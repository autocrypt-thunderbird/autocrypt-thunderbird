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
 * Patrick Brunschwig <patrick.brunschwig@gmx.net>
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

#include "enigmail.h"
#include "nsXPIDLString.h"
#include "nsIMsgCompFields.h"
#include "nsMsgBaseCID.h"
#include "nsMsgCompCID.h"
#include "nsIMsgMailSession.h"
#include "nsIIPCService.h"
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
#undef MOZILLA_INTERNAL_API

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

static NS_DEFINE_CID(kMsgComposeSecureCID, NS_MSGCOMPOSESECURE_CID);

#define MAX_HEADER_BYTES 16000
#define MAX_SIGNATURE_BYTES 16000

static const PRUint32 kCharMax = 1024;

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

const char* nsEnigMsgCompose::FromStr = "From ";
PRBool nsEnigMsgCompose::mRandomSeeded = PR_FALSE;

// nsISupports implementation
NS_IMPL_THREADSAFE_ISUPPORTS3(nsEnigMsgCompose,
                              nsIMsgComposeSecure,
                              nsIRequestObserver,
                              nsIStreamListener)

// nsEnigMsgCompose implementation
nsEnigMsgCompose::nsEnigMsgCompose()
  : mInitialized(PR_FALSE),
    mUseSMIME(PR_FALSE),
    mIsDraft(PR_FALSE),
    mRequestStopped(PR_FALSE),

    mLinebreak(PR_TRUE),
    mSpace(0),
    mMatchFrom(0),

    mInputLen(0),
    mOutputLen(0),

    mSendFlags(0),
    mUIFlags(0),

    mMultipartSigned(PR_FALSE),
    mStripWhitespace(PR_FALSE),

    mSenderEmailAddr(""),
    mRecipients(""),
    mHashAlgorithm("sha1"),

    mBoundary(""),

    mStream(0),

    mEncoderData(nsnull),

    mMsgComposeSecure(nsnull),
    mMimeListener(nsnull),

    mWriter(nsnull),
    mPipeTrans(nsnull)
{
  nsresult rv;

  NS_INIT_ISUPPORTS();

#ifdef PR_LOGGING
  if (gEnigMsgComposeLog == nsnull) {
    gEnigMsgComposeLog = PR_NewLogModule("nsEnigMsgCompose");
  }
#endif

  // Remember to use original CID, not CONTRACTID, to avoid infinite looping!
  mMsgComposeSecure = do_CreateInstance(kMsgComposeSecureCID, &rv);

#ifdef FORCE_PR_LOG
  nsCOMPtr<nsIThread> myThread;
  rv = ENIG_GET_THREAD(myThread);
  DEBUG_LOG(("nsEnigMsgCompose:: <<<<<<<<< CTOR(%p): myThread=%p\n",
         this, myThread.get()));
#endif
}


nsEnigMsgCompose::~nsEnigMsgCompose()
{
  nsresult rv;
#ifdef FORCE_PR_LOG
  nsCOMPtr<nsIThread> myThread;
  rv = ENIG_GET_THREAD(myThread);
  DEBUG_LOG(("nsEnigMsgCompose:: >>>>>>>>> DTOR(%p): myThread=%p\n",
         this, myThread.get()));
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
  }

  if (mWriter) {
    mWriter->Close();
    mWriter = nsnull;
  }

  if (mEncoderData) {
    // Clear encoder buffer
    MimeEncoderDestroy(mEncoderData, PR_FALSE);
    mEncoderData = nsnull;
  }

  return NS_OK;
}


nsresult
nsEnigMsgCompose::GetRandomTime(PRUint32 *_retval)
{
  if (!*_retval)
    return NS_ERROR_NULL_POINTER;

  // Current local time (microsecond resolution)
  PRExplodedTime localTime;
  PR_ExplodeTime(PR_Now(), PR_LocalTimeParameters, &localTime);

  PRUint32       randomNumberA = localTime.tm_sec*1000000+localTime.tm_usec;

  // Elapsed time (1 millisecond to 10 microsecond resolution)
  PRIntervalTime randomNumberB = PR_IntervalNow();

  DEBUG_LOG(("nsEnigMsgCompose::GetRandomTime: ranA=0x%p, ranB=0x%p\n",
                                           randomNumberA, randomNumberB));

  *_retval = ((randomNumberA & 0xFFFFF) << 12) | (randomNumberB & 0xFFF);

  return NS_OK;
}

nsresult
nsEnigMsgCompose::MakeBoundary(const char *prefix)
{
  DEBUG_LOG(("nsEnigMsgCompose::MakeBoundary:\n"));

  nsresult rv;

  if (!mRandomSeeded) {
    PRUint32 ranTime = 1;

    rv = GetRandomTime(&ranTime);
    if (NS_FAILED(rv))
      return rv;

    srand( ranTime );
    mRandomSeeded = PR_TRUE;
  }


  unsigned char ch[13];
  for( PRUint32 j = 0; j < 12; j++)
    ch[j] = rand() % 256;

  char* boundary = PR_smprintf("------------%s"
           "%02X%02X%02X%02X"
           "%02X%02X%02X%02X"
           "%02X%02X%02X%02X",
           prefix,
           ch[0], ch[1], ch[2], ch[3],
           ch[4], ch[5], ch[6], ch[7],
           ch[8], ch[9], ch[10], ch[11]);

  if (!boundary)
    return NS_ERROR_OUT_OF_MEMORY;

  DEBUG_LOG(("nsEnigMsgCompose::MakeBoundary: boundary='%s'\n",
         boundary));


  mBoundary = boundary;

  PR_Free(boundary);

  return NS_OK;
}

nsresult
nsEnigMsgCompose::WriteEncryptedHeaders()
{
  nsresult rv;
  DEBUG_LOG(("nsEnigMsgCompose::WriteEncryptedHeaders:\n"));

  rv = MakeBoundary("enig");
  if (NS_FAILED(rv))
    return rv;

  char* headers = PR_smprintf(
 "Content-Type: multipart/encrypted;\r\n"
 " protocol=\"application/pgp-encrypted\";\r\n"
 " boundary=\"%s\"\r\n"
 "\r\n"
 "This is an OpenPGP/MIME encrypted message (RFC 2440 and 3156)\r\n"
 "--%s\r\n"
 "Content-Type: application/pgp-encrypted\r\n"
 "Content-Description: PGP/MIME version identification\r\n"
 "\r\n"
 "Version: 1\r\n"
 "\r\n"
 "--%s\r\n"
 "Content-Type: application/octet-stream; name=\"encrypted.asc\"\r\n"
 "Content-Description: OpenPGP encrypted message\r\n"
 "Content-Disposition: inline; filename=\"encrypted.asc\"\r\n"
 "\r\n",
 mBoundary.get(), mBoundary.get(), mBoundary.get());

  if (!headers)
    return NS_ERROR_OUT_OF_MEMORY;

  rv = WriteOut(headers, strlen(headers));

  PR_Free(headers);

  return rv;
}

nsresult
nsEnigMsgCompose::WriteSignedHeaders1(PRBool isEightBit)
{
  nsresult rv;
  DEBUG_LOG(("nsEnigMsgCompose::WriteSignedHeaders1: %d\n", (int) isEightBit));

  rv = MakeBoundary("enig");
  if (NS_FAILED(rv))
    return rv;

  char* headers = PR_smprintf(
       "Content-Type: multipart/signed; micalg=pgp-%s;\r\n"
       " protocol=\"application/pgp-signature\";\r\n"
       " boundary=\"%s\"\r\n"
       "%s"
       "This is an OpenPGP/MIME signed message (RFC 2440 and 3156)\r\n"
       "--%s\r\n",
       mHashAlgorithm.get(), mBoundary.get(),
       isEightBit ? "Content-Transfer-Encoding: 8bit\r\n\r\n" : "\r\n",
       mBoundary.get());

  if (!headers)
    return NS_ERROR_OUT_OF_MEMORY;

  rv = WriteOut(headers, strlen(headers));

  PR_Free(headers);

  return rv;
}

nsresult
nsEnigMsgCompose::WriteSignedHeaders2()
{
  nsresult rv;
  DEBUG_LOG(("nsEnigMsgCompose::WriteSignedHeaders2:\n"));

  char* headers = PR_smprintf(
 "\r\n--%s\r\n"
 "Content-Type: application/pgp-signature; name=\"signature.asc\"\r\n"
 "Content-Description: OpenPGP digital signature\r\n"
 "Content-Disposition: attachment; filename=\"signature.asc\"\r\n"
 "\r\n",
 mBoundary.get());

  if (!headers)
    return NS_ERROR_OUT_OF_MEMORY;

  rv = WriteOut(headers, strlen(headers));

  PR_Free(headers);

  return rv;
}

nsresult
nsEnigMsgCompose::WriteFinalSeparator()
{
  nsresult rv;
  DEBUG_LOG(("nsEnigMsgCompose::WriteSeparator:\n"));

  if (mBoundary.IsEmpty())
    return NS_OK;

  // Write out final MIME multipart separator
  char* separator = PR_smprintf(
 "\r\n--%s--\r\n",
 mBoundary.get());

  if (!separator)
    return NS_ERROR_OUT_OF_MEMORY;

  rv = WriteOut(separator, strlen(separator));

  PR_Free(separator);

  return rv;
}

nsresult
nsEnigMsgCompose::Init()
{
  nsresult rv;

  DEBUG_LOG(("nsEnigMsgCompose::Init: sendFlags=%p\n", mSendFlags));

  PRBool signMsg    = mSendFlags & nsIEnigmail::SEND_SIGNED;
  PRBool encryptMsg = mSendFlags & nsIEnigmail::SEND_ENCRYPTED;
  PRBool usePgpMime = mSendFlags & nsIEnigmail::SEND_PGP_MIME;

  mMultipartSigned = usePgpMime && signMsg && !encryptMsg;

  mWriter = do_CreateInstance(NS_ENIGMIMEWRITER_CONTRACTID, &rv);
  if (NS_FAILED(rv)) return rv;

  rv = mWriter->Init(mStream, PR_TRUE);
  if (NS_FAILED(rv)) return rv;

  nsCOMPtr<nsIPrompt> prompter;
  nsCOMPtr <nsIMsgMailSession> mailSession (do_GetService(NS_MSGMAILSESSION_CONTRACTID));
  if (mailSession) {
    nsCOMPtr<nsIMsgWindow> msgWindow;
    mailSession->GetTopmostMsgWindow(getter_AddRefs(msgWindow));
    if (msgWindow)
      msgWindow->GetPromptDialog(getter_AddRefs(prompter));
  }

  nsCOMPtr<nsIEnigmail> enigmailSvc = do_GetService(NS_ENIGMAIL_CONTRACTID, &rv);
  if (NS_FAILED(rv)) return rv;

  if (usePgpMime && signMsg && (! encryptMsg)) {
    // determine hash algorithm to use for PGP/MIME signed msg
    PRInt32 exitCode;
    PRUnichar* ha;

    rv = enigmailSvc->DetermineHashAlgorithm(prompter,
                                             mUIFlags,
                                             mSenderEmailAddr.get(),
                                             &ha,
                                             &exitCode);

    DEBUG_LOG(("nsEnigMsgCompose::Init: DetermineHash: rv=%d, exitCode=%d\n", rv, exitCode));

    if (NS_FAILED(rv))
      return rv;

    if (exitCode != 0)
      return NS_ERROR_NOT_IMPLEMENTED;

    mHashAlgorithm = NS_ConvertUTF16toUTF8(ha).get();
    DEBUG_LOG(("nsEnigMsgCompose::Init: hashAlgorithm=%s\n", mHashAlgorithm.get()));
  }

  nsXPIDLString errorMsg;
  PRBool noProxy = PR_TRUE;
  rv = enigmailSvc->EncryptMessageStart(nsnull, prompter,
                                        mUIFlags,
                                        mSenderEmailAddr.get(),
                                        mRecipients.get(),
                                        mHashAlgorithm.get(),
                                        mSendFlags,
                                        NS_STATIC_CAST(nsIStreamListener*, mWriter),
                                        noProxy,
                                        getter_Copies(errorMsg),
                                        getter_AddRefs(mPipeTrans) );
  if (NS_FAILED(rv))
    return rv;

  if (!mPipeTrans)
    return NS_OK;

  rv = enigmailSvc->StripWhitespace(mSendFlags,
                                    &mStripWhitespace);
  if (NS_FAILED(rv))
    return rv;

  mInitialized = PR_TRUE;

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

  if (!mMsgComposeSecure) {
    ERROR_LOG(("nsEnigMsgCompose::RequiresCryptoEncapsulation: ERROR MsgComposeSecure not instantiated\n"));
    return NS_ERROR_FAILURE;
  }

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

    DEBUG_LOG(("nsEnigMsgCompose::RequiresCryptoEncapsulation: sendFlags=%p\n", sendFlags));

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

  if (!mMsgComposeSecure) {
    ERROR_LOG(("nsEnigMsgCompose::RequiresCryptoEncapsulation: ERROR MsgComposeSecure not instantiated\n"));
    return NS_ERROR_FAILURE;
  }

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

  rv = enigSecurityInfo->GetUIFlags(&mUIFlags);
  if (NS_FAILED(rv))
      return rv;

  rv = enigSecurityInfo->GetSenderEmailAddr(mSenderEmailAddr);
  if (NS_FAILED(rv))
      return rv;

  rv = enigSecurityInfo->GetRecipients(mRecipients);
  if (NS_FAILED(rv))
      return rv;

  rv = enigSecurityInfo->GetHashAlgorithm(mHashAlgorithm);
  if (NS_FAILED(rv))
      return rv;

  // Create listener to intercept MIME headers
  mMimeListener = do_CreateInstance(NS_ENIGMIMELISTENER_CONTRACTID, &rv);
  if (NS_FAILED(rv)) return rv;

  rv = mMimeListener->Init((nsIStreamListener*) this, nsnull,
                           MAX_HEADER_BYTES, PR_TRUE, PR_FALSE, PR_FALSE);
  if (NS_FAILED(rv)) return rv;

  return NS_OK;
}


NS_IMETHODIMP
nsEnigMsgCompose::FinishCryptoEncapsulation(PRBool aAbort,
                                            nsIMsgSendReport* sendReport)
{
  nsresult rv;

  DEBUG_LOG(("nsEnigMsgCompose::FinishCryptoEncapsulation: \n"));

  if (!mMsgComposeSecure)
    return NS_ERROR_FAILURE;

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

  if (mMatchFrom > 0) {
    // Flush "buffer" for detecting lines beginning with "From "
    rv = WriteCopy(FromStr, mMatchFrom);
    if (NS_FAILED(rv)) return rv;
  }

  DEBUG_LOG(("nsEnigMsgCompose::FinishAux: \n"));

  if (mMultipartSigned) {
    rv = WriteSignedHeaders2();
    if (NS_FAILED(rv)) return rv;
  }

  // Wait for STDOUT to close
  rv = mPipeTrans->Join();
  if (NS_FAILED(rv)) return rv;

  if (aAbort) {
    // Terminate process
    mPipeTrans->Terminate();
    mPipeTrans = nsnull;

    return NS_ERROR_FAILURE;
  }

  rv = WriteFinalSeparator();
  if (NS_FAILED(rv)) return rv;

  // Count total bytes sent to writer
  PRUint32 cmdOutputLen;
  rv = mWriter->GetBytesWritten(&cmdOutputLen);
  if (NS_FAILED(rv)) return rv;

  // Exclude passthru bytes to determine STDOUT bytes
  cmdOutputLen -= mOutputLen;

  // Close STDOUT writer
  mWriter->Close();
  mWriter = nsnull;

  nsCOMPtr<nsIPrompt> prompter;
  nsCOMPtr <nsIMsgMailSession> mailSession (do_GetService(NS_MSGMAILSESSION_CONTRACTID));
  if (mailSession) {
    nsCOMPtr<nsIMsgWindow> msgWindow;
    mailSession->GetTopmostMsgWindow(getter_AddRefs(msgWindow));
    if (msgWindow)
      msgWindow->GetPromptDialog(getter_AddRefs(prompter));
  }

  nsCOMPtr<nsIEnigmail> enigmailSvc = do_GetService(NS_ENIGMAIL_CONTRACTID, &rv);
  if (NS_FAILED(rv)) return rv;

  PRInt32 exitCode;
  PRUint32 statusFlags;
  nsXPIDLString errorMsg;
  rv = enigmailSvc->EncryptMessageEnd(nsnull,
                                      prompter,
                                      mUIFlags,
                                      mSendFlags,
                                      cmdOutputLen,
                                      mPipeTrans,
                                      &statusFlags,
                                      getter_Copies(errorMsg),
                                      &exitCode);
  if (NS_FAILED(rv)) return rv;

  if (exitCode != 0) {
    DEBUG_LOG(("nsEnigMsgCompose::FinishAux: ERROR EXIT %d\n", exitCode));
    return NS_ERROR_FAILURE;
  }

  return NS_OK;
}


NS_IMETHODIMP
nsEnigMsgCompose::MimeCryptoWriteBlock(const char *aBuf, PRInt32 aLen)
{
  nsresult rv;

  DEBUG_LOG(("nsEnigMsgCompose::MimeCryptoWriteBlock: \n"));

  if (!mMsgComposeSecure)
    return NS_ERROR_FAILURE;

  if (mUseSMIME) {
    return mMsgComposeSecure->MimeCryptoWriteBlock(aBuf, aLen);
  }

  // Enigmail stuff
  nsCAutoString temStr(aBuf, aLen);
  DEBUG_LOG(("nsEnigMsgCompose::MimeCryptoWriteBlock: aBuf='%s'\n",
             temStr.get()));

  if (!mMultipartSigned) {
    return WriteCopy(aBuf, aLen);
  }

  // Mangle lines beginning with "From "
  // strip trailing whitespaces prior to signing
  PRUint32 offset = 0;
  PRUint32 writeCount = 0;

  for (PRUint32 j=0; j<((PRUint32) aLen); j++) {
    if ((mSpace > 0) && ((aBuf[j] == '\r') || (aBuf[j] == '\n'))) {
      // strip trailing spaces and tabs
      writeCount = j-offset-mSpace;
      WriteCopy(&aBuf[offset], writeCount);
      DEBUG_LOG(("nsEnigMsgCompose::MimeCryptoWriteBlock: stripped trailing whitespaces\n"));
      offset = j;
    }
    if (mLinebreak || (mMatchFrom > 0)) {

      if (aBuf[j] != FromStr[mMatchFrom]) {
        // No match; reset count
        mMatchFrom = 0;

      } else {
        // Increment match count
        mMatchFrom++;

        if (mMatchFrom >= strlen(FromStr)) {
          // Complete match found
          // Write out characters preceding match
          writeCount = j+1-offset-mMatchFrom;

          if (writeCount > 0) {
            rv = WriteCopy(&aBuf[offset], writeCount);
            if (NS_FAILED(rv)) return rv;
          }

          mMatchFrom = 0;
          offset = j+1;

          // Write out mangled string
          rv = WriteCopy(">", 1);
          if (NS_FAILED(rv)) return rv;

          rv = WriteCopy(FromStr, strlen(FromStr));
          if (NS_FAILED(rv)) return rv;

          DEBUG_LOG(("nsEnigMsgCompose::MimeCryptoWriteBlock: >From\n"));
        }

      }
    }

    mLinebreak = (aBuf[j] == '\r') || (aBuf[j] == '\n');
    if (mStripWhitespace && ((aBuf[j] == ' ') || (aBuf[j] == '\t'))) {
      ++mSpace;
    }
    else {
      mSpace = 0;
    }
  }

  if ((offset+mMatchFrom) < (PRUint32) aLen) {
    // Write out characters preceding any match
    rv = WriteCopy(&aBuf[offset], aLen-offset-mMatchFrom-mSpace);
    if (NS_FAILED(rv)) return rv;
  }

  return NS_OK;
}


static nsresult
EnigMsgCompose_write(const char *buf, PRInt32 size, void *closure)
{
  DEBUG_LOG(("nsEnigMsgCompose::EnigMsgCompose_write: (%p) %d\n", closure, size));

  if (!closure)
    return NS_ERROR_FAILURE;

  nsIEnigMimeWriter* enigMimeWriter = (nsIEnigMimeWriter *) closure;

  return enigMimeWriter->Write(buf, size);
}


nsresult
nsEnigMsgCompose::WriteOut(const char *aBuf, PRInt32 aLen)
{
  DEBUG_LOG(("nsEnigMsgCompose::WriteOut: %d\n", aLen));

  if (!mWriter)
    return NS_ERROR_FAILURE;

  if (aLen <= 0)
    return NS_OK;

  mOutputLen += aLen;

  if (mEncoderData) {
    // Encode data before transmitting to writer
    int status = MimeEncoderWrite(mEncoderData, aBuf, aLen);
    return (status == 0) ? NS_OK : NS_ERROR_FAILURE;
  }

  return mWriter->Write(aBuf, aLen);
}


nsresult
nsEnigMsgCompose::WriteCopy(const char *aBuf, PRInt32 aLen)
{
  nsresult rv;

  DEBUG_LOG(("nsEnigMsgCompose::WriteCopy: %d\n", aLen));

  if (aLen <= 0)
    return NS_OK;

  mInputLen += aLen;

  if (mMimeListener) {
    // Write to listener
    mMimeListener->Write(aBuf, aLen, nsnull, nsnull);

  } else if (mPipeTrans) {
    // Write to process and copy if multipart/signed
    mPipeTrans->WriteSync(aBuf, aLen);

    if (mMultipartSigned) {
      rv = WriteOut(aBuf, aLen);
      if (NS_FAILED(rv)) return rv;
    }
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

  nsCAutoString contentType;
  rv = mMimeListener->GetContentType(contentType);
  if (NS_FAILED(rv)) return rv;

  nsCAutoString contentEncoding;
  rv = mMimeListener->GetContentEncoding(contentEncoding);
  if (NS_FAILED(rv)) return rv;

  nsCAutoString headers;
  rv = mMimeListener->GetHeaders(headers);
  if (NS_FAILED(rv)) return rv;

  if (headers.IsEmpty())
    return NS_ERROR_FAILURE;

  DEBUG_LOG(("nsEnigMsgCompose::OnStartRequest: Content-Type: %s\n", headers.get()));

  PRBool encapsulate = PR_FALSE;
  if (mSendFlags & nsIEnigmail::SEND_PGP_MIME) {
    // RFC2015 crypto encapsulation
    encapsulate = PR_TRUE;

  } else if (!contentType.EqualsIgnoreCase("text/plain")) {
    // Force RFC2015 crypto encapsulation for non-plaintext messages
    encapsulate = PR_TRUE;
    mSendFlags |= nsIEnigmail::SEND_PGP_MIME;
  }

  rv = Init();
  if (NS_FAILED(rv)) return rv;

  if (!mPipeTrans) return NS_OK;

  if (encapsulate) {
    // RFC2015 crypto encapsulation for headers

    // Send headers to crypto processor
    rv = mPipeTrans->WriteSync(headers.get(), headers.Length());
    if (NS_FAILED(rv)) return rv;

    if (mMultipartSigned) {
      rv = WriteSignedHeaders1( contentEncoding.EqualsIgnoreCase("8bit") );
      if (NS_FAILED(rv)) return rv;

      // Copy original headers to output
      rv = WriteOut(headers.get(), headers.Length());
      if (NS_FAILED(rv)) return rv;

    } else {
      rv = WriteEncryptedHeaders();
      if (NS_FAILED(rv)) return rv;
    }

  } else {
    // No crypto encapsulation for headers
    DEBUG_LOG(("nsEnigMsgCompose::OnStartRequest: NO CRYPTO ENCAPSULATION\n"));

    rv = WriteOut(headers.get(), headers.Length());
    if (NS_FAILED(rv)) return rv;

    if (contentEncoding.EqualsIgnoreCase("base64")) {

      mEncoderData = MimeB64EncoderInit(EnigMsgCompose_write, (void*) mWriter);

    } else if (contentEncoding.EqualsIgnoreCase("quoted-printable")) {

      mEncoderData = MimeQPEncoderInit(EnigMsgCompose_write, (void*) mWriter);
    }
  }

  return NS_OK;
}

NS_IMETHODIMP
nsEnigMsgCompose::OnStopRequest(nsIRequest* aRequest,
                                  nsISupports* aContext,
                                  nsresult aStatus)
{
  DEBUG_LOG(("nsEnigMsgCompose::OnStopRequest:\n"));

  mRequestStopped = PR_TRUE;

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

  if (!mPipeTrans)
    return NS_ERROR_NOT_INITIALIZED;

  char buf[kCharMax];
  PRUint32 readCount, readMax;

  while (aLength > 0) {
    readMax = (aLength < kCharMax) ? aLength : kCharMax;
    rv = aInputStream->Read((char *) buf, readMax, &readCount);

    if (NS_FAILED(rv)){
      DEBUG_LOG(("nsEnigMsgCompose::OnDataAvailable: Error in reading from input stream, %p\n", rv));
      return rv;
    }

    if (readCount <= 0) return NS_OK;

    rv = mPipeTrans->WriteSync(buf, readCount);
    if (NS_FAILED(rv)) return rv;

    if (mMultipartSigned) {
      rv = WriteOut(buf, readCount);
      if (NS_FAILED(rv)) return rv;
    }

    aLength -= readCount;
  }

  return NS_OK;
}
