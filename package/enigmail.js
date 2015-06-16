/*global Components: false, dump: false */
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
 * The Initial Developer of the Original Code is Ramalingam Saravanan.
 * Portions created by Ramalingam Saravanan <svn@xmlterm.org> are
 * Copyright (C) 2001 Ramalingam Saravanan. All Rights Reserved.
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

const Cu = Components.utils;

Cu.import("resource://gre/modules/XPCOMUtils.jsm"); /*global XPCOMUtils: false */
Cu.import("resource://enigmail/subprocess.jsm"); /*global subprocess: false */
Cu.import("resource://enigmail/pipeConsole.jsm"); /*global EnigmailConsole: false */
Cu.import("resource://enigmail/enigmailCore.jsm"); /*global EnigmailCore: false */
Cu.import("resource://enigmail/enigmailGpgAgent.jsm"); /*global EnigmailGpgAgent: false */
Cu.import("resource://enigmail/encryption.jsm"); /*global Encryption: false */
Cu.import("resource://enigmail/decryption.jsm"); /*global Decryption: false */
Cu.import("resource://enigmail/enigmailProtocolHandler.jsm"); /*global EnigmailProtocolHandler: false */
Cu.import("resource://enigmail/rules.jsm"); /*global Rules: false */
Cu.import("resource://enigmail/filters.jsm"); /*global Filters: false */
Cu.import("resource://enigmail/armor.jsm"); /*global EnigmailArmor: false */
Cu.import("resource://enigmail/log.jsm"); /*global Log: false */
Cu.import("resource://enigmail/os.jsm"); /*global OS: false */
Cu.import("resource://enigmail/locale.jsm"); /*global Locale: false */
Cu.import("resource://enigmail/commandLine.jsm"); /*global CommandLine: false */
Cu.import("resource://enigmail/prefs.jsm"); /*global Prefs: false */
Cu.import("resource://enigmail/uris.jsm"); /*global URIs: false */
Cu.import("resource://enigmail/verify.jsm"); /*global Verify: false */
Cu.import("resource://enigmail/windows.jsm"); /*global Windows: false */
Cu.import("resource://enigmail/dialog.jsm"); /*global Dialog: false */
Cu.import("resource://enigmail/configure.jsm"); /*global Configure: false */
Cu.import("resource://enigmail/app.jsm"); /*global App: false */

/* Implementations supplied by this module */
const NS_ENIGMAIL_CONTRACTID   = "@mozdev.org/enigmail/enigmail;1";

const NS_ENIGMAIL_CID =
  Components.ID("{847b3a01-7ab1-11d4-8f02-006008948af5}");

// Contract IDs and CIDs used by this module
const NS_OBSERVERSERVICE_CONTRACTID = "@mozilla.org/observer-service;1";

const Cc = Components.classes;
const Ci = Components.interfaces;

// Interfaces
const nsISupports            = Ci.nsISupports;
const nsIObserver            = Ci.nsIObserver;
const nsIEnvironment         = Ci.nsIEnvironment;
const nsIEnigmail            = Ci.nsIEnigmail;

const NS_XPCOM_SHUTDOWN_OBSERVER_ID = "xpcom-shutdown";

///////////////////////////////////////////////////////////////////////////////
// Enigmail encryption/decryption service
///////////////////////////////////////////////////////////////////////////////

function getLogDirectoryPrefix() {
    try {
        return Prefs.getPrefBranch().getCharPref("logDirectory") || "";
    } catch (ex) {
        return "";
    }
}

function initializeLogDirectory() {
    const prefix = getLogDirectoryPrefix();
    if (prefix) {
        Log.setLogLevel(5);
        Log.setLogDirectory(prefix);
        Log.DEBUG("enigmail.js: Logging debug output to "+prefix+"/enigdbug.txt\n");
    }
}

function initializeLogging(env) {
    const nspr_log_modules = env.get("NSPR_LOG_MODULES");
    const matches = nspr_log_modules.match(/enigmail.js:(\d+)/);

    if (matches && (matches.length > 1)) {
        Log.setLogLevel(Number(matches[1]));
        Log.WARNING("enigmail.js: Enigmail: LogLevel="+matches[1]+"\n");
    }
}

function initializeSubprocessLogging(env) {
    const nspr_log_modules = env.get("NSPR_LOG_MODULES");
    const matches = nspr_log_modules.match(/subprocess:(\d+)/);

    subprocess.registerLogHandler(function(txt) { Log.ERROR("subprocess.jsm: "+txt); });

    if (matches && matches.length > 1 && matches[1] > 2) {
        subprocess.registerDebugHandler(function(txt) { Log.DEBUG("subprocess.jsm: "+txt); });
    }
}

function initializeAgentInfo() {
    if (EnigmailGpgAgent.useGpgAgent() && (! OS.isDosLike())) {
        if (!EnigmailGpgAgent.isDummy()) {
            EnigmailCore.addToEnvList("GPG_AGENT_INFO="+EnigmailGpgAgent.gpgAgentInfo.envStr);
        }
    }
}

function failureOn(ex, status) {
    status.initializationError = Locale.getString("enigmimeNotAvail");
    Log.ERROR("enigmail.js: Enigmail.initialize: Error - "+status.initializationError+"\n");
    Log.DEBUG("enigmail.js: Enigmail.initialize: exception="+ex.toString()+"\n");
    throw Components.results.NS_ERROR_FAILURE;
}

function getEnvironment(status) {
    try {
        return Cc["@mozilla.org/process/environment;1"].getService(nsIEnvironment);
    } catch (ex) {
        failureOn(ex, status);
    }
}

function initializeEnvironment(env) {
    // Initialize global environment variables list
    const passEnv = [ "GNUPGHOME", "GPGDIR", "ETC",
                      "ALLUSERSPROFILE", "APPDATA", "BEGINLIBPATH",
                      "COMMONPROGRAMFILES", "COMSPEC", "DISPLAY",
                      "ENIGMAIL_PASS_ENV", "ENDLIBPATH",
                      "HOME", "HOMEDRIVE", "HOMEPATH",
                      "LANG", "LANGUAGE", "LC_ALL", "LC_COLLATE",  "LC_CTYPE",
                      "LC_MESSAGES",  "LC_MONETARY", "LC_NUMERIC", "LC_TIME",
                      "LOCPATH", "LOGNAME", "LD_LIBRARY_PATH", "MOZILLA_FIVE_HOME",
                      "NLSPATH", "PATH", "PATHEXT", "PROGRAMFILES", "PWD",
                      "SHELL", "SYSTEMDRIVE", "SYSTEMROOT",
                      "TEMP", "TMP", "TMPDIR", "TZ", "TZDIR", "UNIXROOT",
                      "USER", "USERPROFILE", "WINDIR", "XAUTHORITY" ];

    const passList = env.get("ENIGMAIL_PASS_ENV");
    if (passList) {
        const passNames = passList.split(":");
        for (var k=0; k<passNames.length; k++) {
            passEnv.push(passNames[k]);
        }
    }

    EnigmailCore.initEnvList();
    for (var j=0; j<passEnv.length; j++) {
      const envName = passEnv[j];
      const envValue = env.get(envName);
      if (envValue) {
          EnigmailCore.addToEnvList(envName+"="+envValue);
      }
    }

    Log.DEBUG("enigmail.js: Enigmail.initialize: Ec.envList = "+EnigmailCore.getEnvList()+"\n");
}

function initializeObserver(on) {
    // Register to observe XPCOM shutdown
    const obsServ = Cc[NS_OBSERVERSERVICE_CONTRACTID].getService().
              QueryInterface(Ci.nsIObserverService);
    obsServ.addObserver(on, NS_XPCOM_SHUTDOWN_OBSERVER_ID, false);
}

function Enigmail() {
    this.wrappedJSObject = this;
}

Enigmail.prototype = {
  classDescription: "Enigmail",
  classID:  NS_ENIGMAIL_CID,
  contractID: NS_ENIGMAIL_CONTRACTID,

  initialized: false,
  initializationAttempted: false,
  initializationError: "",

  _xpcom_factory: {
    createInstance: function (aOuter, iid) {
        // Enigmail is a service -> only instanciate once
        return EnigmailCore.ensuredEnigmailService(function() { return new Enigmail(); });
    },
    lockFactory: function (lock) {}
  },
  QueryInterface: XPCOMUtils.generateQI([ nsIEnigmail, nsIObserver, nsISupports ]),

  observe: function (aSubject, aTopic, aData) {
    Log.DEBUG("enigmail.js: Enigmail.observe: topic='"+aTopic+"' \n");

    if (aTopic == NS_XPCOM_SHUTDOWN_OBSERVER_ID) {
      // XPCOM shutdown
      this.finalize();

    }
    else {
      Log.DEBUG("enigmail.js: Enigmail.observe: no handler for '"+aTopic+"'\n");
    }
  },


  finalize: function () {
    Log.DEBUG("enigmail.js: Enigmail.finalize:\n");
    if (!this.initialized) return;

    EnigmailGpgAgent.finalize();
    Log.onShutdown();

    Log.setLogLevel(3);
    this.initializationError = "";
    this.initializationAttempted = false;
    this.initialized = false;
  },


  initialize: function (domWindow, version) {
      this.initializationAttempted = true;

      Log.DEBUG("enigmail.js: Enigmail.initialize: START\n");

      if (this.initialized) return;

      initializeLogDirectory();

      EnigmailCore.setEnigmailService(this);

      this.environment = getEnvironment(this);

      initializeLogging(this.environment);
      initializeSubprocessLogging(this.environment);
      initializeEnvironment(this.environment);

      try {
          EnigmailConsole.write("Initializing Enigmail service ...\n");
      } catch (ex) {
          failureOn(ex, this);
      }

      EnigmailGpgAgent.setAgentPath(domWindow, this);
      EnigmailGpgAgent.detectGpgAgent(domWindow, this);

      initializeAgentInfo();

      initializeObserver(this);

      this.initialized = true;

      Log.DEBUG("enigmail.js: Enigmail.initialize: END\n");
  },

  reinitialize: function () {
    this.initialized = false;
    this.initializationAttempted = true;

    EnigmailConsole.write("Reinitializing Enigmail service ...\n");
    EnigmailGpgAgent.setAgentPath(null, this);
    this.initialized = true;
  },

    getService: function (holder, win, startingPreferences) {
        if (! win) {
            win = Windows.getBestParentWin();
        }

        Log.DEBUG("enigmail.js: svc = "+holder.svc+"\n");

        if (!holder.svc.initialized) {
            const firstInitialization = !holder.svc.initializationAttempted;

            try {
                // Initialize enigmail
                EnigmailCore.init(App.getVersion());
                holder.svc.initialize(win, App.getVersion());

                try {
                    // Reset alert count to default value
                    Prefs.getPrefBranch().clearUserPref("initAlert");
                } catch(ex) { }
            } catch (ex) {
                if (firstInitialization) {
                    // Display initialization error alert
                    const errMsg = (holder.svc.initializationError ? holder.svc.initializationError : Locale.getString("accessError")) +
                              "\n\n"+Locale.getString("initErr.howToFixIt");

                    const checkedObj = {value: false};
                    if (Prefs.getPref("initAlert")) {
                        const r = Dialog.longAlert(win, "Enigmail: "+errMsg,
                                                   Locale.getString("dlgNoPrompt"),
                                                   null, Locale.getString("initErr.setupWizard.button"),
                                                   null, checkedObj);
                        if (r >= 0 && checkedObj.value) {
                            Prefs.setPref("initAlert", false);
                        }
                        if (r == 1) {
                            // start setup wizard
                            Windows.openSetupWizard(win, false);
                            return Enigmail.getService(holder, win);
                        }
                    }
                    if (Prefs.getPref("initAlert")) {
                        holder.svc.initializationAttempted = false;
                        holder.svc = null;
                    }
                }

                return null;
            }

            const configuredVersion = Prefs.getPref("configuredVersion");

            Log.DEBUG("enigmailCommon.jsm: getService: "+configuredVersion+"\n");

            if (firstInitialization && holder.svc.initialized &&
                EnigmailGpgAgent.agentType === "pgp") {
                Dialog.alert(win, Locale.getString("pgpNotSupported"));
            }

            if (holder.svc.initialized && (App.getVersion() != configuredVersion)) {
                Configure.configureEnigmail(win, startingPreferences);
            }
        }

        return holder.svc.initialized ? holder.svc : null;
    }
}; // Enigmail.prototype


EnigmailArmor.registerOn(Enigmail.prototype);
Decryption.registerOn(Enigmail.prototype);
Encryption.registerOn(Enigmail.prototype);
Rules.registerOn(Enigmail.prototype);
URIs.registerOn(Enigmail.prototype);
Verify.registerOn(Enigmail.prototype);

// This variable is exported implicitly and should not be refactored or removed
const NSGetFactory = XPCOMUtils.generateNSGetFactory([Enigmail, EnigmailProtocolHandler, CommandLine.Handler]);

Filters.registerAll();

dump("enigmail.js: Registered components\n");
