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


#ifndef nsIPCService_h__
#define nsIPCService_h__

#include "nspr.h"
#include "nsStringGlue.h"
#include "nsIObserver.h"
#include "nsIIPCService.h"
#include "nsIPipeConsole.h"

#include "mozilla/ModuleUtils.h"

#include "nsCOMPtr.h"
#include "nsIFile.h"

class nsIPCService : public nsIIPCService,
                     public nsIObserver
{
public:
    NS_DECL_ISUPPORTS
    NS_DECL_NSIIPCSERVICE
    NS_DECL_NSIOBSERVER

    // nsIPCService methods:
    nsIPCService();

    // Always make the destructor virtual:
    virtual ~nsIPCService();

    // Define a Create method to be used with a factory:
    static NS_METHOD
      Create(nsISupports *aOuter, REFNSIID aIID, void **aResult);

    NS_METHOD Init();

    NS_METHOD Shutdown();

protected:
    NS_METHOD RunCommand (nsIFile* executable,
                          const PRUnichar **args,
                          PRUint32 argCount,
                          const PRUnichar **env, PRUint32 envCount,
                          nsIPipeListener* errConsole,
                          nsIPipeTransport** _retval);

    NS_METHOD RunPipe (nsIFile *executable,
                       const PRUnichar **args,
                       PRUint32 argCount,
                       const char* preInput,
                       const char* inputData, PRUint32 inputLength,
                       const PRUnichar** env, PRUint32 envCount,
                       char** outputData, PRUint32* outputCount,
                       char** outputError, PRUint32* errorCount,
                       PRInt32* _retval);

    NS_METHOD GetRandomTime (PRUint32 *_retval);

    EMBool                        mInitialized;
    nsCString                     mCookieStr;

    // Owning references
    nsCOMPtr<nsIPipeConsole>      mConsole;
};

class nsIPCRequest : public nsIIPCRequest
{
public:
    NS_DECL_ISUPPORTS
    NS_DECL_NSIIPCREQUEST

    // nsIPCRequest methods:
    nsIPCRequest();

    // Always make the destructor virtual:
    virtual ~nsIPCRequest();

protected:
    nsCString          mExecutable;

    // Owning references
    nsCOMPtr<nsIPipeTransport> mPipeTransport;
    nsCOMPtr<nsIPipeListener>  mStdoutConsole;
    nsCOMPtr<nsIPipeListener>  mStderrConsole;
};

#endif // nsIPCService_h__
