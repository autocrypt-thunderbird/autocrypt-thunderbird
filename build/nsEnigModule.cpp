/*
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
 * The Original Code is Enigmail.
 * 
 * The Initial Developer of the Original Code is Ramalingam Saravanan.
 * Portions created by Ramalingam Saravanan <svn@xmlterm.org> are
 * Copyright (C) 2002 Ramalingam Saravanan. All Rights Reserved.
 * 
 * Contributor(s):
 * 
 * Alternatively, the contents of this file may be used under the
 * terms of the GNU General Public License (the "GPL"), in which case
 * the provisions of the GPL are applicable instead of
 * those above. If you wish to allow use of your version of this
 * file only under the terms of the GPL and not to allow
 * others to use your version of this file under the MPL, indicate
 * your decision by deleting the provisions above and replace them
 * with the notice and other provisions required by the GPL.
 * If you do not delete the provisions above, a recipient
 * may use your version of this file under either the MPL or the
 * GPL.
 */

#include "nsIGenericFactory.h"

#include "nsEnigMsgCompose.h"

#include "nsEnigMsgCompFields.h"

#include "nsEnigMimeDecrypt.h"

#include "nsEnigMimeVerify.h"

#include "nsEnigMimeListener.h"

#include "nsEnigMimeWriter.h"

#include "nsEnigMimeService.h"

#include "nsEnigContentHandler.h"

NS_GENERIC_FACTORY_CONSTRUCTOR(nsEnigMsgCompose)

NS_GENERIC_FACTORY_CONSTRUCTOR(nsEnigMsgComposeFactory)

NS_GENERIC_FACTORY_CONSTRUCTOR(nsEnigMsgCompFields)

NS_GENERIC_FACTORY_CONSTRUCTOR(nsEnigMimeDecrypt)

NS_GENERIC_FACTORY_CONSTRUCTOR(nsEnigMimeVerify)

NS_GENERIC_FACTORY_CONSTRUCTOR(nsEnigMimeListener)

NS_GENERIC_FACTORY_CONSTRUCTOR(nsEnigMimeWriter)

NS_GENERIC_FACTORY_CONSTRUCTOR(nsEnigMimeService)

NS_GENERIC_FACTORY_CONSTRUCTOR(nsEnigContentHandler)

// CIDs implemented by module
static const nsModuleComponentInfo components[] =
{

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

    { NS_ENIGMSGCOMPFIELDS_CLASSNAME,
      NS_ENIGMSGCOMPFIELDS_CID,
      NS_ENIGMSGCOMPFIELDS_CONTRACTID,
      nsEnigMsgCompFieldsConstructor,
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
    },

    { NS_ENIGCONTENTHANDLER_CLASSNAME,
      NS_ENIGCONTENTHANDLER_CID,
      NS_ENIGDUMMYHANDLER_CONTRACTID,
      nsEnigContentHandlerConstructor,
    },
};

// Module entry point
NS_IMPL_NSGETMODULE("nsEnigModule", components)
