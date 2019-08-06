/*global Components: false */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */


"use strict";

const {
  manager: Cm,
  Constructor: CC
} = Components;
Cm.QueryInterface(Ci.nsIComponentRegistrar);

const subprocess = ChromeUtils.import("chrome://autocrypt/content/modules/subprocess.jsm").subprocess;
const EnigmailLazy = ChromeUtils.import("chrome://autocrypt/content/modules/lazy.jsm").EnigmailLazy;

// load all modules lazily to avoid possible cross-reference errors
const getEnigmailConsole = EnigmailLazy.loader("autocrypt/pipeConsole.jsm", "EnigmailConsole");
const getEnigmailMimeEncrypt = EnigmailLazy.loader("autocrypt/mimeEncrypt.jsm", "EnigmailMimeEncrypt");
const getEnigmailProtocolHandler = EnigmailLazy.loader("autocrypt/protocolHandler.jsm", "EnigmailProtocolHandler");
const getEnigmailFiltersWrapper = EnigmailLazy.loader("autocrypt/filtersWrapper.jsm", "EnigmailFiltersWrapper");
const getEnigmailLog = EnigmailLazy.loader("autocrypt/log.jsm", "EnigmailLog");
const getEnigmailOS = EnigmailLazy.loader("autocrypt/os.jsm", "EnigmailOS");
const getEnigmailKeyring = EnigmailLazy.loader("autocrypt/keyRing.jsm", "EnigmailKeyRing");
const getEnigmailLocale = EnigmailLazy.loader("autocrypt/locale.jsm", "EnigmailLocale");
const getEnigmailPrefs = EnigmailLazy.loader("autocrypt/prefs.jsm", "EnigmailPrefs");
const getEnigmailVerify = EnigmailLazy.loader("autocrypt/mimeVerify.jsm", "EnigmailVerify");
const getEnigmailWindows = EnigmailLazy.loader("autocrypt/windows.jsm", "EnigmailWindows");
const getEnigmailDialog = EnigmailLazy.loader("autocrypt/dialog.jsm", "EnigmailDialog");
const getEnigmailConfigure = EnigmailLazy.loader("autocrypt/configure.jsm", "EnigmailConfigure");
const getEnigmailApp = EnigmailLazy.loader("autocrypt/app.jsm", "EnigmailApp");
const getEnigmailKeyRefreshService = EnigmailLazy.loader("autocrypt/keyRefreshService.jsm", "EnigmailKeyRefreshService");
const getEnigmailKeyServer = EnigmailLazy.loader("autocrypt/keyserver.jsm", "EnigmailKeyServer");
const getEnigmailOverlays = EnigmailLazy.loader("autocrypt/enigmailOverlays.jsm", "EnigmailOverlays");
const getEnigmailSqlite = EnigmailLazy.loader("autocrypt/sqliteDb.jsm", "EnigmailSqliteDb");
const getEnigmailCryptoAPI = EnigmailLazy.loader("autocrypt/cryptoAPI.jsm", "EnigmailCryptoAPI");
const getAutocryptMasterpass = EnigmailLazy.loader("autocrypt/masterpass.jsm", "AutocryptMasterpass");
const Services = ChromeUtils.import("resource://gre/modules/Services.jsm").Services;

var EXPORTED_SYMBOLS = ["EnigmailCore"];

// Interfaces
const nsIEnvironment = Ci.nsIEnvironment;

var gOverwriteEnvVar = [];
var gEnigmailService = null; // Global Enigmail Service

var gEnvList = null; // currently filled from enigmail.js

var EnigmailCore = {
  /**
   * Create a new instance of Enigmail, or return the already existing one
   */
  createInstance: function() {
    if (!gEnigmailService) {
      gEnigmailService = new Enigmail();
    }

    return gEnigmailService;
  },

  startup: async function(reason) {
    let env = getEnvironment();
    initializeLogDirectory();
    initializeLogging(env);

    getEnigmailLog().DEBUG("core.jsm: startup()\n");

    // Wait for TB Startup to be complete to initialize window overlays
    let enigmailOverlays = getEnigmailOverlays();
    Services.obs.addObserver(enigmailOverlays.mailStartupDone, "mail-startup-done", false);

    await getEnigmailSqlite().checkDatabaseStructure();
    getEnigmailPrefs().startup(reason);

    let self = this;
    this.factories = [];

    async function continueStartup() {
      getEnigmailLog().DEBUG("core.jsm: startup.continueStartup()\n");

      try {
        let mimeEncrypt = getEnigmailMimeEncrypt();
        mimeEncrypt.startup(reason);
        enigmailOverlays.startupCore(reason);
        self.factories.push(new Factory(getEnigmailProtocolHandler()));
        self.factories.push(new Factory(mimeEncrypt.Handler));

        getAutocryptMasterpass().ensureAutocryptPassword();

        // warm up cache
        await getEnigmailKeyring().getAllSecretKeys();

        /*
          let win = getEnigmailWindows().getBestParentWin();
          getEnigmailLog().DEBUG("core.jsm: getService: show settings");
          getEnigmailWindows().openAutocryptSettings(win);
        */

        getEnigmailLog().DEBUG("core.jsm: startup.continueStartup: ok\n");
      } catch (ex) {
        getEnigmailLog().DEBUG("core.jsm: startup.continueStartup: error " + ex.message + "\n" + ex.stack + "\n");
      }
    }

    // TODO not doing this currently, doesn't actually help :(
    // const cApi = EnigmailCryptoAPI();
    // cApi.initialize();

    getEnigmailVerify().registerContentTypeHandler();
    getEnigmailFiltersWrapper().onStartup();
    await continueStartup();
  },

  shutdown: function(reason) {
    getEnigmailLog().DEBUG("core.jsm: shutdown():\n");

    if (this.factories) {
      for (let fct of this.factories) {
        fct.unregister();
      }
    }

    getEnigmailFiltersWrapper().onShutdown();
    getEnigmailVerify().unregisterContentTypeHandler();

    getEnigmailSqlite().clearCachedConnections();

    getEnigmailLocale().shutdown();
    getEnigmailLog().DEBUG("core.jsm: shutdown(): ok (except log)\n");
    getEnigmailLog().onShutdown();

    getEnigmailLog().setLogLevel(3);
    gEnigmailService = null;
  },

  version: "",

  init: function(enigmailVersion) {
    this.version = enigmailVersion;
  },

  /**
   * get and or initialize the Enigmail service,
   * including the handling for upgrading old preferences to new versions
   *
   * @win:                - nsIWindow: parent window (optional)
   * @startingPreferences - Boolean: true - called while switching to new preferences
   *                        (to avoid re-check for preferences)
   */
  getService: function(win, startingPreferences) {
    // Lazy initialization of Enigmail JS component (for efficiency)

    if (gEnigmailService) {
      return gEnigmailService.initialized ? gEnigmailService : null;
    }

    try {
      this.createInstance();
      return gEnigmailService.getService(win, startingPreferences);
    } catch (ex) {
      return null;
    }

  },

  getEnigmailService: function() {
    return gEnigmailService;
  },

  setEnigmailService: function(v) {
    gEnigmailService = v;
  },

  /**
   * obtain a list of all environment variables
   *
   * @return: Array of Strings with the following structrue
   *          variable_name=variable_content
   */
  getEnvList: function() {
    return gEnvList;
  },

  addToEnvList: function(str) {
    gEnvList.push(str);
  },

  setEnvVariable: function(varname, value) {
    for (let i = 0; i < gEnvList.length; i++) {
      if (gEnvList[i].startsWith(varname + "=")) {
        gEnvList[i] = varname + "=" + value;
        break;
      }
    }
  }
};

///////////////////////////////////////////////////////////////////////////////
// Enigmail encryption/decryption service
///////////////////////////////////////////////////////////////////////////////

function getLogDirectoryPrefix() {
  try {
    return getEnigmailPrefs().getPrefBranch().getCharPref("logDirectory") || "";
  } catch (ex) {
    return "";
  }
}

function initializeLogDirectory() {
  const log_file = getEnigmailApp().getProfileDirectory();
  log_file.append('log_autocrypt.txt');
  getEnigmailLog().setLogLevel(5);
  getEnigmailLog().setLogFile(log_file);
  getEnigmailLog().DEBUG(`core.jsm: Logging debug output to ${log_file.path}\n`);
}

function initializeLogging(env) {
  const nspr_log_modules = env.get("NSPR_LOG_MODULES");
  const matches = nspr_log_modules.match(/enigmail.js:(\d+)/);

  if (matches && (matches.length > 1)) {
    getEnigmailLog().setLogLevel(Number(matches[1]));
    getEnigmailLog().WARNING("core.jsm: Enigmail: LogLevel=" + matches[1] + "\n");
  }
}

function initializeSubprocessLogging(env) {
  const nspr_log_modules = env.get("NSPR_LOG_MODULES");
  const matches = nspr_log_modules.match(/subprocess:(\d+)/);

  subprocess.registerLogHandler(function(txt) {
    getEnigmailLog().ERROR("subprocess.jsm: " + txt);
  });

  if (matches && matches.length > 1 && matches[1] > 2) {
    subprocess.registerDebugHandler(function(txt) {
      getEnigmailLog().DEBUG("subprocess.jsm: " + txt);
    });
  }
}

function failureOn(ex, status) {
  status.initializationError = getEnigmailLocale().getString("enigmailNotAvailable");
  getEnigmailLog().ERROR("core.jsm: Enigmail.initialize: Error - " + status.initializationError + "\n");
  getEnigmailLog().DEBUG("core.jsm: Enigmail.initialize: exception=" + ex.toString() + "\n");
  throw Components.results.NS_ERROR_FAILURE;
}

function getEnvironment(status) {
  try {
    return Cc["@mozilla.org/process/environment;1"].getService(nsIEnvironment);
  } catch (ex) {
    failureOn(ex, status);
  }
  return null;
}

function initializeEnvironment(env) {
  // Initialize global environment variables list
  let passEnv = ["ETC",
    "ALLUSERSPROFILE", "APPDATA", "LOCALAPPDATA", "BEGINLIBPATH",
    "COMMONPROGRAMFILES", "COMSPEC", "DBUS_SESSION_BUS_ADDRESS", "DISPLAY",
    "ENIGMAIL_PASS_ENV", "ENDLIBPATH",
    "GTK_IM_MODULE",
    "HOME", "HOMEDRIVE", "HOMEPATH",
    "LOCPATH", "LOGNAME", "LD_LIBRARY_PATH", "MOZILLA_FIVE_HOME",
    "NLSPATH", "PATH", "PATHEXT", "PINENTRY_USER_DATA", "PROGRAMFILES", "PWD",
    "QT_IM_MODULE",
    "SHELL", "SYSTEMDRIVE", "SYSTEMROOT",
    "TEMP", "TMP", "TMPDIR", "TZ", "TZDIR", "UNIXROOT",
    "USER", "USERPROFILE", "WINDIR", "XAUTHORITY",
    "XMODIFIERS"
  ];

  gEnvList = [];

  // if (!getEnigmailPrefs().getPref("gpgLocaleEn")) 
  //   passEnv = passEnv.concat([
  //     "LANG", "LANGUAGE", "LC_ALL", "LC_COLLATE", "LC_CTYPE",
  //     "LC_MESSAGES", "LC_MONETARY", "LC_NUMERIC", "LC_TIME"
  //   ]);
  // }
  // else if (getEnigmailOS().getOS() === "WINNT") {
  //   // force output on Windows to EN-US
  //   EnigmailCore.addToEnvList("LC_ALL=en_US");
  //   EnigmailCore.addToEnvList("LANG=en_US");
  // }

  EnigmailCore.addToEnvList("LC_ALL=C");
  EnigmailCore.addToEnvList("LANG=C");

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
    } else {
      envValue = env.get(envName);
    }
    if (envValue) {
      EnigmailCore.addToEnvList(envName + "=" + envValue);
    }
  }

  getEnigmailLog().DEBUG("core.jsm: Enigmail.initialize: Ec.envList = " + gEnvList + "\n");
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

    getEnigmailLog().DEBUG("core.jsm: Enigmail.initialize: START\n");

    if (this.initialized) return;

    this.environment = getEnvironment(this);

    initializeSubprocessLogging(this.environment);
    initializeEnvironment(this.environment);

    try {
      getEnigmailConsole().write("Initializing Enigmail service ...\n");
    } catch (ex) {
      failureOn(ex, this);
    }

    // TODO fix refresh service
    // getEnigmailKeyRefreshService().start(getEnigmailKeyServer());

    this.initialized = true;

    getEnigmailLog().DEBUG("core.jsm: Enigmail.initialize: END\n");
  },

  reinitialize: function() {
    getEnigmailLog().DEBUG("core.jsm: Enigmail.reinitialize:\n");
    this.initialized = false;
    this.initializationAttempted = true;

    getEnigmailConsole().write("Reinitializing Enigmail service ...\n");
    initializeEnvironment(this.environment);
    this.initialized = true;
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

  getService: function(win, startingPreferences) {
    if (!win) {
      win = getEnigmailWindows().getBestParentWin();
    }

    getEnigmailLog().DEBUG("core.jsm: svc = " + this + "\n");

    if (!this.initialized) {
      const firstInitialization = !this.initializationAttempted;

      try {
        // Initialize enigmail
        EnigmailCore.init(getEnigmailApp().getVersion());
        this.initialize(win, getEnigmailApp().getVersion());

        try {
          // Reset alert count to default value
          getEnigmailPrefs().getPrefBranch().clearUserPref("initAlert");
        } catch (ex) {}
      } catch (ex) {
        if (firstInitialization) {
          // Display initialization error alert
          const errMsg = (this.initializationError ? this.initializationError : getEnigmailLocale().getString("accessError")) +
            "\n\n" + getEnigmailLocale().getString("initErr.howToFixIt");

          const checkedObj = {
            value: false
          };
          if (getEnigmailPrefs().getPref("initAlert")) {
            const r = getEnigmailDialog().longAlert(win, "Enigmail: " + errMsg,
              getEnigmailLocale().getString("dlgNoPrompt"),
              null, getEnigmailLocale().getString("initErr.setupWizard.button"),
              null, checkedObj);
            if (r >= 0 && checkedObj.value) {
              getEnigmailPrefs().setPref("initAlert", false);
            }
            if (r == 1) {
              // start setup wizard
              getEnigmailWindows().openSetupWizard(win, false);
              return Enigmail.getService(win);
            }
          }
          if (getEnigmailPrefs().getPref("initAlert")) {
            this.initializationAttempted = false;
            gEnigmailService = null;
          }
        }

        return null;
      }

      const configuredVersion = getEnigmailPrefs().getPref("configuredVersion");

      getEnigmailLog().DEBUG("core.jsm: getService: last used version: " + configuredVersion + "\n");

      if (this.initialized && (getEnigmailApp().getVersion() != configuredVersion)) {
        getEnigmailConfigure().configureEnigmail(win, startingPreferences);
      }
    }

    return this.initialized ? this : null;
  }
}; // Enigmail.prototype


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
