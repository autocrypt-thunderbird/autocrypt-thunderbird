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

#include "nsIEnigmail.h"
#include "nsIMsgCompFields.h"
#include "nsIEnigMsgCompFields.h"
#include "nsEnigMsgCompose.h"
#include "nspr.h"
#include "nsCOMPtr.h"
#include "nsString.h"
#include "nsNetUtil.h"
#include "nsFileStream.h"
#include "nsIThread.h"
#include "nsIFactory.h"

#ifdef PR_LOGGING
PRLogModuleInfo* gEnigMsgComposeLog = NULL;
#endif

#define ERROR_LOG(args)    PR_LOG(gEnigMsgComposeLog,PR_LOG_ERROR,args)
#define WARNING_LOG(args)  PR_LOG(gEnigMsgComposeLog,PR_LOG_WARNING,args)
#define DEBUG_LOG(args)    PR_LOG(gEnigMsgComposeLog,PR_LOG_DEBUG,args)

#define NS_MSGCOMPOSESECURE_CID                    \
{ /* dd753201-9a23-4e08-957f-b3616bf7e012 */       \
   0xdd753201, 0x9a23, 0x4e08,                     \
  {0x95, 0x7f, 0xb3, 0x61, 0x6b, 0xf7, 0xe0, 0x12 }}

#define MK_MIME_ERROR_WRITING_FILE -1

static NS_DEFINE_CID(kMsgComposeSecureCID, NS_MSGCOMPOSESECURE_CID);

// nsEnigMsgComposeFactory implementation

NS_IMPL_ISUPPORTS1(nsEnigMsgComposeFactory, nsIFactory)

nsEnigMsgComposeFactory::nsEnigMsgComposeFactory() {

  NS_INIT_ISUPPORTS();
}

nsEnigMsgComposeFactory::~nsEnigMsgComposeFactory() {
}

NS_IMETHODIMP
nsEnigMsgComposeFactory::CreateInstance(nsISupports *aOuter,
                                        const nsIID & aIID,
                                        void **aResult)
{
  NS_ENSURE_ARG_POINTER(aResult);
  
  *aResult = NULL;  
  nsEnigMsgCompose *instance = new nsEnigMsgCompose;    
  if (!instance)
    return NS_ERROR_OUT_OF_MEMORY;
    
  nsresult rv = instance->QueryInterface(aIID, aResult);
  if (rv != NS_OK) {  
    delete instance;  
  }  
    
  return rv;
}

NS_IMETHODIMP nsEnigMsgComposeFactory::LockFactory(PRBool lock)
{
  return NS_OK;
}


// nsEnigMsgCompose implementation

// nsISupports implementation
NS_IMPL_THREADSAFE_ISUPPORTS1(nsEnigMsgCompose,
                              nsIMsgComposeSecure);


// nsEnigMsgCompose implementation
nsEnigMsgCompose::nsEnigMsgCompose()
  : mUseSMIME(PR_FALSE),
    mIsDraft(PR_FALSE),
    mStream(0)
    
{
  nsresult rv;

  NS_INIT_REFCNT();

#ifdef PR_LOGGING
  if (gEnigMsgComposeLog == nsnull) {
    gEnigMsgComposeLog = PR_NewLogModule("nsEnigMsgCompose");
  }
#endif

  mMsgComposeSecure = do_CreateInstance(kMsgComposeSecureCID, &rv);

#ifdef FORCE_PR_LOG
  nsCOMPtr<nsIThread> myThread;
  rv = nsIThread::GetCurrent(getter_AddRefs(myThread));
  DEBUG_LOG(("nsEnigMsgCompose:: <<<<<<<<< CTOR(%x): myThread=%x\n",
         (int) this, (int) myThread.get()));
#endif
}


nsEnigMsgCompose::~nsEnigMsgCompose()
{
  nsresult rv;
#ifdef FORCE_PR_LOG
  nsCOMPtr<nsIThread> myThread;
  rv = nsIThread::GetCurrent(getter_AddRefs(myThread));
  DEBUG_LOG(("nsEnigMsgCompose:: >>>>>>>>> DTOR(%x): myThread=%x\n",
         (int) this, (int) myThread.get()));
#endif

}


///////////////////////////////////////////////////////////////////////////////
// nsIMsgComposeSecure methods:
///////////////////////////////////////////////////////////////////////////////

NS_IMETHODIMP
nsEnigMsgCompose::RequiresCryptoEncapsulation(
                                        nsIMsgIdentity* aIdentity,
                                        nsIMsgCompFields* aCompFields,
                                        PRBool* aRequiresEncryptionWork)
{
  nsresult rv;
  DEBUG_LOG(("nsEnigMsgCompose::RequiresCryptoEncapsulation: \n"));

  if (!mMsgComposeSecure)
    return NS_ERROR_FAILURE;

  rv = mMsgComposeSecure->RequiresCryptoEncapsulation(aIdentity,
                                                      aCompFields,
                                                      &mUseSMIME);
  if (NS_FAILED(rv))
    return rv;

  if (mUseSMIME) {
    DEBUG_LOG(("nsEnigMsgCompose::RequiresCryptoEncapsulation: Using SMIME\n"));
   *aRequiresEncryptionWork = PR_TRUE;
   return NS_OK;
  }

  // Enigmail stuff
  nsCOMPtr<nsISupports> securityInfo;

  rv = aCompFields->GetSecurityInfo(getter_AddRefs(securityInfo));
  if (NS_FAILED(rv))
    return rv;

  nsCOMPtr<nsIEnigMsgCompFields> enigSecurityInfo = do_QueryInterface(securityInfo);

  if (enigSecurityInfo) {
    PRUint32 sendFlags;
    rv = enigSecurityInfo->GetSendFlags(&sendFlags);
    if (NS_FAILED(rv))
      return rv;

    DEBUG_LOG(("nsEnigMsgCompose::RequiresCryptoEncapsulation: sendFlags=%x\n", sendFlags));

    *aRequiresEncryptionWork = sendFlags &
      (nsIEnigmail::SEND_SIGNED | nsIEnigmail::SEND_ENCRYPTED);

  } else {
    *aRequiresEncryptionWork = PR_FALSE;
  }

  return NS_OK;
}

NS_IMETHODIMP
nsEnigMsgCompose::BeginCryptoEncapsulation(
                                        nsOutputFileStream* aStream,
                                        const char* aRecipients,
                                        nsIMsgCompFields* aCompFields,
                                        nsIMsgIdentity* aIdentity,
                                        nsIMsgSendReport* sendReport,
                                        PRBool aIsDraft)
{
  DEBUG_LOG(("nsEnigMsgCompose::BeginCryptoEncapsulation: %s\n", aRecipients));
  if (mUseSMIME) {
    return mMsgComposeSecure->BeginCryptoEncapsulation(aStream, aRecipients,
                                                       aCompFields, aIdentity,
                                                       sendReport, aIsDraft);
  }

  // Enigmail stuff
  mStream = aStream;
  mIsDraft = aIsDraft;

  return NS_OK;
}

NS_IMETHODIMP
nsEnigMsgCompose::FinishCryptoEncapsulation(PRBool aAbort,
                                                nsIMsgSendReport* sendReport)
{
  DEBUG_LOG(("nsEnigMsgCompose::FinishCryptoEncapsulation: \n"));
  if (mUseSMIME) {
    return mMsgComposeSecure->FinishCryptoEncapsulation(aAbort, sendReport);
  }

  // Enigmail stuff
  return NS_OK;
}

NS_IMETHODIMP
nsEnigMsgCompose::MimeCryptoWriteBlock(const char *aBuf, PRInt32 aLen)
{
  DEBUG_LOG(("nsEnigMsgCompose::MimeCryptoWriteBlock: \n"));
  if (mUseSMIME) {
    return mMsgComposeSecure->MimeCryptoWriteBlock(aBuf, aLen);
  }

  // Enigmail stuff
  nsCAutoString temStr(aBuf, aLen);
  DEBUG_LOG(("nsEnigMsgCompose::MimeCryptoWriteBlock: aBuf='%s'\n",
             temStr.get()));

  PRInt32 writeCount = mStream->write(aBuf, aLen);
  if (writeCount < aLen) {
    return MK_MIME_ERROR_WRITING_FILE;
  }

  return NS_OK;
}
