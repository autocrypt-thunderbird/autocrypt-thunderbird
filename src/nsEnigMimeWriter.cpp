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

#include "prlog.h"
#include "nsCOMPtr.h"
#include "nsCRT.h"
#include "nsIThread.h"
#include "nsFileStream.h"

#include "nsEnigMimeWriter.h"

#ifdef PR_LOGGING
PRLogModuleInfo* gEnigMimeWriterLog = NULL;
#endif

#define ERROR_LOG(args)    PR_LOG(gEnigMimeWriterLog,PR_LOG_ERROR,args)
#define WARNING_LOG(args)  PR_LOG(gEnigMimeWriterLog,PR_LOG_WARNING,args)
#define DEBUG_LOG(args)    PR_LOG(gEnigMimeWriterLog,PR_LOG_DEBUG,args)

static const PRUint32 kCharMax = 1024;

///////////////////////////////////////////////////////////////////////////////

// nsEnigMimeWriter implementation

// nsISupports implementation
NS_IMPL_THREADSAFE_ISUPPORTS3(nsEnigMimeWriter,
                              nsIEnigMimeWriter,
                              nsIRequestObserver,
                              nsIStreamListener)


// nsEnigMimeWriter implementation
nsEnigMimeWriter::nsEnigMimeWriter()
  : mStream(nsnull),
    mForceCRLF(PR_FALSE),

    mClosed(PR_FALSE),
    mLastCR(PR_FALSE),

    mByteCount(0)
{
    NS_INIT_ISUPPORTS();

#ifdef PR_LOGGING
  if (gEnigMimeWriterLog == nsnull) {
    gEnigMimeWriterLog = PR_NewLogModule("nsEnigMimeWriter");
  }
#endif

#ifdef FORCE_PR_LOG
  nsresult rv;
  nsCOMPtr<nsIThread> myThread;
  rv = nsIThread::GetCurrent(getter_AddRefs(myThread));
  DEBUG_LOG(("nsEnigMimeWriter:: <<<<<<<<< CTOR(%x): myThread=%x\n",
         (int) this, (int) myThread.get()));
#endif
}


nsEnigMimeWriter::~nsEnigMimeWriter()
{
  nsresult rv;
#ifdef FORCE_PR_LOG
  nsCOMPtr<nsIThread> myThread;
  rv = nsIThread::GetCurrent(getter_AddRefs(myThread));
  DEBUG_LOG(("nsEnigMimeWriter:: >>>>>>>>> DTOR(%x): myThread=%x\n",
         (int) this, (int) myThread.get()));
#endif
  mStream = nsnull;
}


///////////////////////////////////////////////////////////////////////////////
// nsIEnigMimeWriter methods
///////////////////////////////////////////////////////////////////////////////

NS_IMETHODIMP
nsEnigMimeWriter::Init(nsOutputFileStream* aStream,
                         PRBool forceCRLF)
{
  DEBUG_LOG(("nsEnigMimeWriter::Init: %d\n", forceCRLF));

  if (!aStream)
    return NS_ERROR_NULL_POINTER;

  mStream = aStream;

  mForceCRLF = forceCRLF;

  return NS_OK;
}


NS_IMETHODIMP
nsEnigMimeWriter::Write(const char* buf, PRUint32 count)
{
  nsresult rv;

  DEBUG_LOG(("nsEnigMimeWriter::Write: %d\n", count));

  if (!mForceCRLF)
    return WriteStream(buf, count);

  PRUint32 offset = 0;
  for (PRUint32 j=0; j<count; j++) {
    if (buf[j] == '\n') {

      if (mLastCR) {
        rv = WriteStream(&buf[offset], j-offset+1);
        if (NS_FAILED(rv)) return rv;

      } else {
        rv = WriteStream(&buf[offset], j-offset);
        if (NS_FAILED(rv)) return rv;

        rv = WriteStream("\r\n", 2);
        if (NS_FAILED(rv)) return rv;
      }

      offset = j+1;

    } else if (mLastCR) {
      rv = WriteStream(&buf[offset], j-offset);
      if (NS_FAILED(rv)) return rv;

      rv = WriteStream("\r\n", 2);
      if (NS_FAILED(rv)) return rv;

      offset = j;
    }

    mLastCR = (buf[j] == '\r');
  }

  if (offset < count) {
    rv = WriteStream(&buf[offset], count-offset);
    if (NS_FAILED(rv)) return rv;
  }

  return NS_OK;
}


nsresult   
nsEnigMimeWriter::WriteStream(const char* buf, PRUint32 count)
{
  DEBUG_LOG(("nsEnigMimeWriter::WriteStream: %d\n", count));

  if (!mStream)
    return NS_ERROR_NOT_INITIALIZED;

  while (count > 0) {
    PRInt32 writeCount = mStream->write(buf, count);

    if (writeCount <= 0)
      return NS_ERROR_FAILURE;

    mByteCount += writeCount;

    count -= writeCount;
    buf += writeCount;
  }

  return NS_OK;
}


NS_IMETHODIMP
nsEnigMimeWriter::GetBytesWritten(PRUint32* _retval)
{
  NS_ENSURE_ARG(_retval);
  DEBUG_LOG(("nsEnigMimeWriter::GetBytesWritten: %d\n", mByteCount));

  *_retval = mByteCount;
  return NS_OK;
}


NS_IMETHODIMP 
nsEnigMimeWriter::Close()
{
  nsresult rv;

  DEBUG_LOG(("nsEnigMimeWriter::Close: \n"));

  if (mClosed)
    return NS_OK;

  if (mLastCR) {
    rv = WriteStream("\n", 1);
    if (NS_FAILED(rv)) return rv;
  }

  mClosed = PR_TRUE;

  mStream = nsnull;

  return NS_OK;
}

///////////////////////////////////////////////////////////////////////////////
// nsIRequestObserver methods
///////////////////////////////////////////////////////////////////////////////

NS_IMETHODIMP
nsEnigMimeWriter::OnStartRequest(nsIRequest *aRequest,
                                 nsISupports *aContext)
{
  DEBUG_LOG(("nsEnigMimeWriter::OnStartRequest:\n"));

  return NS_OK;
}

NS_IMETHODIMP
nsEnigMimeWriter::OnStopRequest(nsIRequest* aRequest,
                                nsISupports* aContext,
                                nsresult aStatus)
{
  DEBUG_LOG(("nsEnigMimeWriter::OnStopRequest:\n"));

  return NS_OK;
}

///////////////////////////////////////////////////////////////////////////////
// nsIStreamWriter method
///////////////////////////////////////////////////////////////////////////////

NS_IMETHODIMP
nsEnigMimeWriter::OnDataAvailable(nsIRequest* aRequest,
                                  nsISupports* aContext,
                                  nsIInputStream *aInputStream,
                                  PRUint32 aSourceOffset,
                                  PRUint32 aLength)
{
  nsresult rv = NS_OK;

  DEBUG_LOG(("nsEnigMimeWriter::OnDataAVailable: %d\n", aLength));

  if (!mStream)
    return NS_ERROR_NOT_INITIALIZED;

  char buf[kCharMax];
  PRUint32 readCount, readMax;

  while (aLength > 0) {
    readMax = (aLength < kCharMax) ? aLength : kCharMax;
    rv = aInputStream->Read((char *) buf, readMax, &readCount);

    if (NS_FAILED(rv)){
      ERROR_LOG(("nsEnigMimeWriter::OnDataAvailable: Error in reading from input stream, %x\n", rv));
      return rv;
    }

    if (readCount <= 0)
      break;

    aLength -= readCount;
    aSourceOffset += readCount;

    rv = Write(buf, readCount);
    if (NS_FAILED(rv)) return rv;
  }

  return NS_OK;
}
