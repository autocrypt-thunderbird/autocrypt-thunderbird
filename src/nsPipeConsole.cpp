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


// Logging of debug output
// The following define statement should occur before any include statements
#define FORCE_PR_LOG       /* Allow logging even in release build */

#include "enigmail.h"
#include "prlog.h"
#include "nsCOMPtr.h"
#include "mozilla/Mutex.h"
#include "nsIInputStream.h"
#include "nsIThread.h"
#include "nsIHttpChannel.h"
#include "nsIURI.h"
#include "nsNetUtil.h"
#include "nsStringGlue.h"

#ifdef XP_WIN
#include <windows.h>
#include <shellapi.h>
#endif

#include "nsPipeConsole.h"

#ifdef PR_LOGGING
PRLogModuleInfo* gPipeConsoleLog = NULL;
#endif

#define ERROR_LOG(args)    PR_LOG(gPipeConsoleLog,PR_LOG_ERROR,args)
#define WARNING_LOG(args)  PR_LOG(gPipeConsoleLog,PR_LOG_WARNING,args)
#define DEBUG_LOG(args)    PR_LOG(gPipeConsoleLog,PR_LOG_DEBUG,args)

#define NS_PIPE_CONSOLE_BUFFER_SIZE   (1024)

static const PRUint32 kCharMax = NS_PIPE_CONSOLE_BUFFER_SIZE;

///////////////////////////////////////////////////////////////////////////////

using namespace mozilla;

// nsPipeConsole implementation

// nsISupports implementation
NS_IMPL_THREADSAFE_ISUPPORTS4(nsPipeConsole,
                              nsIStreamListener,
                              nsIPipeListener,
                              nsIPipeConsole,
                              nsIRunnable)


// nsPipeConsole implementation
nsPipeConsole::nsPipeConsole()
  : mFinalized(PR_FALSE),
    mJoinable(PR_FALSE),
    mThreadJoined(PR_FALSE),
    mOverflowed(PR_FALSE),

    mLock("nsPipeConsole.lock"),
    mConsoleBuf(""),
    mConsoleMaxLines(0),
    mConsoleMaxCols(0),

    mByteCount(0),
    mConsoleLines(0),
    mConsoleLineLen(0),
    mConsoleNewChars(0),

    mPipeWrite(IPC_NULL_HANDLE),
    mPipeRead(IPC_NULL_HANDLE),

    mPipeThread(nsnull)
{
    NS_INIT_ISUPPORTS();

#ifdef PR_LOGGING
  if (gPipeConsoleLog == nsnull) {
    gPipeConsoleLog = PR_NewLogModule("nsPipeConsole");
  }
#endif

#ifdef FORCE_PR_LOG
  nsresult rv;
  nsCOMPtr<nsIThread> myThread;
  rv = ENIG_GET_THREAD(myThread);
  DEBUG_LOG(("nsPipeConsole:: <<<<<<<<< CTOR(%p): myThread=%p\n",
         this, myThread.get()));
#endif
}


nsPipeConsole::~nsPipeConsole()
{
  nsresult rv;
#ifdef FORCE_PR_LOG
  nsCOMPtr<nsIThread> myThread;
  rv = ENIG_GET_THREAD(myThread);
  DEBUG_LOG(("nsPipeConsole:: >>>>>>>>> DTOR(%p): myThread=%p\n",
         this, myThread.get()));
#endif

  if (mPipeThread) {
    DEBUG_LOG(("nsPipeConsole::destructor: terminating mPipeTread\n"));
    mPipeThread->Shutdown(); // ignore result, we need to shutdown anyway
    DEBUG_LOG(("nsPipeConsole::destructor: done\n"));
    mPipeThread = nsnull;
 }

  Finalize(PR_TRUE);

}

///////////////////////////////////////////////////////////////////////////////
// static functions used here
///////////////////////////////////////////////////////////////////////////////

PRStatus CreateInheritablePipe(IPCFileDesc* *readPipe,
                               IPCFileDesc* *writePipe,
                               PRBool readInherit,
                               PRBool writeInherit)
{
#ifndef XP_WIN
  PRStatus status;

  //status = PR_NewTCPSocketPair(fd);
  status = PR_CreatePipe(readPipe, writePipe);
  if (status != PR_SUCCESS)
    return status;

  status = PR_SetFDInheritable(*readPipe, readInherit);
  if (status != PR_SUCCESS)
    return status;

  status = PR_SetFDInheritable(*writePipe, writeInherit);
  if (status != PR_SUCCESS)
    return status;

  return PR_SUCCESS;
#else  // XPWIN
  BOOL bRetVal;

  // Security attributes for inheritable handles
  SECURITY_ATTRIBUTES securityAttr;
  securityAttr.nLength = sizeof(SECURITY_ATTRIBUTES);
  securityAttr.lpSecurityDescriptor = NULL;
  securityAttr.bInheritHandle = TRUE;

  // Create pipe
  HANDLE hReadPipe, hWritePipe;
  bRetVal = CreatePipe( &hReadPipe, &hWritePipe,
                        &securityAttr, 0);
  if (!bRetVal)
    return PR_FAILURE;

  HANDLE hPipeTem;

  if (!readInherit) {
    // Make read handle uninheritable
    bRetVal = DuplicateHandle( GetCurrentProcess(),
                               hReadPipe,
                               GetCurrentProcess(),
                               &hPipeTem,
                               0,
                               FALSE,
                               DUPLICATE_SAME_ACCESS);
    CloseHandle(hReadPipe);

    if (!bRetVal) {
      CloseHandle(hWritePipe);
      return PR_FAILURE;
    }
    hReadPipe = hPipeTem;
  }

  if (!writeInherit) {
    // Make write handle uninheritable
    bRetVal = DuplicateHandle( GetCurrentProcess(),
                               hWritePipe,
                               GetCurrentProcess(),
                               &hPipeTem,
                               0,
                               FALSE,
                               DUPLICATE_SAME_ACCESS);
    CloseHandle(hWritePipe);

    if (!bRetVal) {
      CloseHandle(hReadPipe);
      return PR_FAILURE;
    }
    hWritePipe = hPipeTem;
  }

  *readPipe  = (void*) hReadPipe;
  *writePipe = (void*) hWritePipe;
#endif // XP_WIN

  return PR_SUCCESS;
}

#ifndef XP_WIN
#define EnigRead PR_Read
#else // XP_WIN
PRInt32 EnigRead(IPCFileDesc* fd, void *buf, PRInt32 amount)
{
  unsigned long bytes;

  if (ReadFile((HANDLE) fd,
               (LPVOID) buf,
               amount,
               &bytes,
               NULL)) {
    return bytes;
  }

  DWORD dwLastError = GetLastError();

  if (dwLastError == ERROR_BROKEN_PIPE)
    return 0;

  return -1;
}
#endif // XP_WIN

#ifndef XP_WIN
#define EnigClose PR_Close
#else // XP_WIN
PRStatus EnigClose(IPCFileDesc* fd)
{
  return (CloseHandle((HANDLE) fd)) ? PR_SUCCESS : PR_FAILURE;
}
#endif // XP_WIN

///////////////////////////////////////////////////////////////////////////////
// nsPipeConsole methods:
///////////////////////////////////////////////////////////////////////////////

nsresult
nsPipeConsole::Finalize(PRBool destructor)
{
  DEBUG_LOG(("nsPipeConsole::Finalize: \n"));

  if (mFinalized)
    return NS_OK;

  mFinalized = PR_TRUE;

  nsCOMPtr<nsIPipeConsole> self;
  if (!destructor) {
    // Hold a reference to ourselves to prevent our DTOR from being called
    // while finalizing. Automatically released upon returning.
    self = this;
  }

  // Close write pipe
  if (mPipeWrite) {
    EnigClose(mPipeWrite);
    mPipeWrite = IPC_NULL_HANDLE;
  }

  // Release owning refs
  mObserver = nsnull;
  mObserverContext = nsnull;

  // Clear console
  mConsoleBuf.Assign("");
  mConsoleLines = 0;
  mConsoleLineLen = 0;
  mConsoleNewChars = 0;

  mConsoleMaxLines = 0;
  mConsoleMaxCols = 0;

  return NS_OK;
}

nsresult
nsPipeConsole::Init()
{
  DEBUG_LOG(("nsPipeConsole::Init: \n"));

  // add shutdown observer

  nsCOMPtr<nsIObserverService> observ(do_GetService("@mozilla.org/observer-service;1"));
  if (observ)
    observ->AddObserver((nsIObserver*)(this),
                        NS_XPCOM_SHUTDOWN_OBSERVER_ID, PR_FALSE);

  return NS_OK;
}

///////////////////////////////////////////////////////////////////////////////
// nsIPipeConsole methods (thread-safe)
///////////////////////////////////////////////////////////////////////////////

NS_IMETHODIMP
nsPipeConsole::Open(PRInt32 maxRows, PRInt32 maxCols, PRBool joinable)
{
  nsresult rv;

  DEBUG_LOG(("nsPipeConsole::Open: %d, %d, %d\n", maxRows, maxCols,
                                                  (int) joinable));
  rv = Init();
  NS_ENSURE_SUCCESS(rv, rv);

  mJoinable = joinable;

  if ((maxRows < 0) || (maxCols < 0))
    return NS_ERROR_FAILURE;

  mConsoleMaxLines = maxRows;
  mConsoleMaxCols  = ((maxCols > 0) && (maxCols < 3)) ? 3: maxCols;

  // Create pipe pair
  PRStatus status = CreateInheritablePipe(&mPipeRead, &mPipeWrite,
                                              PR_FALSE, PR_TRUE);
  if (status != PR_SUCCESS) {
    ERROR_LOG(("nsPipeConsole::Open: CreateInheritablePipe failed\n"));
    return NS_ERROR_FAILURE;
  }

  // Spin up a new thread to handle STDOUT polling
  rv = NS_NewThread(getter_AddRefs(mPipeThread), this);
  DEBUG_LOG(("nsPipeConsole::Open: created new thread: %d", rv));
  NS_ENSURE_SUCCESS(rv, rv);

  return NS_OK;
}



NS_IMETHODIMP
nsPipeConsole::HasNewData(PRBool *_retval)
{
  MutexAutoLock lock(mLock);

  //DEBUG_LOG(("nsPipeConsole::HasNewData:\n"));

  *_retval = (mConsoleNewChars > 0);

  return NS_OK;
}


NS_IMETHODIMP
nsPipeConsole::GetData(char** _retval)
{
  DEBUG_LOG(("nsPipeConsole::GetData:\n"));

  mConsoleNewChars = mConsoleBuf.Length();

  return GetNewData(_retval);
}


NS_IMETHODIMP
nsPipeConsole::GetNewData(char** _retval)
{
  MutexAutoLock lock(mLock);

  DEBUG_LOG(("nsPipeConsole::GetNewData:\n"));

  if (!_retval)
    return NS_ERROR_NULL_POINTER;

  // Compute offset of "new" portion of string
  PRInt32 consoleLen = mConsoleBuf.Length();
  PRInt32 offset = consoleLen - mConsoleNewChars;

  if ((offset < 0) || (offset > consoleLen)) {
    ERROR_LOG(("nsPipeConsole::GetData: Internal error - Invalid console offset"));
    return NS_ERROR_FAILURE;
  }

  // Copy portion of console data to be returned
  nsCAutoString consoleCopy (mConsoleBuf);
  if (offset)
    consoleCopy.Cut(0,offset);

  // Replace any NULs with '0'
  PRInt32 nulIndex = 0;
  while (nulIndex != -1) {
    nulIndex = consoleCopy.FindChar(char(0));
    if (nulIndex != -1) {
      consoleCopy.Replace(nulIndex, 1, "0", 1);
    }
  }

  // Duplicate new C string
  *_retval = ToNewCString(consoleCopy);
  if (!*_retval)
    return NS_ERROR_OUT_OF_MEMORY;

  mConsoleNewChars = 0;

  return NS_OK;
}

///////////////////////////////////////////////////////////////////////////////
// nsIPipeListener methods (thread-safe)
///////////////////////////////////////////////////////////////////////////////

NS_IMETHODIMP
nsPipeConsole::Observe(nsIRequestObserver* observer, nsISupports* context)
{
  MutexAutoLock lock(mLock);
  DEBUG_LOG(("nsPipeConsole::Observe: %p, %p\n", observer, context));

  mObserver = observer;
  mObserverContext = context;

  return NS_OK;
}


NS_IMETHODIMP
nsPipeConsole::GetJoinable(PRBool *_retval)
{
  DEBUG_LOG(("nsPipeConsole::GetJoinable: %d\n", (int) mJoinable));

  *_retval = mJoinable;

  return NS_OK;
}


NS_IMETHODIMP
nsPipeConsole::Join()
{
  nsresult rv;

  if (!mJoinable)
    return NS_ERROR_FAILURE;

  {
    // Nested lock to avoid deadlock while waiting for Join
    MutexAutoLock lock(mLock);
    DEBUG_LOG(("nsPipeConsole::Join:\n"));

    if (mThreadJoined || !mPipeThread)
      return NS_OK;

    if (mPipeWrite) {
      // Close write pipe before joining
      EnigClose(mPipeWrite);
      mPipeWrite = IPC_NULL_HANDLE;
    }

    // Assume that this join will succeed to prevent double joining
    mThreadJoined = PR_TRUE;
  }

  DEBUG_LOG(("nsPipeConsole::terminating thread\n"));
  rv = mPipeThread->Shutdown();
  NS_ENSURE_SUCCESS(rv, rv);

  if (rv == NS_OK) mPipeThread=nsnull;

  return NS_OK;
}


NS_IMETHODIMP
nsPipeConsole::Shutdown()
{
  MutexAutoLock lock(mLock);
  DEBUG_LOG(("nsPipeConsole::Shutdown:\n"));

  Finalize(PR_FALSE);

  nsCOMPtr<nsIObserverService> observerSvc =
           do_GetService("@mozilla.org/observer-service;1");

  if (observerSvc) {
    observerSvc->RemoveObserver((nsIObserver*)(this),
                                NS_XPCOM_SHUTDOWN_OBSERVER_ID);
  }

  return NS_OK;
}


NS_IMETHODIMP
nsPipeConsole::GetFileDesc(IPCFileDesc* *_retval)
{
  MutexAutoLock lock(mLock);

  DEBUG_LOG(("nsPipeConsole::GetFileDesc:\n"));

  if (!_retval)
    return NS_ERROR_NULL_POINTER;

  if (mPipeWrite == IPC_NULL_HANDLE)
    return NS_ERROR_FAILURE;

  *_retval = mPipeWrite;
  return NS_OK;
}


NS_IMETHODIMP
nsPipeConsole::GetOverflowed(PRBool *_retval)
{
  MutexAutoLock lock(mLock);

  DEBUG_LOG(("nsPipeConsole::GetOverflowed: %d\n", (int) mOverflowed));

  *_retval = mOverflowed;

  return NS_OK;
}


NS_IMETHODIMP
nsPipeConsole::GetByteData(PRUint32 *count, char **data)
{
  MutexAutoLock lock(mLock);

  DEBUG_LOG(("nsPipeConsole::GetByteData:\n"));

  if (!count || !data)
    return NS_ERROR_NULL_POINTER;

  // Copy bytes
  *count = mConsoleBuf.Length();
  *data = reinterpret_cast<char*>(nsMemory::Alloc((*count)+1));
  if (!*data)
    return NS_ERROR_OUT_OF_MEMORY;

  memcpy(*data, mConsoleBuf.get(), *count);

  // NUL terminate byte array(just to be safe!)
  (*data)[*count] = '\0';

  mConsoleNewChars = 0;

  return NS_OK;
}


NS_IMETHODIMP
nsPipeConsole::Write(const char* str)
{
  // Note: Locking occurs in WriteBuf

  DEBUG_LOG(("nsPipeConsole::Write: %s\n", str));

  PRUint32 len = strlen(str);
  if (!len)
    return NS_OK;

  return WriteBuf(str, len);
}

NS_METHOD
nsPipeConsole::WriteBuf(const char* buf, PRUint32 count)
{
  MutexAutoLock lock(mLock);

  DEBUG_LOG(("nsPipeConsole::WriteBuf: %d\n", count));

  mByteCount += count;

  if ((count <= 0) || !mConsoleMaxLines)
    return NS_OK;

  PRInt32 consoleOldLen = mConsoleBuf.Length();

  PRInt32 appendOffset = 0;

  PRInt32 j;

  // Count and append new lines (folding extra-long lines)
  for (j=0; j<(PRInt32)count; j++) {
    if (buf[j] == '\n') {
      // End-of-line
      mConsoleLineLen = 0;
      mConsoleLines++;

    } else if (mConsoleMaxCols &&
               ((int)mConsoleLineLen >= mConsoleMaxCols)) {
      // Fold line
      mConsoleLineLen = 1;
      mConsoleLines++;

      // Append characters upto this point
      if (j > appendOffset)
        mConsoleBuf.Append(buf+appendOffset, j-appendOffset);

      // Append newline
      mConsoleBuf.Append('\n');

      appendOffset = j;

    } else {
      // Extend line
      mConsoleLineLen++;
    }
  }

  // Append all remaining characters
  mConsoleBuf.Append(buf+appendOffset, count-appendOffset);

  PRInt32 deleteLines = mConsoleLines - mConsoleMaxLines;

  PRInt32 consoleLen = mConsoleBuf.Length();
  mConsoleNewChars += consoleLen - consoleOldLen;

  if (deleteLines > 0) {
    PRInt32 newOffset;
    PRInt32 linesLocated = 0;
    PRInt32 offset = 0;

    mOverflowed = PR_TRUE;

    while ((offset < consoleLen) && (linesLocated < deleteLines)) {
      newOffset = mConsoleBuf.FindChar('\n', offset);
      if (newOffset == -1) break;
      offset = newOffset + 1;
      linesLocated++;
    }

    if (linesLocated != deleteLines) {

      ERROR_LOG(("nsPipeConsole::WriteBuf: linesLocated(%d) != deleteLines(%d)\n", linesLocated, deleteLines));

      return NS_ERROR_FAILURE;
    }

    mConsoleBuf.Cut(0,offset);
    mConsoleLines -= deleteLines;
  }

  if (mConsoleNewChars > mConsoleBuf.Length())
    mConsoleNewChars = mConsoleBuf.Length();

  return NS_OK;
}

///////////////////////////////////////////////////////////////////////////////
// nsIRequestObserver methods
///////////////////////////////////////////////////////////////////////////////

NS_IMETHODIMP
nsPipeConsole::OnStartRequest(nsIRequest *aRequest, nsISupports *aContext)
{
  DEBUG_LOG(("nsPipeConsole::OnStartRequest:\n"));

  nsCOMPtr<nsIRequestObserver> observer;
  nsCOMPtr<nsISupports> observerContext;
  {
    MutexAutoLock lock(mLock);

    if (!mObserver)
      return NS_OK;

    observer = mObserver;
    observerContext = mObserverContext;
  }

  return observer->OnStartRequest(aRequest, observerContext);
}

NS_IMETHODIMP
nsPipeConsole::OnStopRequest(nsIRequest* aRequest, nsISupports* aContext,
                             nsresult aStatus)
{
  DEBUG_LOG(("nsPipeConsole::OnStopRequest:\n"));

  nsCOMPtr<nsIRequestObserver> observer;
  nsCOMPtr<nsISupports> observerContext;
  {
    MutexAutoLock lock(mLock);

    if (!mObserver)
      return NS_OK;

    observer = mObserver;
    observerContext = mObserverContext;
  }

  return observer->OnStopRequest(aRequest, observerContext, aStatus);
}

///////////////////////////////////////////////////////////////////////////////
// nsIStreamListener method
///////////////////////////////////////////////////////////////////////////////

NS_IMETHODIMP
nsPipeConsole::OnDataAvailable(nsIRequest* aRequest, nsISupports* aContext,
                              nsIInputStream *aInputStream,
                              PRUint32 aSourceOffset,
                              PRUint32 aLength)
{
  nsresult rv = NS_OK;

  DEBUG_LOG(("nsPipeConsole::OnDataAVailable: %d\n", aLength));

  char buf[kCharMax];
  PRUint32 readCount, readMax;

  while (aLength > 0) {
    readMax = (aLength < kCharMax) ? aLength : kCharMax;
    rv = aInputStream->Read((char *) buf, readMax, &readCount);
    if (NS_FAILED(rv)){
      ERROR_LOG(("nsPipeConsole::OnDataAvailable: Error in reading from input stream, %x\n", rv));
      return rv;
    }

    if (readCount <= 0) return NS_OK;

    rv = WriteBuf(buf, readCount);
    NS_ENSURE_SUCCESS(rv, rv);

    aLength -= readCount;
  }

  return NS_OK;
}

///////////////////////////////////////////////////////////////////////////////
// nsIRunnable methods:
// (runs as a new thread)
///////////////////////////////////////////////////////////////////////////////

NS_IMETHODIMP
nsPipeConsole::Run()
{
  nsresult rv = NS_OK;

#ifdef FORCE_PR_LOG
  nsCOMPtr<nsIThread> myThread;
  rv = ENIG_GET_THREAD(myThread);
  DEBUG_LOG(("nsPipeConsole::Run: myThread=%p\n", myThread.get()));
#endif

  // Blocked read loop
  while (1) {
    char buf[kCharMax];
    PRInt32 readCount;

    // Read data from pipe (blocking)
    readCount = EnigRead(mPipeRead, (char *) buf, kCharMax);

    DEBUG_LOG(("nsPipeConsole::Run: Read %d chars\n", readCount));

    if (readCount <= 0)
      break;

    // Append data read to console
    WriteBuf(buf, readCount);
  }

  // Clear any NSPR interrupt
  PR_ClearInterrupt();

  // Close read pipe
  EnigClose(mPipeRead);
  mPipeRead = IPC_NULL_HANDLE;

  return NS_OK;
}

//-----------------------------------------------------------------------------
// nsIObserver impl
//-----------------------------------------------------------------------------

NS_IMETHODIMP
nsPipeConsole::Observe(nsISupports *subject, const char *aTopic, const PRUnichar *data)
{
    DEBUG_LOG(("nsPipeConsole::Observe: topic=%s\n", aTopic));

    if (!PL_strcmp(aTopic, NS_XPCOM_SHUTDOWN_OBSERVER_ID)) {
      Shutdown();
    }
    return NS_OK;
}
