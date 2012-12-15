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

#include "nsEnigMsgCompose.h"
#include "mozilla/ModuleUtils.h"
#include "nsIMimeContentTypeHandler.h"

#if MOZILLA_MAJOR_VERSION < 19
NS_GENERIC_FACTORY_CONSTRUCTOR(nsEnigMsgCompose)
#endif

//NS_GENERIC_FACTORY_CONSTRUCTOR_INIT(nsEnigMimeService, Init)

#if MOZILLA_MAJOR_VERSION < 19
NS_DEFINE_NAMED_CID(NS_ENIGMSGCOMPOSE_CID);
#endif

const mozilla::Module::CIDEntry kEnigModuleCIDs[] = {
#if MOZILLA_MAJOR_VERSION < 19
   { &kNS_ENIGMSGCOMPOSE_CID, false, NULL, nsEnigMsgComposeConstructor },
#endif
  { NULL }
};

const mozilla::Module::ContractIDEntry kEnigModuleContracts[] = {
#if MOZILLA_MAJOR_VERSION < 19
  { "@mozilla.org/messengercompose/composesecure;1", &kNS_ENIGMSGCOMPOSE_CID },
#endif
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
