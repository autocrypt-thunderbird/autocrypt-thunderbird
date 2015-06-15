/*global Components: false, EnigmailFuncs: false, Log: false, OS: false, Files: false, App: false */
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

Components.utils.import("resource://enigmail/enigmailFuncs.jsm");
Components.utils.import("resource://enigmail/log.jsm");
Components.utils.import("resource://enigmail/os.jsm");
Components.utils.import("resource://enigmail/files.jsm");
Components.utils.import("resource://enigmail/app.jsm");

var EXPORTED_SYMBOLS = [ "Rules" ];

const Cc = Components.classes;
const Ci = Components.interfaces;

const NS_RDONLY      = 0x01;
const NS_WRONLY      = 0x02;
const NS_CREATE_FILE = 0x08;
const NS_TRUNCATE    = 0x20;
const DEFAULT_FILE_PERMS = 0x180; // equals 0600

const NS_DOMPARSER_CONTRACTID = "@mozilla.org/xmlextras/domparser;1";
const NS_DOMSERIALIZER_CONTRACTID = "@mozilla.org/xmlextras/xmlserializer;1";

const rulesListHolder = {
    rulesList: null
};

const Rules = {
    getRulesFile: function() {
        Log.DEBUG("enigmail.js: getRulesFile\n");
        var rulesFile = App.getProfileDirectory();
        rulesFile.append("pgprules.xml");
        return rulesFile;
    },

    loadRulesFile: function() {
        Log.DEBUG("enigmail.js: loadRulesFile\n");
        var flags = NS_RDONLY;
        var rulesFile = this.getRulesFile();
        if (rulesFile.exists()) {
            var fileContents = Files.readFile(rulesFile);

            if (fileContents.length===0 || fileContents.search(/^\s*$/)===0) {
                return false;
            }

            var domParser=Cc[NS_DOMPARSER_CONTRACTID].createInstance(Ci.nsIDOMParser);
            rulesListHolder.rulesList = domParser.parseFromString(fileContents, "text/xml");

            return true;
        }
        return false;
    },

    saveRulesFile: function() {
        Log.DEBUG("enigmail.js: saveRulesFile\n");

        var flags = NS_WRONLY | NS_CREATE_FILE | NS_TRUNCATE;
        var domSerializer=Cc[NS_DOMSERIALIZER_CONTRACTID].createInstance(Ci.nsIDOMSerializer);
        var rulesFile = this.getRulesFile();
        if (rulesFile) {
            if (rulesListHolder.rulesList) {
                // the rule list is not empty -> write into file
                return Files.writeFileContents(rulesFile.path,
                                               domSerializer.serializeToString(rulesListHolder.rulesList.firstChild),
                                               DEFAULT_FILE_PERMS);
            } else {
                // empty rule list -> delete rules file
                try {
                    rulesFile.remove(false);
                }
                catch (ex) {}
                return true;
            }
        } else {
            return false;
        }
    },

    getRulesData: function(rulesListObj) {
        Log.DEBUG("enigmail.js: getRulesData\n");

        var ret=true;

        if (! rulesListHolder.rulesList) {
            ret=this.loadRulesFile();
        }

        if (rulesListHolder.rulesList) {
            rulesListObj.value = rulesListHolder.rulesList;
            return ret;
        }

        rulesListObj.value = null;
        return false;
    },

    addRule: function(appendToEnd, toAddress, keyList, sign, encrypt, pgpMime, flags) {
        Log.DEBUG("enigmail.js: addRule\n");
        if (! rulesListHolder.rulesList) {
            var domParser=Cc[NS_DOMPARSER_CONTRACTID].createInstance(Ci.nsIDOMParser);
            rulesListHolder.rulesList = domParser.parseFromString("<pgpRuleList/>", "text/xml");
        }
        var negate = (flags & 1);
        var rule=rulesListHolder.rulesList.createElement("pgpRule");
        rule.setAttribute("email", toAddress);
        rule.setAttribute("keyId", keyList);
        rule.setAttribute("sign", sign);
        rule.setAttribute("encrypt", encrypt);
        rule.setAttribute("pgpMime", pgpMime);
        rule.setAttribute("negateRule", flags);
        var origFirstChild = rulesListHolder.rulesList.firstChild.firstChild;

        if (origFirstChild && (! appendToEnd)) {
            rulesListHolder.rulesList.firstChild.insertBefore(rule, origFirstChild);
            rulesListHolder.rulesList.firstChild.insertBefore(rulesListHolder.rulesList.createTextNode(OS.isDosLike() ? "\r\n" : "\n"), origFirstChild);
        }
        else {
            rulesListHolder.rulesList.firstChild.appendChild(rule);
            rulesListHolder.rulesList.firstChild.appendChild(rulesListHolder.rulesList.createTextNode(OS.isDosLike() ? "\r\n" : "\n"));
        }
    },

    clearRules: function () {
        rulesListHolder.rulesList = null;
    },

    registerOn: function(target) {
        target.getRulesFile = Rules.getRulesFile;
        target.loadRulesFile = Rules.loadRulesFile;
        target.saveRulesFile = Rules.saveRulesFile;
        target.getRulesData = Rules.getRulesData;
        target.addRule = Rules.addRule;
        target.clearRules = Rules.clearRules;
    }
};
