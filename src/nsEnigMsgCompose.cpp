/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*-
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


// Logging of debug output
// The following define statement should occur before any include statements
#define FORCE_PR_LOG       /* Allow logging even in release build */

#include "enigmail.h"
#include "nsStringAPI.h"
#include "nsIMsgCompFields.h"
#include "nsEnigMsgCompose.h"
#include "nsIEnigMsgCompFields.h"
#include "nsIEnigScriptableMsgCompose.h"
#include "nsComponentManagerUtils.h"
#include "nspr.h"
///undef MOZILLA_INTERNAL_API

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

static NS_DEFINE_CID(kMsgComposeSecureCID, NS_MSGCOMPOSESECURE_CID);


#define MAX_HEADER_BYTES 16000
#define MAX_SIGNATURE_BYTES 16000

static const PRUint32 kCharMax = 1024;

// nsEnigMsgCompose implementation

// nsISupports implementation
NS_IMPL_THREADSAFE_ISUPPORTS1(nsEnigMsgCompose,
                              nsIMsgComposeSecure)

// nsEnigMsgCompose implementation
nsEnigMsgCompose::nsEnigMsgCompose()
  : mInitialized(PR_FALSE),
    mUseSMIME(PR_FALSE),
    mEnigMsgComposeJS(NULL),
    mMsgComposeSecure(NULL)
{
  nsresult rv;

  NS_INIT_ISUPPORTS();

#ifdef PR_LOGGING
  if (gEnigMsgComposeLog == NULL) {
    gEnigMsgComposeLog = PR_NewLogModule("nsEnigMsgCompose");
  }
#endif

  // Remember to use original CID, not CONTRACTID, to avoid infinite looping!
  mMsgComposeSecure = do_CreateInstance(kMsgComposeSecureCID, &rv);

#ifdef FORCE_PR_LOG
  nsCOMPtr<nsIThread> myThread;
  rv = ENIG_GET_THREAD(myThread);
  DEBUG_LOG(("nsEnigMsgCompose:: <<<<<<<<< CTOR(%p): myThread=%p\n",
         this, myThread.get()));
#endif
}


nsEnigMsgCompose::~nsEnigMsgCompose()
{
  nsresult rv;
#ifdef FORCE_PR_LOG
  nsCOMPtr<nsIThread> myThread;
  rv = ENIG_GET_THREAD(myThread);
  DEBUG_LOG(("nsEnigMsgCompose:: >>>>>>>>> DTOR(%p): myThread=%p\n",
         this, myThread.get()));
#endif

  Finalize();

}

nsresult
nsEnigMsgCompose::Finalize()
{
  DEBUG_LOG(("nsEnigMsgCompose::Finalize:\n"));

  // do something useful

  return NS_OK;
}


///////////////////////////////////////////////////////////////////////////////
// nsIMsgComposeSecure methods:
///////////////////////////////////////////////////////////////////////////////

NS_IMETHODIMP
nsEnigMsgCompose::RequiresCryptoEncapsulation(
                                        nsIMsgIdentity* aIdentity,
                                        nsIMsgCompFields* aCompFields,
                                        bool* aRequiresEncryptionWork)
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

  mEnigMsgComposeJS = do_CreateInstance("@enigmail.net/enigmail/newcomposesecure;1", &rv);

  if (NS_FAILED(rv)) {
    ERROR_LOG(("nsEnigMsgCompose::RequiresCryptoEncapsulation: could not create JS object\n"));

    return rv;
  }

  rv = mEnigMsgComposeJS->DisableSMimeCheck();
  NS_ENSURE_SUCCESS(rv, rv);

  return mEnigMsgComposeJS->RequiresCryptoEncapsulation(aIdentity,
                                                      aCompFields,
                                                      aRequiresEncryptionWork);

}


NS_IMETHODIMP
nsEnigMsgCompose::BeginCryptoEncapsulation(
                                        nsIOutputStream* aStream,
                                        const char* aRecipients,
                                        nsIMsgCompFields* aCompFields,
                                        nsIMsgIdentity* aIdentity,
                                        nsIMsgSendReport* sendReport,
                                        bool aIsDraft)
{
  DEBUG_LOG(("nsEnigMsgCompose::BeginCryptoEncapsulation: %s\n", aRecipients));

  if (!mMsgComposeSecure)
    return NS_ERROR_FAILURE;

  if (mUseSMIME) {
    return mMsgComposeSecure->BeginCryptoEncapsulation(aStream, aRecipients,
                                                       aCompFields, aIdentity,
                                                       sendReport, aIsDraft);
  }

  return mEnigMsgComposeJS->BeginCryptoEncapsulation(aStream, aRecipients,
                                                     aCompFields, aIdentity,
                                                     sendReport, aIsDraft);
}

NS_IMETHODIMP
nsEnigMsgCompose::FinishCryptoEncapsulation(bool aAbort,
                                            nsIMsgSendReport* sendReport)
{
  DEBUG_LOG(("nsEnigMsgCompose::FinishCryptoEncapsulation: \n"));

  if (!mMsgComposeSecure)
    return NS_ERROR_FAILURE;

  if (mUseSMIME) {
    return mMsgComposeSecure->FinishCryptoEncapsulation(aAbort, sendReport);
  }

  return mEnigMsgComposeJS->FinishCryptoEncapsulation(aAbort, sendReport);
}




NS_IMETHODIMP
nsEnigMsgCompose::MimeCryptoWriteBlock(const char *aBuf, PRInt32 aLen)
{
  DEBUG_LOG(("nsEnigMsgCompose::MimeCryptoWriteBlock: \n"));

  if (!mMsgComposeSecure)
    return NS_ERROR_FAILURE;

  if (mUseSMIME) {
    return mMsgComposeSecure->MimeCryptoWriteBlock(aBuf, aLen);
  }

  return mEnigMsgComposeJS->MimeCryptoWriteBlock(aBuf, aLen);
}

