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

#include "nsEnigContentHandler.h"
#include "mimedummy.h"
#include "mimeenig.h"
#include "nspr.h"
#include "nsCOMPtr.h"
#include "nsString.h"
#include "nsNetUtil.h"
#include "nsFileStream.h"
#include "nsIThread.h"
#include "nsIMimeObjectClassAccess.h"
#include "nsMsgMimeCID.h"

MimeContainerClass* mimeContainerClassP = NULL;

#ifdef PR_LOGGING
PRLogModuleInfo* gEnigContentHandlerLog = NULL;
#endif

#define ERROR_LOG(args)    PR_LOG(gEnigContentHandlerLog,PR_LOG_ERROR,args)
#define WARNING_LOG(args)  PR_LOG(gEnigContentHandlerLog,PR_LOG_WARNING,args)
#define DEBUG_LOG(args)    PR_LOG(gEnigContentHandlerLog,PR_LOG_DEBUG,args)

static NS_DEFINE_CID(kMimeObjectClassAccessCID, NS_MIME_OBJECT_CLASS_ACCESS_CID);


// nsEnigContentHandlerFactory implementation

NS_IMPL_ISUPPORTS1(nsEnigContentHandlerFactory, nsIFactory)

nsEnigContentHandlerFactory::nsEnigContentHandlerFactory() {

  NS_INIT_ISUPPORTS();
}

nsEnigContentHandlerFactory::~nsEnigContentHandlerFactory() {
}

NS_IMETHODIMP
nsEnigContentHandlerFactory::CreateInstance(nsISupports *aOuter,
                                        const nsIID & aIID,
                                        void **aResult)
{
  NS_ENSURE_ARG_POINTER(aResult);
  
  *aResult = NULL;  
  nsEnigContentHandler *instance = new nsEnigContentHandler;    
  if (!instance)
    return NS_ERROR_OUT_OF_MEMORY;
    
  nsresult rv = instance->QueryInterface(aIID, aResult);
  if (rv != NS_OK) {  
    delete instance;  
  }  
    
  return rv;
}

NS_IMETHODIMP nsEnigContentHandlerFactory::LockFactory(PRBool lock)
{
  return NS_OK;
}


// nsEnigContentHandler implementation

// nsISupports implementation
NS_IMPL_THREADSAFE_ISUPPORTS1(nsEnigContentHandler,
                              nsIMimeContentTypeHandler);


// nsEnigContentHandler implementation
nsEnigContentHandler::nsEnigContentHandler()
  : mContentType("")
{
  nsresult rv;

  NS_INIT_REFCNT();

#ifdef PR_LOGGING
  if (gEnigContentHandlerLog == nsnull) {
    gEnigContentHandlerLog = PR_NewLogModule("nsEnigContentHandler");
  }
#endif

#ifdef FORCE_PR_LOG
  nsCOMPtr<nsIThread> myThread;
  rv = nsIThread::GetCurrent(getter_AddRefs(myThread));
  DEBUG_LOG(("nsEnigContentHandler:: <<<<<<<<< CTOR(%x): myThread=%x\n",
         (int) this, (int) myThread.get()));
#endif
}


nsEnigContentHandler::~nsEnigContentHandler()
{
  nsresult rv;
#ifdef FORCE_PR_LOG
  nsCOMPtr<nsIThread> myThread;
  rv = nsIThread::GetCurrent(getter_AddRefs(myThread));
  DEBUG_LOG(("nsEnigContentHandler:: >>>>>>>>> DTOR(%x): myThread=%x\n",
         (int) this, (int) myThread.get()));
#endif

}


///////////////////////////////////////////////////////////////////////////////
// nsIMimeContentTypeHandler methods:
///////////////////////////////////////////////////////////////////////////////

NS_IMETHODIMP
nsEnigContentHandler::GetContentType(char **contentType)
{
  DEBUG_LOG(("nsEnigContenthandler::GetContentType: \n"));
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP
nsEnigContentHandler::CreateContentTypeHandlerClass(
                                    const char *content_type, 
                                    contentTypeHandlerInitStruct *initStruct, 
                                    MimeObjectClass **objClass)
{
  DEBUG_LOG(("nsEnigContenthandler::CreateContentTypeHandlerClass: %s\n", content_type));

  mContentType = content_type;

  *objClass = NULL;

  if (!nsCRT::strcasecmp(content_type, APPLICATION_XENIGMAIL_DUMMY)) {
    // application/x-enigmail-dummy

    if (!mimeContainerClassP) {
      nsresult rv;

      nsCOMPtr<nsIMimeObjectClassAccess> mimeObjectClassAccess(do_CreateInstance(kMimeObjectClassAccessCID, &rv));
      if (NS_FAILED(rv))
        return rv;

      rv = mimeObjectClassAccess->GetmimeContainerClass((void **) &mimeContainerClassP);
      if (NS_FAILED(rv))
        return rv;

      // Set superclass by hand
      MimeObjectClass *clazz = (MimeObjectClass *) &mimeDummyClass;
      clazz->superclass = (MimeObjectClass *) mimeContainerClassP;
    }

    *objClass = (MimeObjectClass *) &mimeDummyClass;

    initStruct->force_inline_display = PR_FALSE;

    return NS_OK;
  }

  if (!nsCRT::strcasecmp(content_type, MULTIPART_ENCRYPTED)) {
    // multipart/encrypted

    if (!mimeContainerClassP || !mimeEncryptedClassP)
      return NS_ERROR_FAILURE;

    *objClass = (MimeObjectClass *) &mimeEncryptedEnigClass;

    initStruct->force_inline_display = PR_FALSE;

    return NS_OK;
  }

  if (!nsCRT::strcasecmp(content_type, APPLICATION_PGP)) {
    // application/pgp

    if (!mimeContainerClassP || !mimeEncryptedClassP)
      return NS_ERROR_FAILURE;

    *objClass = (MimeObjectClass *) &mimeEncryptedEnigClass;

    initStruct->force_inline_display = PR_FALSE;

    return NS_OK;
  }

  return NS_ERROR_FAILURE;
}
