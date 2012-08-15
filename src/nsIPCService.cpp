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
#include "nspr.h"
#include "plstr.h"
#include "nsStringGlue.h"

#include "nsIServiceManager.h"
#include "nsIObserverService.h"
#include "nsIIOService.h"
#include "nsIInputStream.h"
#include "nsIStringStream.h"
#include "nsStringStream.h"
#include "nsIHttpChannel.h"
#include "nsIChannel.h"
#include "nsIURL.h"
#include "nsIScriptSecurityManager.h"
#include "nsNetUtil.h"

#include "nsIPipeConsole.h"
#include "nsIPipeTransport.h"
#include "nsIPCService.h"

#include "nsEnigModule.h"
#include "nsIIPCBuffer.h"

#ifdef PR_LOGGING
PRLogModuleInfo* gIPCServiceLog = NULL;
#endif

#define ERROR_LOG(args)    PR_LOG(gIPCServiceLog,PR_LOG_ERROR,args)
#define WARNING_LOG(args)  PR_LOG(gIPCServiceLog,PR_LOG_WARNING,args)
#define DEBUG_LOG(args)    PR_LOG(gIPCServiceLog,PR_LOG_DEBUG,args)

#define IPCSERVICE_COOKIE_DIGITS 16
#define MAX_DATA_BYTES 2000000

#define NS_STRINGINPUTSTREAM_CONTRACTID "@mozilla.org/io/string-input-stream;1"

static const PRUint32 kCharMax = 1024;

///////////////////////////////////////////////////////////////////////////////

nsIPCService::nsIPCService()
    : mInitialized(PR_FALSE)
{
  NS_INIT_ISUPPORTS();

#ifdef PR_LOGGING
  if (gIPCServiceLog == NULL) {
    gIPCServiceLog = PR_NewLogModule("nsIPCService");
    PR_LOG(gIPCServiceLog,PR_LOG_ALWAYS,("Logging nsIPCService...\n"));
  }
#endif

  DEBUG_LOG(("nsIPCService:: <<<<<<<<< CTOR(%p)\n", this));
}

nsIPCService::~nsIPCService()
{

  DEBUG_LOG(("nsIPCService:: >>>>>>>>> DTOR(%p)\n", this));
}

//
// --------------------------------------------------------------------------
// nsISupports implementation...
// --------------------------------------------------------------------------
//

NS_IMPL_THREADSAFE_ISUPPORTS2(nsIPCService, nsIIPCService, nsIObserver)

NS_METHOD
nsIPCService::Init()
{
  nsresult rv;

  DEBUG_LOG(("nsIPCService::Init:\n"));

  if (mInitialized)
    return NS_OK;

  mInitialized = PR_TRUE;

  // Create a non-joinable pipeconsole
  mConsole = do_CreateInstance(NS_PIPECONSOLE_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  rv = mConsole->Open(500, 80, PR_FALSE);
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsIObserverService> observerSvc =
           do_GetService("@mozilla.org/observer-service;1");

  if (observerSvc) {
    observerSvc->AddObserver((nsIObserver*)(this),
                             NS_XPCOM_SHUTDOWN_OBSERVER_ID, PR_FALSE);
  }

  return NS_OK;
}

NS_METHOD
nsIPCService::Shutdown()
{
  DEBUG_LOG(("nsIPCService::Shutdown:\n"));

  if (!mInitialized)
    return NS_OK;

  if (mConsole) {
    mConsole->Shutdown();
    mConsole = NULL;
  }

  nsCOMPtr<nsIObserverService> observerSvc =
           do_GetService("@mozilla.org/observer-service;1");

  if (observerSvc) {
    observerSvc->RemoveObserver((nsIObserver*)(this),
                                NS_XPCOM_SHUTDOWN_OBSERVER_ID);
  }

  mInitialized = PR_FALSE;

  return NS_OK;
}

///////////////////////////////////////////////////////////////////////////////
// nsIIPCService methods
///////////////////////////////////////////////////////////////////////////////

NS_IMETHODIMP
nsIPCService::GetVersion(char **_retval)
{
  *_retval = PL_strdup(ENIGMIME_VERSION);
  if (!*_retval)
    return NS_ERROR_OUT_OF_MEMORY;

  DEBUG_LOG(("nsIPCService::GetVersion: %s\n", *_retval));
  return NS_OK;
}

NS_IMETHODIMP
nsIPCService::GetConsole(nsIPipeConsole* *_retval)
{

  if (!_retval || !mConsole)
    return NS_ERROR_FAILURE;

  NS_IF_ADDREF(*_retval = mConsole);
  return NS_OK;
}

NS_METHOD
nsIPCService::RunCommand(nsIFile *executable,
                         const PRUnichar **args,
                         PRUint32 argCount,
                         const PRUnichar **env, PRUint32 envCount,
                         nsIPipeListener* errConsole,
                         nsIPipeTransport** _retval)
{
  nsresult rv;

  DEBUG_LOG(("nsIPCService::RunCommand: [%d]\n", argCount));

  if (!_retval || !executable)
    return NS_ERROR_NULL_POINTER;

  *_retval = NULL;

  // Create a pipetransport instance
  nsCOMPtr<nsIPipeTransport> pipeTrans = do_CreateInstance(NS_PIPETRANSPORT_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  EMBool mergeStderr = PR_FALSE;

  nsCOMPtr<nsIPipeListener> console (errConsole);

  if (!errConsole)
    errConsole = mConsole;

  rv = pipeTrans->Init(executable);
  NS_ENSURE_SUCCESS(rv, rv);

  rv = pipeTrans->OpenPipe(args, argCount,
                       env, envCount,
                       0, "",
                       mergeStderr,
                       console);
  NS_ENSURE_SUCCESS(rv, rv);

  NS_IF_ADDREF(*_retval = pipeTrans);
  return NS_OK;
}


NS_IMETHODIMP
nsIPCService::NewStringChannel(nsIURI* aURI, const nsACString &aContentType,
                               const nsACString &aContentCharset,
                               const char *aData, nsIChannel **result)
{
  nsresult rv;

  DEBUG_LOG(("nsIPCService::NewStringChannel:\n"));

  nsCOMPtr<nsIStringInputStream> inputStream =
    do_CreateInstance(NS_STRINGINPUTSTREAM_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  rv = inputStream->SetData((const char*)aData, -1);

  NS_ENSURE_SUCCESS(rv, rv);

  nsCAutoString contentType(aContentType);
  nsCAutoString contentCharset(aContentCharset);

  if (contentCharset.IsEmpty())
    NS_ParseContentType(aContentType, contentType, contentCharset);

//  nsCOMPtr<nsIChannel> channel;
  rv = NS_NewInputStreamChannel(result,
                                aURI,
                                inputStream,
                                contentType,
                                contentCharset);

  return rv;
}

///////////////////////////////////////////////////////////////////////////////
// nsIObserver methods
///////////////////////////////////////////////////////////////////////////////

NS_IMETHODIMP
nsIPCService::Observe(nsISupports *aSubject, const char *aTopic,
                      const PRUnichar *someData)
{
  DEBUG_LOG(("nsIPCService::Observe: %s\n", aTopic));

  if (!PL_strcmp(aTopic, NS_XPCOM_SHUTDOWN_OBSERVER_ID)) {
    // Shutdown IPC service on XPCOM shutdown
    Shutdown();
  }
  return NS_OK;
}

///////////////////////////////////////////////////////////////////////////////

// nsIPCRequest implementation

// nsISupports implementation
NS_IMPL_THREADSAFE_ISUPPORTS1 (nsIPCRequest, nsIIPCRequest)


// nsIPCRequest implementation
nsIPCRequest::nsIPCRequest()
  : mExecutable(""),
    mPipeTransport(NULL),
    mStdoutConsole(NULL),
    mStderrConsole(NULL)
{
    NS_INIT_ISUPPORTS();

    DEBUG_LOG(("nsIPCRequest:: <<<<<<<<< CTOR(%p)\n", this));
}


nsIPCRequest::~nsIPCRequest()
{
  DEBUG_LOG(("nsIPCRequest:: >>>>>>>>> DTOR(%p)\n", this));
  mPipeTransport = NULL;
  mStdoutConsole = NULL;
  mStderrConsole = NULL;
}

NS_IMETHODIMP
nsIPCRequest::Init(const char *aExecutable, nsIPipeTransport* aPipeTransport,
                   nsIPipeListener* aStdoutConsole,
                   nsIPipeListener* aStderrConsole)
{

  DEBUG_LOG(("nsIPCRequest::Init: %s\n", aExecutable));

  mExecutable.Assign(aExecutable);

  mPipeTransport = aPipeTransport;
  mStdoutConsole = aStdoutConsole;
  mStderrConsole = aStderrConsole;

  return NS_OK;
}

NS_IMETHODIMP
nsIPCRequest::Close(EMBool closeConsoles)
{
  DEBUG_LOG(("nsIPCRequest::Close: %d\n", (int) closeConsoles));
  mExecutable.Assign("");

  if (mPipeTransport)
    mPipeTransport->Terminate();
  mPipeTransport = NULL;

  if (mStdoutConsole && closeConsoles)
    mStdoutConsole->Shutdown();
  mStdoutConsole = NULL;

  if (mStderrConsole && closeConsoles)
    mStderrConsole->Shutdown();
  mStderrConsole = NULL;

  return NS_OK;
}


NS_IMETHODIMP
nsIPCRequest::IsPending(EMBool *_retval)
{

  DEBUG_LOG(("nsIPCRequest::IsPending:\n"));
  if (!_retval)
    return NS_ERROR_NULL_POINTER;

  if (!mPipeTransport) {
    *_retval = PR_FALSE;
    return NS_OK;
  }

  return mPipeTransport->GetIsRunning(_retval);
}

NS_IMETHODIMP
nsIPCRequest::GetExecutable(char **_retval)
{

  DEBUG_LOG(("nsIPCRequest::GetExecutable:\n"));
  if (!_retval)
    return NS_ERROR_NULL_POINTER;

  *_retval = ToNewCString(mExecutable);

  return *_retval ? NS_OK : NS_ERROR_OUT_OF_MEMORY;
}

NS_IMETHODIMP
nsIPCRequest::GetPipeTransport(nsIPipeTransport* *_retval)
{
  //DEBUG_LOG(("nsIPCRequest::GetPipeTransport:\n"));
  if (!_retval || !mPipeTransport)
    return NS_ERROR_FAILURE;

  NS_IF_ADDREF(*_retval = mPipeTransport);
  return NS_OK;
}

NS_IMETHODIMP
nsIPCRequest::GetStdoutConsole(nsIPipeListener* *_retval)
{
  //DEBUG_LOG(("nsIPCRequest::GetStdoutConsole:\n"));
  if (!_retval || !mStdoutConsole)
    return NS_ERROR_FAILURE;

  NS_IF_ADDREF(*_retval = mStdoutConsole);
  return NS_OK;
}

NS_IMETHODIMP
nsIPCRequest::GetStderrConsole(nsIPipeListener* *_retval)
{
  //DEBUG_LOG(("nsIPCRequest::GetStderrConsole:\n"));
  if (!_retval || !mStderrConsole)
    return NS_ERROR_FAILURE;

  NS_IF_ADDREF(*_retval = mStderrConsole);
  return NS_OK;
}



