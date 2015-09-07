/*global Components: false, EnigmailFuncs: false, EnigmailLog: false, EnigmailOS: false, EnigmailFiles: false, EnigmailApp: false */
/*jshint -W097 */
/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
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
 * The Initial Developer of the Original Code is Patrick Brunschwig.
 * Portions created by Patrick Brunschwig <patrick@enigmail.net> are
 * Copyright (C) 2010 Patrick Brunschwig. All Rights Reserved.
 *
 * Contributor(s):
 *  Patrick Brunschwig <patrick@enigmail.net>
 *  Janosch Rux <rux@informatik.uni-luebeck.de>
 *  Fan Jiang <fanjiang@thoughtworks.com>
 *  Iván Pazmiño <iapazmino@thoughtworks.com>
 *  Ola Bini <obini@thoughtworks.com>
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
 * ***** END LICENSE BLOCK ***** */

"use strict";

Components.utils.import("resource://enigmail/funcs.jsm");
Components.utils.import("resource://enigmail/log.jsm");
Components.utils.import("resource://enigmail/os.jsm");
Components.utils.import("resource://enigmail/files.jsm");
Components.utils.import("resource://enigmail/app.jsm");
Components.utils.import("resource://enigmail/core.jsm"); /*global EnigmailCore: false */
Components.utils.import("resource://enigmail/constants.jsm"); /*global EnigmailConstants: false */

var EXPORTED_SYMBOLS = ["EnigmailRules"];

const Cc = Components.classes;
const Ci = Components.interfaces;

const NS_RDONLY = 0x01;
const NS_WRONLY = 0x02;
const NS_CREATE_FILE = 0x08;
const NS_TRUNCATE = 0x20;
const DEFAULT_FILE_PERMS = 0x180; // equals 0600

const NS_DOMPARSER_CONTRACTID = "@mozilla.org/xmlextras/domparser;1";
const NS_DOMSERIALIZER_CONTRACTID = "@mozilla.org/xmlextras/xmlserializer;1";

const rulesListHolder = {
  rulesList: null
};

const EnigmailRules = {

  getRulesFile: function() {
    EnigmailLog.DEBUG("rules.jsm: getRulesFile()\n");
    var rulesFile = EnigmailApp.getProfileDirectory();
    rulesFile.append("pgprules.xml");
    return rulesFile;
  },

  loadRulesFile: function() {
    var flags = NS_RDONLY;
    var rulesFile = this.getRulesFile();
    if (rulesFile.exists()) {
      var fileContents = EnigmailFiles.readFile(rulesFile);

      return this.loadRulesFromString(fileContents);
    }

    return false;
  },

  loadRulesFromString: function(contents) {
    EnigmailLog.DEBUG("rules.jsm: loadRulesFromString()\n");
    if (contents.length === 0 || contents.search(/^\s*$/) === 0) {
      return false;
    }

    var domParser = Cc[NS_DOMPARSER_CONTRACTID].createInstance(Ci.nsIDOMParser);
    rulesListHolder.rulesList = domParser.parseFromString(contents, "text/xml");

    return true;
  },

  saveRulesFile: function() {
    EnigmailLog.DEBUG("rules.jsm: saveRulesFile()\n");

    var flags = NS_WRONLY | NS_CREATE_FILE | NS_TRUNCATE;
    var domSerializer = Cc[NS_DOMSERIALIZER_CONTRACTID].createInstance(Ci.nsIDOMSerializer);
    var rulesFile = this.getRulesFile();
    if (rulesFile) {
      if (rulesListHolder.rulesList) {
        // the rule list is not empty -> write into file
        return EnigmailFiles.writeFileContents(rulesFile.path,
          domSerializer.serializeToString(rulesListHolder.rulesList.firstChild),
          DEFAULT_FILE_PERMS);
      }
      else {
        // empty rule list -> delete rules file
        try {
          rulesFile.remove(false);
        }
        catch (ex) {}
        return true;
      }
    }
    else {
      return false;
    }
  },

  getRulesData: function(rulesListObj) {
    EnigmailLog.DEBUG("rules.jsm: getRulesData()\n");

    var ret = true;

    if (!rulesListHolder.rulesList) {
      ret = this.loadRulesFile();
    }

    if (rulesListHolder.rulesList) {
      rulesListObj.value = rulesListHolder.rulesList;
      return ret;
    }

    rulesListObj.value = null;
    return false;
  },

  addRule: function(appendToEnd, toAddress, keyList, sign, encrypt, pgpMime, flags) {
    EnigmailLog.DEBUG("rules.jsm: addRule()\n");
    if (!rulesListHolder.rulesList) {
      var domParser = Cc[NS_DOMPARSER_CONTRACTID].createInstance(Ci.nsIDOMParser);
      rulesListHolder.rulesList = domParser.parseFromString("<pgpRuleList/>", "text/xml");
    }
    var negate = (flags & 1);
    var rule = rulesListHolder.rulesList.createElement("pgpRule");
    rule.setAttribute("email", toAddress);
    rule.setAttribute("keyId", keyList);
    rule.setAttribute("sign", sign);
    rule.setAttribute("encrypt", encrypt);
    rule.setAttribute("pgpMime", pgpMime);
    rule.setAttribute("negateRule", flags);
    var origFirstChild = rulesListHolder.rulesList.firstChild.firstChild;

    if (origFirstChild && (!appendToEnd)) {
      rulesListHolder.rulesList.firstChild.insertBefore(rule, origFirstChild);
      rulesListHolder.rulesList.firstChild.insertBefore(rulesListHolder.rulesList.createTextNode(EnigmailOS.isDosLike() ? "\r\n" : "\n"), origFirstChild);
    }
    else {
      rulesListHolder.rulesList.firstChild.appendChild(rule);
      rulesListHolder.rulesList.firstChild.appendChild(rulesListHolder.rulesList.createTextNode(EnigmailOS.isDosLike() ? "\r\n" : "\n"));
    }
  },

  clearRules: function() {
    rulesListHolder.rulesList = null;
  },

  registerOn: function(target) {
    target.getRulesFile = EnigmailRules.getRulesFile;
    target.loadRulesFile = EnigmailRules.loadRulesFile;
    target.loadRulesFromString = EnigmailRules.loadRulesFromString;
    target.saveRulesFile = EnigmailRules.saveRulesFile;
    target.getRulesData = EnigmailRules.getRulesData;
    target.addRule = EnigmailRules.addRule;
  },

  /**
   * process resulting sign/encryp/pgpMime mode for passed string of email addresses and
   * use rules and interactive rule dialog to replace emailAddrs by known keys
   * Input parameters:
   *  @emailAddrs:                comma and space separated string of addresses to process
   *  @startDialogForMissingKeys: true: start dialog for emails without key(s)
   * Output parameters:
   *  @matchedKeysObj.value:   comma separated string of matched keys AND email addresses for which no key was found (or "")
   *  @matchedKeysObj.addrKeysList: all email/keys mappings (array of objects with addr as string and keys as comma separated string)
   *                                (does NOT contain emails for which no key was found)
   *  @matchedKeysObj.addrNoKeyList: list of emails that don't have a key according to rules
   *  @flagsObj:       return value for combined sign/encrype/pgpMime mode
   *                   values might be: 0='never', 1='maybe', 2='always', 3='conflict'
   *
   * @return:  false if error occurred or processing was canceled
   */
  mapAddrsToKeys: function(emailAddrs, startDialogForMissingKeys, window,
                           matchedKeysObj, flagsObj) {
    EnigmailLog.DEBUG("rules.jsm: mapAddrsToKeys(): emailAddrs=\"" + emailAddrs + "\" startDialogForMissingKeys=" + startDialogForMissingKeys + "\n");

    const nsIEnigmail = Components.interfaces.nsIEnigmail;

    let enigmailSvc = EnigmailCore.getService();
    if (!enigmailSvc) {
      return false;
    }

    // initialize return value and the helper variables for them:
    matchedKeysObj.value = "";
    flagsObj.value = false;
    let flags = {};  // object to be able to modify flags in subfunction
    flags.sign = EnigmailConstants.ENIG_UNDEF; // default sign flag is: maybe
    flags.encrypt = EnigmailConstants.ENIG_UNDEF; // default encrypt flag is: maybe
    flags.pgpMime = EnigmailConstants.ENIG_UNDEF; // default pgpMime flag is: maybe

    // list of addresses not processed
    // - create string of open addresses in rule processing
    //   - where associated keys are still missing AND
    //   - no rule "do not process further rules applies
    //   with { and } around each email to enable pattern matching with rules
    //   (e.g. "{a@qqq.de}" will match "@qqq.de}", which stands for emails ending with "qqq.de")
    let addresses = {};  // object to be able to modify flags in subfunction
    addresses.openInRules = "{" + EnigmailFuncs.stripEmail(emailAddrs.toLowerCase()).replace(/[, ]+/g, "},{") + "}";
    addresses.nokeyInRules = "";
    let keyList = [];        // list of keys found for all Addresses
    let addrKeysList = [];   // NEW: list of found email addresses and their associated keys
    let addrNoKeyList = [];  // NEW: list of email addresses that have no key according to rules

    // process recipient rules
    let rulesListObj = {};
    if (enigmailSvc.getRulesData(rulesListObj)) {

      let rulesList = rulesListObj.value;
      if (rulesList.firstChild.nodeName == "parsererror") {
        EnigmailDialog.alert(window, "Invalid pgprules.xml file:\n" + rulesList.firstChild.textContent);
        return false;
      }
      EnigmailLog.DEBUG("rules.jsm: mapAddrsToKeys(): rules successfully loaded; now process them\n");

      // go through all rules to find match with email addresses
      // - note: only if the key field has a value, an address is done with processing
      for (let node = rulesList.firstChild.firstChild; node; node = node.nextSibling) {
        if (node.tagName == "pgpRule") {
          try {
            let rule = {}
            rule.email = node.getAttribute("email");
            if (!rule.email) {
              continue;
            }
            rule.negate = false;
            if (node.getAttribute("negateRule")) {
              rule.negate = Number(node.getAttribute("negateRule"));
            }
            if (!rule.negate) {
              rule.keyId = node.getAttribute("keyId");
              rule.sign    = node.getAttribute("sign");
              rule.encrypt = node.getAttribute("encrypt");
              rule.pgpMime = node.getAttribute("pgpMime");
              this.mapRuleToKeys(rule,
                                 addresses, flags, keyList, addrKeysList, addrNoKeyList);
            }
            // no negate rule handling (turned off in dialog)
          }
          catch (ex) {
            EnigmailLog.DEBUG("rules.jsm: mapAddrsToKeys(): ignore exception: " + ex.description + "\n");
          }
        }
      }
    }
    addresses.openInRules = addresses.openInRules.replace(/ /g, "").replace(/[,][,]+/g, ",");
    EnigmailLog.DEBUG("   addresses.openInRules: '" + addresses.openInRules + "'\n");

    // NOTE: here we have
    // - addresses.openInRules: the addresses not having any key assigned yet
    //                          (and not marked as don't process any other rule)
    // - addresses with "don't process other rules" are in addrKeyList
    //   as addr without any key

    // if requested: start dialog to add new rule for each missing key
    if (startDialogForMissingKeys) {
      let addrList = addresses.openInRules.split(/,/);
      let inputObj = {};
      let resultObj = {};
      for (let i = 0; i < addrList.length; i++) {
        let theAddr = EnigmailFuncs.stripEmail(addrList[i]).toLowerCase().replace(/[{}]/g, "");
        if (theAddr.length > 0) {
          // if the email address contains a @ or no 0x at the beginning:
          // - reason: newsgroups have neither @ nor 0x
          if (theAddr.indexOf("@") != -1 || theAddr.indexOf("0x") != 0) {
            inputObj.toAddress = "{" + theAddr + "}";
            inputObj.options = "";
            inputObj.command = "add";
            window.openDialog("chrome://enigmail/content/enigmailSingleRcptSettings.xul", "",
                              "dialog,modal,centerscreen,resizable", inputObj, resultObj);
            if (resultObj.cancelled === true) {
              return false;
            }

            if (!resultObj.negate) {
              // note: keyId can be:
              // - empty: "check further rules" (but there will be not further rule that applies
              //                                 otherweis we wouldn't have started this dialog)
              // - ".": do NOT check further rules
              // - list of keys
              this.mapRuleToKeys(resultObj,
                                 addresses, flags, keyList, addrKeysList, addrNoKeyList);
            }
            // no negate rule handling (turned off in dialog)
          }
        }
      }
    }

    // NOTE: still we might have addrs without any key both in
    // - addresses.openInRules
    // - addresses.nokeyInRules
    // combine these lists to comma separated string:
    addresses.openInRules = addresses.openInRules.replace(/,/g, "");
    let openAddresses = addresses.nokeyInRules + addresses.openInRules;
    openAddresses = openAddresses.replace(/\}\{/g, ", ").replace(/\{/g, "").replace(/\}/g, "");

    // OLD: if we found key, return keys AND unprocessed addresses in matchedKeysObj.value
    if (keyList.length > 0) {
      // sort key list and make it unique?
      matchedKeysObj.value = keyList.join(", ");
      if (addresses.openInRules.length > 0) {
        matchedKeysObj.value += ", " + openAddresses
      }
    }
    // NEW: return
    // - in matchedKeysObj.addrKeysList:  found email/keys mappings (array of objects with addr and keys)
    // - in matchedKeysObj.addrNoKeyList: list of unprocessed emails
    matchedKeysObj.addrKeysList = addrKeysList;
    matchedKeysObj.addrNoKeyList = addrNoKeyList;

    // return result from combining flags
    flagsObj.sign = flags.sign;
    flagsObj.encrypt = flags.encrypt;
    flagsObj.pgpMime = flags.pgpMime;
    flagsObj.value = true;

    EnigmailLog.DEBUG("   found keys:\n");
    for (let i = 0; i < matchedKeysObj.addrKeysList.length; i++) {
      EnigmailLog.DEBUG("     " + matchedKeysObj.addrKeysList[i].addr + ": " + matchedKeysObj.addrKeysList[i].keys + "\n");
    }
    EnigmailLog.DEBUG("   addresses without keys:\n");
    EnigmailLog.DEBUG("     " + matchedKeysObj.addrNoKeyList.join(", ") + "\n");
    EnigmailLog.DEBUG("   old returned value:\n");
    EnigmailLog.DEBUG("     " + matchedKeysObj.value + "\n");

    return true;
  },

  mapRuleToKeys: function(rule,
                          addresses, flags, keyList, addrKeysList, addrNoKeyList) {
    EnigmailLog.DEBUG("rules.jsm: mapRuleToKeys() rule.email='" + rule.email + "'\n");
    // process rule
    let addrList = rule.email.toLowerCase().split(/[ ,;]+/);
    for (let addrIndex = 0; addrIndex < addrList.length; addrIndex++) {
      let email = addrList[addrIndex];  // email has format such as '{name@qqq.de}' or '@qqq' or '{name' or '@qqq.de}'
      let idx = addresses.openInRules.indexOf(email);
      if (idx >= 0) {
        EnigmailLog.DEBUG("rules.jsm: mapRuleToKeys(): got matching rule for \"" + email + "\"\n");

        // process sign/encrypt/ppgMime settings
        flags.sign    = this.combineFlagValues(flags.sign,    Number(rule.sign));
        flags.encrypt = this.combineFlagValues(flags.encrypt, Number(rule.encrypt));
        flags.pgpMime = this.combineFlagValues(flags.pgpMime, Number(rule.pgpMime));

        // process keys:
        // NOTE: rule.keyId might be:
        // - empty: Either if "Continue with next rule for the matching address"
        //          OR: if "Use the following OpenPGP keys:" with no keys and
        //              warning (will turn off encryption) acknowledged
        //          => then we only process the flags
        // - ".":   If "Do not check further rules for the matching address"
        //          => mark all matching addresses as no longer open, but assign no keys
        // - keys:  => assign keys to all matching emails
        if (rule.keyId) {
          while (idx >= 0) {
            // - extract matching address and its indexes (where { starts and after } ends)
            let start = addresses.openInRules.substring(0, idx + email.length).lastIndexOf("{");
            let end   = start + addresses.openInRules.substring(start).indexOf("}") + 1;
            let foundAddr = addresses.openInRules.substring(start+1,end-1);  // without { and }
            // - assign key if one exists (not ".")
            if (rule.keyId != ".") {  // if NOT "do not check further rules for this address"
              let ids = rule.keyId.replace(/[ ,;]+/g, ", ");
              keyList.push(ids);
              let elem = { addr:foundAddr, keys:ids };
              addrKeysList.push(elem);
            }
            else {
              // no further rule processing and now key: addr was (finally) processed but without any key
              addresses.nokeyInRules = "{" + foundAddr + "}";
              addrNoKeyList.push(foundAddr);
            }
            // - remove found address from openAdresses and add it to found addresses (with { and } as delimiters)
            addresses.openInRules = addresses.openInRules.substring(0, start) + addresses.openInRules.substring(end);
            // - check whether we have any other matching address for the same rule
            idx = addresses.openInRules.indexOf(email,start);
          }
        }
      }
    }
  },

};

