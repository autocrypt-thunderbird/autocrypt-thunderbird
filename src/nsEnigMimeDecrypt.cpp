/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public
 * License Version 1.1 (the "MPL"); you may not use this file
 * except in compliance with the MPL. You may obtain a copy of
 * the MPL at http://www.mozilla.org/MPL/
 *
 * Software distributed under the MPL is distributed on an "AS
 * IS" basis, WITHOUT WARRANTY OF ANY KIND, either express or
 * implied. See the MPL for the specific language governing
 * rights and limitations under the MPL.
 *
 * The Original Code is Enigmail.
 *
 * The Initial Developer of the Original Code is Ramalingam Saravanan.
 * Portions created by Ramalingam Saravanan <sarava@sarava.net> are
 * Copyright (C) 2002 Ramalingam Saravanan. All Rights Reserved.
 *
 * Contributor(s):
 * Patrick Brunschwig <patrick@mozilla-enigmail.org>
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
 * ***** END LICENSE BLOCK ***** */

// Logging of debug output
// The following define statement should occur before any include statements
#define FORCE_PR_LOG       /* Allow logging even in release build */

#include "enigmail.h"
#include "nspr.h"
#include "nsCOMPtr.h"
#include "plstr.h"
#include "nsStringAPI.h"
#include "nsNetUtil.h"
#include "nsIPrompt.h"
#include "nsIMsgWindow.h"
#include "nsMsgBaseCID.h"
#include "nsIMsgMailSession.h"
#include "nsIMimeMiscStatus.h"
#include "nsIEnigMimeHeaderSink.h"
#include "nsIAsyncInputStream.h"
#include "nsIThread.h"
#include "nsIEventTarget.h"
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
NS_IMPL_THREADSAFE_ISUPPORTS2(nsEnigMimeDecrypt,
                              nsIEnigMimeDecrypt,
                              nsIPipeReader)

// nsEnigMimeDecrypt implementation
nsEnigMimeDecrypt::nsEnigMimeDecrypt()
  : mInitialized(PR_FALSE),
    mVerifyOnly(PR_FALSE),
    mRfc2015(PR_FALSE),
    mDone(PR_FALSE),

    mInputLen(0),
    mOutputLen(0),
    mIterations(0),
    mCtFound(-1),

    mBuffer(NULL),
    mListener(NULL),
    mPipeTrans(NULL),
    mSecurityInfo(NULL),
    mUri(NULL)
{
  nsresult rv;

  NS_INIT_ISUPPORTS();

#ifdef PR_LOGGING
  if (gEnigMimeDecryptLog == NULL) {
    gEnigMimeDecryptLog = PR_NewLogModule("nsEnigMimeDecrypt");
  }
#endif

#ifdef FORCE_PR_LOG
  nsCOMPtr<nsIThread> myThread;
  rv = ENIG_GET_THREAD(myThread);
  DEBUG_LOG(("nsEnigMimeDecrypt:: <<<<<<<<< CTOR(%p): myThread=%p\n",
         this, myThread.get()));
#endif
}


nsEnigMimeDecrypt::~nsEnigMimeDecrypt()
{
  nsresult rv;
#ifdef FORCE_PR_LOG
  nsCOMPtr<nsIThread> myThread;
  rv = ENIG_GET_THREAD(myThread);
  DEBUG_LOG(("nsEnigMimeDecrypt:: >>>>>>>>> DTOR(%p): myThread=%p\n",
         this, myThread.get()));
#endif

  Finalize();
}


///////////////////////////////////////////////////////////////////////////////
// nsIEnigMimeDecrypt methods:
///////////////////////////////////////////////////////////////////////////////

NS_IMETHODIMP
nsEnigMimeDecrypt::Init(EMBool verifyOnly,
                        EMBool rfc2015,
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

    rv = mListener->Init((nsIStreamListener*)(mBuffer),
                         NULL, "", "", 1, PR_FALSE, PR_TRUE, NULL);
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
    mPipeTrans = NULL;
  }

  if (mListener) {
    mListener = NULL;
  }

  if (mBuffer) {
    mBuffer->Shutdown();
    mBuffer = NULL;
  }

  return NS_OK;
}

NS_IMETHODIMP
nsEnigMimeDecrypt::Write(const char *buf, PRUint32 buf_size)

{
  if (!mInitialized)
    return NS_ERROR_NOT_INITIALIZED;

  if (mListener)
    mListener->Write(buf, buf_size, NULL, NULL);
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
  nsCOMPtr<nsIThread> myThread;
  rv = ENIG_GET_THREAD(myThread);

  mUri = uri;
  nsCAutoString uriSpec("");

  if (mListener) {
    rv = mListener->OnStopRequest(NULL, NULL, NS_OK);
    if (NS_FAILED(rv))
      return rv;

    nsCAutoString endLine;
    rv = mListener->GetEndLine(endLine);
    if (NS_FAILED(rv)) return rv;

    if (endLine.IsEmpty()) {
      ERROR_LOG(("nsEnigMimeDecrypt::FinishAux: ERROR MIME part not terminated\n"));
      return NS_ERROR_FAILURE;
    }

    mListener = NULL;
  }

  rv = mBuffer->OnStopRequest(NULL, NULL, NS_OK);
  if (NS_FAILED(rv))
    return rv;

  if (msgWindow) {
    nsCOMPtr<nsIMsgHeaderSink> headerSink;
    msgWindow->GetMsgHeaderSink(getter_AddRefs(headerSink));
    if (headerSink)
        headerSink->GetSecurityInfo(getter_AddRefs(mSecurityInfo));
  }
  DEBUG_LOG(("nsEnigMimeDecrypt::FinishAux: securityInfo=%p\n", mSecurityInfo.get()));

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

  DEBUG_LOG(("nsEnigMimeDecrypt::FinishAux: prompter=%p\n", prompter.get()));

  nsCOMPtr<nsIEnigmail> enigmailSvc = do_GetService(NS_ENIGMAIL_CONTRACTID, &rv);
  if (NS_FAILED(rv))
    return rv;

  nsString errorMsg;
  EMBool noOutput = PR_FALSE;
  PRUint32 statusFlags;

  rv = enigmailSvc->DecryptMessageStart(NULL,
                                        prompter,
                                        mVerifyOnly,
                                        noOutput,
                                        NULL,
                                        &statusFlags,
                                        getter_Copies(errorMsg),
                                        getter_AddRefs(mPipeTrans) );
  if (NS_FAILED(rv)) return rv;

  if (!mPipeTrans) {
    if (mSecurityInfo) {
      nsCOMPtr<nsIEnigMimeHeaderSink> enigHeaderSink = do_QueryInterface(mSecurityInfo);
      if (enigHeaderSink) {
        NS_NAMED_LITERAL_STRING(nullString, "");
        rv = enigHeaderSink->UpdateSecurityStatus(uriSpec, -1, statusFlags, nullString.get(), nullString.get(), nullString.get(), errorMsg.get(), nullString.get(), mUri);
      }
    }

    return NS_ERROR_FAILURE;
  }

  mIterations = 0;
  mCtFound = -1;
  nsCOMPtr<nsIInputStream> plainStream = NULL;

  // read via pipeTransport.jsm
  nsCOMPtr<nsIRequest> request;
  rv = mPipeTrans->ReadInputStream(this, getter_AddRefs(request));
  NS_ENSURE_SUCCESS(rv, rv);

  // Write buffered data asyncronously to process
  nsCOMPtr<nsIInputStream> bufStream;
  rv = mBuffer->OpenInputStream(getter_AddRefs(bufStream));
  if (NS_FAILED(rv)) return rv;

#if MOZILLA_MAJOR_VERSION < 17
  PRUint32 available;
#else
  PRUint64 available;
#endif

  rv = bufStream->Available(&available);
  if (NS_FAILED(rv)) return rv;

  DEBUG_LOG(("nsEnigMimeDecrypt::FinishAux: available=%d\n", available));

  rv = mPipeTrans->WriteAsync(bufStream, (PRUint32) available, PR_TRUE);
  if (NS_FAILED(rv)) return rv;

  // read via pipeTransport.jsm

  nsCOMPtr<nsIThread> currentThread;
  rv = ENIG_GET_THREAD(currentThread);
  NS_ENSURE_SUCCESS(rv, rv);

  mDone = PR_FALSE;

  // wait with returning until message is completely processed
  // (simulate synchronous function)
  while (! mDone) {
    EMBool pendingEvents;
    rv = currentThread->ProcessNextEvent(PR_TRUE, &pendingEvents);
    NS_ENSURE_SUCCESS(rv, rv);
  }

  return NS_OK;
}

nsresult
nsEnigMimeDecrypt::ProcessPlainData(char* buf, PRUint32 readCount)
{
  DEBUG_LOG(("nsEnigMimeDecrypt::ProcessPlainData: readCount=%d\n", readCount));

  int status;
  ++mIterations;
  // Read synchronously


  if (mIterations == 1 && readCount > 25) {
    // add mime boundaries around text/plain message (bug 6627)
    if (PL_strncasecmp("content-type:", buf, 13)==0) {
      PRUint32 whitespace=13;
      while((whitespace<readCount) && buf[whitespace] &&
            ((buf[whitespace]==' ') || (buf[whitespace]=='\t'))) { whitespace++; }
      if (buf[whitespace] && (whitespace<readCount)) {
        mCtFound = PL_strncasecmp(buf + whitespace, "text/plain", 10);
        if (mCtFound != 0) {
          mCtFound=PL_strncasecmp(buf + whitespace, "text/html", 9);
        }
      }
      if (mCtFound == 0) {
        char* header = PR_smprintf(
        "Content-Type: multipart/mixed; boundary=\"enigDummy\""
        "\n\n--enigDummy\n");
        PR_SetError(0,0);
        status = mOutputFun(header, strlen(header), mOutputClosure);
        if (status < 0) {
          PR_SetError(status, 0);
          mOutputFun = NULL;
          mOutputClosure = NULL;

          return NS_ERROR_FAILURE;
        }
        mOutputLen += strlen(header);
      }
    }
  }

  if (readCount < kCharMax) {
    // make sure we can continue to write later
    if (buf[readCount-1]==0) --readCount;
  }

  PR_SetError(0,0);
  status = mOutputFun(buf, readCount, mOutputClosure);
  if (status < 0) {
    PR_SetError(status, 0);
    mOutputFun = NULL;
    mOutputClosure = NULL;

    return NS_ERROR_FAILURE;
  }

  mOutputLen += readCount;

  return NS_OK;
} // loop end


nsresult
nsEnigMimeDecrypt::ProcessEnd(nsIInputStream* plainStream)
{
  DEBUG_LOG(("nsEnigMimeDecrypt::ProcessEnd:\n"));

  char buf[kCharMax];
  nsresult rv;
  nsString errorMsg;
  nsCAutoString uriSpec("");


  nsCOMPtr<nsIEnigmail> enigmailSvc = do_GetService(NS_ENIGMAIL_CONTRACTID, &rv);
  if (NS_FAILED(rv))
    return rv;

DEBUG_LOG(("nsEnigMimeDecrypt::ProcessEnd: got Enigmail Svc\n"));

  if (mCtFound==0) {
    // add mime boundaries around text/plain message (bug 6627)
    PR_SetError(0,0);
    strcpy(buf, "\n\n--enigDummy--\n");

    int status = mOutputFun(buf, strlen(buf), mOutputClosure);
    if (status < 0) {
      PR_SetError(status, 0);
      mOutputFun = NULL;
      mOutputClosure = NULL;
DEBUG_LOG(("nsEnigMimeDecrypt::ProcessEnd: error 1\n"));

      return NS_ERROR_FAILURE;
    }
    mOutputLen+=strlen(buf);
  }
  else {
    // add final \n to make sure last line is always displayed (bug 5952)
    buf[0]='\n';
    PR_SetError(0,0);
    int status = mOutputFun(buf, 1, mOutputClosure);
    if (status >= 0) {
      // ignore any errors here
      mOutputLen++;
    }
  }

  PR_SetError(0,0);

  // Close input stream
  if (plainStream) plainStream->Close();

  // Close buffer
  mBuffer->Shutdown();

  PRInt32 exitCode;
  nsString keyId;
  nsString userId;
  nsString sigDate;
  nsString blockSeparation;
  PRUint32 statusFlags;

  PRUint32 uiFlags = nsIEnigmail::UI_PGP_MIME;
  EMBool noOutput = PR_FALSE;

  rv = enigmailSvc->DecryptMessageEnd(uiFlags,
                                      mOutputLen,
                                      mPipeTrans,
                                      mVerifyOnly,
                                      noOutput,
                                      &statusFlags,
                                      getter_Copies(keyId),
                                      getter_Copies(userId),
                                      getter_Copies(sigDate),
                                      getter_Copies(errorMsg),
                                      getter_Copies(blockSeparation),
                                      &exitCode);

  if (NS_FAILED(rv)) return rv;

  if (mSecurityInfo) {
    nsCOMPtr<nsIEnigMimeHeaderSink> enigHeaderSink = do_QueryInterface(mSecurityInfo);
    if (enigHeaderSink) {
      rv = enigHeaderSink->UpdateSecurityStatus(uriSpec, exitCode, statusFlags, keyId.get(), userId.get(), sigDate.get(), errorMsg.get(), blockSeparation.get(), mUri);
    }
  }

  if (exitCode != 0) {
    return NS_ERROR_FAILURE;
  }

  return NS_OK;
}


NS_IMETHODIMP
nsEnigMimeDecrypt::ReadData(const char* buf,
                            PRUint32 count)
{
  nsresult rv;
  DEBUG_LOG(("nsEnigMimeDecrypt::ReadData: count=%d\n", count));

  NS_ENSURE_ARG(buf);

/*
  PRUint32 readCount;
  char buf[count + 1];

  rv = stream->Read((char*) buf, count, &readCount);
  NS_ENSURE_SUCCESS(rv, rv);
*/
  if (count) {
    rv = ProcessPlainData((char *) buf, count);
    return rv;
  }

  return NS_OK;

}


NS_IMETHODIMP
nsEnigMimeDecrypt::StopRequest(PRUint32 status)
{
  DEBUG_LOG(("nsEnigMimeDecrypt::StopRequest:\n"));

  ProcessEnd(NULL);
  mDone = PR_TRUE;

  return NS_OK;
}
