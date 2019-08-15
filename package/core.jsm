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

const EnigmailLazy = ChromeUtils.import("chrome://autocrypt/content/modules/lazy.jsm").EnigmailLazy;

// load all modules lazily to avoid possible cross-reference errors
const getEnigmailConsole = EnigmailLazy.loader("autocrypt/pipeConsole.jsm", "EnigmailConsole");
const getEnigmailMimeEncrypt = EnigmailLazy.loader("autocrypt/mimeEncrypt.jsm", "EnigmailMimeEncrypt");
const getEnigmailProtocolHandler = EnigmailLazy.loader("autocrypt/protocolHandler.jsm", "EnigmailProtocolHandler");
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
const getEnigmailTimer = EnigmailLazy.loader("autocrypt/timer.jsm", "EnigmailTimer");
const getAutocryptOverlays = EnigmailLazy.loader("autocrypt/autocryptOverlays.jsm", "AutocryptOverlays");
const getEnigmailSqlite = EnigmailLazy.loader("autocrypt/sqliteDb.jsm", "EnigmailSqliteDb");
const getEnigmailCryptoAPI = EnigmailLazy.loader("autocrypt/cryptoAPI.jsm", "EnigmailCryptoAPI");
const getAutocryptMasterpass = EnigmailLazy.loader("autocrypt/masterpass.jsm", "AutocryptMasterpass");
const Services = ChromeUtils.import("resource://gre/modules/Services.jsm").Services;

var EXPORTED_SYMBOLS = ["EnigmailCore"];

var gOverwriteEnvVar = [];
var gEnigmailService = null; // Global Enigmail Service

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
    initializeLogDirectory();

    getEnigmailLog().DEBUG("core.jsm: startup()\n");

    let autocryptOverlays = getAutocryptOverlays();

    await getEnigmailSqlite().checkDatabaseStructure();
    getEnigmailPrefs().startup(reason);

    let self = this;
    this.factories = [];

    async function continueStartup() {
      getEnigmailLog().DEBUG("core.jsm: startup.continueStartup()\n");

      try {
        let mimeEncrypt = getEnigmailMimeEncrypt();
        mimeEncrypt.startup(reason);
        autocryptOverlays.startupCore(reason);
        self.factories.push(new Factory(getEnigmailProtocolHandler()));
        self.factories.push(new Factory(mimeEncrypt.Handler));

        getAutocryptMasterpass().ensureAutocryptPassword();

        // Wait for TB Startup to be complete to initialize window overlays
        // For some reason, we are sometimes missing this callback..
        getEnigmailTimer().setTimeout(autocryptOverlays.mailStartupDoneBackup, 1000);
        // Services.obs.addObserver(autocryptOverlays.mailStartupDone, "mail-startup-done", false);

        /*
          let win = getEnigmailWindows().getBestParentWin();
          getEnigmailLog().DEBUG("core.jsm: getService: show settings");
          getEnigmailWindows().openAutocryptSettings(win);
        */
        /*
        let win = getEnigmailWindows().getBestParentWin();
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

        // getEnigmailSqlite().autocryptUpdateKey('look@my.amazin.horse', new Date(), null, null, true);

        // perform initialization of the service
        self.getService();

        getEnigmailLog().DEBUG("core.jsm: startup.continueStartup: ok\n");
      } catch (ex) {
        getEnigmailLog().DEBUG("core.jsm: startup.continueStartup: error " + ex.message + "\n" + ex.stack + "\n");
      }
    }

    getEnigmailVerify().registerContentTypeHandler();
    await continueStartup();
  },

  shutdown: function(reason) {
    getEnigmailLog().DEBUG("core.jsm: shutdown():\n");

    if (this.factories) {
      for (let fct of this.factories) {
        fct.unregister();
      }
    }

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

function failureOn(ex, status) {
  status.initializationError = getEnigmailLocale().getString("enigmailNotAvailable");
  getEnigmailLog().ERROR("core.jsm: Enigmail.initialize: Error - " + status.initializationError + "\n");
  getEnigmailLog().DEBUG("core.jsm: Enigmail.initialize: exception=" + ex.toString() + "\n");
  throw Components.results.NS_ERROR_FAILURE;
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
    this.initialized = true;
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
      } catch (ex) {
        getEnigmailLog().DEBUG("core.jsm: getService: init failed!\n");
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
