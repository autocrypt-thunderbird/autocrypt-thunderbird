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

#include "nsEnigMsgCompFields.h"
#include "nspr.h"
#include "nsCOMPtr.h"
#include "nsString.h"
#include "nsNetUtil.h"
#include "nsFileStream.h"
#include "nsIThread.h"
#include "nsIFactory.h"

#ifdef PR_LOGGING
PRLogModuleInfo* gEnigMsgCompFieldsLog = NULL;
#endif

#define ERROR_LOG(args)    PR_LOG(gEnigMsgCompFieldsLog,PR_LOG_ERROR,args)
#define WARNING_LOG(args)  PR_LOG(gEnigMsgCompFieldsLog,PR_LOG_WARNING,args)
#define DEBUG_LOG(args)    PR_LOG(gEnigMsgCompFieldsLog,PR_LOG_DEBUG,args)

#define NS_MSGCOMPOSESECURE_CID                    \
{ /* dd753201-9a23-4e08-957f-b3616bf7e012 */       \
   0xdd753201, 0x9a23, 0x4e08,                     \
  {0x95, 0x7f, 0xb3, 0x61, 0x6b, 0xf7, 0xe0, 0x12 }}

#define MK_MIME_ERROR_WRITING_FILE -1

// nsEnigMsgCompFields implementation

// nsISupports implementation
NS_IMPL_THREADSAFE_ISUPPORTS2(nsEnigMsgCompFields,
                              nsIEnigMsgCompFields,
                              nsIMsgSMIMECompFields);


// nsEnigMsgCompFields implementation
nsEnigMsgCompFields::nsEnigMsgCompFields()
  : mUIFlags(0),
    mSendFlags(0),
    mMsgSMIMECompFields(nsnull)
{
  nsresult rv;

  NS_INIT_REFCNT();

#ifdef PR_LOGGING
  if (gEnigMsgCompFieldsLog == nsnull) {
    gEnigMsgCompFieldsLog = PR_NewLogModule("nsEnigMsgCompFields");
  }
#endif

#ifdef FORCE_PR_LOG
  nsCOMPtr<nsIThread> myThread;
  rv = nsIThread::GetCurrent(getter_AddRefs(myThread));
  DEBUG_LOG(("nsEnigMsgCompFields:: <<<<<<<<< CTOR(%x): myThread=%x\n",
         (int) this, (int) myThread.get()));
#endif
}


nsEnigMsgCompFields::~nsEnigMsgCompFields()
{
  nsresult rv;
#ifdef FORCE_PR_LOG
  nsCOMPtr<nsIThread> myThread;
  rv = nsIThread::GetCurrent(getter_AddRefs(myThread));
  DEBUG_LOG(("nsEnigMsgCompFields:: >>>>>>>>> DTOR(%x): myThread=%x\n",
         (int) this, (int) myThread.get()));
#endif

}


///////////////////////////////////////////////////////////////////////////////
// nsIEnigMsgCompFields methods:
///////////////////////////////////////////////////////////////////////////////

NS_IMETHODIMP
nsEnigMsgCompFields::Init(nsIMsgSMIMECompFields* smimeCompFields)
{
  DEBUG_LOG(("nsEnigMsgCompFields::Init: \n"));

  mMsgSMIMECompFields = smimeCompFields;

  return NS_OK;
}

NS_IMETHODIMP
nsEnigMsgCompFields::GetUIFlags(PRUint32* _retval)
{
  *_retval = mUIFlags;
  return NS_OK;
}

NS_IMETHODIMP
nsEnigMsgCompFields::SetUIFlags(PRUint32 uiFlags)
{
  mUIFlags = uiFlags;
  return NS_OK;
}

NS_IMETHODIMP
nsEnigMsgCompFields::GetSendFlags(PRUint32* _retval)
{
  *_retval = mSendFlags;
  return NS_OK;
}

NS_IMETHODIMP
nsEnigMsgCompFields::SetSendFlags(PRUint32 uiFlags)
{
  mSendFlags = uiFlags;
  return NS_OK;
}

NS_IMETHODIMP
nsEnigMsgCompFields::GetSenderEmailAddr(nsACString &aSenderEmailAddr)
{
  DEBUG_LOG(("nsEnigMsgCompFields::GetSenderEmailAddr:\n"));

  aSenderEmailAddr = mSenderEmailAddr;
  return NS_OK;
}

NS_IMETHODIMP
nsEnigMsgCompFields::SetSenderEmailAddr(const nsACString &aSenderEmailAddr)
{
  mSenderEmailAddr = aSenderEmailAddr;
  DEBUG_LOG(("nsEnigMsgCompFields::SetSenderEmailAddr: %s\n", mSenderEmailAddr.get()));
  return NS_OK;
}
