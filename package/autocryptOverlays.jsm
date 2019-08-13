/*global Components: false*/
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/**
 * Load overlays in a similar way as XUL did for non-bootstrapped addons
 * Unlike "real" XUL, overlays are only loaded over window URLs, and no longer
 * over any xul file that is loaded somewhere.
 *
 *
 * Prepare the XUL files:
 *
 * 1. Elements can be referenced by ID, or by CSS selector (document.querySelector()).
 *    To use the a CSS Selector query, define the attribute "overlay_target"
 *    e.g. <vbox overlay_target=".test>...</vbox>
 *
 * 2. define CSS the same way as you would in HTML, i.e.:
 *      <link rel="stylesheet" type="text/css" href="chrome://some/cssFile.css"/>
 *
 * 3. inline scripts are not supported
 *
 * 4. if you add buttons to a toolbar using <toolbarpalette/> in your XUL, add the
 *    following attributes to the toolbarpalette:
 *      targetToolbox="some_id"   --> the ID of the *toolbox* where the buttons are added
 *      targetToolbar="some_id"   --> the ID of the *toolbar* where the buttons are added
 *
 * Prepare the JavaScript:
 * 1. Event listeners registering for "load" now need to listen to "load-"+MY_ADDON_ID
 */

"use strict";

var EXPORTED_SYMBOLS = ["AutocryptOverlays"];

const {
  classes: Cc,
  interfaces: Ci,
  utils: Cu
} = Components;

const APP_STARTUP = 1;
const APP_SHUTDOWN = 2;

const {
  Services
} = ChromeUtils.import("resource://gre/modules/Services.jsm", {});

Components.utils.importGlobalProperties(["XMLHttpRequest"]);

// the following constants need to be customized for each addon
const BASE_PATH = "chrome://autocrypt/content/ui/";
const MY_ADDON_ID = "autocrypt";

var gMailStartupDone = false;
var gCoreStartup = false;

const overlays = {
  // main mail reading window
  "chrome://messenger/content/messenger.xul": [
    "columnOverlay.xul", {
      // Overlay for Thunderbird (and other non-SeaMonkey apps)
      url: "messengerOverlay-tbird.xul",
      application: "!{92650c4d-4b8e-4d2a-b7eb-24ecf4f6b63a}"
    }, {
      // Overlay for SeaMonkey
      url: "messengerOverlay-sm.xul",
      application: "{92650c4d-4b8e-4d2a-b7eb-24ecf4f6b63a}"
    },
    "enigmailMessengerOverlay.xul",
    "enigmailMsgHdrViewOverlay.xul"
  ],

  // single message reader window
  "chrome://messenger/content/messageWindow.xul": [{
      // Overlay for Thunderbird (and other non-SeaMonkey apps)
      url: "messengerOverlay-tbird.xul",
      application: "!{92650c4d-4b8e-4d2a-b7eb-24ecf4f6b63a}"
    }, {
      // Overlay for SeaMonkey
      url: "messengerOverlay-sm.xul",
      application: "{92650c4d-4b8e-4d2a-b7eb-24ecf4f6b63a}"
    },
    "enigmailMessengerOverlay.xul",
    "enigmailMsgHdrViewOverlay.xul"
  ],

  "chrome://messenger/content/messengercompose/messengercompose.xul": [{
    // Overlay for Thunderbird (and other non-SeaMonkey apps)
    url: "enigmailMsgComposeOverlay.xul",
    application: "!{92650c4d-4b8e-4d2a-b7eb-24ecf4f6b63a}"
  }, {
    // Overlay for SeaMonkey
    url: "enigmailMsgComposeOverlay-sm.xul",
    application: "{92650c4d-4b8e-4d2a-b7eb-24ecf4f6b63a}"
  }]

  // "chrome://messenger/content/FilterEditor.xul": ["autocryptFilterEditorOverlay.xul"],
  // "chrome://messenger/content/FilterListDialog.xul": ["autocryptFilterListOverlay.xul"],
  // "chrome://messenger/content/addressbook/addressbook.xul": ["autocryptAbCardViewOverlay.xul"],
  // "chrome://autocrypt/content/ui/editSingleAccount.xul": ["autocryptEditIdentity.xul"],

  // Overlay for privacy preferences in Thunderbird
  // "chrome://messenger/content/preferences/preferencesTab.xul": ["autocryptPrivacyOverlay.xul"]

  // Overlay for Customize Toolbar (Windows, Linux)
  // "chrome://messenger/content/customizeToolbar.xul": ["autocryptCustToolOverlay.xul"], // TB 60+
  // "chrome://global/content/customizeToolbar.xul": ["autocryptCustToolOverlay.xul"], // TB <= 52.x

  // Overlay for Account Manager
  // "chrome://messenger/content/AccountManager.xul": ["accountManagerOverlay.xul"]
};

const {
  EnigmailLog
} = ChromeUtils.import("chrome://autocrypt/content/modules/log.jsm", {});
const {
  Overlays
} = ChromeUtils.import("chrome://autocrypt/content/modules/overlays.jsm", {});

function DEBUG_LOG(str) {
  EnigmailLog.DEBUG(str);
}

function ERROR_LOG(str) {
  EnigmailLog.ERROR(str);
}

var WindowListener = {
  setupUI: function(window, overlayDefs) {
    DEBUG_LOG("autocryptOverlays.jsm: setupUI(" + window.document.location.href + ")\n");
    let ovl = [];

    if (window.isAutocryptOverlaysLoaded) {
      DEBUG_LOG("autocryptOverlays.jsm: overlays for this window already loaded\n");
      return;
    }
    window.isAutocryptOverlaysLoaded = true;

    for (let index = 0; index < overlayDefs.length; index++) {
      let overlayDef = overlayDefs[index];
      let url = overlayDef;

      if (typeof(overlayDef) !== "string") {
        url = overlayDef.url;
        if (overlayDef.application.substr(0, 1) === "!") {
          if (overlayDef.application.indexOf(getAppId()) > 0) {
            continue;
          }
        } else if (overlayDef.application.indexOf(getAppId()) < 0) {
          continue;
        }
      }
      ovl.push(BASE_PATH + url);
    }

    Overlays.loadOverlays(MY_ADDON_ID, window, ovl);
  },

  tearDownUI: function(window) {
    DEBUG_LOG("autocryptOverlays.jsm: tearDownUI(" + window.document.location.href + ")\n");
    Overlays.unloadOverlays(MY_ADDON_ID, window);
  },

  // nsIWindowMediatorListener functions
  onOpenWindow: function(xulWindow) {
    // A new window has opened
    let domWindow = xulWindow.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIDOMWindow);

    // Wait for it to finish loading
    domWindow.addEventListener("load", function listener() {
      domWindow.removeEventListener("load", listener, false);

      for (let w in overlays) {
        // If this is a relevant window then setup its UI
        if (domWindow.document.location.href.startsWith(w))
          WindowListener.setupUI(domWindow, overlays[w]);
      }
    }, false);
  },

  onCloseWindow: function(xulWindow) {},

  onWindowTitleChange: function(xulWindow, newTitle) {}
};

/**
 * Determine if an overlay exists for a window, and if so
 * load it
 */

function loadUiForWindow(domWindow) {
  for (let w in overlays) {
    // If this is a relevant window then setup its UI
    if (domWindow.document.location.href.startsWith(w))
      WindowListener.setupUI(domWindow, overlays[w]);
  }
}


var AutocryptOverlays = {
  startupDone: false,

  /**
   * Called by bootstrap.js upon startup of the addon
   * (e.g. enabling, instalation, update, application startup)
   *
   */
  startup: function() {
    DEBUG_LOG("autocryptOverlays.jsm: startup()\n");

    if (this.startupDone) {
      DEBUG_LOG("autocryptOverlays.jsm: startup(): already done, skipping\n");
      return;
    }
    this.startupDone = true;

    let wm = Cc["@mozilla.org/appshell/window-mediator;1"].getService(Ci.nsIWindowMediator);

    // Wait for any new windows to open
    wm.addListener(WindowListener);

    let windows = wm.getEnumerator(null);
    while (windows.hasMoreElements()) {
      try {
        let domWindow = windows.getNext().QueryInterface(Ci.nsIDOMWindow);

        DEBUG_LOG("autocryptOverlays.jsm: startup: found window: " + domWindow.document.location.href + "\n");

        loadUiForWindow(domWindow);
      } catch (ex) {
        DEBUG_LOG("autocryptOverlays.jsm: startup: error " + ex.message + "\n");
      }
    }
  },

  /**
   * callback from mail-startup-done event. Wait for Autocrypt-core-startup to be also done
   * and then add Autocrypt UI
   */
  mailStartupDone: function() {
    DEBUG_LOG(`overlay.jsm: mailStartupDone\n`);

    gMailStartupDone = true;

    if (gCoreStartup) {
      AutocryptOverlays.startup();
    }
  },

  /**
   * callback from Autocrypt-core-startup event. Wait for mail-startup-done to be also done
   * and then add Autocrypt UI
   */
  startupCore: function(reason) {
    DEBUG_LOG(`overlay.jsm: initiating startup (core startup done ${reason})\n`);

    gCoreStartup = true;

    if (reason !== APP_STARTUP) {
      gMailStartupDone = true;
    }

    if (gMailStartupDone) {
      AutocryptOverlays.startup();
    }
  },

  /**
   * Called by bootstrap.js upon shutdown of the addon
   * (e.g. disabling, uninstalling, update, application shutdown)
   *
   * @param reason: Number - bootstrap "reason" constant
   */
  shutdown: function(reason) {
    DEBUG_LOG("overlay.jsm: initiating shutdown\n");
    // When the application is shutting down we normally don't have to clean
    // up any UI changes made
    if (reason == APP_SHUTDOWN)
      return;

    let wm = Cc["@mozilla.org/appshell/window-mediator;1"].getService(Ci.nsIWindowMediator);

    // Stop listening for any new windows to open
    wm.removeListener(WindowListener);

    // Get the list of windows already open
    let windows = wm.getEnumerator(null);
    while (windows.hasMoreElements()) {
      let domWindow = windows.getNext().QueryInterface(Ci.nsIDOMWindow);

      WindowListener.tearDownUI(domWindow);

      // If this is a window opened by the addon, then close it
      if (domWindow.document.location.href.startsWith(BASE_PATH))
        domWindow.close();
    }

    DEBUG_LOG("overlay.jsm: shutdown complete\n");
  }

};

function getAppId() {
  return Cc["@mozilla.org/xre/app-info;1"].getService(Ci.nsIXULAppInfo).ID;
}
