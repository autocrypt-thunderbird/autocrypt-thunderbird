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
#include "nsIMimeMiscStatus.h"
#include "nsIMsgSMIMEHeaderSink.h"
#include "nsIThread.h"
#include "nsEnigMimeVerify.h"
#include "nsIPipeTransport.h"
#include "nsIIPCBuffer.h"
#include "nsIEnigmail.h"

#ifdef PR_LOGGING
PRLogModuleInfo* gEnigMimeVerifyLog = NULL;
#endif

#define ERROR_LOG(args)    PR_LOG(gEnigMimeVerifyLog,PR_LOG_ERROR,args)
#define WARNING_LOG(args)  PR_LOG(gEnigMimeVerifyLog,PR_LOG_WARNING,args)
#define DEBUG_LOG(args)    PR_LOG(gEnigMimeVerifyLog,PR_LOG_DEBUG,args)

#define MAX_BUFFER_BYTES 32000
#define MAX_HEADER_BYTES 16000

static const PRUint32 kCharMax = 1024;

static NS_DEFINE_CID(kIOServiceCID, NS_IOSERVICE_CID);

// nsEnigMimeVerify implementation

// nsISupports implementation
NS_IMPL_THREADSAFE_ISUPPORTS3(nsEnigMimeVerify,
                              nsIEnigMimeVerify,
                              nsIRequestObserver,
                              nsIStreamListener);

// nsEnigMimeVerify implementation
nsEnigMimeVerify::nsEnigMimeVerify()
  : mInitialized(PR_FALSE),
    mRfc2015(PR_FALSE),
    mRequestStopped(PR_FALSE),
    mStartCount(0),

    mContentBoundary(""),

    mMsgWindow(nsnull),

    mOutBuffer(nsnull),
    mPipeTrans(nsnull),
    mPipeTransListener(nsnull),

    mArmorListener(nsnull),
    mSecondPartListener(nsnull),
    mFirstPartListener(nsnull),
    mOuterMimeListener(nsnull),
    mInnerMimeListener(nsnull)
{
  nsresult rv;

  NS_INIT_REFCNT();

#ifdef PR_LOGGING
  if (gEnigMimeVerifyLog == nsnull) {
    gEnigMimeVerifyLog = PR_NewLogModule("nsEnigMimeVerify");
  }
#endif

#ifdef FORCE_PR_LOG
  nsCOMPtr<nsIThread> myThread;
  rv = nsIThread::GetCurrent(getter_AddRefs(myThread));
  DEBUG_LOG(("nsEnigMimeVerify:: <<<<<<<<< CTOR(%x): myThread=%x\n",
         (int) this, (int) myThread.get()));
#endif
}


nsEnigMimeVerify::~nsEnigMimeVerify()
{
  nsresult rv;
#ifdef FORCE_PR_LOG
  nsCOMPtr<nsIThread> myThread;
  rv = nsIThread::GetCurrent(getter_AddRefs(myThread));
  DEBUG_LOG(("nsEnigMimeVerify:: >>>>>>>>> DTOR(%x): myThread=%x\n",
         (int) this, (int) myThread.get()));
#endif

  Finalize();
}


///////////////////////////////////////////////////////////////////////////////
// nsIEnigMimeVerify methods:
///////////////////////////////////////////////////////////////////////////////

NS_IMETHODIMP
nsEnigMimeVerify::Init(nsIURI* aURI, nsIMsgWindow* msgWindow,
                       PRBool rfc2015)
{
  nsresult rv;

  DEBUG_LOG(("nsEnigMimeVerify::Init: rfc2015=%d\n", (int) rfc2015));

  mMsgWindow = msgWindow;
  mRfc2015 = rfc2015;

  nsCOMPtr<nsIIOService> ioService(do_GetService(kIOServiceCID, &rv));
  if (NS_FAILED(rv))
    return rv;

  nsCOMPtr<nsIChannel> channel;
  rv = ioService->NewChannelFromURI(aURI, getter_AddRefs(channel));
  if (NS_FAILED(rv))
    return rv;

  // Listener to parse PGP block armor
  mArmorListener = do_CreateInstance(NS_PIPEFILTERLISTENER_CONTRACTID, &rv);
  if (NS_FAILED(rv)) return rv;

  const char* pgpHeader = "-----BEGIN PGP SIGNATURE-----";
  const char* pgpFooter = "-----END PGP SIGNATURE-----";

  rv = mArmorListener->Init((nsIStreamListener*) this, nsnull,
                            pgpHeader, pgpFooter,
                            0, PR_TRUE, PR_FALSE, nsnull);
  if (NS_FAILED(rv)) return rv;

  // Inner mime listener to parse second part
  nsCOMPtr<nsIEnigMimeListener> mInnerMimeListener = do_CreateInstance(NS_ENIGMIMELISTENER_CONTRACTID, &rv);
  if (NS_FAILED(rv)) return rv;

  rv = mInnerMimeListener->Init(mArmorListener, nsnull,
                                MAX_HEADER_BYTES, PR_TRUE, PR_FALSE);
  if (NS_FAILED(rv)) return rv;

  // Create PipeFilterListener to extract second MIME part
  mSecondPartListener = do_CreateInstance(NS_PIPEFILTERLISTENER_CONTRACTID, &rv);
  if (NS_FAILED(rv)) return rv;

  // Create PipeFilterListener to extract first MIME part
  mFirstPartListener = do_CreateInstance(NS_PIPEFILTERLISTENER_CONTRACTID, &rv);
  if (NS_FAILED(rv)) return rv;

  rv = mFirstPartListener->Init((nsIStreamListener*) this,
                               nsnull, "", "", 1, PR_FALSE, PR_TRUE, 
                               mSecondPartListener);
  if (NS_FAILED(rv)) return rv;

  // Outer mime listener to capture URI content
  nsCOMPtr<nsIEnigMimeListener> mOuterMimeListener = do_CreateInstance(NS_ENIGMIMELISTENER_CONTRACTID, &rv);
  if (NS_FAILED(rv)) return rv;

  rv = mOuterMimeListener->Init(mFirstPartListener, nsnull,
                                MAX_HEADER_BYTES, PR_TRUE, PR_FALSE);
  if (NS_FAILED(rv)) return rv;

  // Initiate asynchronous loading of URI
  rv = channel->AsyncOpen( mOuterMimeListener, nsnull );
  if (NS_FAILED(rv))
    return rv;

  mInitialized = PR_TRUE;

  return NS_OK;
}

nsresult
nsEnigMimeVerify::Finalize()
{
  DEBUG_LOG(("nsEnigMimeVerify::Finalize:\n"));

  if (mPipeTrans) {
    mPipeTrans->Terminate();
    mPipeTrans = nsnull;
    mPipeTransListener = nsnull;
  }

  if (mOutBuffer) {
    mOutBuffer->Shutdown();
    mOutBuffer = nsnull;
  }

  mMsgWindow = nsnull;

  mArmorListener = nsnull;
  mFirstPartListener = nsnull;
  mSecondPartListener = nsnull;
  mOuterMimeListener = nsnull;
  mInnerMimeListener = nsnull;

  return NS_OK;
}

NS_IMETHODIMP
nsEnigMimeVerify::Finish()
{
  // Enigmail stuff
  nsresult rv;

  if (!mInitialized || !mPipeTrans)
    return NS_ERROR_NOT_INITIALIZED;

  if (!mRequestStopped)
    return NS_ERROR_FAILURE;

  // Check input data consistency
  if (mStartCount < 2) {
    ERROR_LOG(("nsEnigMimeVerify::Finish: ERROR mStartCount=%d\n", mStartCount));
    return NS_ERROR_FAILURE;
  }

  nsCAutoString armorTail;
  rv = mArmorListener->GetEndLine(armorTail);
  if (NS_FAILED(rv)) return rv;

  if (armorTail.IsEmpty()) {
    ERROR_LOG(("nsEnigMimeVerify::Finish: ERROR No armor tail found\n"));
    return NS_ERROR_FAILURE;
  }

  nsCAutoString endBoundary;
  rv = mSecondPartListener->GetEndLine(endBoundary);
  if (NS_FAILED(rv)) return rv;

  // Trim leading/trailing whitespace
  endBoundary.Trim(" \t\r\n", PR_TRUE, PR_TRUE);

  nsCAutoString temBoundary("--");
  temBoundary += mContentBoundary;
temBoundary += "--";

  if (!endBoundary.Equals(temBoundary)) {
    ERROR_LOG(("nsEnigMimeVerify::Finish: ERROR endBoundary=%s\n", endBoundary.get()));
    return NS_ERROR_FAILURE;
  }

  // Wait for STDOUT to close
  rv = mPipeTrans->Join();
  if (NS_FAILED(rv)) return rv;

  PRInt32 exitCode;
  rv = mPipeTrans->ExitCode(&exitCode);
  if (NS_FAILED(rv)) return rv;

  DEBUG_LOG(("nsEnigMimeVerify::Finish: exitCode=%d\n", exitCode));

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

  // Shutdown STDOUT & STDERR consoles
  mOutBuffer->Shutdown();
  errListener->Shutdown();

  // Terminate process
  mPipeTrans->Terminate();
  mPipeTrans = nsnull;

  PRInt32 newExitCode;
  PRUint32 statusFlags;

  nsXPIDLCString keyId;
  nsXPIDLCString userId;
  nsXPIDLCString errorMsg;

  nsCOMPtr<nsIEnigmail> enigmailSvc;
  rv = enigmailSvc->DecryptMessageEnd(exitCode,
                                      0,
                                      errorOutput,
                                      &statusFlags,
                                      getter_Copies(keyId),
                                      getter_Copies(userId),
                                      getter_Copies(errorMsg),
                                      &newExitCode);
  if (NS_FAILED(rv)) return rv;

  nsCOMPtr<nsISupports> securityInfo;
  if (mMsgWindow) {
    nsCOMPtr<nsIMsgHeaderSink> headerSink;
    mMsgWindow->GetMsgHeaderSink(getter_AddRefs(headerSink));
    if (headerSink)
        headerSink->GetSecurityInfo(getter_AddRefs(securityInfo));
  }

  DEBUG_LOG(("nsEnigMimeVerify::Finish: securityInfo=%x\n", securityInfo.get()));

  if (securityInfo) {
    nsCOMPtr<nsIMsgSMIMEHeaderSink> sink = do_QueryInterface(securityInfo);
    PRInt32 nesting;
    rv = sink->MaxWantedNesting(&nesting);
    DEBUG_LOG(("nsEnigMimeVerify::Finish: nesting=%d\n", nesting));
  }


  if (newExitCode != 0) {
    DEBUG_LOG(("nsEnigMimeVerify::Finish: ERROR EXIT %d\n", newExitCode));
    return NS_ERROR_FAILURE;
  }

  return NS_OK;
}


///////////////////////////////////////////////////////////////////////////////
// nsIRequestObserver methods
///////////////////////////////////////////////////////////////////////////////

NS_IMETHODIMP
nsEnigMimeVerify::OnStartRequest(nsIRequest *aRequest,
                                   nsISupports *aContext)
{
  nsresult rv;

  mStartCount++;

  DEBUG_LOG(("nsEnigMimeVerify::OnStartRequest: %d\n", mStartCount));

  if (!mInitialized)
    return NS_ERROR_NOT_INITIALIZED;

  if (mStartCount > 2)
    return NS_ERROR_FAILURE;

  if (mStartCount == 2) {
    // Second start request
    nsCAutoString innerContentType;
    rv = mInnerMimeListener->GetContentType(innerContentType);
    if (NS_FAILED(rv)) return rv;

    if (!innerContentType.EqualsIgnoreCase("application/pgp-signature")) {
      ERROR_LOG(("nsEnigMimeVerify::OnStartRequest: ERROR innerContentType=%s\n", innerContentType.get()));
      return NS_ERROR_FAILURE;
    }

    // Output Linebreak after signed content (IMPORTANT)
    nsCAutoString innerLinebreak;
    rv = mInnerMimeListener->GetContentType(innerLinebreak);
    if (NS_FAILED(rv)) return rv;

    if (innerLinebreak.IsEmpty())
      return NS_ERROR_FAILURE;

    mPipeTrans->WriteSync(innerLinebreak.get(), innerLinebreak.Length());

    return NS_OK;
}

  // First start request
  nsCAutoString contentType;
  rv = mOuterMimeListener->GetContentType(contentType);

  if (!contentType.EqualsIgnoreCase("multipart/signed")) {
    ERROR_LOG(("nsEnigMimeVerify::OnStartRequest: ERROR contentType=%s\n", contentType.get()));
    return NS_ERROR_FAILURE;
  }

  nsCAutoString contentProtocol;
  mOuterMimeListener->GetContentProtocol(contentProtocol);
  if (NS_FAILED(rv)) return rv;

  if (!contentProtocol.EqualsIgnoreCase("application/pgp-signature")) {
    ERROR_LOG(("nsEnigMimeVerify::OnStartRequest: ERROR contentProtocol=%s\n", contentProtocol.get()));
    return NS_ERROR_FAILURE;
  }

  nsCAutoString contentMicalg;
  mOuterMimeListener->GetContentMicalg(contentMicalg);
  if (NS_FAILED(rv)) return rv;

  if (contentMicalg.IsEmpty()) {
  }

  nsCAutoString hashSymbol;
  if (contentMicalg.EqualsIgnoreCase("pgp-md5")) {
    hashSymbol = "SHA1";

  } else if (contentMicalg.EqualsIgnoreCase("pgp-sha1")) {
    hashSymbol = "MD5";

  } else {
    ERROR_LOG(("nsEnigMimeVerify::OnStartRequest: ERROR contentMicalg='%s'\n", contentMicalg.get()));
    return NS_ERROR_FAILURE;
  }

  nsCAutoString linebreak;
  rv = mOuterMimeListener->GetContentType(linebreak);
  if (NS_FAILED(rv)) return rv;

  mOuterMimeListener->GetContentBoundary(mContentBoundary);
  if (NS_FAILED(rv)) return rv;

  if (mContentBoundary.IsEmpty()) {
    ERROR_LOG(("nsEnigMimeVerify::OnStartRequest: ERROR no content boundary\n"));
    return NS_ERROR_FAILURE;
  }

  nsCAutoString temBoundary("--");
  temBoundary += mContentBoundary;

  nsCAutoString startDelimiter;
  mFirstPartListener->GetStartDelimiter(startDelimiter);
  if (NS_FAILED(rv)) return rv;

  if (!startDelimiter.Equals(temBoundary)) {
    ERROR_LOG(("nsEnigMimeVerify::OnStartRequest: ERROR startDelimiter=%s\n", startDelimiter.get()));
    return NS_ERROR_FAILURE;
  }

  nsCAutoString endBoundary;
  mFirstPartListener->GetStartDelimiter(endBoundary);
  if (NS_FAILED(rv)) return rv;

  endBoundary.Trim(" \t\r\n", PR_TRUE, PR_TRUE);

  if (!endBoundary.Equals(temBoundary)) {
    ERROR_LOG(("nsEnigMimeVerify::OnStartRequest: ERROR endBoundary=%s\n", endBoundary.get()));
    return NS_ERROR_FAILURE;
  }

  // Initialize second part listener with content boundary
  rv = mSecondPartListener->Init(mInnerMimeListener,
                                 nsnull, "", mContentBoundary.get(),
                                 0, PR_FALSE, PR_FALSE, nsnull);
  if (NS_FAILED(rv)) return rv;


  // Create null buffer to capture verification output
  mOutBuffer = do_CreateInstance(NS_IPCBUFFER_CONTRACTID, &rv);
  if (NS_FAILED(rv)) return rv;

  rv = mOutBuffer->Open(0, PR_FALSE);
  if (NS_FAILED(rv)) return rv;

  nsCOMPtr<nsIPrompt> prompter;
  if (mMsgWindow) {
    mMsgWindow->GetPromptDialog(getter_AddRefs(prompter));
  }

  DEBUG_LOG(("nsEnigMimeVerify::Finish: prompter=%x\n", prompter.get()));

  nsCOMPtr<nsIEnigmail> enigmailSvc = do_GetService(NS_ENIGMAIL_CONTRACTID, &rv);
  if (NS_FAILED(rv)) return rv;

  nsXPIDLCString errorMsg;
  PRBool verifyOnly = PR_TRUE;
  PRBool noProxy = PR_TRUE;
  rv = enigmailSvc->DecryptMessageStart(prompter,
                                        (PRUint32) 0,
                                        verifyOnly,
                                        mOutBuffer,
                                        noProxy,
                                        getter_Copies(errorMsg),
                                        getter_AddRefs(mPipeTrans) );
  if (NS_FAILED(rv)) return rv;

  if (!mPipeTrans)
    return NS_ERROR_FAILURE;

  // Write clearsigned message header
  const char* clearsignHeader = "-----BEGIN PGP SIGNED MESSAGE-----";

  rv = mPipeTrans->WriteSync(clearsignHeader, nsCRT::strlen(clearsignHeader));
  if (NS_FAILED(rv)) return rv;

  rv = mPipeTrans->WriteSync(linebreak.get(), linebreak.Length());
  if (NS_FAILED(rv)) return rv;

  // Write out hash symbol
  const char* hashHeader = "Hash: ";

  rv = mPipeTrans->WriteSync(hashHeader, nsCRT::strlen(hashHeader));
  if (NS_FAILED(rv)) return rv;

  rv = mPipeTrans->WriteSync(hashSymbol.get(), hashSymbol.Length());
  if (NS_FAILED(rv)) return rv;

  rv = mPipeTrans->WriteSync(linebreak.get(), linebreak.Length());
  if (NS_FAILED(rv)) return rv;

  rv = mPipeTrans->WriteSync(linebreak.get(), linebreak.Length());
  if (NS_FAILED(rv)) return rv;

  // Get StreamListener to write synchronously to pipeTransport
  rv = mPipeTrans->GetListener(getter_AddRefs(mPipeTransListener));
  if (NS_FAILED(rv)) return rv;

  return NS_OK;
}

NS_IMETHODIMP
nsEnigMimeVerify::OnStopRequest(nsIRequest* aRequest,
                                  nsISupports* aContext,
                                  nsresult aStatus)
{
  nsresult rv;
  DEBUG_LOG(("nsEnigMimeVerify::OnStopRequest:\n"));

  if (!mInitialized || !mPipeTransListener)
    return NS_ERROR_NOT_INITIALIZED;

  mRequestStopped = PR_TRUE;

  rv = mPipeTransListener->OnStopRequest(aRequest, aContext, aStatus);
  if (NS_FAILED(rv)) {
    Finalize();
    return rv;
  }

  rv = Finish();
  if (NS_FAILED(rv)) {
    Finalize();
    return rv;
  }

  return NS_OK;
}

///////////////////////////////////////////////////////////////////////////////
// nsIStreamListener method
///////////////////////////////////////////////////////////////////////////////

NS_IMETHODIMP
nsEnigMimeVerify::OnDataAvailable(nsIRequest* aRequest,
                                  nsISupports* aContext,
                                  nsIInputStream *aInputStream,
                                  PRUint32 aSourceOffset,
                                  PRUint32 aLength)
{
  nsresult rv = NS_OK;

  DEBUG_LOG(("nsEnigMimeVerify::OnDataAVailable: %d\n", aLength));

  if (!mInitialized || !mPipeTransListener)
    return NS_ERROR_NOT_INITIALIZED;

  rv = mPipeTransListener->OnDataAvailable(aRequest, aContext, aInputStream,
                                           aSourceOffset, aLength);
  if (NS_FAILED(rv)) return rv;

  return NS_OK;
}
