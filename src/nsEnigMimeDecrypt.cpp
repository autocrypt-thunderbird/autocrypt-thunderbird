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

#include "nspr.h"
#include "nsCOMPtr.h"
#include "nsString.h"
#include "nsXPIDLString.h"
#include "nsNetUtil.h"
#include "nsIPrompt.h"
#include "nsIMsgWindow.h"
#include "nsMsgBaseCID.h"
#include "nsIMsgMailSession.h"
#include "nsIMimeMiscStatus.h"
#include "nsIEnigMimeHeaderSink.h"
#include "nsIThread.h"
#include "nsEnigMimeDecrypt.h"
#include "nsIPipeTransport.h"
#include "nsIIPCBuffer.h"
#include "nsIEnigmail.h"

#ifdef PR_LOGGING
PRLogModuleInfo* gEnigMimeDecryptLog = NULL;
#endif

#define ERROR_LOG(args)    PR_LOG(gEnigMimeDecryptLog,PR_LOG_ERROR,args)
#define WARNING_LOG(args)  PR_LOG(gEnigMimeDecryptLog,PR_LOG_WARNING,args)
#define DEBUG_LOG(args)    PR_LOG(gEnigMimeDecryptLog,PR_LOG_DEBUG,args)

#define MAX_BUFFER_BYTES 32768
static const PRUint32 kCharMax = 1024;

// nsEnigMimeDecrypt implementation

// nsISupports implementation
NS_IMPL_THREADSAFE_ISUPPORTS1(nsEnigMimeDecrypt,
                              nsIEnigMimeDecrypt);

// nsEnigMimeDecrypt implementation
nsEnigMimeDecrypt::nsEnigMimeDecrypt()
  : mInitialized(PR_FALSE),
    mVerifyOnly(PR_FALSE),
    mRfc2015(PR_FALSE),

    mInputLen(0),
    mOutputLen(0),

    mBuffer(nsnull),
    mListener(nsnull),
    mPipeTrans(nsnull)
{
  nsresult rv;

  NS_INIT_ISUPPORTS();

#ifdef PR_LOGGING
  if (gEnigMimeDecryptLog == nsnull) {
    gEnigMimeDecryptLog = PR_NewLogModule("nsEnigMimeDecrypt");
  }
#endif

#ifdef FORCE_PR_LOG
  nsCOMPtr<nsIThread> myThread;
  rv = nsIThread::GetCurrent(getter_AddRefs(myThread));
  DEBUG_LOG(("nsEnigMimeDecrypt:: <<<<<<<<< CTOR(%x): myThread=%x\n",
         (int) this, (int) myThread.get()));
#endif
}


nsEnigMimeDecrypt::~nsEnigMimeDecrypt()
{
  nsresult rv;
#ifdef FORCE_PR_LOG
  nsCOMPtr<nsIThread> myThread;
  rv = nsIThread::GetCurrent(getter_AddRefs(myThread));
  DEBUG_LOG(("nsEnigMimeDecrypt:: >>>>>>>>> DTOR(%x): myThread=%x\n",
         (int) this, (int) myThread.get()));
#endif

  Finalize();
}


///////////////////////////////////////////////////////////////////////////////
// nsIEnigMimeDecrypt methods:
///////////////////////////////////////////////////////////////////////////////

NS_IMETHODIMP
nsEnigMimeDecrypt::Init(PRBool verifyOnly,
                        PRBool rfc2015,
                        EnigDecryptCallbackFun outputFun,
                        void* outputClosure)
{
  nsresult rv;

  if (!outputFun || !outputClosure)
    return NS_ERROR_NULL_POINTER;

  mVerifyOnly = verifyOnly;
  mRfc2015 = rfc2015;

  mOutputFun     = outputFun;
  mOutputClosure = outputClosure;

  mBuffer = do_CreateInstance(NS_IPCBUFFER_CONTRACTID, &rv);
  if (NS_FAILED(rv)) return rv;

  // Prepare to copy data to buffer, with temp file overflow
  rv = mBuffer->Open(MAX_BUFFER_BYTES, PR_TRUE);
  if (NS_FAILED(rv)) return rv;

  if (mRfc2015) {
    // RFC 2015: Create PipeFilterListener to extract second MIME part
    mListener = do_CreateInstance(NS_PIPEFILTERLISTENER_CONTRACTID, &rv);
    if (NS_FAILED(rv)) return rv;

    rv = mListener->Init(NS_STATIC_CAST(nsIStreamListener*, mBuffer),
                         nsnull, "", "", 1, PR_FALSE, PR_TRUE, nsnull);
    if (NS_FAILED(rv)) return rv;
  }

  mInitialized = PR_TRUE;

  return NS_OK;
}


nsresult
nsEnigMimeDecrypt::Finalize()
{
  DEBUG_LOG(("nsEnigMimeDecrypt::Finalize:\n"));

  mOutputFun = NULL;
  mOutputClosure = NULL;

  if (mPipeTrans) {
    mPipeTrans->Terminate();
    mPipeTrans = nsnull;
  }

  if (mListener) {
    mListener = nsnull;
  }

  if (mBuffer) {
    mBuffer->Shutdown();
    mBuffer = nsnull;
  }

  return NS_OK;
}

NS_IMETHODIMP
nsEnigMimeDecrypt::Write(const char *buf, PRUint32 buf_size)

{
  if (!mInitialized)
    return NS_ERROR_NOT_INITIALIZED;

  if (mListener)
    mListener->Write(buf, buf_size, nsnull, nsnull);
  else
    mBuffer->WriteBuf(buf, buf_size);

  mInputLen += buf_size;

  return NS_OK;
}


NS_IMETHODIMP
nsEnigMimeDecrypt::Finish(nsIMsgWindow* msgWindow, nsIURI* uri)
{
  // Enigmail stuff
  nsresult rv;

  DEBUG_LOG(("nsEnigMimeDecrypt::Finish:\n"));

  if (!mInitialized)
    return NS_ERROR_NOT_INITIALIZED;

  rv = FinishAux(msgWindow, uri);
  if (NS_FAILED(rv)) {
    Finalize();
    return rv;
  }

  return NS_OK;
}


nsresult
nsEnigMimeDecrypt::FinishAux(nsIMsgWindow* msgWindow, nsIURI* uri)
{
  // Enigmail stuff
  nsresult rv;

  nsCAutoString uriSpec("");

  if (mListener) {
    rv = mListener->OnStopRequest(nsnull, nsnull, 0);
    if (NS_FAILED(rv))
      return rv;

    nsCAutoString endLine;
    rv = mListener->GetEndLine(endLine);
    if (NS_FAILED(rv)) return rv;

    if (endLine.IsEmpty()) {
      ERROR_LOG(("nsEnigMimeDecrypt::FinishAux: ERROR MIME part not terminated\n"));
      return NS_ERROR_FAILURE;
    }

    mListener = nsnull;
  }

  rv = mBuffer->OnStopRequest(nsnull, nsnull, 0);
  if (NS_FAILED(rv))
    return rv;

  nsCOMPtr<nsISupports> securityInfo;
  if (msgWindow) {
    nsCOMPtr<nsIMsgHeaderSink> headerSink;
    msgWindow->GetMsgHeaderSink(getter_AddRefs(headerSink));
    if (headerSink)
        headerSink->GetSecurityInfo(getter_AddRefs(securityInfo));
  }
  DEBUG_LOG(("nsEnigMimeDecrypt::FinishAux: securityInfo=%x\n", securityInfo.get()));

  nsCOMPtr<nsIPrompt> prompter;
  if (msgWindow) {
    msgWindow->GetPromptDialog(getter_AddRefs(prompter));
  }

  if (!prompter) {
    nsCOMPtr <nsIMsgMailSession> mailSession (do_GetService(NS_MSGMAILSESSION_CONTRACTID));
    if (mailSession) {
      nsCOMPtr<nsIMsgWindow> msgwin;
      mailSession->GetTopmostMsgWindow(getter_AddRefs(msgwin));
      if (msgwin)
        msgwin->GetPromptDialog(getter_AddRefs(prompter));
    }
  }

  DEBUG_LOG(("nsEnigMimeDecrypt::FinishAux: prompter=%x\n", prompter.get()));

  nsCOMPtr<nsIEnigmail> enigmailSvc = do_GetService(NS_ENIGMAIL_CONTRACTID, &rv);
  if (NS_FAILED(rv))
    return rv;

  nsXPIDLString errorMsg;
  PRBool noOutput = PR_FALSE;
  PRBool noProxy = PR_FALSE;

  rv = enigmailSvc->DecryptMessageStart(nsnull,
                                        prompter,
                                        mVerifyOnly,
                                        noOutput,
                                        nsnull,
                                        noProxy,
                                        getter_Copies(errorMsg),
                                        getter_AddRefs(mPipeTrans) );
  if (NS_FAILED(rv)) return rv;

  if (!mPipeTrans) {
    if (securityInfo) {
      nsCOMPtr<nsIEnigMimeHeaderSink> enigHeaderSink = do_QueryInterface(securityInfo);
      if (enigHeaderSink) {
        NS_NAMED_LITERAL_STRING(nullString, "");
        rv = enigHeaderSink->UpdateSecurityStatus(uriSpec, -1, 0, nullString.get(), nullString.get(), errorMsg);
      }
    }

    return NS_ERROR_FAILURE;
  }

  nsCOMPtr<nsIInputStream> plainStream;
  rv = mPipeTrans->OpenInputStream(0, PRUint32(-1), 0,
                                  getter_AddRefs(plainStream));
  if (NS_FAILED(rv)) return rv;

  // Write buffered data asyncronously to process
  nsCOMPtr<nsIInputStream> bufStream;
  rv = mBuffer->OpenInputStream(getter_AddRefs(bufStream));
  if (NS_FAILED(rv)) return rv;

  PRUint32 available;
  rv = bufStream->Available(&available);
  if (NS_FAILED(rv)) return rv;

  DEBUG_LOG(("nsEnigMimeDecrypt::FinishAux: available=%d\n", available));

  rv = mPipeTrans->WriteAsync(bufStream, available, PR_TRUE);
  if (NS_FAILED(rv)) return rv;

  PRUint32 readCount;
  char buf[kCharMax];
  while (1) {
    // Read synchronously

    rv = plainStream->Read((char *) buf, kCharMax, &readCount);
    if (NS_FAILED(rv)) return rv;

    if (!readCount) break;

    if (readCount < kCharMax) {
      // make sure we can continue to write later
      if (buf[readCount-1]==0) --readCount;
    }

    PR_SetError(0,0);
    int status = mOutputFun(buf, readCount, mOutputClosure);
    if (status < 0) {
      PR_SetError(status, 0);
      mOutputFun = NULL;
      mOutputClosure = NULL;

      return NS_ERROR_FAILURE;
    }

    mOutputLen += readCount;
  }

  // add final \n to make sure last line is always displayed (bug 5952)
  buf[0]='\n';
  PR_SetError(0,0);
  int status = mOutputFun(buf, 1, mOutputClosure);
  if (status >= 0) {
    // ignore any errors here
    mOutputLen++;
  }
  PR_SetError(0,0);

  // Close input stream
  plainStream->Close();

  // Close buffer
  mBuffer->Shutdown();

  PRInt32 exitCode;
  PRUint32 statusFlags;
  nsXPIDLString keyId;
  nsXPIDLString userId;

  PRUint32 uiFlags = nsIEnigmail::UI_PGP_MIME;

  rv = enigmailSvc->DecryptMessageEnd(uiFlags,
                                      mOutputLen,
                                      mPipeTrans,
                                      mVerifyOnly,
                                      noOutput,
                                      &statusFlags,
                                      getter_Copies(keyId),
                                      getter_Copies(userId),
                                      getter_Copies(errorMsg),
                                      &exitCode);
  if (NS_FAILED(rv)) return rv;

  if (securityInfo) {
    nsCOMPtr<nsIEnigMimeHeaderSink> enigHeaderSink = do_QueryInterface(securityInfo);
    if (enigHeaderSink) {
      rv = enigHeaderSink->UpdateSecurityStatus(uriSpec, exitCode, statusFlags, keyId, userId, errorMsg);
    }
  }

  if (exitCode != 0) {
    DEBUG_LOG(("nsEnigMimeDecrypt::FinishAux: ERROR EXIT %d\n", exitCode));
    return NS_ERROR_FAILURE;
  }

  return NS_OK;
}
