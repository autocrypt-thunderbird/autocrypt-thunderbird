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

#include "mimeenig.h"
#include "nsEnigModule.h"
#include "nsEnigMimeService.h"
#include "nspr.h"
#include "nsString.h"
#include "nsCOMPtr.h"
#include "nsIDOMNode.h"
#include "nsIDOMText.h"
#include "nsIThread.h"
#include "nsIComponentManager.h"
#include "nsIComponentRegistrar.h"
#include "nsIGenericFactory.h"
#include "nsEnigContentHandler.h"
#include "nsReadableUtils.h"

NS_GENERIC_FACTORY_CONSTRUCTOR(nsEnigContentHandler)

#ifdef PR_LOGGING
PRLogModuleInfo* gEnigMimeServiceLog = NULL;
#endif

#define ERROR_LOG(args)    PR_LOG(gEnigMimeServiceLog,PR_LOG_ERROR,args)
#define WARNING_LOG(args)  PR_LOG(gEnigMimeServiceLog,PR_LOG_WARNING,args)
#define DEBUG_LOG(args)    PR_LOG(gEnigMimeServiceLog,PR_LOG_DEBUG,args)


// nsEnigMimeService implementation

// nsISupports implementation
NS_IMPL_THREADSAFE_ISUPPORTS1(nsEnigMimeService,
                              nsIEnigMimeService)


// nsEnigMimeService implementation
nsEnigMimeService::nsEnigMimeService()
  : mDummyHandler(PR_FALSE),
    mInitialized(PR_FALSE)
{
  nsresult rv;

  NS_INIT_ISUPPORTS();

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

  static const nsModuleComponentInfo info =
  { NS_ENIGCONTENTHANDLER_CLASSNAME,
    NS_ENIGCONTENTHANDLER_CID,
    NS_ENIGDUMMYHANDLER_CONTRACTID,
    nsEnigContentHandlerConstructor,
  };

  // Create a generic factory for the dummy content handler
  nsCOMPtr<nsIGenericFactory> factory;
  rv = NS_NewGenericFactory(getter_AddRefs(factory), &info);

  if (NS_SUCCEEDED(rv)) {
    // Register factory for dummy handler
    nsCOMPtr<nsIComponentRegistrar> registrar;
    rv = NS_GetComponentRegistrar(getter_AddRefs(registrar));
    if (NS_FAILED(rv)) return;
        
    rv = registrar->RegisterFactory(info.mCID, info.mDescription,
                                             info.mContractID, factory);
    if (NS_SUCCEEDED(rv)) {
      mDummyHandler = PR_TRUE;
    }
  }
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
nsEnigMimeService::Init()
{
  nsresult rv;
  DEBUG_LOG(("nsEnigContenthandler::Init:\n"));

  if (!mimeEncryptedClassP) {
    ERROR_LOG(("nsEnigContenthandler::Init: ERROR mimeEncryptedClassPis null\n"));
    return NS_ERROR_FAILURE;
  }

  if (!mDummyHandler) {
    ERROR_LOG(("nsEnigContenthandler::Init: ERROR content handler for %s not initialized\n", APPLICATION_XENIGMAIL_DUMMY));
    return NS_ERROR_FAILURE;
  }

  static const nsModuleComponentInfo info =
  { NS_ENIGCONTENTHANDLER_CLASSNAME,
    NS_ENIGCONTENTHANDLER_CID,
    NS_ENIGENCRYPTEDHANDLER_CONTRACTID,
    nsEnigContentHandlerConstructor,
  };

  // Create a generic factory for the content handler
  nsCOMPtr<nsIGenericFactory> factory;
  rv = NS_NewGenericFactory(getter_AddRefs(factory), &info);
  if (NS_FAILED(rv)) return rv;
  
  nsCOMPtr<nsIComponentRegistrar> registrar;
  rv = NS_GetComponentRegistrar(getter_AddRefs(registrar));
  if (NS_FAILED(rv)) return rv;

  // Register factory
  rv = registrar->RegisterFactory(info.mCID, info.mDescription,
                                           info.mContractID, factory);

  if (NS_FAILED(rv)) return rv;

  DEBUG_LOG(("nsEnigMimeService::Init: registered %s\n", info.mContractID));

  mInitialized = PR_TRUE;

  return NS_OK;
}

NS_IMETHODIMP
nsEnigMimeService::GetInitialized(PRBool *_retval)
{
  if (!_retval)
    return NS_ERROR_NULL_POINTER;

  *_retval = mInitialized;

  DEBUG_LOG(("nsEnigMimeService::GetInitialized: %d\n", (int) mInitialized));

  return NS_OK;
}

NS_IMETHODIMP
nsEnigMimeService::GetVersion(char **_retval)
{
  *_retval = nsCRT::strdup(ENIGMIME_VERSION);
  if (!*_retval)
    return NS_ERROR_OUT_OF_MEMORY;

  DEBUG_LOG(("nsEnigMimeService::GetVersion: %s\n", *_retval));
  return NS_OK;
}

NS_IMETHODIMP
nsEnigMimeService::GetPlainText(nsIDOMNode* domNode,
                                const PRUnichar* findStr,
                                nsAString& text)
{
  nsresult rv;
  nsAutoString outStr;

  //DEBUG_LOG(("nsEnigMimeService::GetPlainText:\n"));

  PRUint16 nodeType;
  rv = domNode->GetNodeType(&nodeType);
  if (NS_FAILED(rv)) return rv;

  if (nodeType == nsIDOMNode::TEXT_NODE) {
    // Text node
    nsCOMPtr<nsIDOMText> domText( do_QueryInterface(domNode) );
    rv = domText->GetData(outStr);
    if (NS_FAILED(rv)) return rv;

  } else {
    // Iterate over all child nodes
    nsCOMPtr<nsIDOMNode> child;
    rv = domNode->GetFirstChild(getter_AddRefs(child));
    if (NS_FAILED(rv))
      return NS_OK;

    while (child) {
      nsAutoString temStr;
      rv = GetPlainText(child, nsnull, temStr);
      if (NS_FAILED(rv)) return rv;

      outStr.Append(temStr);

      nsCOMPtr<nsIDOMNode> temp = child;
      rv = temp->GetNextSibling(getter_AddRefs(child));
      if (NS_FAILED(rv))
        break;
    }
  }

  if (outStr.FindChar(0xA0) >= 0) {
    // Replace non-breaking spaces with plain spaces
    outStr.ReplaceChar(0xA0, ' ');
  }

  if (findStr &&
      nsCharTraits<PRUnichar>::length(findStr) &&
      (outStr.Find(findStr) < 0) ) {
    // Substring not found; return empty string
    outStr.Truncate(0);
  }

  text = outStr;

  return NS_OK;
}

NS_IMETHODIMP
nsEnigMimeService::RememberEncrypted(const nsACString & uri)
{
  // Assuming duplicates are allowed.
  mEncryptedURIs.AppendCString(nsCString(uri));
  return NS_OK;
}

NS_IMETHODIMP
nsEnigMimeService::ForgetEncrypted(const nsACString & uri)
{
  // Assuming, this will only remove one copy of the string, if the array
  // contains multiple copies of the same string.
  mEncryptedURIs.RemoveCString(nsCString(uri));
  return NS_OK;
}

NS_IMETHODIMP
nsEnigMimeService::IsEncrypted(const nsACString & uri, PRBool *_retval)
{
  *_retval = (mEncryptedURIs.IndexOf(nsCString(uri)) != -1);
  return NS_OK;
}
