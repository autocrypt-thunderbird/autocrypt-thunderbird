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

#include "nsEnigMimeService.h"
#include "nspr.h"
#include "nsCOMPtr.h"
#include "nsIThread.h"

#ifdef PR_LOGGING
PRLogModuleInfo* gEnigMimeServiceLog = NULL;
#endif

#define ERROR_LOG(args)    PR_LOG(gEnigMimeServiceLog,PR_LOG_ERROR,args)
#define WARNING_LOG(args)  PR_LOG(gEnigMimeServiceLog,PR_LOG_WARNING,args)
#define DEBUG_LOG(args)    PR_LOG(gEnigMimeServiceLog,PR_LOG_DEBUG,args)


// nsEnigMimeService implementation

// nsISupports implementation
NS_IMPL_THREADSAFE_ISUPPORTS1(nsEnigMimeService,
                              nsIEnigMimeService);


// nsEnigMimeService implementation
nsEnigMimeService::nsEnigMimeService()
  : mMimeInitialized(PR_FALSE)
{
  nsresult rv;

  NS_INIT_REFCNT();

#ifdef PR_LOGGING
  if (gEnigMimeServiceLog == nsnull) {
    gEnigMimeServiceLog = PR_NewLogModule("nsEnigMimeService");
  }
#endif

#ifdef FORCE_PR_LOG
  nsCOMPtr<nsIThread> myThread;
  rv = nsIThread::GetCurrent(getter_AddRefs(myThread));
  DEBUG_LOG(("nsEnigMimeService:: <<<<<<<<< CTOR(%x): myThread=%x\n",
         (int) this, (int) myThread.get()));
#endif
}


nsEnigMimeService::~nsEnigMimeService()
{
  nsresult rv;
#ifdef FORCE_PR_LOG
  nsCOMPtr<nsIThread> myThread;
  rv = nsIThread::GetCurrent(getter_AddRefs(myThread));
  DEBUG_LOG(("nsEnigMimeService:: >>>>>>>>> DTOR(%x): myThread=%x\n",
         (int) this, (int) myThread.get()));
#endif

}


///////////////////////////////////////////////////////////////////////////////
// nsIEnigMimeService methods:
///////////////////////////////////////////////////////////////////////////////

NS_IMETHODIMP
nsEnigMimeService::GetMimeInitialized(PRBool *mimeInitialized)
{
  DEBUG_LOG(("nsEnigContenthandler::GetMimeInitialized: \n"));

  *mimeInitialized = mMimeInitialized;
  return NS_OK;
}
