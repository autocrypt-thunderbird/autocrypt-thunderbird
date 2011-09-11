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
 * The Original Code is protoZilla.
 *
 * The Initial Developer of the Original Code is Ramalingam Saravanan.
 * Portions created by Ramalingam Saravanan <sarava@sarava.net> are
 * Copyright (C) 2000 Ramalingam Saravanan. All Rights Reserved.
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


// NOTE: nsPipeChannel is not a thread-safe class

// Logging of debug output
// The following define statement should occur before any include statements
#define FORCE_PR_LOG       /* Allow logging even in release build */

#include "enigmail.h"
#include "prlog.h"
#include "plstr.h"
#include "nsStringGlue.h"
#include "nsIProxyObjectManager.h"
#include "nsIThread.h"
#include "nsIURI.h"
#include "nsIURL.h"
#include "nsIHttpChannel.h"
#include "nsIFile.h"
#include "nsNetUtil.h"

#include "nsMimeTypes.h"
#include "nsIMIMEService.h"

#include "nsXPCOMCIDInternal.h"

#include "nsPipeChannel.h"

#ifdef PR_LOGGING
PRLogModuleInfo* gPipeChannelLog = NULL;
#endif

#define ERROR_LOG(args)    PR_LOG(gPipeChannelLog,PR_LOG_ERROR,args)
#define WARNING_LOG(args)  PR_LOG(gPipeChannelLog,PR_LOG_WARNING,args)
#define DEBUG_LOG(args)    PR_LOG(gPipeChannelLog,PR_LOG_DEBUG,args)


#define NS_NET_STATUS_RECEIVING_FROM  NS_ERROR_GENERATE_FAILURE(NS_ERROR_MODULE_NETWORK, 6)

///////////////////////////////////////////////////////////////////////////////

nsPipeChannel::nsPipeChannel()
    : mFinalized(PR_FALSE),
      mRestricted(PR_FALSE),
      mChannelState(CHANNEL_NOT_YET_OPENED),
      mPostingData(PR_FALSE),
      mStatus(NS_OK),

      mNoMimeHeaders(PR_FALSE),

      mBufferSegmentSize(-1),
      mBufferMaxSize(-1),

      mLoadFlags(LOAD_NORMAL),

      mContentType(UNKNOWN_CONTENT_TYPE),
      mContentLength(-1),

      mHeaderContentType(UNKNOWN_CONTENT_TYPE),
      mHeaderContentLength(-1),
      mHeaderCharset(""),

      mContentReceived(0)

{
  NS_INIT_ISUPPORTS();

#ifdef PR_LOGGING
  if (gPipeChannelLog == nsnull) {
    gPipeChannelLog = PR_NewLogModule("nsPipeChannel");
  }
#endif

  DEBUG_LOG(("nsPipeChannel:: <<<<<<<<< CTOR(%p)\n", this));

}

nsPipeChannel::~nsPipeChannel()
{

  DEBUG_LOG(("nsPipeChannel:: >>>>>>>>> DTOR(%p)\n", this));

  Finalize(PR_TRUE);
}

nsresult
nsPipeChannel::Finalize(PRBool destructor)
{
  nsresult rv = NS_OK;

  DEBUG_LOG(("nsPipeChannel::Finalize:\n"));

  if (mFinalized)
    return NS_OK;

  mFinalized = PR_TRUE;

  mChannelState = CHANNEL_CLOSED;

  if (mStatus == NS_OK)
    mStatus = NS_BINDING_ABORTED;

  nsCOMPtr<nsIPipeChannel> self;
  if (!destructor) {
    // Hold a reference to ourselves to prevent our DTOR from being called
    // while finalizing. Automatically released upon returning.
    self = this;
  }

  if (mPipeTransport) {
    mPipeTransport->Terminate();
  }

  // Release owning refs
  mURI           = nsnull;
  mOriginalURI   = nsnull;

  mPipeTransport = nsnull;
  mPipeRequest   = nsnull;

  mListener      = nsnull;
  mContext       = nsnull;

  mLoadGroup = nsnull;
  mCallbacks = nsnull;
  mProgress = nsnull;

  return rv;
}

//
// --------------------------------------------------------------------------
// nsISupports implementation...
// --------------------------------------------------------------------------
//

NS_IMPL_THREADSAFE_ISUPPORTS5(nsPipeChannel,
                              nsIPipeChannel,
                              nsIChannel,
                              nsIRequest,
                              nsIStreamListener,
                              nsIPipeTransportHeaders)

///////////////////////////////////////////////////////////////////////////////
// nsIPipeChannel methods
///////////////////////////////////////////////////////////////////////////////

NS_IMETHODIMP
nsPipeChannel::Init(nsIURI* aURI,
                    nsIFile *executable,
                    const PRUnichar **args,
                    PRUint32 argCount,
                    const PRUnichar **env,
                    PRUint32 envCount,
                    PRUint32 timeoutMS,
                    const char *killString,
                    PRBool noMimeHeaders,
                    PRBool mergeStderr,
                    PRBool restricted,
                    nsIPipeListener* console)
{
  nsresult rv;

  DEBUG_LOG(("nsPipeChannel::Init:\n"));

  mRestricted = restricted;

  mURI = aURI;
  mOriginalURI = aURI;
  mNoMimeHeaders = noMimeHeaders;

  // Try to get URL from URI.
  nsCOMPtr<nsIURL> url( do_QueryInterface( aURI, &rv ) );

  if (url) {
    // Try to get MIME content type from URL (i.e., from file extension)
    // Note: We don't try to get content type from URIs which are not URLs,
    // because we have a very loose interpretation of an URI

    nsCOMPtr<nsIMIMEService> MIMEService (do_GetService("@mozilla.org/mime;1", &rv));
    NS_ENSURE_SUCCESS(rv, rv);

    nsCString contentType;
    rv = MIMEService->GetTypeFromURI(url, contentType);

    if (NS_SUCCEEDED(rv) && (contentType.Length() > 0)) {
      mContentType.Assign(contentType);
    }
  }

  // Create an instance of pipe transport
  mPipeTransport = do_CreateInstance(NS_PIPETRANSPORT_CONTRACTID, &rv);
  if (NS_FAILED(rv)) {

    DEBUG_LOG(("nsPipeChannel::Init: Failed to create pipe transport instance\n"));
    return rv;
  }

  PRBool noProxy = PR_FALSE;
  rv = mPipeTransport->Init(executable);
  NS_ENSURE_SUCCESS(rv, rv);
  return mPipeTransport->OpenPipe(args, argCount, env, envCount, timeoutMS, killString, noProxy, mergeStderr, console);

  if (NS_FAILED(rv)) {

    DEBUG_LOG(("nsPipeChannel::Init: Failed to initialize pipe transport\n"));
    return rv;
  }

  // Close process STDIN
  rv = mPipeTransport->CloseStdin();
  NS_ENSURE_SUCCESS(rv, rv);

  mChannelState = CHANNEL_OPEN;
  return NS_OK;
}

///////////////////////////////////////////////////////////////////////////////
// nsIRequest methods
///////////////////////////////////////////////////////////////////////////////

NS_IMETHODIMP
nsPipeChannel::GetName(nsACString &result)
{
  DEBUG_LOG(("nsPipeChannel::GetName: \n"));

  if (!mURI)
    return NS_ERROR_FAILURE;

  return mURI->GetSpec(result);
}

NS_IMETHODIMP
nsPipeChannel::IsPending(PRBool *result)
{

  DEBUG_LOG(("nsPipeChannel::IsPending: \n"));
  *result = (mChannelState == CHANNEL_OPEN);
  return NS_OK;
}

NS_IMETHODIMP
nsPipeChannel::GetStatus(nsresult *status)
{

  DEBUG_LOG(("nsPipeChannel::GetStatus: \n"));
  *status = mStatus;
  return NS_OK;
}

NS_IMETHODIMP
nsPipeChannel::Cancel(nsresult status)
{
  DEBUG_LOG(("nsPipeChannel::Cancel: \n"));
  // Need a non-zero status code to cancel
  if (status == NS_OK)
    return NS_ERROR_FAILURE;

  if (mStatus == NS_OK)
    mStatus = status;

  if (mPipeRequest)
    mPipeRequest->Cancel(mStatus);

  return Finalize(PR_FALSE);
}

NS_IMETHODIMP
nsPipeChannel::Suspend(void)
{

  DEBUG_LOG(("nsPipeChannel::Suspend: \n"));
  return NS_OK;
}


NS_IMETHODIMP
nsPipeChannel::Resume(void)
{

  DEBUG_LOG(("nsPipeChannel::Resume: \n"));
  return NS_OK;
}


NS_IMETHODIMP
nsPipeChannel::GetLoadGroup(nsILoadGroup * *aLoadGroup)
{

  DEBUG_LOG(("nsPipeChannel::GetLoadGroup: \n"));
  NS_IF_ADDREF(*aLoadGroup = mLoadGroup);
  return NS_OK;
}

NS_IMETHODIMP
nsPipeChannel::SetLoadGroup(nsILoadGroup* aLoadGroup)
{

  DEBUG_LOG(("nsPipeChannel::SetLoadGroup: \n"));
  mLoadGroup = aLoadGroup;
  return NS_OK;
}

NS_IMETHODIMP
nsPipeChannel::GetLoadFlags(nsLoadFlags *aLoadFlags)
{

  DEBUG_LOG(("nsPipeChannel::GetLoadFlags: \n"));
  *aLoadFlags = mLoadFlags;
  return NS_OK;
}

NS_IMETHODIMP
nsPipeChannel::SetLoadFlags(nsLoadFlags aLoadFlags)
{

  DEBUG_LOG(("nsPipeChannel::SetLoadFlags: \n"));
  mLoadFlags = aLoadFlags;
  return NS_OK;
}

///////////////////////////////////////////////////////////////////////////////
// nsIChannel methods:
///////////////////////////////////////////////////////////////////////////////

NS_IMETHODIMP
nsPipeChannel::GetOriginalURI(nsIURI* *aURI)
{

  DEBUG_LOG(("nsPipeChannel::GetOriginalURI: \n"));
  NS_IF_ADDREF(*aURI = mOriginalURI.get());
  return NS_OK;
}

NS_IMETHODIMP
nsPipeChannel::SetOriginalURI(nsIURI* aURI)
{

  DEBUG_LOG(("nsPipeChannel::SetOriginalURI: \n"));
  if (!mRestricted) {
    // Change original URI only for unrestricted channels
    mOriginalURI = aURI;
  }
  return NS_OK;
}

NS_IMETHODIMP
nsPipeChannel::GetURI(nsIURI* *aURI)
{

  DEBUG_LOG(("nsPipeChannel::GetURI: \n"));
  NS_IF_ADDREF(*aURI = mURI.get());
  return NS_OK;
}

NS_IMETHODIMP
nsPipeChannel::GetContentType(nsACString &aContentType)
{
  if (mContentType.IsEmpty() || mContentType.Equals(UNKNOWN_CONTENT_TYPE)) {
    aContentType = TEXT_PLAIN;
  } else {
    aContentType = mContentType;
  }

  DEBUG_LOG(("nsPipeChannel::GetContentType: content-type: %s\n", mContentType.get()));
  return NS_OK;
}

NS_IMETHODIMP
nsPipeChannel::SetContentType(const nsACString &aContentType)
{

  NS_ParseContentType(aContentType, mContentType, mContentCharset);
  DEBUG_LOG(("nsPipeChannel::SetContentType: %s\n", mContentType.get()));
  return NS_OK;
}

NS_IMETHODIMP
nsPipeChannel::GetContentCharset(nsACString &aContentCharset)
{
  aContentCharset = mContentCharset;
  DEBUG_LOG(("nsPipeChannel::GetContentCharset: content-type: %s\n", mContentCharset.get()));
  return NS_OK;
}

NS_IMETHODIMP
nsPipeChannel::SetContentCharset(const nsACString &aContentCharset)
{

  mContentCharset = aContentCharset;
  DEBUG_LOG(("nsPipeChannel::SetContentCharset: %s\n", mContentCharset.get()));
  return NS_OK;
}


#if MOZILLA_MAJOR_VERSION > 8
NS_IMETHODIMP
nsPipeChannel::GetContentDisposition(PRUint32 *)
{
  // not available -> throw error as specified in nsIChannel.idl
  return NS_ERROR_NOT_AVAILABLE;
}

NS_IMETHODIMP
nsPipeChannel::GetContentDispositionHeader(nsACString &dummy)
{
  // not available -> throw error as specified in nsIChannel.idl
  return NS_ERROR_NOT_AVAILABLE;
}

NS_IMETHODIMP
nsPipeChannel::GetContentDispositionFilename(nsAString &dummy)
{
  // not available -> throw error as specified in nsIChannel.idl
  return NS_ERROR_NOT_AVAILABLE;
}

#endif

NS_IMETHODIMP
nsPipeChannel::GetContentLength(IPCLong *aContentLength)
{
  DEBUG_LOG(("nsPipeChannel::GetContentLength: \n"));
  *aContentLength = mContentLength;
  return NS_OK;
}

NS_IMETHODIMP
nsPipeChannel::SetContentLength(IPCLong aContentLength)
{
  DEBUG_LOG(("nsPipeChannel::SetContentLength: %d\n", aContentLength));
  mContentLength = aContentLength;
  return NS_OK;
}

NS_IMETHODIMP
nsPipeChannel::GetOwner(nsISupports * *aOwner)
{
  DEBUG_LOG(("nsPipeChannel::GetOwner: \n"));
  NS_IF_ADDREF(*aOwner = mOwner);
  return NS_OK;
}

NS_IMETHODIMP
nsPipeChannel::SetOwner(nsISupports * aOwner)
{
  DEBUG_LOG(("nsPipeChannel::SetOwner: \n"));
  mOwner = aOwner;
  return NS_OK;
}

NS_IMETHODIMP
nsPipeChannel::GetNotificationCallbacks(nsIInterfaceRequestor* *aNotificationCallbacks)
{
  DEBUG_LOG(("nsPipeChannel::GetNotificationCallbacks: \n"));
  NS_IF_ADDREF(*aNotificationCallbacks = mCallbacks.get());
  return NS_OK;
}

NS_IMETHODIMP
nsPipeChannel::SetNotificationCallbacks(nsIInterfaceRequestor* aNotificationCallbacks)
{

  DEBUG_LOG(("nsPipeChannel::SetNotificationCallbacks: \n"));
  mCallbacks = aNotificationCallbacks;

  // Get a nsIProgressEventSink so that we can fire status/progress on it-
  if (mCallbacks) {
    nsCOMPtr<nsISupports> sink;
    nsresult rv = mCallbacks->GetInterface(NS_GET_IID(nsIProgressEventSink),
                                           getter_AddRefs(sink));
    if (NS_FAILED(rv)) return NS_OK;        // don't need a progress event sink

    // Now generate a proxied event sink
    nsCOMPtr<nsIProxyObjectManager> proxyMgr =
                                 do_GetService(NS_XPCOMPROXY_CONTRACTID, &rv);

    NS_ENSURE_SUCCESS(rv, rv);

    rv = proxyMgr->GetProxyForObject(NS_PROXY_TO_MAIN_THREAD, // primordial thread
                                     NS_GET_IID(nsIProgressEventSink),
                                     sink,
                                     NS_PROXY_ASYNC | NS_PROXY_ALWAYS,
                                     getter_AddRefs(mProgress));
    // TODO: ignore rv value here on purpose??
  }

  return NS_OK;
}


NS_IMETHODIMP
nsPipeChannel::GetSecurityInfo(nsISupports * *aSecurityInfo)
{

  DEBUG_LOG(("nsPipeChannel:GetSecurityInfo:: \n"));
  *aSecurityInfo = nsnull;
  return NS_OK;
}


NS_IMETHODIMP
nsPipeChannel::Open(nsIInputStream **result)
{

  DEBUG_LOG(("nsPipeChannel::Open: \n"));
  return mPipeTransport->OpenInputStream(0, PRUint32(-1), 0, result);
}


NS_IMETHODIMP
nsPipeChannel::AsyncOpen(nsIStreamListener *listener, nsISupports *ctxt)
{
  nsresult rv;

  DEBUG_LOG(("nsPipeChannel::AsyncOpen:\n"));

  if (listener) {
    nsCOMPtr<nsIProxyObjectManager> proxyMgr =
                                 do_GetService(NS_XPCOMPROXY_CONTRACTID, &rv);

    NS_ENSURE_SUCCESS(rv, rv);

    rv = proxyMgr->GetProxyForObject(nsnull /* will that work?? */,
                                     NS_GET_IID(nsIStreamListener),
                                     listener,
                                     NS_PROXY_ASYNC | NS_PROXY_ALWAYS,
                                     getter_AddRefs(mListener));
    NS_ENSURE_SUCCESS(rv, rv);
  }

  rv = mPipeTransport->SetHeaderProcessor(mNoMimeHeaders ? nsnull : (nsIPipeTransportHeaders*) this);
  NS_ENSURE_SUCCESS(rv, rv);

  return mPipeTransport->AsyncRead(this, ctxt, 0, PRUint32(-1), 0,
                                   getter_AddRefs(mPipeRequest));
}

///////////////////////////////////////////////////////////////////////////////
// nsIRequestObserver methods
///////////////////////////////////////////////////////////////////////////////

NS_IMETHODIMP
nsPipeChannel::OnStartRequest(nsIRequest *aRequest, nsISupports *aContext)
{
  nsresult rv = NS_OK;

#ifdef FORCE_PR_LOG
  nsCOMPtr<nsIThread> myThread;
  rv = ENIG_GET_THREAD(myThread);
  DEBUG_LOG(("nsPipeChannel::OnStartRequest: myThread=%p\n", myThread.get()));
#endif

  if (!mPostingData) {
    // Not posting data
    if (mLoadGroup) {

      DEBUG_LOG(("nsPipeChannel::OnStartRequest: AddRequest\n"));
      rv = mLoadGroup->AddRequest(this, nsnull);
      NS_ENSURE_SUCCESS(rv, rv);
    }

    return mListener->OnStartRequest(this, aContext);
  } else {
    // Posting data; ignore OnStartRequest from AyncWrite
    return NS_OK;
  }
}

NS_IMETHODIMP
nsPipeChannel::OnStopRequest(nsIRequest* aRequest, nsISupports* aContext,
                            nsresult aStatus)
{
  nsresult rv = NS_OK;

#ifdef FORCE_PR_LOG
  nsCOMPtr<nsIThread> myThread;
  rv = ENIG_GET_THREAD(myThread);
  DEBUG_LOG(("nsPipeChannel::OnStopRequest: myThread=%p\n", myThread.get()));
#endif

  if (mChannelState == CHANNEL_CLOSED)
    return NS_OK;

  if (NS_SUCCEEDED(aStatus) && mPostingData) {
    // Posting data; posting has been successfully completed
    mPostingData = PR_FALSE;

    return NS_OK;
  }

  // Close channel
  mChannelState = CHANNEL_CLOSED;

  // Error status or not posting data; stop request
  if (mLoadGroup && !mPostingData) {

    DEBUG_LOG(("nsPipeChannel::OnStopRequest: RemoveRequest\n"));
    rv = mLoadGroup->RemoveRequest(this, nsnull, aStatus);
    NS_ENSURE_SUCCESS(rv, rv);
  }

  rv = mListener->OnStopRequest(this, aContext, aStatus);

  if (mProgress && !(mLoadFlags & LOAD_BACKGROUND)) {
    nsAutoString statusStr;
    statusStr.Assign(NS_LITERAL_STRING(""));
    if (mURI) {
      nsCAutoString urlSpec;
      rv = mURI->GetSpec(urlSpec);
      if (NS_SUCCEEDED(rv))
        statusStr.Assign(NS_ConvertUTF8toUTF16(urlSpec));
    }

    rv = mProgress->OnStatus(this, mContext,
                             NS_NET_STATUS_RECEIVING_FROM,
                             statusStr.get());
    NS_ASSERTION(NS_SUCCEEDED(rv), "unexpected OnStopRequest failure");
  }

  // Release owning references to PipeTransport, PipeRequest, Listener,
  //   and Context
  // (Use Finalize instead?)
  mPipeTransport = nsnull;
  mPipeRequest   = nsnull;
  mListener      = nsnull;
  mContext       = nsnull;

  return rv;
}

///////////////////////////////////////////////////////////////////////////////
// nsIStreamListener method
///////////////////////////////////////////////////////////////////////////////

NS_IMETHODIMP
nsPipeChannel::OnDataAvailable(nsIRequest* aRequest, nsISupports* aContext,
                              nsIInputStream *aInputStream,
                              PRUint32 aSourceOffset,
                              PRUint32 aLength)
{
  nsresult rv = NS_OK;

  if (mChannelState != CHANNEL_OPEN)
    return NS_ERROR_FAILURE;

#ifdef FORCE_PR_LOG
  nsCOMPtr<nsIThread> myThread;
  rv = ENIG_GET_THREAD(myThread);
  DEBUG_LOG(("nsPipeChannel::OnDataAvailable: myThread=%p, offset=%d, length=%d\n",
         myThread.get(), aSourceOffset, aLength));
#endif

  mContentReceived += aLength;

  if (mProgress && !(mLoadFlags & LOAD_BACKGROUND)) {
    IPCLong contentMax = (mContentLength >= 0) ? mContentLength : 0;
    rv = mProgress->OnProgress(this, aContext,
                               mContentReceived, contentMax);
    NS_ASSERTION(NS_SUCCEEDED(rv), "unexpected OnProgress failure");
  }

  rv = mListener->OnDataAvailable(this, aContext, aInputStream,
                                  aSourceOffset, aLength);

  return rv;
}

///////////////////////////////////////////////////////////////////////////////
// nsIPipeTransportHeaders methods:
///////////////////////////////////////////////////////////////////////////////

NS_IMETHODIMP
nsPipeChannel::ParseMimeHeaders(const char* mimeHeaders, PRUint32 count,
                               PRInt32 *retval)
{
  nsresult rv;

  DEBUG_LOG(("nsPipeChannel::ParseMimeHeaders, count=%d\n", count));
  if (!mimeHeaders || !retval)
    return NS_ERROR_NULL_POINTER;

  // Create headers string
  nsCAutoString headers(mimeHeaders, count);

  PRBool foundStatusLine = PR_FALSE;
  if ((headers.Length() >= 5)
      && (PL_strncmp(headers.get(), "HTTP/", 5) == 0)) {
    // Look for possible HTTP header line preceding MIME headers

    PRInt32 lineEnd = headers.Find("\n");

    if (lineEnd != -1) {
      // Strip HTTP header line
      headers.Cut(0, lineEnd+1);
      foundStatusLine = PR_TRUE;
    }
  }

  // Replace CRLF with just LF
  PRInt32 lineIndex = 0;

  while (lineIndex != -1) {
    lineIndex = headers.Find("\r\n");
    if (lineIndex != -1) {
      headers.Replace(lineIndex, 2, "\n", 1);
    }
  }

  if (headers.Length() < 2)
    return NS_ERROR_FAILURE;

  PRBool noHeaders = PR_FALSE;
  if (headers.CharAt(0) == '\n') {
    // First line is empty; no headers
    noHeaders = PR_TRUE;

  } else if ( (headers.CharAt(headers.Length()-2) != '\n') ||
              (headers.CharAt(headers.Length()-1) != '\n') ) {
    // No empty line terminating header
    noHeaders = PR_TRUE;
  }

  // Eliminate all leading whitespace (including linefeeds)
  headers.Trim(" \t\n", PR_TRUE, PR_FALSE);

  if (mContentType.Equals(UNKNOWN_CONTENT_TYPE)) {
    // Use some heuristics to guess type of unknown content even before
    // trying to parse the headers

    if (headers.CharAt(0) == '<') {
      // Start of markup?
      if (headers.Find("<html>", PR_TRUE) == 0) {
        // Set content type to text/html
        mContentType = TEXT_HTML;
      }
      // TO BE IMPLEMENTED: Look for doctype, xml, ...
    }
  }

  if (mContentType.Equals(UNKNOWN_CONTENT_TYPE)) {
    // Still unknown content type; check if headers are all printable ASCII
    PRBool printableAscii = PR_TRUE;

    for (PRUint32 j=0; j<count; j++) {
      char ch = (char) mimeHeaders[j];
      if ( (ch < '\t') ||
           ((ch > '\r') && (ch < ' ')) ||
           (ch >= 0x7F) ) {
        printableAscii = PR_FALSE;
        break;
      }
    }

    if (printableAscii) {
      // Treat unknown content as plain text by default
      mContentType = TEXT_PLAIN;
    } else {
      // Treat unknown content as octet stream by default
      mContentType = APPLICATION_OCTET_STREAM;
    }
  }

  if (noHeaders)
    return NS_ERROR_FAILURE;

  // Handle continuation of MIME headers, i.e., newline followed by a space
  lineIndex = 0;

  while (lineIndex != -1) {
    lineIndex = headers.Find("\n");
    if (lineIndex != -1) {
      headers.Replace(lineIndex, 1, " ", 1);
    }
  }

  // Default values for header content type/length (to be overridden by header)
  mHeaderContentType   = UNKNOWN_CONTENT_TYPE;
  mHeaderContentLength = mContentLength;
  mHeaderCharset = "";

  PRUint32 offset = 0;
  while (offset < headers.Length()) {
    PRInt32 lineEnd = headers.Find("\n", offset);

    if (lineEnd == -1) {
      // Header line terminator not found
      NS_NOTREACHED("lineEnd == kNotFound");
      return NS_ERROR_FAILURE;
    }

    // Normal exit if empty header line
    if (lineEnd == (int)offset)
      break;

    // Parse header line
    rv = ParseHeader((headers.get())+offset, lineEnd - offset);
    NS_ENSURE_SUCCESS(rv, rv);

    offset = lineEnd+1;
  }

  // If content type not found, assume header not found
  if (mHeaderContentType.Equals(UNKNOWN_CONTENT_TYPE))
    return NS_ERROR_FAILURE;

  // Copy back content type/length after successful parsing of headers
  mContentType   = mHeaderContentType;
  mContentLength = mHeaderContentLength;


  DEBUG_LOG(("nsPipeChannel::ParseMimeHeaders END: cType=%s, clen=%d\n",
         mContentType.get(), mContentLength));
  return NS_OK;
}

nsresult
nsPipeChannel::ParseHeader(const char* header, PRUint32 count)
{

  DEBUG_LOG(("nsPipeChannel::ParseHeader, count=%d\n", count));

  if (!header || (count <= 0) )
    return NS_OK;

  // Create header string
  nsCAutoString headerStr(header, count);

  PRInt32 colonOffset;
  colonOffset = headerStr.Find(":");
  if (colonOffset == -1) {
    // Malformed headerStr ... simulate NS4.x/IE behaviour trying SPC/TAB as delimiters

    colonOffset = headerStr.Find(" ");
    if (colonOffset == -1) {

      colonOffset = headerStr.Find("\t");
      if (colonOffset == -1) {
        return NS_ERROR_FAILURE;
      }
    }
  }

  // Null header key not allowed
  if (colonOffset == 0)
    return NS_ERROR_FAILURE;

  // Extract header key (not case-sensitive)
  nsCAutoString headerKey;
  // headerStr.Left(headerKey, colonOffset);
  headerStr = Substring(headerStr, 0, colonOffset);

  ToLowerCase(headerKey);

  // Extract header value, trimming leading/trailing whitespace
  nsCAutoString headerValue;
  // headerStr.Right(headerValue, headerStr.Length() - colonOffset - 1);
  headerValue = Substring(headerStr, colonOffset + 1, headerStr.Length());
  headerValue.Trim(" ");


  DEBUG_LOG(("nsPipeChannel::ParseHeader, key='%s', value='%s'\n",
         headerKey.get(), headerValue.get()));

  if (headerKey.Equals("content-type")) {
    // Ignore comments
    PRInt32 parenOffset = headerValue.Find("(");
    if (parenOffset > -1) {
      // headerValue.Truncate(parenOffset);
      headerValue = Substring(headerValue, 0, parenOffset);
      headerValue.Trim(" ", PR_FALSE);
    }

    if (!headerValue.IsEmpty()) {
      PRInt32 semicolonOffset = headerValue.Find(";");
      if (semicolonOffset == -1) {
        // No charset stuff
        mHeaderContentType = headerValue.get();

      } else {
        nsCAutoString buf;
        // headerValue.Left(buf, semicolonOffset);
        // mHeaderContentType = buf.get();

        mHeaderContentType = Substring(headerValue, semicolonOffset);

        // Look for charset
        // headerValue.Right(buf, headerValue.Length() - semicolonOffset - 1);
        buf = Substring(headerValue, semicolonOffset + 1, headerValue.Length());
        buf.Trim(" ");
        if (buf.Find("charset=", PR_TRUE) == 0) {
          // Charset found
          buf.Cut(0, 8);
          mHeaderCharset = buf.get();
        }
      }
    }
  }

  if (headerKey.Equals("content-length")) {
    PRUint32 status;
    mHeaderContentLength = headerValue.ToInteger(&status);
    if (NS_FAILED((nsresult) status))
      return NS_ERROR_FAILURE;
  }

  return NS_OK;
}
