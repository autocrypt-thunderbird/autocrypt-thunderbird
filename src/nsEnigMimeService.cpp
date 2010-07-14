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

#include "enigmail.h"
#include "mimeenig.h"
#include "nsEnigModule.h"
#include "nsEnigMimeService.h"
#include "nspr.h"
#include "plstr.h"
#include "nsStringAPI.h"
#include "nsCOMPtr.h"
#include "nsIDOMNode.h"
#include "nsIDOMText.h"
#include "nsIThread.h"
#include "nsIComponentManager.h"
#include "nsIComponentRegistrar.h"
#if MOZILLA_MAJOR_VERSION < 2

#include "nsIGenericFactory.h"

#else

#include "mozilla/ModuleUtils.h"
#include "nsXULAppAPI.h"

#endif
#include "nsEnigContentHandler.h"

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
  rv = ENIG_GET_THREAD(myThread);
  DEBUG_LOG(("nsEnigMimeService:: <<<<<<<<< CTOR(%p): myThread=%p\n",
         this, myThread.get()));
#endif

#if MOZILLA_MAJOR_VERSION < 2

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

#else

  mDummyHandler = PR_TRUE;

#endif
}


nsEnigMimeService::~nsEnigMimeService()
{
  nsresult rv;
#ifdef FORCE_PR_LOG
  nsCOMPtr<nsIThread> myThread;
  rv = ENIG_GET_THREAD(myThread);
  DEBUG_LOG(("nsEnigMimeService:: >>>>>>>>> DTOR(%p): myThread=%p\n",
         this, myThread.get()));
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

#if MOZILLA_MAJOR_VERSION < 2

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

  DEBUG_LOG(("nsEnigMimeService::Init: %s\n", info.mContractID));

#endif


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
  *_retval = PL_strdup(ENIGMIME_VERSION);
  if (!*_retval)
    return NS_ERROR_OUT_OF_MEMORY;

  DEBUG_LOG(("nsEnigMimeService::GetVersion: %s\n", *_retval));
  return NS_OK;
}


static void
__ReplaceSubstring (nsAString &string, nsAString &replace, nsAString &with)
{
  PRInt32 i = string.Find (replace);
  while (i >= 0) {
    string.Replace (i, replace.Length(), with);
    i = string.Find (replace);
  }
}

static void
__ReplaceChar (nsAString &string, const PRUnichar replace, const PRUnichar with)
{
  PRInt32 i = string.FindChar (replace);
  while (i >= 0) {
    string.Replace (i, 1, &with, 1);
    i = string.FindChar (replace);
  }
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
    __ReplaceChar(outStr, 0xA0, ' ');
  }

  if (findStr &&
      nsDependentString(findStr).Length() &&
      (outStr.Find(nsDependentString(findStr)) < 0) ) {
    // Substring not found; return empty string
    outStr.Truncate();
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

NS_IMETHODIMP
nsEnigMimeService::Sleep(PRUint32 miliSeconds)
{
  // Sleep for the specified amount of miliseconds
  PR_Sleep(miliSeconds);
  return NS_OK;
}


NS_IMETHODIMP
nsEnigMimeService::GetRandomHex(PRUint32 nDigits, char **_retval)
{
  DEBUG_LOG(("nsIPCService::GetRandomHex: %d\n", nDigits));

  if (!_retval)
    return NS_ERROR_NULL_POINTER;

  if (nDigits < 1)
    return NS_ERROR_FAILURE;

  // Get random noise
  PRSize nBytes = (nDigits+1)/2;
  PRBool discardOneDigit = (nBytes*2 == nDigits+1);

  unsigned char *randomBuf = (unsigned char*) PR_Malloc(sizeof(char *)
                                                        * nBytes );
  PRSize randomBytes = PR_GetRandomNoise((void*)randomBuf, nBytes);

  if (randomBytes < nBytes) {
    PR_Free(randomBuf);
    return NS_ERROR_NOT_AVAILABLE;
  }

  // Convert random bytes to hexadecimal string
  nsCAutoString hex ("");
  for (PRUint32 j=0; j<nBytes; j++) {
     PRInt32 value = randomBuf[j];
     if (discardOneDigit && (j == nBytes-1)) {
       value = value % 16;
     } else if (value < 16) {
       hex.Append("0");
     }
     hex.AppendInt(value, 16);
  }

  PR_Free(randomBuf);

  *_retval = ToNewCString(hex);

  return NS_OK;
}



/*
NS_IMETHODIMP nsPipeTransport::InitCommand(const char *command,
                                           const char **env,
                                           PRUint32 envCount,
                                           PRUint32 timeoutMS,
                                           const char *killString,
                                           PRBool noProxy,
                                           PRBool mergeStderr,
                                           nsIPipeListener* console)
{
  nsresult rv;

  DEBUG_LOG(("nsPipeTransport::InitCommand: command=%s [%d]\n",
             command, envCount));

  if (!command)
    return NS_ERROR_FAILURE;

  mCommand = command;

  // Create a buffer of same size as the command string
  PRUint32 len = strlen(command);
  char* buf = (char*) PR_Malloc(sizeof(char) * (len+1) );

  // Parse command arguments separated by whitespace
  PRUint32 j;
  char quote = '\0';
  PRBool backquote = PR_FALSE;
  PRBool inArg = PR_FALSE;
  PRUint32 bufCount = 0;
  PRUint32 argCount = 0;

  for (j=0; j<len; j++) {
    char ch = command[j];
    if (!quote && !backquote) {
      // Unquoted character

      if ((ch == ' ') || (ch == '\t') || (ch == '\r') || (ch == '\n')) {
        // Whitespace (skip)

        if (inArg) {
          // End argument parsing; insert null character in buffer
          buf[bufCount++] = '\0';
          inArg = PR_FALSE;
        }

      } else if (!inArg) {
        // Non-whitespace character; start parsing new argument
        inArg = PR_TRUE;
        argCount++;
      }
    }

    if (inArg) {
      // Argument parsing

      if (backquote) {
        // Backquoted character; append to buffer
        buf[bufCount++] = ch;
        backquote = PR_FALSE;

      } else if (ch == '\\') {
        // Backquote following character
        backquote = PR_TRUE;

      } else if (quote == ch) {
        // Matching end quote
        quote = '\0';

      } else if (!quote && ((ch == '"') || (ch == '\'')) ) {
        // Start new quote
        quote = ch;

      } else {
        // Append character to buffer (quoted/unquoted)
        buf[bufCount++] = ch;
      }
    }
  }

  if (inArg)
    buf[bufCount++] = '\0';   // End argument parsing

  PR_ASSERT(bufCount <= (len+1)); // No buffer overflow

  if (quote) {
    ERROR_LOG(("nsPipeTransport::InitCommand: Unmatched quote in command string\n"));
    PR_Free(buf);
    return NS_ERROR_FAILURE;
  }

  if (!argCount) {
    ERROR_LOG(("nsPipeTransport::InitCommand: Blank/null command string\n"));
    PR_Free(buf);
    return NS_ERROR_FAILURE;
  }

  DEBUG_LOG(("nsPipeTransport::InitCommand: argCount=%d\n", argCount));

  // Argument list (includes command path as the first argument)
  char** args = (char **) PR_Malloc(sizeof(char *) * (argCount+1) );
  if (!args)
    return NS_ERROR_OUT_OF_MEMORY;

  PRUint32 argOffset = 0;
  for (j=0; j<argCount; j++) {
    args[j] = buf + argOffset;
    argOffset += strlen(args[j]) + 1;
  }

  PR_ASSERT(argOffset == bufCount);

  args[argCount] = NULL;

  rv = Init((const char*) args[0],
            (const char**) args+1, argCount-1, env, envCount,
            timeoutMS, killString, noProxy, mergeStderr,
            console);

  PR_Free(buf);

  return rv;
}
*/
