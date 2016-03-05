/*global Components: false */
/*jshint -W097 */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */


"use strict";

const Cu = Components.utils;

Cu.import("resource://gre/modules/XPCOMUtils.jsm"); /*global XPCOMUtils: false */
Cu.import("resource://enigmail/subprocess.jsm"); /*global subprocess: false */
Cu.import("resource://enigmail/pipeConsole.jsm"); /*global EnigmailConsole: false */
Cu.import("resource://enigmail/core.jsm"); /*global EnigmailCore: false */
Cu.import("resource://enigmail/gpgAgent.jsm"); /*global EnigmailGpgAgent: false */
Cu.import("resource://enigmail/encryption.jsm"); /*global EnigmailEncryption: false */
Cu.import("resource://enigmail/decryption.jsm"); /*global EnigmailDecryption: false */
Cu.import("resource://enigmail/protocolHandler.jsm"); /*global EnigmailProtocolHandler: false */
Cu.import("resource://enigmail/rules.jsm"); /*global EnigmailRules: false */
Cu.import("resource://enigmail/filters.jsm"); /*global EnigmailFilters: false */
Cu.import("resource://enigmail/armor.jsm"); /*global EnigmailArmor: false */
Cu.import("resource://enigmail/log.jsm"); /*global EnigmailLog: false */
Cu.import("resource://enigmail/os.jsm"); /*global EnigmailOS: false */
Cu.import("resource://enigmail/locale.jsm"); /*global EnigmailLocale: false */
Cu.import("resource://enigmail/commandLine.jsm"); /*global EnigmailCommandLine: false */
Cu.import("resource://enigmail/prefs.jsm"); /*global EnigmailPrefs: false */
Cu.import("resource://enigmail/uris.jsm"); /*global EnigmailURIs: false */
Cu.import("resource://enigmail/verify.jsm"); /*global EnigmailVerifyAttachment: false */
Cu.import("resource://enigmail/mimeVerify.jsm"); /*global EnigmailVerify: false */
Cu.import("resource://enigmail/windows.jsm"); /*global EnigmailWindows: false */
Cu.import("resource://enigmail/dialog.jsm"); /*global EnigmailDialog: false */
Cu.import("resource://enigmail/configure.jsm"); /*global EnigmailConfigure: false */
Cu.import("resource://enigmail/app.jsm"); /*global EnigmailApp: false */

/* Implementations supplied by this module */
const NS_ENIGMAIL_CONTRACTID = "@mozdev.org/enigmail/enigmail;1";

const NS_ENIGMAIL_CID =
  Components.ID("{847b3a01-7ab1-11d4-8f02-006008948af5}");

// Contract IDs and CIDs used by this module
const NS_OBSERVERSERVICE_CONTRACTID = "@mozilla.org/observer-service;1";

const Cc = Components.classes;
const Ci = Components.interfaces;

// Interfaces
const nsISupports = Ci.nsISupports;
const nsIObserver = Ci.nsIObserver;
const nsIEnvironment = Ci.nsIEnvironment;
const nsIEnigmail = Ci.nsIEnigmail;

const NS_XPCOM_SHUTDOWN_OBSERVER_ID = "xpcom-shutdown";

///////////////////////////////////////////////////////////////////////////////
// Enigmail encryption/decryption service
///////////////////////////////////////////////////////////////////////////////

function getLogDirectoryPrefix() {
  try {
    return EnigmailPrefs.getPrefBranch().getCharPref("logDirectory") || "";
  }
  catch (ex) {
    return "";
  }
}

function initializeLogDirectory() {
  const prefix = getLogDirectoryPrefix();
  if (prefix) {
    EnigmailLog.setLogLevel(5);
    EnigmailLog.setLogDirectory(prefix);
    EnigmailLog.DEBUG("enigmail.js: Logging debug output to " + prefix + "/enigdbug.txt\n");
  }
}

function initializeLogging(env) {
  const nspr_log_modules = env.get("NSPR_LOG_MODULES");
  const matches = nspr_log_modules.match(/enigmail.js:(\d+)/);

  if (matches && (matches.length > 1)) {
    EnigmailLog.setLogLevel(Number(matches[1]));
    EnigmailLog.WARNING("enigmail.js: Enigmail: LogLevel=" + matches[1] + "\n");
  }
}

function initializeSubprocessLogging(env) {
  const nspr_log_modules = env.get("NSPR_LOG_MODULES");
  const matches = nspr_log_modules.match(/subprocess:(\d+)/);

  subprocess.registerLogHandler(function(txt) {
    EnigmailLog.ERROR("subprocess.jsm: " + txt);
  });

  if (matches && matches.length > 1 && matches[1] > 2) {
    subprocess.registerDebugHandler(function(txt) {
      EnigmailLog.DEBUG("subprocess.jsm: " + txt);
    });
  }
}

function initializeAgentInfo() {
  if (EnigmailGpgAgent.useGpgAgent() && (!EnigmailOS.isDosLike())) {
    if (!EnigmailGpgAgent.isDummy()) {
      EnigmailCore.addToEnvList("GPG_AGENT_INFO=" + EnigmailGpgAgent.gpgAgentInfo.envStr);
    }
  }
}

function failureOn(ex, status) {
  status.initializationError = EnigmailLocale.getString("enigmailNotAvailable");
  EnigmailLog.ERROR("enigmail.js: Enigmail.initialize: Error - " + status.initializationError + "\n");
  EnigmailLog.DEBUG("enigmail.js: Enigmail.initialize: exception=" + ex.toString() + "\n");
  throw Components.results.NS_ERROR_FAILURE;
}

function getEnvironment(status) {
  try {
    return Cc["@mozilla.org/process/environment;1"].getService(nsIEnvironment);
  }
  catch (ex) {
    failureOn(ex, status);
  }
}

function initializeEnvironment(env) {
  // Initialize global environment variables list
  const passEnv = ["GNUPGHOME", "GPGDIR", "ETC",
    "ALLUSERSPROFILE", "APPDATA", "BEGINLIBPATH",
    "COMMONPROGRAMFILES", "COMSPEC", "DBUS_SESSION_BUS_ADDRESS", "DISPLAY",
    "ENIGMAIL_PASS_ENV", "ENDLIBPATH",
    "GTK_IM_MODULE",
    "HOME", "HOMEDRIVE", "HOMEPATH",
    "LANG", "LANGUAGE", "LC_ALL", "LC_COLLATE", "LC_CTYPE",
    "LC_MESSAGES", "LC_MONETARY", "LC_NUMERIC", "LC_TIME",
    "LOCPATH", "LOGNAME", "LD_LIBRARY_PATH", "MOZILLA_FIVE_HOME",
    "NLSPATH", "PATH", "PATHEXT", "PROGRAMFILES", "PWD",
    "QT_IM_MODULE",
    "SHELL", "SYSTEMDRIVE", "SYSTEMROOT",
    "TEMP", "TMP", "TMPDIR", "TZ", "TZDIR", "UNIXROOT",
    "USER", "USERPROFILE", "WINDIR", "XAUTHORITY",
    "XMODIFIERS"
  ];

  const passList = env.get("ENIGMAIL_PASS_ENV");
  if (passList) {
    const passNames = passList.split(":");
    for (var k = 0; k < passNames.length; k++) {
      passEnv.push(passNames[k]);
    }
  }

  EnigmailCore.initEnvList();
  for (var j = 0; j < passEnv.length; j++) {
    const envName = passEnv[j];
    const envValue = env.get(envName);
    if (envValue) {
      EnigmailCore.addToEnvList(envName + "=" + envValue);
    }
  }

  EnigmailLog.DEBUG("enigmail.js: Enigmail.initialize: Ec.envList = " + EnigmailCore.getEnvList() + "\n");
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
  classID: NS_ENIGMAIL_CID,
  contractID: NS_ENIGMAIL_CONTRACTID,

  initialized: false,
  initializationAttempted: false,
  initializationError: "",

  _xpcom_factory: {
    createInstance: function(aOuter, iid) {
      // Enigmail is a service -> only instanciate once
      return EnigmailCore.ensuredEnigmailService(function() {
        return new Enigmail();
      });
    },
    lockFactory: function(lock) {}
  },
  QueryInterface: XPCOMUtils.generateQI([nsIEnigmail, nsIObserver, nsISupports]),

  observe: function(aSubject, aTopic, aData) {
    EnigmailLog.DEBUG("enigmail.js: Enigmail.observe: topic='" + aTopic + "' \n");

    if (aTopic == NS_XPCOM_SHUTDOWN_OBSERVER_ID) {
      // XPCOM shutdown
      this.finalize();

    }
    else {
      EnigmailLog.DEBUG("enigmail.js: Enigmail.observe: no handler for '" + aTopic + "'\n");
    }
  },


  finalize: function() {
    EnigmailLog.DEBUG("enigmail.js: Enigmail.finalize:\n");
    if (!this.initialized) return;

    EnigmailGpgAgent.finalize();
    EnigmailLog.onShutdown();

    EnigmailLog.setLogLevel(3);
    this.initializationError = "";
    this.initializationAttempted = false;
    this.initialized = false;
  },


  initialize: function(domWindow, version) {
    this.initializationAttempted = true;

    EnigmailLog.DEBUG("enigmail.js: Enigmail.initialize: START\n");

    if (this.initialized) return;

    initializeLogDirectory();

    EnigmailCore.setEnigmailService(this);

    this.environment = getEnvironment(this);

    initializeLogging(this.environment);
    initializeSubprocessLogging(this.environment);
    initializeEnvironment(this.environment);

    try {
      EnigmailConsole.write("Initializing Enigmail service ...\n");
    }
    catch (ex) {
      failureOn(ex, this);
    }

    EnigmailGpgAgent.setAgentPath(domWindow, this);
    EnigmailGpgAgent.detectGpgAgent(domWindow, this);

    initializeAgentInfo();

    initializeObserver(this);

    this.initialized = true;

    EnigmailLog.DEBUG("enigmail.js: Enigmail.initialize: END\n");
  },

  reinitialize: function() {
    this.initialized = false;
    this.initializationAttempted = true;

    EnigmailConsole.write("Reinitializing Enigmail service ...\n");
    EnigmailGpgAgent.setAgentPath(null, this);
    this.initialized = true;
  },

  getService: function(holder, win, startingPreferences) {
    if (!win) {
      win = EnigmailWindows.getBestParentWin();
    }

    EnigmailLog.DEBUG("enigmail.js: svc = " + holder.svc + "\n");

    if (!holder.svc.initialized) {
      const firstInitialization = !holder.svc.initializationAttempted;

      try {
        // Initialize enigmail
        EnigmailCore.init(EnigmailApp.getVersion());
        holder.svc.initialize(win, EnigmailApp.getVersion());

        try {
          // Reset alert count to default value
          EnigmailPrefs.getPrefBranch().clearUserPref("initAlert");
        }
        catch (ex) {}
      }
      catch (ex) {
        if (firstInitialization) {
          // Display initialization error alert
          const errMsg = (holder.svc.initializationError ? holder.svc.initializationError : EnigmailLocale.getString("accessError")) +
            "\n\n" + EnigmailLocale.getString("initErr.howToFixIt");

          const checkedObj = {
            value: false
          };
          if (EnigmailPrefs.getPref("initAlert")) {
            const r = EnigmailDialog.longAlert(win, "Enigmail: " + errMsg,
              EnigmailLocale.getString("dlgNoPrompt"),
              null, EnigmailLocale.getString("initErr.setupWizard.button"),
              null, checkedObj);
            if (r >= 0 && checkedObj.value) {
              EnigmailPrefs.setPref("initAlert", false);
            }
            if (r == 1) {
              // start setup wizard
              EnigmailWindows.openSetupWizard(win, false);
              return Enigmail.getService(holder, win);
            }
          }
          if (EnigmailPrefs.getPref("initAlert")) {
            holder.svc.initializationAttempted = false;
            holder.svc = null;
          }
        }

        return null;
      }

      const configuredVersion = EnigmailPrefs.getPref("configuredVersion");

      EnigmailLog.DEBUG("enigmailCommon.jsm: getService: " + configuredVersion + "\n");

      if (firstInitialization && holder.svc.initialized &&
        EnigmailGpgAgent.agentType === "pgp") {
        EnigmailDialog.alert(win, EnigmailLocale.getString("pgpNotSupported"));
      }

      if (holder.svc.initialized && (EnigmailApp.getVersion() != configuredVersion)) {
        EnigmailConfigure.configureEnigmail(win, startingPreferences);
      }
    }

    return holder.svc.initialized ? holder.svc : null;
  }
}; // Enigmail.prototype


EnigmailArmor.registerOn(Enigmail.prototype);
EnigmailDecryption.registerOn(Enigmail.prototype);
EnigmailEncryption.registerOn(Enigmail.prototype);
EnigmailRules.registerOn(Enigmail.prototype);
EnigmailURIs.registerOn(Enigmail.prototype);
EnigmailVerifyAttachment.registerOn(Enigmail.prototype);
EnigmailVerify.registerContentTypeHandler();

// This variable is exported implicitly and should not be refactored or removed
const NSGetFactory = XPCOMUtils.generateNSGetFactory([Enigmail, EnigmailProtocolHandler, EnigmailCommandLine.Handler]);

EnigmailFilters.registerAll();
