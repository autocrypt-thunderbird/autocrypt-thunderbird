/*global Components: false, EnigmailFuncs: false, EnigmailLog: false, EnigmailOS: false, EnigmailFiles: false, EnigmailApp: false */
/*jshint -W097 */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

"use strict";

var EXPORTED_SYMBOLS = ["EnigmailRules"];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import("resource://enigmail/funcs.jsm");
Cu.import("resource://enigmail/log.jsm");
Cu.import("resource://enigmail/os.jsm");
Cu.import("resource://enigmail/files.jsm");
Cu.import("resource://enigmail/app.jsm");
Cu.import("resource://enigmail/core.jsm"); /*global EnigmailCore: false */
Cu.import("resource://enigmail/constants.jsm"); /*global EnigmailConstants: false */
Cu.import("resource://enigmail/dialog.jsm"); /*global EnigmailDialog: false */

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

var EnigmailRules = {

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

  /**
   * Create new rule
   *
   * @param appendToEnd: Boolean - true:  append rule at the end of the rules list
   *                               false: insert rule at the start of the rules list
   * @param toAddress:   String  - Adress(es) to match. Multiple email addresses are separated by spaces.
   *            The matching is done on substrings, with curly brackets ({}) defining substring boundaries:
   *             "{" is equivalent to ^ in regexp
   *             "}" is equivalent to $ in regexp
   * @param keyList:     String  - space separated list of key IDs (starting with 0x)
   *                                If keyList === ".", use the email address
   * @param sign:        Number  - 0/1/2 as defined below
   * @param encrypt:     Number  - 0/1/2 as defined below
   * @param pgpMime:     Number  - 0/1/2 as defined below
   * @param flags:       Number  - 0: no flags / 1: negate rule
   *
   * sign/encrypt/pgpMime values:
   *  0: Disable the action (= "Never")
   *  1: Use the setting in Message Composition
   *  2: Enable the action (= "Always")
   */
  addRule: function(appendToEnd, toAddress, keyList, sign, encrypt, pgpMime, flags) {
    EnigmailLog.DEBUG("rules.jsm: addRule()\n");
    if (!rulesListHolder.rulesList) {
      var domParser = Cc[NS_DOMPARSER_CONTRACTID].createInstance(Ci.nsIDOMParser);
      rulesListHolder.rulesList = domParser.parseFromString("<pgpRuleList/>", "text/xml");
    }
    var negate = (flags & 1);
    var rule = rulesListHolder.rulesList.createElement("pgpRule");
    rule.setAttribute("email", toAddress.toLowerCase());
    rule.setAttribute("keyId", keyList);
    rule.setAttribute("sign", sign);
    rule.setAttribute("encrypt", encrypt);
    rule.setAttribute("pgpMime", pgpMime);
    rule.setAttribute("negateRule", flags);
    var origFirstChild = rulesListHolder.rulesList.firstChild.firstChild;

    if (origFirstChild && (!appendToEnd)) {
      rulesListHolder.rulesList.firstChild.insertBefore(rule, origFirstChild);
      rulesListHolder.rulesList.firstChild.insertBefore(rulesListHolder.rulesList.createTextNode(EnigmailOS.isDosLike ? "\r\n" : "\n"), origFirstChild);
    }
    else {
      rulesListHolder.rulesList.firstChild.appendChild(rule);
      rulesListHolder.rulesList.firstChild.appendChild(rulesListHolder.rulesList.createTextNode(EnigmailOS.isDosLike ? "\r\n" : "\n"));
    }
  },

  /**
   * ...
   * @return: Number: 0 - no update / 1 - rule updated / 2 - new rule created
   */
  insertOrUpdateRule: function(ruleObj) {
    if ((!("email" in ruleObj)) || ruleObj.email.length === 0) return 0;

    ruleObj.email = ruleObj.email.toLowerCase();

    let rulesListObj = {};
    this.getRulesData(rulesListObj);
    let rulesList = rulesListObj.value;

    if (rulesList) {
      for (let node = rulesList.firstChild.firstChild; node; node = node.nextSibling) {
        if (node.tagName == "pgpRule") {
          try {
            let email = node.getAttribute("email");
            if (!email) {
              continue;
            }
            if (email.toLowerCase() === ruleObj.email) {
              node.setAttribute("keyId", ruleObj.keyList);
              node.setAttribute("sign", ruleObj.sign);
              node.setAttribute("encrypt", ruleObj.encrypt);
              node.setAttribute("pgpMime", ruleObj.pgpMime);
              node.setAttribute("negateRule", ruleObj.flags);
              this.saveRulesFile();

              return 1;
            }
          }
          catch (ex) {
            EnigmailLog.DEBUG("rules.jsm: mapAddrsToKeys(): ignore exception: " + ex.description + "\n");
          }
        }
      }
    }

    // no rule matched, let's add the rule at the start of the list
    this.addRule(false, ruleObj.email, ruleObj.keyList, ruleObj.sign, ruleObj.encrypt, ruleObj.pgpMime, ruleObj.flags);
    this.saveRulesFile();

    return 2;
  },

  clearRules: function() {
    rulesListHolder.rulesList = null;
  },

  DEBUG_EmailList: function(name, list) {
    EnigmailLog.DEBUG("           " + name + ":\n");
    for (let i = 0; i < list.length; i++) {
      let elem = list[i];
      let str = "            [" + i + "]: ";
      if (elem.orig) {
        str += "orig: '" + elem.orig + "'  ";
      }
      if (elem.addr) {
        str += "addr: '" + elem.addr + "'  ";
      }
      if (elem.keys) {
        str += "keys: '" + elem.keys + "'  ";
      }
      EnigmailLog.DEBUG(str + "\n");
    }
  },

  /**
   * process resulting sign/encryp/pgpMime mode for passed string of email addresses and
   * use rules and interactive rule dialog to replace emailAddrsStr by known keys
   * Input parameters:
   *  @emailAddrsStr:             comma and space separated string of addresses to process
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
  mapAddrsToKeys: function(emailAddrsStr, startDialogForMissingKeys, window,
    matchedKeysObj, flagsObj) {
    EnigmailLog.DEBUG("rules.jsm: mapAddrsToKeys(): emailAddrsStr=\"" + emailAddrsStr + "\" startDialogForMissingKeys=" + startDialogForMissingKeys + "\n");

    let enigmailSvc = EnigmailCore.getService();
    if (!enigmailSvc) {
      EnigmailLog.DEBUG("EnigmailCore Service is down\n");
      return false;
    }

    // initialize return value and the helper variables for them:
    matchedKeysObj.value = "";
    flagsObj.value = false;
    let flags = {}; // object to be able to modify flags in subfunction
    flags.sign = EnigmailConstants.ENIG_UNDEF; // default sign flag is: maybe
    flags.encrypt = EnigmailConstants.ENIG_UNDEF; // default encrypt flag is: maybe
    flags.pgpMime = EnigmailConstants.ENIG_UNDEF; // default pgpMime flag is: maybe

    // create openList: list of addresses not processed by rules yet
    // - each entry has
    //   - orig:  the original full email address
    //   - addr:  the lowercased pure email address to check against rules and keys
    // - elements will be moved
    //   - to addrKeysList  if a matching rule with keys was found
    //   - to addrNoKeyList if a rule with "do not process further rules" ("." as key) applies
    let emailAddrList = ("," + emailAddrsStr + ",").split(/\s*,\s*/);
    // TODO: we split with , and spaces around
    //       BUT what if , is in "..." part of an email?
    //       => use lists!!!
    let openList = [];
    for (let i = 0; i < emailAddrList.length; ++i) {
      let orig = emailAddrList[i];
      if (orig) {
        let addr = EnigmailFuncs.stripEmail(orig.toLowerCase());
        if (addr) {
          let elem = {
            orig: orig,
            addr: addr
          };
          openList.push(elem);
        }
      }
    }
    //this.DEBUG_EmailList("openList", openList);
    let addrKeysList = []; // NEW: list of found email addresses and their associated keys
    let addrNoKeyList = []; // NEW: list of email addresses that have no key according to rules

    // process recipient rules
    let rulesListObj = {};
    if (this.getRulesData(rulesListObj)) {

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
            let rule = {};
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
              rule.sign = node.getAttribute("sign");
              rule.encrypt = node.getAttribute("encrypt");
              rule.pgpMime = node.getAttribute("pgpMime");
              this.mapRuleToKeys(rule,
                openList, flags, addrKeysList, addrNoKeyList);
            }
            // no negate rule handling (turned off in dialog)
          }
          catch (ex) {
            EnigmailLog.DEBUG("rules.jsm: mapAddrsToKeys(): ignore exception: " + ex.description + "\n");
          }
        }
      }
    }

    // NOTE: here we have
    // - openList: the addresses not having any key assigned yet
    //             (and not marked as don't process any other rule)
    // - addresses with "don't process other rules" are in addrNoKeyList
    //this.DEBUG_EmailList("openList", openList);
    //this.DEBUG_EmailList("addrKeysList", addrKeysList);
    //this.DEBUG_EmailList("addrnoKeyList", addrnoKeyList);

    // if requested: start dialog to add new rule for each missing key
    if (startDialogForMissingKeys) {
      let inputObj = {};
      let resultObj = {};
      for (let i = 0; i < openList.length; i++) {
        let theAddr = openList[i].addr;
        // start dialog only if the email address contains a @ or no 0x at the beginning:
        // - reason: newsgroups have neither @ nor 0x
        if (theAddr.indexOf("@") != -1 || theAddr.indexOf("0x") !== 0) {
          inputObj.toAddress = "{" + theAddr + "}";
          inputObj.options = "";
          inputObj.command = "add";
          window.openDialog("chrome://enigmail/content/enigmailSingleRcptSettings.xul", "",
            "dialog,modal,centerscreen,resizable", inputObj, resultObj);
          if (resultObj.cancelled === true) {
            return false;
          }

          if (!resultObj.negate) {
            this.mapRuleToKeys(resultObj,
              openList, flags, addrKeysList, addrNoKeyList);
          }
          // no negate rule handling (turned off in dialog)
        }
      }
    }

    // return value of OLD interface:
    // IFF we found keys, return keys AND unprocessed addresses in matchedKeysObj.value as comma-separated string
    if (addrKeysList.length > 0) {
      let tmpList = addrKeysList.concat(addrNoKeyList).concat(openList);
      matchedKeysObj.value = tmpList[0].keys;
      for (let idx = 1; idx < tmpList.length; ++idx) {
        if (tmpList[idx].keys) {
          matchedKeysObj.value += ", " + tmpList[idx].keys;
        }
        else {
          matchedKeysObj.value += ", " + tmpList[idx].addr;
        }
      }
      // sort key list and make it unique?
    }

    // return value of NEW interface:
    // return
    // - in matchedKeysObj.addrKeysList:  found email/keys mappings (array of objects with addr and keys)
    // - in matchedKeysObj.addrNoKeyList: list of unprocessed emails
    matchedKeysObj.addrKeysList = addrKeysList;
    if (openList.length > 0) {
      matchedKeysObj.addrNoKeyList = addrNoKeyList.concat(openList);
    }
    else {
      matchedKeysObj.addrNoKeyList = addrNoKeyList;
    }

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
    for (let i = 0; i < matchedKeysObj.addrNoKeyList.length; i++) {
      EnigmailLog.DEBUG("     " + matchedKeysObj.addrNoKeyList[i].addr + "\n");
    }
    EnigmailLog.DEBUG("   old returned value:\n");
    EnigmailLog.DEBUG("     " + matchedKeysObj.value + "\n");

    return true;
  },

  mapRuleToKeys: function(rule, openList, flags, addrKeysList, addrNoKeyList) {
    //EnigmailLog.DEBUG("rules.jsm: mapRuleToKeys() rule.email='" + rule.email + "'\n");
    let ruleList = rule.email.toLowerCase().split(/[ ,;]+/);
    for (let ruleIndex = 0; ruleIndex < ruleList.length; ++ruleIndex) {
      let ruleEmailElem = ruleList[ruleIndex]; // ruleEmailElem has format such as '{name@qqq.de}' or '@qqq' or '{name' or '@qqq.de}'
      //EnigmailLog.DEBUG("   process ruleElem: '" + ruleEmailElem + "'\n");
      for (let openIndex = 0; openIndex < openList.length; ++openIndex) {
        let addr = openList[openIndex].addr;
        // search with { and } around because these are used a begin and end markers in the rules:
        let idx = ('{' + addr + '}').indexOf(ruleEmailElem);
        if (idx >= 0) {
          if (ruleEmailElem == rule.email) {
            EnigmailLog.DEBUG("rules.jsm: mapRuleToKeys(): for '" + addr + "' ('" + openList[openIndex].orig +
              "') found matching rule element '" + ruleEmailElem + "'\n");
          }
          else {
            EnigmailLog.DEBUG("rules.jsm: mapRuleToKeys(): for '" + addr + "' ('" + openList[openIndex].orig +
              "') found matching rule element '" + ruleEmailElem + "' from '" + rule.email + "'\n");
          }

          // process rule:
          // NOTE: rule.keyId might be:
          // - keys:  => assign keys to all matching emails
          //             and mark matching address as no longer open
          // - ".":   signals "Do not check further rules for the matching address"
          //          => mark all matching address as no longer open, but assign no keys
          //             (thus, add it to the addrNoKeyList)
          // - empty: Either if "Continue with next rule for the matching address"
          //          OR: if "Use the following OpenPGP keys:" with no keys and
          //              warning (will turn off encryption) acknowledged
          //          => then we only process the flags

          // process sign/encrypt/ppgMime settings
          flags.sign = this.combineFlagValues(flags.sign, Number(rule.sign));
          flags.encrypt = this.combineFlagValues(flags.encrypt, Number(rule.encrypt));
          flags.pgpMime = this.combineFlagValues(flags.pgpMime, Number(rule.pgpMime));

          if (rule.keyId) {
            // move found address from openAdresses to corresponding list (with keys added)
            let elem = openList.splice(openIndex, 1)[0];
            --openIndex; // IMPORTANT because we remove element in the array we iterate on
            if (rule.keyId != ".") {
              // keys exist: assign keys as comma-separated string
              let ids = rule.keyId.replace(/[ ,;]+/g, ", ");
              elem.keys = ids;
              addrKeysList.push(elem);
            }
            else {
              // '.': no further rule processing and no key: addr was (finally) processed but without any key
              addrNoKeyList.push(elem);
            }
          }
        }
      }
    }
  },

  /**
   *  check for the attribute of type "sign"/"encrypt"/"pgpMime" of the passed node
   *  and combine its value with oldVal and check for conflicts
   *    values might be: 0='never', 1='maybe', 2='always', 3='conflict'
   *  @oldVal:      original input value
   *  @newVal:      new value to combine with
   *  @return: result value after applying the rule (0/1/2)
   *           and combining it with oldVal
   */
  combineFlagValues: function(oldVal, newVal) {
    //EnigmailLog.DEBUG("rules.jsm:    combineFlagValues(): oldVal=" + oldVal + " newVal=" + newVal + "\n");

    // conflict remains conflict
    if (oldVal === EnigmailConstants.ENIG_CONFLICT) {
      return EnigmailConstants.ENIG_CONFLICT;
    }

    // 'never' and 'always' triggers conflict:
    if ((oldVal === EnigmailConstants.ENIG_NEVER && newVal === EnigmailConstants.ENIG_ALWAYS) || (oldVal === EnigmailConstants.ENIG_ALWAYS && newVal === EnigmailConstants.ENIG_NEVER)) {
      return EnigmailConstants.ENIG_CONFLICT;
    }

    // if there is any 'never' return 'never'
    // - thus: 'never' and 'maybe' => 'never'
    if (oldVal === EnigmailConstants.ENIG_NEVER || newVal === EnigmailConstants.ENIG_NEVER) {
      return EnigmailConstants.ENIG_NEVER;
    }

    // if there is any 'always' return 'always'
    // - thus: 'always' and 'maybe' => 'always'
    if (oldVal === EnigmailConstants.ENIG_ALWAYS || newVal === EnigmailConstants.ENIG_ALWAYS) {
      return EnigmailConstants.ENIG_ALWAYS;
    }

    // here, both values are 'maybe', which we return then
    return EnigmailConstants.ENIG_UNDEF; // maybe
  }


};
