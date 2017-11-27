/*global Components: false */
/*jshint -W097 */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */


"use strict";

const {
  classes: Cc,
  interfaces: Ci,
  manager: Cm,
  results: Cr,
  utils: Cu,
  Constructor: CC
} = Components;
Cm.QueryInterface(Ci.nsIComponentRegistrar);

var EXPORTED_SYMBOLS = ["EnigmailCoreService"];

Cu.import("resource://gre/modules/XPCOMUtils.jsm"); /*global XPCOMUtils: false */
Cu.import("resource://enigmail/subprocess.jsm"); /*global subprocess: false */
Cu.import("resource://enigmail/pipeConsole.jsm"); /*global EnigmailConsole: false */
Cu.import("resource://enigmail/core.jsm"); /*global EnigmailCore: false */
Cu.import("resource://enigmail/gpgAgent.jsm"); /*global EnigmailGpgAgent: false */
Cu.import("resource://enigmail/encryption.jsm"); /*global EnigmailEncryption: false */
Cu.import("resource://enigmail/mimeEncrypt.jsm"); /*global EnigmailMimeEncrypt: false */
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
Cu.import("resource://enigmail/keyRefreshService.jsm"); /*global EnigmailKeyRefreshService: false */
Cu.import("resource://enigmail/keyserver.jsm"); /*global EnigmailKeyServer: false */
Cu.import("resource://enigmail/wksMimeHandler.jsm"); /*global EnigmailWksMimeHandler: false */
Cu.import("resource://enigmail/pEpAdapter.jsm"); /*global EnigmailPEPAdapter: false */
Cu.import("resource://enigmail/msgCompFields.jsm"); /*global EnigmailMsgCompFields: false */



// Interfaces
const nsISupports = Ci.nsISupports;
const nsIEnvironment = Ci.nsIEnvironment;

var gPreferredGpgPath = null;
var gOverwriteEnvVar = [];
var gEnigmailService = null;

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
    EnigmailLog.DEBUG("coreService.jsm: Logging debug output to " + prefix + "/enigdbug.txt\n");
  }
}

function initializeLogging(env) {
  const nspr_log_modules = env.get("NSPR_LOG_MODULES");
  const matches = nspr_log_modules.match(/enigmail.js:(\d+)/);

  if (matches && (matches.length > 1)) {
    EnigmailLog.setLogLevel(Number(matches[1]));
    EnigmailLog.WARNING("coreService.jsm: Enigmail: LogLevel=" + matches[1] + "\n");
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
  if (!EnigmailOS.isDosLike && !EnigmailGpgAgent.isDummy()) {
    EnigmailCore.addToEnvList("GPG_AGENT_INFO=" + EnigmailGpgAgent.gpgAgentInfo.envStr);
  }
}

function failureOn(ex, status) {
  status.initializationError = EnigmailLocale.getString("enigmailNotAvailable");
  EnigmailLog.ERROR("coreService.jsm: Enigmail.initialize: Error - " + status.initializationError + "\n");
  EnigmailLog.DEBUG("coreService.jsm: Enigmail.initialize: exception=" + ex.toString() + "\n");
  throw Components.results.NS_ERROR_FAILURE;
}

function getEnvironment(status) {
  try {
    return Cc["@mozilla.org/process/environment;1"].getService(nsIEnvironment);
  }
  catch (ex) {
    failureOn(ex, status);
  }
  return null;
}

function initializeEnvironment(env) {
  // Initialize global environment variables list
  let passEnv = ["GNUPGHOME", "GPGDIR", "ETC",
    "ALLUSERSPROFILE", "APPDATA", "BEGINLIBPATH",
    "COMMONPROGRAMFILES", "COMSPEC", "DBUS_SESSION_BUS_ADDRESS", "DISPLAY",
    "ENIGMAIL_PASS_ENV", "ENDLIBPATH",
    "GTK_IM_MODULE",
    "HOME", "HOMEDRIVE", "HOMEPATH",
    "LOCPATH", "LOGNAME", "LD_LIBRARY_PATH", "MOZILLA_FIVE_HOME",
    "NLSPATH", "PATH", "PATHEXT", "PROGRAMFILES", "PWD",
    "QT_IM_MODULE",
    "SHELL", "SYSTEMDRIVE", "SYSTEMROOT",
    "TEMP", "TMP", "TMPDIR", "TZ", "TZDIR", "UNIXROOT",
    "USER", "USERPROFILE", "WINDIR", "XAUTHORITY",
    "XMODIFIERS"
  ];

  EnigmailCore.initEnvList();

  if (!EnigmailPrefs.getPref("gpgLocaleEn")) {
    passEnv = passEnv.concat([
      "LANG", "LANGUAGE", "LC_ALL", "LC_COLLATE", "LC_CTYPE",
      "LC_MESSAGES", "LC_MONETARY", "LC_NUMERIC", "LC_TIME"
    ]);
  }
  else if (EnigmailOS.getOS() === "WINNT") {
    // force output on Windows to EN-US
    EnigmailCore.addToEnvList("LC_ALL=en_US");
    EnigmailCore.addToEnvList("LANG=en_US");
  }

  const passList = env.get("ENIGMAIL_PASS_ENV");
  if (passList) {
    const passNames = passList.split(":");
    for (var k = 0; k < passNames.length; k++) {
      passEnv.push(passNames[k]);
    }
  }

  for (var j = 0; j < passEnv.length; j++) {
    const envName = passEnv[j];
    let envValue;

    if (envName in gOverwriteEnvVar) {
      envValue = gOverwriteEnvVar[envName];
    }
    else {
      envValue = env.get(envName);
    }
    if (envValue) {
      EnigmailCore.addToEnvList(envName + "=" + envValue);
    }
  }

  EnigmailLog.DEBUG("coreService.jsm: Enigmail.initialize: Ec.envList = " + EnigmailCore.getEnvList() + "\n");
}


function Enigmail() {
  this.wrappedJSObject = this;
}

Enigmail.prototype = {
  initialized: false,
  initializationAttempted: false,
  initializationError: "",

  initialize: function(domWindow, version) {
    this.initializationAttempted = true;

    EnigmailLog.DEBUG("coreService.jsm: Enigmail.initialize: START\n");

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

    EnigmailGpgAgent.setAgentPath(domWindow, this, gPreferredGpgPath);
    EnigmailGpgAgent.detectGpgAgent(domWindow, this);

    initializeAgentInfo();

    EnigmailKeyRefreshService.start(EnigmailKeyServer);

    this.initialized = true;

    EnigmailLog.DEBUG("coreService.jsm: Enigmail.initialize: END\n");
  },

  reinitialize: function() {
    EnigmailLog.DEBUG("coreService.jsm: Enigmail.reinitialize:\n");
    this.initialized = false;
    this.initializationAttempted = true;

    EnigmailConsole.write("Reinitializing Enigmail service ...\n");
    initializeEnvironment(this.environment);
    EnigmailGpgAgent.setAgentPath(null, this, gPreferredGpgPath);
    this.initialized = true;
  },

  perferGpgPath: function(gpgPath) {
    EnigmailLog.DEBUG("coreService.jsm: Enigmail.perferGpgPath = " + gpgPath + "\n");
    gPreferredGpgPath = gpgPath;
  },

  overwriteEnvVar: function(envVar) {
    let envLines = envVar.split(/\n/);

    gOverwriteEnvVar = [];
    for (let i = 0; i < envLines.length; i++) {
      let j = envLines[i].indexOf("=");
      if (j > 0) {
        gOverwriteEnvVar[envLines[i].substr(0, j)] = envLines[i].substr(j + 1);
      }
    }
  },

  getService: function(holder, win, startingPreferences) {
    if (!win) {
      win = EnigmailWindows.getBestParentWin();
    }

    EnigmailLog.DEBUG("coreService.jsm: svc = " + holder.svc + "\n");

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

      EnigmailLog.DEBUG("coreService.jsm: getService: last used version: " + configuredVersion + "\n");

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

var EnigmailCoreService = {
  /**
   * Create a new instance of Enigmail, or return the already existing one
   */
  createInstance: function() {
    if (!gEnigmailService) {
      gEnigmailService = new Enigmail();
    }

    return gEnigmailService;
  },

  startup: function(reason) {
    EnigmailArmor.registerOn(Enigmail.prototype);
    EnigmailDecryption.registerOn(Enigmail.prototype);
    EnigmailEncryption.registerOn(Enigmail.prototype);
    EnigmailRules.registerOn(Enigmail.prototype);
    EnigmailURIs.registerOn(Enigmail.prototype);
    EnigmailVerifyAttachment.registerOn(Enigmail.prototype);
    EnigmailVerify.registerContentTypeHandler();
    EnigmailWksMimeHandler.registerContentTypeHandler();
    EnigmailPEPAdapter.initialize();
    EnigmailMimeEncrypt.startup(reason);

    this.factories = [];
    try {
      let cLineReg = EnigmailCommandLine.categoryRegistry;
      let catMan = Cc["@mozilla.org/categorymanager;1"].getService(Ci.nsICategoryManager);
      catMan.addCategoryEntry(cLineReg.category,
        cLineReg.entry,
        cLineReg.serviceName,
        false, true);
      this.factories.push(new Factory(Enigmail));
      this.factories.push(new Factory(EnigmailProtocolHandler));
      this.factories.push(new Factory(EnigmailCommandLine.Handler));
      this.factories.push(new Factory(EnigmailMimeEncrypt.Handler));
      this.factories.push(new Factory(EnigmailMsgCompFields.CompFields));
    }
    catch (ex) {}

    EnigmailFilters.registerAll();
  },

  shutdown: function(reason) {
    EnigmailLog.DEBUG("coreService.jsm: shutdown():\n");

    let cLineReg = EnigmailCommandLine.categoryRegistry;
    let catMan = Cc["@mozilla.org/categorymanager;1"].getService(Ci.nsICategoryManager);
    catMan.deleteCategoryEntry(cLineReg.category, cLineReg.entry, false);

    if (this.factories) {
      for (let fct of this.factories) {
        fct.unregister();
      }
    }

    EnigmailPEPAdapter.onShutdown();

    EnigmailGpgAgent.finalize();
    EnigmailLog.onShutdown();

    EnigmailLog.setLogLevel(3);
    gEnigmailService = null;
  }
};

class Factory {
  constructor(component) {
    this.component = component;
    this.register();
    Object.freeze(this);
  }

  createInstance(outer, iid) {
    if (outer) {
      throw Cr.NS_ERROR_NO_AGGREGATION;
    }
    return new this.component();
  }

  register() {
    Cm.registerFactory(this.component.prototype.classID,
      this.component.prototype.classDescription,
      this.component.prototype.contractID,
      this);
  }

  unregister() {
    Cm.unregisterFactory(this.component.prototype.classID, this);
  }
}
