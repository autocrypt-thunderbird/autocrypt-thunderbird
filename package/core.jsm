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

const AutocryptLazy = ChromeUtils.import("chrome://autocrypt/content/modules/lazy.jsm").AutocryptLazy;

// load all modules lazily to avoid possible cross-reference errors
const getAutocryptConsole = AutocryptLazy.loader("autocrypt/pipeConsole.jsm", "AutocryptConsole");
const getAutocryptMimeEncrypt = AutocryptLazy.loader("autocrypt/mimeEncrypt.jsm", "AutocryptMimeEncrypt");
const getAutocryptProtocolHandler = AutocryptLazy.loader("autocrypt/protocolHandler.jsm", "AutocryptProtocolHandler");
const getAutocryptLog = AutocryptLazy.loader("autocrypt/log.jsm", "AutocryptLog");
const getAutocryptOS = AutocryptLazy.loader("autocrypt/os.jsm", "AutocryptOS");
const getAutocryptKeyring = AutocryptLazy.loader("autocrypt/keyRing.jsm", "AutocryptKeyRing");
const getAutocryptLocale = AutocryptLazy.loader("autocrypt/locale.jsm", "AutocryptLocale");
const getAutocryptPrefs = AutocryptLazy.loader("autocrypt/prefs.jsm", "AutocryptPrefs");
const getAutocryptVerify = AutocryptLazy.loader("autocrypt/mimeVerify.jsm", "AutocryptVerify");
const getAutocryptWindows = AutocryptLazy.loader("autocrypt/windows.jsm", "AutocryptWindows");
const getAutocryptDialog = AutocryptLazy.loader("autocrypt/dialog.jsm", "AutocryptDialog");
const getAutocryptConfigure = AutocryptLazy.loader("autocrypt/configure.jsm", "AutocryptConfigure");
const getAutocryptApp = AutocryptLazy.loader("autocrypt/app.jsm", "AutocryptApp");
const getAutocryptKeyRefreshService = AutocryptLazy.loader("autocrypt/keyRefreshService.jsm", "AutocryptKeyRefreshService");
const getAutocryptKeyServer = AutocryptLazy.loader("autocrypt/keyserver.jsm", "AutocryptKeyServer");
const getAutocryptTimer = AutocryptLazy.loader("autocrypt/timer.jsm", "AutocryptTimer");
const getAutocryptOverlays = AutocryptLazy.loader("autocrypt/autocryptOverlays.jsm", "AutocryptOverlays");
const getAutocryptSqlite = AutocryptLazy.loader("autocrypt/sqliteDb.jsm", "AutocryptSqliteDb");
const getAutocryptCryptoAPI = AutocryptLazy.loader("autocrypt/cryptoAPI.jsm", "AutocryptCryptoAPI");
const getAutocryptMasterpass = AutocryptLazy.loader("autocrypt/masterpass.jsm", "AutocryptMasterpass");
const Services = ChromeUtils.import("resource://gre/modules/Services.jsm").Services;

var EXPORTED_SYMBOLS = ["AutocryptCore"];

var gOverwriteEnvVar = [];
var gAutocryptService = null; // Global Autocrypt Service

var AutocryptCore = {
  /**
   * Create a new instance of Autocrypt, or return the already existing one
   */
  createInstance: function() {
    if (!gAutocryptService) {
      gAutocryptService = new Autocrypt();
    }

    return gAutocryptService;
  },

  startup: async function(reason) {
    initializeLogDirectory();

    getAutocryptLog().DEBUG("core.jsm: startup()\n");

    let autocryptOverlays = getAutocryptOverlays();

    await getAutocryptSqlite().checkDatabaseStructure();
    getAutocryptPrefs().startup(reason);

    let self = this;
    this.factories = [];

    async function continueStartup() {
      getAutocryptLog().DEBUG("core.jsm: startup.continueStartup()\n");

      try {
        let mimeEncrypt = getAutocryptMimeEncrypt();
        mimeEncrypt.startup(reason);
        autocryptOverlays.startupCore(reason);
        self.factories.push(new Factory(getAutocryptProtocolHandler()));
        self.factories.push(new Factory(mimeEncrypt.Handler));

        getAutocryptMasterpass().ensureAutocryptPassword();

        // Wait for TB Startup to be complete to initialize window overlays
        // For some reason, we are sometimes missing this callback..
        getAutocryptTimer().setTimeout(autocryptOverlays.mailStartupDoneBackup, 1000);
        // Services.obs.addObserver(autocryptOverlays.mailStartupDone, "mail-startup-done", false);

        /*
          let win = getAutocryptWindows().getBestParentWin();
          getAutocryptLog().DEBUG("core.jsm: getService: show settings");
          getAutocryptWindows().openAutocryptSettings(win);
        */
        /*
        let win = getAutocryptWindows().getBestParentWin();
        let args = {
          recipients: [
            'look@my.amazin.horse',
            'nope@nope.com',
            'vincent@cotech.de'
          ]
        };
        win.openDialog("chrome://autocrypt/content/ui/dialogMissingKeys.xul", "",
          "chrome,dialog,modal,centerscreen,resizable,titlebar", args);
        */

        // getAutocryptSqlite().autocryptUpdateKey('look@my.amazin.horse', new Date(), null, null, true);

        // perform initialization of the service
        self.getService();

        getAutocryptLog().DEBUG("core.jsm: startup.continueStartup: ok\n");
      } catch (ex) {
        getAutocryptLog().DEBUG("core.jsm: startup.continueStartup: error " + ex.message + "\n" + ex.stack + "\n");
      }
    }

    getAutocryptVerify().registerContentTypeHandler();
    await continueStartup();
  },

  shutdown: function(reason) {
    getAutocryptLog().DEBUG("core.jsm: shutdown():\n");

    if (this.factories) {
      for (let fct of this.factories) {
        fct.unregister();
      }
    }

    getAutocryptVerify().unregisterContentTypeHandler();

    getAutocryptSqlite().clearCachedConnections();

    getAutocryptLocale().shutdown();
    getAutocryptLog().DEBUG("core.jsm: shutdown(): ok (except log)\n");
    getAutocryptLog().onShutdown();

    getAutocryptLog().setLogLevel(3);
    gAutocryptService = null;
  },

  version: "",

  init: function(enigmailVersion) {
    this.version = enigmailVersion;
  },

  /**
   * get and or initialize the Autocrypt service,
   * including the handling for upgrading old preferences to new versions
   *
   * @win:                - nsIWindow: parent window (optional)
   */
  getService: function(win) {
    // Lazy initialization of Autocrypt JS component (for efficiency)

    if (gAutocryptService) {
      return gAutocryptService.initialized ? gAutocryptService : null;
    }

    try {
      this.createInstance();
      return gAutocryptService.getService(win);
    } catch (ex) {
      return null;
    }

  },

  getAutocryptService: function() {
    return gAutocryptService;
  },

  setAutocryptService: function(v) {
    gAutocryptService = v;
  }
};

///////////////////////////////////////////////////////////////////////////////
// Autocrypt encryption/decryption service
///////////////////////////////////////////////////////////////////////////////

function getLogDirectoryPrefix() {
  try {
    return getAutocryptPrefs().getPrefBranch().getCharPref("logDirectory") || "";
  } catch (ex) {
    return "";
  }
}

function initializeLogDirectory() {
  const log_file = getAutocryptApp().getProfileDirectory();
  log_file.append('log_autocrypt.txt');
  getAutocryptLog().setLogLevel(5);
  getAutocryptLog().setLogFile(log_file);
  getAutocryptLog().DEBUG(`core.jsm: Logging debug output to ${log_file.path}\n`);
}

function failureOn(ex, status) {
  status.initializationError = getAutocryptLocale().getString("enigmailNotAvailable");
  getAutocryptLog().ERROR("core.jsm: Autocrypt.initialize: Error - " + status.initializationError + "\n");
  getAutocryptLog().DEBUG("core.jsm: Autocrypt.initialize: exception=" + ex.toString() + "\n");
  throw Components.results.NS_ERROR_FAILURE;
}

function Autocrypt() {
  this.wrappedJSObject = this;
}

Autocrypt.prototype = {
  initialized: false,
  initializationAttempted: false,
  initializationError: "",

  initialize: function(domWindow, version) {
    this.initializationAttempted = true;

    getAutocryptLog().DEBUG("core.jsm: Autocrypt.initialize: START\n");

    if (this.initialized) return;

    try {
      getAutocryptConsole().write("Initializing Autocrypt service ...\n");
    } catch (ex) {
      failureOn(ex, this);
    }

    // TODO fix refresh service
    // getAutocryptKeyRefreshService().start(getAutocryptKeyServer());

    this.initialized = true;

    getAutocryptLog().DEBUG("core.jsm: Autocrypt.initialize: END\n");
  },

  reinitialize: function() {
    getAutocryptLog().DEBUG("core.jsm: Autocrypt.reinitialize:\n");
    this.initialized = false;
    this.initializationAttempted = true;

    getAutocryptConsole().write("Reinitializing Autocrypt service ...\n");
    this.initialized = true;
  },

  getService: function(win) {
    if (!win) {
      win = getAutocryptWindows().getBestParentWin();
    }

    getAutocryptLog().DEBUG("core.jsm: svc = " + this + "\n");

    if (!this.initialized) {
      const firstInitialization = !this.initializationAttempted;
      const appVersion = getAutocryptApp().getVersion();

      try {
        // Initialize enigmail
        AutocryptCore.init(appVersion);
        this.initialize(win, appVersion);
      } catch (ex) {
        getAutocryptLog().DEBUG("core.jsm: getService: init failed!\n");
        return null;
      }

      if (this.initialized) {
        const configuredVersion = getAutocryptPrefs().getPref("configuredVersion");
        getAutocryptTimer().setTimeout(function() {
          getAutocryptConfigure().configureAutocrypt(configuredVersion, appVersion);
        }, 0);
      }
    }

    return this.initialized ? this : null;
  }
}; // Autocrypt.prototype


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
