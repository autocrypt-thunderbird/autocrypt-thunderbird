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
#include "prlog.h"
#include "nsCOMPtr.h"
#include "nsAutoLock.h"
#include "nsIInputStream.h"
#include "nsIThread.h"
#include "nsStringAPI.h"
#include "nsNetUtil.h"
#include "mimehdrs2.h"
#include "nsMimeTypes.h"
#include "nsMailHeaders.h"
#ifdef _ENIG_MOZILLA_1_8
#include "nsFileStream.h"
#endif

#include "nsEnigMimeListener.h"

#ifdef PR_LOGGING
PRLogModuleInfo* gEnigMimeListenerLog = NULL;
#endif

#define ERROR_LOG(args)    PR_LOG(gEnigMimeListenerLog,PR_LOG_ERROR,args)
#define WARNING_LOG(args)  PR_LOG(gEnigMimeListenerLog,PR_LOG_WARNING,args)
#define DEBUG_LOG(args)    PR_LOG(gEnigMimeListenerLog,PR_LOG_DEBUG,args)

#define NS_PIPE_CONSOLE_BUFFER_SIZE   (1024)

static const PRUint32 kCharMax = 1024;

#define MK_MIME_ERROR_WRITING_FILE -1

///////////////////////////////////////////////////////////////////////////////

// nsEnigMimeListener implementation

// nsISupports implementation
NS_IMPL_THREADSAFE_ISUPPORTS4(nsEnigMimeListener,
                              nsIEnigMimeListener,
                              nsIRequestObserver,
                              nsIStreamListener,
                              nsIInputStream)


// nsEnigMimeListener implementation
nsEnigMimeListener::nsEnigMimeListener()
  : mInitialized(PR_FALSE),
    mRequestStarted(PR_FALSE),
    mSkipHeaders(PR_FALSE),
    mSkipBody(PR_FALSE),

    mContentType(""),
    mContentCharset(""),
    mContentBoundary(""),
    mContentProtocol(""),
    mContentMicalg(""),

    mContentEncoding(""),
    mContentDisposition(""),
    mContentLength(-1),

    mDecodeContent(PR_FALSE),
    mDecoderData(nsnull),

    mLinebreak(""),
    mHeaders(""),
    mDataStr(""),
    mHeaderSearchCounter(0),

    mHeadersFinalCR(PR_FALSE),
    mHeadersLinebreak(2),

    mMaxHeaderBytes(0),
    mDataOffset(0),

    mStreamBuf(nsnull),
    mStreamOffset(0),
    mStreamLength(0),
    mSubPartTreatment(PR_FALSE),

    mListener(nsnull),
    mContext(nsnull)
{
    NS_INIT_ISUPPORTS();

#ifdef PR_LOGGING
  if (gEnigMimeListenerLog == nsnull) {
    gEnigMimeListenerLog = PR_NewLogModule("nsEnigMimeListener");
  }
#endif

#ifdef FORCE_PR_LOG
  nsresult rv;
  nsCOMPtr<nsIThread> myThread;
  rv = ENIG_GET_THREAD(myThread);
  DEBUG_LOG(("nsEnigMimeListener:: <<<<<<<<< CTOR(%p): myThread=%p\n",
         this, myThread.get()));
#endif
}


nsEnigMimeListener::~nsEnigMimeListener()
{
  nsresult rv;
#ifdef FORCE_PR_LOG
  nsCOMPtr<nsIThread> myThread;
  rv = ENIG_GET_THREAD(myThread);
  DEBUG_LOG(("nsEnigMimeListener:: >>>>>>>>> DTOR(%p): myThread=%p\n",
         this, myThread.get()));
#endif

  if (mDecoderData) {
    // Clear decoder buffer
    MimeDecoderDestroy(mDecoderData, PR_FALSE);
    mDecoderData = nsnull;
  }

  // Release owning refs
  mListener = nsnull;
  mContext = nsnull;
}


///////////////////////////////////////////////////////////////////////////////
// nsIEnigMimeListener methods
///////////////////////////////////////////////////////////////////////////////

NS_IMETHODIMP
nsEnigMimeListener::Init(nsIStreamListener* listener, nsISupports* ctxt,
                         PRUint32 maxHeaderBytes, PRBool skipHeaders,
                         PRBool skipBody, PRBool decodeContent)
{
  DEBUG_LOG(("nsEnigMimeListener::Init: (%p) %d, %d, %d, %d\n", this,
             maxHeaderBytes, skipHeaders, skipBody, decodeContent));

  if (!listener)
    return NS_ERROR_NULL_POINTER;

  mListener = listener;
  mContext = ctxt;

  mMaxHeaderBytes = maxHeaderBytes;

  mSkipHeaders = skipHeaders;
  mSkipBody = skipBody;
  mDecodeContent = decodeContent;

  // There is implicitly a newline preceding the first character
  mHeadersLinebreak = 2;
  mHeadersFinalCR = PR_FALSE;

  mInitialized = PR_TRUE;

  return NS_OK;
}


NS_IMETHODIMP
nsEnigMimeListener::Write(const char* buf, PRUint32 count,
                          nsIRequest* aRequest, nsISupports* aContext)
{
  nsresult rv;

  DEBUG_LOG(("nsEnigMimeListener::Write: (%p) %d\n", this, count));

  if (mRequestStarted)
    return Transmit(buf, count, aRequest, aContext);

  // Search for headers
  PRBool startingRequest = HeaderSearch(buf, count);
  if (!startingRequest)
    return NS_OK;

  rv = StartRequest(aRequest, aContext);
  if (NS_FAILED(rv))
    return rv;

  return NS_OK;
}

static nsresult
EnigMimeListener_write(const char *buf, PRInt32 size, void *closure)
{
  DEBUG_LOG(("nsEnigMimeListener::EnigMimeListener_write: (%p) %d\n", closure, size));

  if (!closure)
    return NS_ERROR_FAILURE;

  nsEnigMimeListener* enigMimeListener = (nsEnigMimeListener *) closure;

  return enigMimeListener->SendStream(buf, size, nsnull, nsnull);
}


NS_METHOD
nsEnigMimeListener::Transmit(const char* buf, PRUint32 count,
                             nsIRequest* aRequest, nsISupports* aContext)
{
  DEBUG_LOG(("nsEnigMimeListener::Transmit: (%p) %d\n", this, count));

  if (!mDecoderData) {
    return SendStream(buf, count, aRequest, aContext);
  }

  // Decode data before transmitting to listener
  int status = MimeDecoderWrite(mDecoderData, buf, count);

  return (status == 0) ? NS_OK : NS_ERROR_FAILURE;
}


NS_METHOD
nsEnigMimeListener::SendStream(const char* buf, PRUint32 count,
                               nsIRequest* aRequest, nsISupports* aContext)
{
  nsresult rv;

  DEBUG_LOG(("nsEnigMimeListener::SendStream: (%p) %d\n", this, count));

  if (!mListener)
    return NS_OK;

  // Transmit data to listener
  mStreamBuf = buf;
  mStreamOffset = 0;
  mStreamLength = count;

  rv = mListener->OnDataAvailable(aRequest,
                                  mContext ? mContext.get() : aContext,
                                  (nsIInputStream*)(this),
                                  0, count);
  Close();

  return rv;
}


NS_IMETHODIMP
nsEnigMimeListener::GetHeaders(nsACString &aHeaders)
{
  aHeaders = mHeaders;
  DEBUG_LOG(("nsEnigMimeListener::GetHeaders: %d\n", mHeaders.Length()));
  return NS_OK;
}

NS_IMETHODIMP
nsEnigMimeListener::GetLinebreak(nsACString &aLinebreak)
{
  aLinebreak = mLinebreak;
  DEBUG_LOG(("nsEnigMimeListener::GetLinebreak: %d\n", mLinebreak.Length()));
  return NS_OK;
}

NS_IMETHODIMP
nsEnigMimeListener::GetContentType(nsACString &aContentType)
{
  aContentType = mContentType;
  DEBUG_LOG(("nsEnigMimeListener::GetContentType: %s\n", mContentType.get()));
  return NS_OK;
}

NS_IMETHODIMP
nsEnigMimeListener::GetContentCharset(nsACString &aContentCharset)
{
  aContentCharset = mContentCharset;
  DEBUG_LOG(("nsEnigMimeListener::GetContentCharset: %s\n", mContentCharset.get()));
  return NS_OK;
}

NS_IMETHODIMP
nsEnigMimeListener::GetContentBoundary(nsACString &aContentBoundary)
{
  aContentBoundary = mContentBoundary;
  DEBUG_LOG(("nsEnigMimeListener::GetContentBoundary: %s\n", mContentBoundary.get()));
  return NS_OK;
}

NS_IMETHODIMP
nsEnigMimeListener::GetContentProtocol(nsACString &aContentProtocol)
{
  aContentProtocol = mContentProtocol;
  DEBUG_LOG(("nsEnigMimeListener::GetContentProtocol: %s\n", mContentProtocol.get()));
  return NS_OK;
}

NS_IMETHODIMP
nsEnigMimeListener::GetContentMicalg(nsACString &aContentMicalg)
{
  aContentMicalg = mContentMicalg;
  DEBUG_LOG(("nsEnigMimeListener::GetContentMicalg: %s\n", mContentMicalg.get()));
  return NS_OK;
}

NS_IMETHODIMP
nsEnigMimeListener::GetContentEncoding(nsACString &aContentEncoding)
{
  aContentEncoding = mContentEncoding;
  DEBUG_LOG(("nsEnigMimeListener::GetContentEncoding: %s\n", mContentEncoding.get()));
  return NS_OK;
}

NS_IMETHODIMP
nsEnigMimeListener::GetContentDisposition(nsACString &aContentDisposition)
{
  aContentDisposition = mContentDisposition;
  DEBUG_LOG(("nsEnigMimeListener::GetContentDisposition: %s\n", mContentDisposition.get()));
  return NS_OK;
}

NS_IMETHODIMP
nsEnigMimeListener::GetContentLength(PRInt32 *aContentLength)
{
  DEBUG_LOG(("nsEnigMimeListener::GetContentLength: \n"));
  *aContentLength = mContentLength;
  return NS_OK;
}

///////////////////////////////////////////////////////////////////////////////
// nsIRequestObserver methods
///////////////////////////////////////////////////////////////////////////////

NS_IMETHODIMP
nsEnigMimeListener::OnStartRequest(nsIRequest *aRequest,
                                   nsISupports *aContext)
{
  DEBUG_LOG(("nsEnigMimeListener::OnStartRequest: (%p)\n", this));

  if (!mInitialized)
    return NS_ERROR_NOT_INITIALIZED;

  return NS_OK;
}

NS_IMETHODIMP
nsEnigMimeListener::OnStopRequest(nsIRequest* aRequest,
                                  nsISupports* aContext,
                                  nsresult aStatus)
{
  nsresult rv = NS_OK;

  DEBUG_LOG(("nsEnigMimeListener::OnStopRequest: (%p)\n", this));

  // Ensure that OnStopRequest call chain does not break by failing softly

  if (!mRequestStarted) {

    if (mHeadersFinalCR) {
      // Handle special case of terminating CR with no content
      mHeadersFinalCR = PR_FALSE;

      mLinebreak = "\r";
      mHeaders = mDataStr;

      if (mSkipHeaders) {
        // Skip headers
        mDataStr = "";
      }
    }

    rv = StartRequest(aRequest, aContext);
    if (NS_FAILED(rv))
      aStatus = NS_BINDING_ABORTED;
  }

  if (mDecoderData) {
    // Clear decoder buffer
    MimeDecoderDestroy(mDecoderData, PR_FALSE);
    mDecoderData = nsnull;
  }

  if (mListener) {
    rv = mListener->OnStopRequest(aRequest,
                                  mContext ? mContext.get() : aContext,
                                  aStatus);
    if (NS_FAILED(rv))
      aStatus = NS_BINDING_ABORTED;
  }

  // Release owning refs
  mListener = nsnull;
  mContext = nsnull;

  return (aStatus == NS_BINDING_ABORTED) ? NS_ERROR_FAILURE : NS_OK;
}

///////////////////////////////////////////////////////////////////////////////
// nsIStreamListener method
///////////////////////////////////////////////////////////////////////////////

NS_IMETHODIMP
nsEnigMimeListener::OnDataAvailable(nsIRequest* aRequest,
                                    nsISupports* aContext,
                                    nsIInputStream *aInputStream,
                                    PRUint32 aSourceOffset,
                                    PRUint32 aLength)
{
  nsresult rv = NS_OK;

  DEBUG_LOG(("nsEnigMimeListener::OnDataAvailable: (%p) %d\n", this, aLength));

  if (!mInitialized)
    return NS_ERROR_NOT_INITIALIZED;

  char buf[kCharMax];
  PRUint32 readCount, readMax;

  while ((aLength > 0) && (!mRequestStarted || mDecoderData) ) {
    // Searching for headers or decoding content

    readMax = (aLength < kCharMax) ? aLength : kCharMax;
    rv = aInputStream->Read((char *) buf, readMax, &readCount);
    if (NS_FAILED(rv)){
      ERROR_LOG(("nsEnigMimeListener::OnDataAvailable: Error in reading from input stream, %x\n", rv));
      return rv;
    }

    if (readCount <= 0)
      break;

    aLength -= readCount;
    aSourceOffset += readCount;

    rv = Write(buf, readCount, aRequest, aContext);
    if (NS_FAILED(rv))
      return rv;
  }

  // Not searching for headers and not decoding content
  if (!mSkipBody && (aLength > 0) && mListener) {
    // Transmit body data unread
    rv = mListener->OnDataAvailable(aRequest,
                                    mContext ? mContext.get() : aContext,
                                    aInputStream, mDataOffset, aLength);
    mDataOffset += aLength;

    if (NS_FAILED(rv))
      return rv;
  }

  return NS_OK;
}


NS_IMETHODIMP
nsEnigMimeListener::StartRequest(nsIRequest* aRequest, nsISupports* aContext)
{
  nsresult rv;

  DEBUG_LOG(("nsEnigMimeListener::StartRequest: (%p)\n", this));

  if (!mHeaders.IsEmpty()) {
    // Try to parse headers
    ParseMimeHeaders(mHeaders.get(), mHeaders.Length());
  }

  if (mListener) {
    rv = mListener->OnStartRequest(aRequest,
                                   mContext ? mContext.get() : aContext);
    if (NS_FAILED(rv))
      return rv;
  }

  mRequestStarted = PR_TRUE;

  if (mHeaders.IsEmpty() && mSkipBody) {
    // No headers terminated and skipping body; so discard whatever we have
    mDataStr = "";
  }

  if (!mDataStr.IsEmpty()) {
    // Transmit header/body data already in buffer
    nsCAutoString temStr( mDataStr );

    mDataOffset += mDataStr.Length();
    mDataStr = "";

    rv = Transmit(temStr.get(), temStr.Length(), aRequest, aContext);
    if (NS_FAILED(rv))
      return rv;
  }

  return NS_OK;
}


PRBool
nsEnigMimeListener::HeaderSearch(const char* buf, PRUint32 count)
{
  DEBUG_LOG(("nsEnigMimeListener::HeaderSearch: (%p) count=%d\n", this, count));

  mHeaderSearchCounter++;

  if (mMaxHeaderBytes <= 0) {
    // Not looking for MIME headers; start request immediately
    return PR_TRUE;
  }

  if (!count)
    return PR_FALSE;

  PRUint32 bytesAvailable = mMaxHeaderBytes - mDataStr.Length();
  NS_ASSERTION(bytesAvailable > 0, "bytesAvailable <= 0");

  PRBool lastSegment = (bytesAvailable <= count);

  PRUint32 scanLen = lastSegment ? bytesAvailable : count;

  PRBool headersFound = PR_FALSE;
  PRUint32 offset = 0;
  PRUint32 startOffset = 0;
  PRUint32 j = 0;
  char ch;
  if (mSubPartTreatment) {
    // FIXME:
    // this is a HACK necessary because Mozilla does not deliver
    // a subpart starting with its headers (so we get the
    // part on a higher level and sort out things manually!)
    // there is (so far) no way to get the headers of an
    // arbitrary message mime part
    DEBUG_LOG(("nsEnigMimeListener::HeaderSearch: subparts treatment\n"));
    ch='\n';
    while(j<scanLen-3) {
      if (((ch=='\n') || (ch=='\r')) &&
          (buf[j]=='-') &&
          (buf[j+1]=='-') &&
          (buf[j+2]!='\n') &&
          (buf[j+2]!='\r'))
      {
          startOffset = j;
          DEBUG_LOG(("nsEnigMimeListener::HeaderSearch: startOffset=%d\n",startOffset));
          break;
      }
      ch=buf[j];
      j++;
    }

    // set j=startOffset needed if startOffset == 0!
    j=startOffset;
/*
    // Solution for how to do it, if the content-type info
    // would be available
    nsCAutoString cType("Content-Type: multipart/signed; micalg=pgp-sha1; protocol=\"application/pgp-signature\"; boundary=\"J2SCkAp4GZ/dPZZf\"\n\n");
    mDataStr.Append(cType.get(), cType.Length());
    mHeaders = cType;
    if (mSkipHeaders)
      mDataStr = "";
    if (!mSkipBody)
      mDataStr.Append(buf, count);

    mHeadersLinebreak = 0;
    mLinebreak = "\n";
*/
    mSubPartTreatment = PR_FALSE;
    // return PR_TRUE;
  }

  while (j<scanLen) {
    ch = buf[j];

    if (mHeadersFinalCR) {
      // End-of-headers found
      mHeadersFinalCR = PR_FALSE;

      if (ch == '\n') {
        offset = j+1;
        mLinebreak = "\r\n";
        DEBUG_LOG(("nsEnigMimeListener::HeaderSearch: Found final CRLF"));

      } else {
        offset = j;
        mLinebreak = "\r";
        DEBUG_LOG(("nsEnigMimeListener::HeaderSearch: Found final CR"));
      }

      headersFound = PR_TRUE;
      break;

    }

    if (ch == '\n') {

      if (mHeadersLinebreak == 2) {
        // End-of-headers found
        headersFound = PR_TRUE;

        offset = j+1;
        mLinebreak = "\n";
        DEBUG_LOG(("nsEnigMimeListener::HeaderSearch: Found final LF"));
        break;
      }

      mHeadersLinebreak = 2;

    } else if (ch == '\r') {

      if (mHeadersLinebreak > 0) {
        // Final CR
        mHeadersFinalCR = PR_TRUE;
      } else {
        mHeadersLinebreak = 1;
      }

    } else {
      mHeadersLinebreak = 0;
    }

    j++;
  }

  DEBUG_LOG(("nsEnigMimeListener::HeaderSearch: offset=%d\n", offset));

  if (headersFound) {
    // Copy headers out of stream buffer
    if (offset > 0)
      mDataStr.Append(buf+startOffset, offset-startOffset);

    mHeaders = mDataStr;

    if (mSkipHeaders) {
      // Skip headers
      mDataStr = "";
    }

    if (!mSkipBody && (offset < count)) {
      // Copy remaining data into stream buffer
     mDataStr.Append(buf+offset, count-offset);
    }

  } else if (!lastSegment) {
    // Save headers data
    mDataStr.Append(buf, count);
  }

  return headersFound || lastSegment;
}

static void
__ReplaceCSubstring (nsACString &string, const char* replace, const char* with)
{
	PRInt32 i = string.Find (replace);
	string.Replace (i, strlen (replace), with);
}

static void
__ReplaceCChar (nsACString &string, const char replace, const char with)
{
	PRInt32 i = string.FindChar (replace);
	string.Replace (i, 1, (const char*) &with, 1);
}

void
nsEnigMimeListener::ParseMimeHeaders(const char* mimeHeaders, PRUint32 count)
{
  DEBUG_LOG(("nsEnigMimeListener::ParseMimeHeaders, count=%d\n", count));

  // Copy headers string
  nsCAutoString headers(mimeHeaders, count);

  // Replace CRLF with just LF
  __ReplaceCSubstring(headers, "\r\n", "\n");

  // Replace CR with LF (for MAC-style line endings)
  __ReplaceCChar(headers, '\r', '\n');

  // Eliminate all leading whitespace (including linefeeds)
  headers.Trim(" \t\n", PR_TRUE, PR_FALSE);

  if (headers.Length() <= 3) {
    // No headers to parse
    return;
  }

  // Handle continuation of MIME headers, i.e., newline followed by whitespace
  __ReplaceCSubstring(headers, "\n ",  " ");
  __ReplaceCSubstring(headers, "\n\t", "\t");

  //DEBUG_LOG(("nsEnigMimeListener::ParseMimeHeaders: headers='%s'\n", headers.get()));

  PRUint32 offset = 0;
  while (offset < headers.Length()) {
    PRInt32 lineEnd = headers.FindChar('\n', offset);

    if (lineEnd < 0) {
      // Header line terminator not found
      NS_NOTREACHED("lineEnd == kNotFound");
      return;
    }

    // Normal exit if empty header line
    if (lineEnd == (int)offset)
      break;

    // Parse header line
    ParseHeader((headers.get())+offset, lineEnd - offset);

    offset = lineEnd+1;
  }

  if (mDecodeContent) {
    // Decode data
    if (mContentEncoding.Equals("base64", CaseInsensitiveCompare)) {

      mDecoderData = MimeB64DecoderInit(EnigMimeListener_write, (void*) this);

    } else if (mContentEncoding.Equals("quoted-printable", CaseInsensitiveCompare)) {

      mDecoderData = MimeQPDecoderInit(EnigMimeListener_write, (void*) this);
    }
  }
  return;
}

void
nsEnigMimeListener::ParseHeader(const char* header, PRUint32 count)
{

  //DEBUG_LOG(("nsEnigMimeListener::ParseHeader: header='%s'\n", header));

  if (!header || (count <= 0) )
    return;

  // Create header string
  nsCAutoString headerStr(header, count);

  PRInt32 colonOffset;
  colonOffset = headerStr.FindChar(':');
  if (colonOffset < 0)
    return;

  // Null header key not allowed
  if (colonOffset == 0)
    return;

  // Extract header key (not case-sensitive)
  nsCAutoString headerKey = (nsCString) nsDependentCSubstring (headerStr, colonOffset);
  ToLowerCase(headerKey);

  // Extract header value, trimming leading/trailing whitespace
  nsCAutoString buf = (nsCString) nsDependentCSubstring (headerStr, colonOffset, headerStr.Length() - colonOffset);
  buf.Trim(" ");

  //DEBUG_LOG(("nsEnigMimeListener::ParseHeader: %s: %s\n", headerKey.get(), buf.get()));

  PRInt32 semicolonOffset = buf.FindChar(';');

  nsCString headerValue;
  if (semicolonOffset < 0) {
    // No parameters
    headerValue = ((nsCString)buf).get();

  } else {
    // Extract value to left of parameters
    headerValue = nsDependentCSubstring (buf, semicolonOffset);
  }

  // Trim leading and trailing spaces in header value
  headerValue.Trim(" ");

  if (headerKey.Equals("content-type")) {
    mContentType = headerValue;

    DEBUG_LOG(("nsEnigMimeListener::ParseHeader: ContentType=%s\n",
               mContentType.get()));

    if (!buf.IsEmpty()) {
      char *charset  = MimeHeaders_get_parameter(buf.get(),
                              HEADER_PARM_CHARSET, NULL, NULL);
      char *boundary = MimeHeaders_get_parameter(buf.get(),
                              HEADER_PARM_BOUNDARY, NULL, NULL);
      char *protocol = MimeHeaders_get_parameter(buf.get(),
                              PARAM_PROTOCOL, NULL, NULL);
      char *micalg   = MimeHeaders_get_parameter(buf.get(),
                               PARAM_MICALG, NULL, NULL);

      if (charset)
        mContentCharset = charset;

      if (boundary)
        mContentBoundary = boundary;

      if (protocol)
        mContentProtocol = protocol;

      if (micalg)
        mContentMicalg = micalg;

      PR_FREEIF(charset);
      PR_FREEIF(boundary);
      PR_FREEIF(protocol);
      PR_FREEIF(micalg);

      DEBUG_LOG(("nsEnigMimeListener::ParseHeader: ContentCharset=%s\n",
                 mContentCharset.get()));

      DEBUG_LOG(("nsEnigMimeListener::ParseHeader: ContentBoundary=%s\n",
                 mContentBoundary.get()));

      DEBUG_LOG(("nsEnigMimeListener::ParseHeader: ContentProtocol=%s\n",
                 mContentProtocol.get()));

      DEBUG_LOG(("nsEnigMimeListener::ParseHeader: ContentMicalg=%s\n",
                 mContentMicalg.get()));
    }

  } else if (headerKey.Equals("content-transfer-encoding")) {
    mContentEncoding = buf;
    ToLowerCase(mContentEncoding);

    DEBUG_LOG(("nsEnigMimeListener::ParseHeader: ContentEncoding=%s\n",
               mContentEncoding.get()));

  } else if (headerKey.Equals("content-disposition")) {
    mContentDisposition = buf;

    DEBUG_LOG(("nsEnigMimeListener::ParseHeader: ContentDisposition=%s\n",
               mContentDisposition.get()));

  } else if (headerKey.Equals("content-length")) {
    nsresult status;
    PRInt32 value = headerValue.ToInteger(&status);

    if (NS_SUCCEEDED(status))
      mContentLength = value;

    DEBUG_LOG(("nsEnigMimeListener::ParseHeader: ContenLengtht=%d\n",
               mContentLength));
  }

  return;
}


///////////////////////////////////////////////////////////////////////////////
// nsIInputStream methods
///////////////////////////////////////////////////////////////////////////////

NS_IMETHODIMP
nsEnigMimeListener::Available(PRUint32* _retval)
{
  if (!_retval)
    return NS_ERROR_NULL_POINTER;

  *_retval = (mStreamLength > mStreamOffset) ?
              mStreamLength - mStreamOffset : 0;

  DEBUG_LOG(("nsEnigMimeListener::Available: (%p) %d\n", this, *_retval));

  return NS_OK;
}

NS_IMETHODIMP
nsEnigMimeListener::Read(char* buf, PRUint32 count,
                         PRUint32 *readCount)
{
  DEBUG_LOG(("nsEnigMimeListener::Read: (%p) %d\n", this, count));

  if (!buf || !readCount)
    return NS_ERROR_NULL_POINTER;

  PRInt32 avail = (mStreamLength > mStreamOffset) ?
                   mStreamLength - mStreamOffset : 0;

  *readCount = ((PRUint32) avail > count) ? count : avail;

  if (*readCount) {
    memcpy(buf, mStreamBuf+mStreamOffset, *readCount);
    mStreamOffset += *readCount;
  }

  if (mStreamOffset >= mStreamLength) {
    Close();
  }

  return NS_OK;
}

NS_IMETHODIMP
nsEnigMimeListener::ReadSegments(nsWriteSegmentFun writer,
                                 void * aClosure, PRUint32 count,
                                 PRUint32 *readCount)
{
  DEBUG_LOG(("nsEnigMimeListener::ReadSegments: %d\n", count));

  if (!readCount)
    return NS_ERROR_NULL_POINTER;

  PRInt32 avail = (mStreamLength > mStreamOffset) ?
                   mStreamLength - mStreamOffset : 0;

  PRUint32 readyCount = ((PRUint32) avail > count) ? count : avail;

  if (!readyCount) {
    *readCount = 0;

  } else {
    nsresult rv = writer((nsIInputStream*)(this),
                         aClosure, mStreamBuf+mStreamOffset,
                         mStreamOffset, readyCount, readCount);
    if (NS_FAILED(rv))
      return rv;

    mStreamOffset += *readCount;
  }

  if (mStreamOffset >= mStreamLength) {
    Close();
  }

  return NS_OK;
}

NS_IMETHODIMP
nsEnigMimeListener::IsNonBlocking(PRBool *aNonBlocking)
{
  DEBUG_LOG(("nsEnigMimeListener::IsNonBlocking: \n"));

  *aNonBlocking = PR_TRUE;
  return NS_OK;
}

NS_IMETHODIMP
nsEnigMimeListener::GetSubPartTreatment(PRBool* aSubPartTreatment)
{
  *aSubPartTreatment = mSubPartTreatment;
  return NS_OK;
}

NS_IMETHODIMP
nsEnigMimeListener::SetSubPartTreatment(PRBool aSubPartTreatment)
{
  DEBUG_LOG(("nsEnigMimeListener::SetSubPartTreatment: %d\n", aSubPartTreatment));

  mSubPartTreatment = aSubPartTreatment;
  return NS_OK;
}

NS_IMETHODIMP
nsEnigMimeListener::Close()
{
  DEBUG_LOG(("nsEnigMimeListener::Close: (%p)\n", this));
  mStreamBuf = nsnull;
  mStreamOffset = 0;
  mStreamLength = 0;
  return NS_OK;
}
