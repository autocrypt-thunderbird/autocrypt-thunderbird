/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License
 * Version 1.1 (the "MPL"); you may not use this file except in
 * compliance with the MPL. You may obtain a copy of the MPL at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the MPL is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the MPL
 * for the specific language governing rights and limitations under the
 * MPL.
 *
 * The Original Code is Enigmail.
 *
 * The Initial Developer of the Original Code is
 * Ramalingam Saravanan <sarava@sarava.net>
 * Portions created by the Initial Developer are Copyright (C) 2002
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or 
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

// Logging of debug output 
// The following define statement should occur before any include statements
#define FORCE_PR_LOG       /* Allow logging even in release build */

#include "nsXPIDLString.h"
#include "nsIIPCBuffer.h"
#include "nsIMsgCompFields.h"
#include "nsIEnigMsgCompFields.h"
#include "nsEnigMsgCompose.h"
#include "nspr.h"
#include "nsCOMPtr.h"
#include "nsString.h"
#include "nsIPrompt.h"
#include "nsNetUtil.h"
#include "nsFileStream.h"
#include "nsIThread.h"
#include "nsIFactory.h"

#ifdef PR_LOGGING
PRLogModuleInfo* gEnigMsgComposeLog = NULL;
#endif

#define ERROR_LOG(args)    PR_LOG(gEnigMsgComposeLog,PR_LOG_ERROR,args)
#define WARNING_LOG(args)  PR_LOG(gEnigMsgComposeLog,PR_LOG_WARNING,args)
#define DEBUG_LOG(args)    PR_LOG(gEnigMsgComposeLog,PR_LOG_DEBUG,args)

#define NS_MSGCOMPOSESECURE_CID                    \
{ /* dd753201-9a23-4e08-957f-b3616bf7e012 */       \
   0xdd753201, 0x9a23, 0x4e08,                     \
  {0x95, 0x7f, 0xb3, 0x61, 0x6b, 0xf7, 0xe0, 0x12 }}

#define MAX_HEADER_BYTES 16000

static const PRUint32 kCharMax = 1024;

static NS_DEFINE_CID(kMsgComposeSecureCID, NS_MSGCOMPOSESECURE_CID);

// nsEnigMsgComposeFactory implementation

NS_IMPL_ISUPPORTS1(nsEnigMsgComposeFactory, nsIFactory)

nsEnigMsgComposeFactory::nsEnigMsgComposeFactory() {

  NS_INIT_ISUPPORTS();
}

nsEnigMsgComposeFactory::~nsEnigMsgComposeFactory() {
}

NS_IMETHODIMP
nsEnigMsgComposeFactory::CreateInstance(nsISupports *aOuter,
                                        const nsIID & aIID,
                                        void **aResult)
{
  NS_ENSURE_ARG_POINTER(aResult);
  
  *aResult = NULL;  
  nsEnigMsgCompose *instance = new nsEnigMsgCompose;    
  if (!instance)
    return NS_ERROR_OUT_OF_MEMORY;
    
  nsresult rv = instance->QueryInterface(aIID, aResult);
  if (rv != NS_OK) {  
    delete instance;  
  }  
    
  return rv;
}

NS_IMETHODIMP nsEnigMsgComposeFactory::LockFactory(PRBool lock)
{
  return NS_OK;
}


// nsEnigMsgCompose implementation

const char* nsEnigMsgCompose::EncryptionHeaders =
 "Content-Type: application/pgp\r\n"
 "\r\n";

// nsISupports implementation
NS_IMPL_THREADSAFE_ISUPPORTS3(nsEnigMsgCompose,
                              nsIMsgComposeSecure,
                              nsIRequestObserver,
                              nsIStreamListener);

// nsEnigMsgCompose implementation
nsEnigMsgCompose::nsEnigMsgCompose()
  : mInitialized(PR_FALSE),
    mUseSMIME(PR_FALSE),
    mIsDraft(PR_FALSE),
    mRequestStopped(PR_FALSE),

    mInputLen(0),
    mOutputLen(0),

    mSendFlags(0),
    mUIFlags(0),

    mSenderEmailAddr(""),
    mRecipients(""),

    mStream(0),

    mMsgComposeSecure(nsnull),
    mMimeListener(nsnull),

    mOutBuffer(nsnull),
    mPipeTrans(nsnull),
    mPipeTransListener(nsnull)
{
  nsresult rv;

  NS_INIT_REFCNT();

#ifdef PR_LOGGING
  if (gEnigMsgComposeLog == nsnull) {
    gEnigMsgComposeLog = PR_NewLogModule("nsEnigMsgCompose");
  }
#endif

  mMsgComposeSecure = do_CreateInstance(kMsgComposeSecureCID, &rv);

#ifdef FORCE_PR_LOG
  nsCOMPtr<nsIThread> myThread;
  rv = nsIThread::GetCurrent(getter_AddRefs(myThread));
  DEBUG_LOG(("nsEnigMsgCompose:: <<<<<<<<< CTOR(%x): myThread=%x\n",
         (int) this, (int) myThread.get()));
#endif
}


nsEnigMsgCompose::~nsEnigMsgCompose()
{
  nsresult rv;
#ifdef FORCE_PR_LOG
  nsCOMPtr<nsIThread> myThread;
  rv = nsIThread::GetCurrent(getter_AddRefs(myThread));
  DEBUG_LOG(("nsEnigMsgCompose:: >>>>>>>>> DTOR(%x): myThread=%x\n",
         (int) this, (int) myThread.get()));
#endif

  Finalize();

}

nsresult
nsEnigMsgCompose::Finalize()
{
  DEBUG_LOG(("nsEnigMsgCompose::Finalize:\n"));

  mMsgComposeSecure = nsnull;
  mMimeListener = nsnull;

  if (mPipeTrans) {
    mPipeTrans->Terminate();
    mPipeTrans = nsnull;
    mPipeTransListener = nsnull;
  }

  if (mOutBuffer) {
    mOutBuffer->Shutdown();
    mOutBuffer = nsnull;
  }

  return NS_OK;
}


///////////////////////////////////////////////////////////////////////////////
// nsIMsgComposeSecure methods:
///////////////////////////////////////////////////////////////////////////////

NS_IMETHODIMP
nsEnigMsgCompose::RequiresCryptoEncapsulation(
                                        nsIMsgIdentity* aIdentity,
                                        nsIMsgCompFields* aCompFields,
                                        PRBool* aRequiresEncryptionWork)
{
  nsresult rv;
  DEBUG_LOG(("nsEnigMsgCompose::RequiresCryptoEncapsulation: \n"));

  if (!mMsgComposeSecure)
    return NS_ERROR_FAILURE;

  rv = mMsgComposeSecure->RequiresCryptoEncapsulation(aIdentity,
                                                      aCompFields,
                                                      &mUseSMIME);
  if (NS_FAILED(rv))
    return rv;

  if (mUseSMIME) {
    DEBUG_LOG(("nsEnigMsgCompose::RequiresCryptoEncapsulation: Using SMIME\n"));
   *aRequiresEncryptionWork = PR_TRUE;
   return NS_OK;
  }

  // Enigmail stuff
  nsCOMPtr<nsISupports> securityInfo;

  rv = aCompFields->GetSecurityInfo(getter_AddRefs(securityInfo));
  if (NS_FAILED(rv))
    return rv;

  if (!securityInfo) {
    *aRequiresEncryptionWork = PR_FALSE;
    return NS_OK;
  }

  nsCOMPtr<nsIEnigMsgCompFields> enigSecurityInfo = do_QueryInterface(securityInfo);

  if (enigSecurityInfo) {
    PRUint32 sendFlags;
    rv = enigSecurityInfo->GetSendFlags(&sendFlags);
    if (NS_FAILED(rv))
      return rv;

    DEBUG_LOG(("nsEnigMsgCompose::RequiresCryptoEncapsulation: sendFlags=%x\n", sendFlags));

    *aRequiresEncryptionWork = sendFlags &
      (nsIEnigmail::SEND_SIGNED | nsIEnigmail::SEND_ENCRYPTED);

  } else {
    *aRequiresEncryptionWork = PR_FALSE;
  }

  return NS_OK;
}

NS_IMETHODIMP
nsEnigMsgCompose::BeginCryptoEncapsulation(
                                        nsOutputFileStream* aStream,
                                        const char* aRecipients,
                                        nsIMsgCompFields* aCompFields,
                                        nsIMsgIdentity* aIdentity,
                                        nsIMsgSendReport* sendReport,
                                        PRBool aIsDraft)
{
  nsresult rv;

  DEBUG_LOG(("nsEnigMsgCompose::BeginCryptoEncapsulation: %s\n", aRecipients));
  if (mUseSMIME) {
    return mMsgComposeSecure->BeginCryptoEncapsulation(aStream, aRecipients,
                                                       aCompFields, aIdentity,
                                                       sendReport, aIsDraft);
  }

  if (!aStream)
    return NS_ERROR_NULL_POINTER;

  // Enigmail stuff
  mStream = aStream;
  mIsDraft = aIsDraft;

  nsCOMPtr<nsISupports> securityInfo;

  rv = aCompFields->GetSecurityInfo(getter_AddRefs(securityInfo));
  if (NS_FAILED(rv))
    return rv;

  if (!securityInfo)
    return NS_ERROR_FAILURE;

  nsCOMPtr<nsIEnigMsgCompFields> enigSecurityInfo = do_QueryInterface(securityInfo);

  if (!enigSecurityInfo)
    return NS_ERROR_FAILURE;

  rv = enigSecurityInfo->GetSendFlags(&mSendFlags);
  if (NS_FAILED(rv))
      return rv;

  rv = enigSecurityInfo->GetSendFlags(&mUIFlags);
  if (NS_FAILED(rv))
      return rv;

  rv = enigSecurityInfo->GetSenderEmailAddr(mSenderEmailAddr);
  if (NS_FAILED(rv))
      return rv;

  nsXPIDLString toField;
  rv = aCompFields->GetTo(getter_Copies(toField));
  if (NS_FAILED(rv))
      return rv;

  mRecipients.AssignWithConversion(toField);

  DEBUG_LOG(("nsEnigMsgCompose::BeginCryptoEncapsulation: sendFlags=%x\n", mSendFlags));

  mOutBuffer = do_CreateInstance(NS_IPCBUFFER_CONTRACTID, &rv);
  if (NS_FAILED(rv)) return rv;

  // Prepare to copy data via IPCBuffer to output file stream
  rv = mOutBuffer->Open(0, PR_FALSE);
  if (NS_FAILED(rv)) return rv;

  rv = mOutBuffer->SetOutputFileStream(mStream);
  if (NS_FAILED(rv)) return rv;

  nsCOMPtr<nsIEnigmail> enigmailSvc = do_GetService(NS_ENIGMAIL_CONTRACTID, &rv);
  if (NS_FAILED(rv)) return rv;

  nsXPIDLCString errorMsg;
  PRBool noProxy = PR_TRUE;
  rv = enigmailSvc->EncryptMessageStart((nsIPrompt*) nsnull,
                                        mUIFlags,
                                        mSenderEmailAddr.get(),
                                        mRecipients.get(),
                                        mSendFlags,
                NS_STATIC_CAST(nsIStreamListener*, mOutBuffer),
                                        noProxy,
                                        getter_Copies(errorMsg),
                                        getter_AddRefs(mPipeTrans) );
  if (NS_FAILED(rv))
    return rv;

  if (!mPipeTrans)
    return NS_ERROR_FAILURE;

  if (!(mSendFlags & nsIEnigmail::SEND_PGP_MIME)) {
    // Create listener to intercept MIME headers
    mMimeListener = do_CreateInstance(NS_ENIGMIMELISTENER_CONTRACTID, &rv);
    if (NS_FAILED(rv)) return rv;

    rv = mMimeListener->Init((nsIStreamListener*) this, nsnull,
                             MAX_HEADER_BYTES, PR_TRUE, PR_FALSE);
    if (NS_FAILED(rv)) return rv;

    // Get StreamListener to write synchronously to pipeTransport
    rv = mPipeTrans->GetListener(getter_AddRefs(mPipeTransListener));
    if (NS_FAILED(rv)) return rv;
  }

  mInitialized = PR_TRUE;

  return NS_OK;
}

NS_IMETHODIMP
nsEnigMsgCompose::FinishCryptoEncapsulation(PRBool aAbort,
                                            nsIMsgSendReport* sendReport)
{
  nsresult rv;

  DEBUG_LOG(("nsEnigMsgCompose::FinishCryptoEncapsulation: \n"));
  if (mUseSMIME) {
    return mMsgComposeSecure->FinishCryptoEncapsulation(aAbort, sendReport);
  }

  // Enigmail stuff
  if (!mInitialized || !mPipeTrans)
    return NS_ERROR_NOT_INITIALIZED;

  rv = FinishAux(aAbort, sendReport);
  if (NS_FAILED(rv)) {
    Finalize();
    return rv;
  }

  return NS_OK;
}

nsresult
nsEnigMsgCompose::FinishAux(PRBool aAbort,
                            nsIMsgSendReport* sendReport)
{
  nsresult rv;

  DEBUG_LOG(("nsEnigMsgCompose::FinishAux: \n"));

  // Wait for STDOUT to close
  rv = mPipeTrans->Join();
  if (NS_FAILED(rv)) return rv;

  if (aAbort)
    return NS_ERROR_FAILURE;

  PRInt32 exitCode;
  rv = mPipeTrans->ExitCode(&exitCode);
  if (NS_FAILED(rv)) return rv;

  DEBUG_LOG(("nsEnigMsgCompose::FinishAux: exitCode=%d\n", exitCode));

  // Count STDOUT bytes
  rv = mOutBuffer->GetTotalBytes(&mOutputLen);
  if (NS_FAILED(rv)) return rv;

  // Shutdown STDOUT buffer
  mOutBuffer->Shutdown();
  mOutBuffer = nsnull;

  // Extract STDERR output
  nsCOMPtr<nsIPipeListener> errListener;
  rv = mPipeTrans->GetConsole(getter_AddRefs(errListener));
  if (NS_FAILED(rv)) return rv;

  if (!errListener)
    return NS_ERROR_FAILURE;

  PRUint32 errorCount;
  nsXPIDLCString errorOutput;
  rv = errListener->GetByteData(&errorCount, getter_Copies(errorOutput));
  if (NS_FAILED(rv)) return rv;

  // Shutdown STDERR console
  errListener->Shutdown();

  // Terminate process
  mPipeTrans->Terminate();
  mPipeTrans = nsnull;

  nsCOMPtr<nsIEnigmail> enigmailSvc = do_GetService(NS_ENIGMAIL_CONTRACTID, &rv);
  if (NS_FAILED(rv)) return rv;

  PRInt32 newExitCode;
  PRUint32 statusFlags;
  nsXPIDLCString errorMsg;
  rv = enigmailSvc->EncryptMessageEnd(mSendFlags,
                                      exitCode,
                                      mOutputLen,
                                      errorOutput,
                                      &statusFlags,
                                      getter_Copies(errorMsg),
                                      &newExitCode);
  if (NS_FAILED(rv)) return rv;

  if (newExitCode != 0) {
    DEBUG_LOG(("nsEnigMsgCompose::FinishAux: ERROR EXIT %d\n", newExitCode));
    return NS_ERROR_FAILURE;
  }

  return NS_OK;
}


NS_IMETHODIMP
nsEnigMsgCompose::MimeCryptoWriteBlock(const char *aBuf, PRInt32 aLen)
{
  DEBUG_LOG(("nsEnigMsgCompose::MimeCryptoWriteBlock: \n"));

  if (mUseSMIME) {
    return mMsgComposeSecure->MimeCryptoWriteBlock(aBuf, aLen);
  }

  // Enigmail stuff
  nsCAutoString temStr(aBuf, aLen);
  DEBUG_LOG(("nsEnigMsgCompose::MimeCryptoWriteBlock: aBuf='%s'\n",
             temStr.get()));

  if (!mInitialized)
    return NS_ERROR_NOT_INITIALIZED;

  if (aLen <= 0)
    return NS_OK;

  mInputLen += aLen;

  if (mMimeListener) {
    mMimeListener->Write(aBuf, aLen, nsnull, nsnull);

  } else if (mPipeTrans) {
    mPipeTrans->WriteSync(aBuf, aLen);
  }

  return NS_OK;
}

///////////////////////////////////////////////////////////////////////////////
// nsIRequestObserver methods
///////////////////////////////////////////////////////////////////////////////

NS_IMETHODIMP
nsEnigMsgCompose::OnStartRequest(nsIRequest *aRequest,
                                   nsISupports *aContext)
{
  nsresult rv;
  DEBUG_LOG(("nsEnigMsgCompose::OnStartRequest:\n"));

  if (!mInitialized || !mPipeTransListener)
    return NS_ERROR_NOT_INITIALIZED;

  rv = mPipeTransListener->OnStartRequest(aRequest, aContext);
  if (NS_FAILED(rv)) return rv;

  if (mMimeListener) {
    nsCAutoString contentType;
    rv = mMimeListener->GetContentType(contentType);
    if (NS_FAILED(rv)) return rv;

    nsCAutoString headers;
    rv = mMimeListener->GetHeaders(headers);
    if (NS_FAILED(rv)) return rv;

    if (headers.IsEmpty())
        return NS_ERROR_FAILURE;

    DEBUG_LOG(("nsEnigMsgCompose::OnStartRequest: Content-Type: %s\n", headers.get()));

    if (contentType.Equals("text/plain")) {
      // No crypto encapsulation for headers
      DEBUG_LOG(("nsEnigMsgCompose::OnStartRequest: NO CRYPTO ENCAPSULATION\n"));
      PRInt32 status = mStream->write(headers.get(), headers.Length());
      if (status < int(headers.Length()))
        return NS_ERROR_FAILURE;

    } else {
      // Crypto encapsulation for headers
      mStream->write(EncryptionHeaders, nsCRT::strlen(EncryptionHeaders));
      mPipeTrans->WriteSync(headers.get(), headers.Length());
    }

  } else {
    // Emit RFC 2015 headers
    mStream->write(EncryptionHeaders, nsCRT::strlen(EncryptionHeaders));
  }

  return NS_OK;
}

NS_IMETHODIMP
nsEnigMsgCompose::OnStopRequest(nsIRequest* aRequest,
                                  nsISupports* aContext,
                                  nsresult aStatus)
{
  nsresult rv;
  DEBUG_LOG(("nsEnigMsgCompose::OnStopRequest:\n"));

  if (!mInitialized || !mPipeTransListener)
    return NS_ERROR_NOT_INITIALIZED;

  mRequestStopped = PR_TRUE;

  rv = mPipeTransListener->OnStopRequest(aRequest, aContext, aStatus);
  if (NS_FAILED(rv)) return rv;

  return NS_OK;
}

///////////////////////////////////////////////////////////////////////////////
// nsIStreamListener method
///////////////////////////////////////////////////////////////////////////////

NS_IMETHODIMP
nsEnigMsgCompose::OnDataAvailable(nsIRequest* aRequest,
                                  nsISupports* aContext,
                                  nsIInputStream *aInputStream,
                                  PRUint32 aSourceOffset,
                                  PRUint32 aLength)
{
  nsresult rv;

  DEBUG_LOG(("nsEnigMsgCompose::OnDataAVailable: %d\n", aLength));

  if (!mInitialized || !mPipeTransListener)
    return NS_ERROR_NOT_INITIALIZED;

  rv = mPipeTransListener->OnDataAvailable(aRequest, aContext, aInputStream,
                                           aSourceOffset, aLength);

  if (NS_FAILED(rv)) return rv;

  return NS_OK;
}
