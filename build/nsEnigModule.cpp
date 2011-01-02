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
 *
 * ***** END LICENSE BLOCK ***** */

#include "nsEnigModule.h"
#include "nsIClassInfoImpl.h"

#include "nsPipeConsole.h"
#include "nsPipeChannel.h"
#include "nsPipeFilterListener.h"
#include "nsIPCService.h"

#include "nsEnigMsgCompose.h"
#include "nsEnigMimeDecrypt.h"
#include "nsEnigMimeVerify.h"
#include "nsEnigMimeListener.h"
#include "nsEnigMimeWriter.h"
#include "nsEnigMimeService.h"
#include "nsEnigContentHandler.h"
//#include "nsIMsgComposeSecure.h"

#if MOZILLA_MAJOR_VERSION < 2

#include "nsIGenericFactory.h"

#else

#include "mozilla/ModuleUtils.h"

#endif

NS_GENERIC_FACTORY_CONSTRUCTOR(nsPipeConsole)
NS_GENERIC_FACTORY_CONSTRUCTOR(nsPipeChannel)
NS_GENERIC_FACTORY_CONSTRUCTOR(nsPipeFilterListener)
NS_GENERIC_FACTORY_CONSTRUCTOR_INIT(nsIPCService, Init)

NS_GENERIC_FACTORY_CONSTRUCTOR(nsEnigMsgCompose)
NS_GENERIC_FACTORY_CONSTRUCTOR(nsEnigMsgComposeFactory)
NS_GENERIC_FACTORY_CONSTRUCTOR(nsEnigMimeDecrypt)
NS_GENERIC_FACTORY_CONSTRUCTOR(nsEnigMimeVerify)
NS_GENERIC_FACTORY_CONSTRUCTOR(nsEnigMimeListener)
NS_GENERIC_FACTORY_CONSTRUCTOR(nsEnigMimeWriter)
NS_GENERIC_FACTORY_CONSTRUCTOR(nsEnigMimeService)

//NS_GENERIC_FACTORY_CONSTRUCTOR_INIT(nsEnigMimeService, Init)


#if MOZILLA_MAJOR_VERSION < 2


// CIDs implemented by module
static const nsModuleComponentInfo components[] =
{

    { NS_PIPECONSOLE_CLASSNAME,
      NS_PIPECONSOLE_CID,
      NS_PIPECONSOLE_CONTRACTID,
      nsPipeConsoleConstructor,
    },

    { NS_PIPECHANNEL_CLASSNAME,
      NS_PIPECHANNEL_CID,
      NS_PIPECHANNEL_CONTRACTID,
      nsPipeChannelConstructor,
    },

    { NS_PIPEFILTERLISTENER_CLASSNAME,
      NS_PIPEFILTERLISTENER_CID,
      NS_PIPEFILTERLISTENER_CONTRACTID,
      nsPipeFilterListenerConstructor,
    },

    { NS_IPCSERVICE_CLASSNAME,
      NS_IPCSERVICE_CID,
      NS_IPCSERVICE_CONTRACTID,
      nsIPCServiceConstructor,
    },

    { NS_ENIGMSGCOMPOSE_CLASSNAME,
      NS_ENIGMSGCOMPOSE_CID,
      NS_ENIGMSGCOMPOSE_CONTRACTID,
      nsEnigMsgComposeConstructor,
    },

    { NS_ENIGMSGCOMPOSEFACTORY_CLASSNAME,
      NS_ENIGMSGCOMPOSEFACTORY_CID,
      NS_ENIGMSGCOMPOSEFACTORY_CONTRACTID,
      nsEnigMsgComposeFactoryConstructor,
    },

    { NS_ENIGMIMELISTENER_CLASSNAME,
      NS_ENIGMIMELISTENER_CID,
      NS_ENIGMIMELISTENER_CONTRACTID,
      nsEnigMimeListenerConstructor,
    },

    { NS_ENIGMIMEWRITER_CLASSNAME,
      NS_ENIGMIMEWRITER_CID,
      NS_ENIGMIMEWRITER_CONTRACTID,
      nsEnigMimeWriterConstructor,
    },

    { NS_ENIGMIMEDECRYPT_CLASSNAME,
      NS_ENIGMIMEDECRYPT_CID,
      NS_ENIGMIMEDECRYPT_CONTRACTID,
      nsEnigMimeDecryptConstructor,
    },

    { NS_ENIGMIMEVERIFY_CLASSNAME,
      NS_ENIGMIMEVERIFY_CID,
      NS_ENIGMIMEVERIFY_CONTRACTID,
      nsEnigMimeVerifyConstructor,
    },

    { NS_ENIGMIMESERVICE_CLASSNAME,
      NS_ENIGMIMESERVICE_CID,
      NS_ENIGMIMESERVICE_CONTRACTID,
      nsEnigMimeServiceConstructor,
    }
};

// Module entry point
NS_IMPL_NSGETMODULE(nsEnigModule, components)

#else
  // Gecko >= 2.0


NS_GENERIC_FACTORY_CONSTRUCTOR(nsEnigContentHandler)

NS_DEFINE_NAMED_CID(NS_PIPECONSOLE_CID);
NS_DEFINE_NAMED_CID(NS_PIPECHANNEL_CID);
NS_DEFINE_NAMED_CID(NS_PIPEFILTERLISTENER_CID);
NS_DEFINE_NAMED_CID(NS_IPCSERVICE_CID);

NS_DEFINE_NAMED_CID(NS_ENIGMSGCOMPOSE_CID);
NS_DEFINE_NAMED_CID(NS_ENIGMSGCOMPOSEFACTORY_CID);
NS_DEFINE_NAMED_CID(NS_ENIGMIMELISTENER_CID);
NS_DEFINE_NAMED_CID(NS_ENIGMIMEWRITER_CID);
NS_DEFINE_NAMED_CID(NS_ENIGMIMEDECRYPT_CID);
NS_DEFINE_NAMED_CID(NS_ENIGMIMEVERIFY_CID);
NS_DEFINE_NAMED_CID(NS_ENIGMIMESERVICE_CID);
NS_DEFINE_NAMED_CID(NS_ENIGCONTENTHANDLER_CID);

const mozilla::Module::CIDEntry kEnigModuleCIDs[] = {
  { &kNS_PIPECONSOLE_CID, false, NULL, nsPipeConsoleConstructor },
  { &kNS_PIPECHANNEL_CID, false, NULL, nsPipeChannelConstructor },
  { &kNS_PIPEFILTERLISTENER_CID, false, NULL, nsPipeFilterListenerConstructor },
  { &kNS_IPCSERVICE_CID, false, NULL, nsIPCServiceConstructor },
  { &kNS_ENIGMSGCOMPOSE_CID, false, NULL, nsEnigMsgComposeConstructor },
  { &kNS_ENIGMSGCOMPOSEFACTORY_CID, false, NULL, nsEnigMsgComposeFactoryConstructor },
  { &kNS_ENIGMSGCOMPOSE_CID, false, NULL, nsEnigMsgComposeFactoryConstructor },
  { &kNS_ENIGMIMELISTENER_CID, false, NULL, nsEnigMimeListenerConstructor },
  { &kNS_ENIGMIMEWRITER_CID, false, NULL, nsEnigMimeWriterConstructor },
  { &kNS_ENIGMIMEDECRYPT_CID, false, NULL, nsEnigMimeDecryptConstructor },
  { &kNS_ENIGMIMEVERIFY_CID, false, NULL, nsEnigMimeVerifyConstructor },
  { &kNS_ENIGMIMESERVICE_CID, false, NULL, nsEnigMimeServiceConstructor },
  { &kNS_ENIGCONTENTHANDLER_CID, false, NULL, nsEnigContentHandlerConstructor },
  { &kNS_ENIGCONTENTHANDLER_CID, false, NULL, nsEnigContentHandlerConstructor },
  { NULL }
};

const mozilla::Module::ContractIDEntry kEnigModuleContracts[] = {
  { NS_PIPETRANSPORT_CONTRACTID, &kNS_PIPETRANSPORT_CID },
  { NS_PIPECONSOLE_CONTRACTID, &kNS_PIPECONSOLE_CID },
  { NS_PIPECHANNEL_CONTRACTID, &kNS_PIPECHANNEL_CID },
  { NS_PIPEFILTERLISTENER_CONTRACTID, &kNS_PIPEFILTERLISTENER_CID },
  { NS_IPCSERVICE_CONTRACTID, &kNS_IPCSERVICE_CID },
  { NS_ENIGMSGCOMPOSE_CONTRACTID, &kNS_ENIGMSGCOMPOSE_CID },
  { NS_ENIGMSGCOMPOSEFACTORY_CONTRACTID, &kNS_ENIGMSGCOMPOSEFACTORY_CID },
  { "@mozilla.org/messengercompose/composesecure;1", &kNS_ENIGMSGCOMPOSE_CID },
  { NS_ENIGMIMELISTENER_CONTRACTID, &kNS_ENIGMIMELISTENER_CID },
  { NS_ENIGMIMEWRITER_CONTRACTID, &kNS_ENIGMIMEWRITER_CID },
  { NS_ENIGMIMEDECRYPT_CONTRACTID, &kNS_ENIGMIMEDECRYPT_CID },
  { NS_ENIGMIMEVERIFY_CONTRACTID, &kNS_ENIGMIMEVERIFY_CID },
  { NS_ENIGMIMESERVICE_CONTRACTID, &kNS_ENIGMIMESERVICE_CID },
  { NS_ENIGENCRYPTEDHANDLER_CONTRACTID, &kNS_ENIGCONTENTHANDLER_CID },
  { NS_ENIGDUMMYHANDLER_CONTRACTID, &kNS_ENIGCONTENTHANDLER_CID },
  { NULL }

};

static const mozilla::Module::CategoryEntry kEnigModuleCategories[] = {
  { NULL }
};

static const mozilla::Module kEnigModule = {
  mozilla::Module::kVersion,
  kEnigModuleCIDs,
  kEnigModuleContracts,
  kEnigModuleCategories
};

NSMODULE_DEFN(nsEnigModule) = &kEnigModule;
#endif