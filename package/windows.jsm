/*global Components: false, escape: false */
/*jshint -W097 */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

"use strict";

var EXPORTED_SYMBOLS = ["AutocryptWindows"];

const AutocryptLog = ChromeUtils.import("chrome://autocrypt/content/modules/log.jsm").AutocryptLog;
const AutocryptCore = ChromeUtils.import("chrome://autocrypt/content/modules/core.jsm").AutocryptCore;
const AutocryptLocale = ChromeUtils.import("chrome://autocrypt/content/modules/locale.jsm").AutocryptLocale;
const AutocryptApp = ChromeUtils.import("chrome://autocrypt/content/modules/app.jsm").AutocryptApp;
const PromiseUtils = ChromeUtils.import("resource://gre/modules/PromiseUtils.jsm").PromiseUtils;
const AutocryptStdlib = ChromeUtils.import("chrome://autocrypt/content/modules/stdlib.jsm").AutocryptStdlib;

const APPSHELL_MEDIATOR_CONTRACTID = "@mozilla.org/appshell/window-mediator;1";
const APPSHSVC_CONTRACTID = "@mozilla.org/appshell/appShellService;1";

const LOCAL_FILE_CONTRACTID = "@mozilla.org/file/local;1";
const IOSERVICE_CONTRACTID = "@mozilla.org/network/io-service;1";

var AutocryptWindows = {
  openAutocryptSettings: function(win, email) {
    AutocryptLog.DEBUG("windows.jsm: openAutocryptSettings()\n");

    if (!AutocryptStdlib.hasConfiguredAccounts()) {
      AutocryptLog.DEBUG("windows.jsm: openAutocryptSettings: no configured accounts\n");
      return;
    }

    const args = {
      email: email
    };

    win.openDialog("chrome://autocrypt/content/ui/autocryptSettings.xul",
      "", "chrome,dialog,centerscreen,resizable,modal", args);
  },

  openManageAllKeys: function(win) {
    AutocryptLog.DEBUG("windows.jsm: openManageAllKeys()\n");

    win.open("chrome://autocrypt/content/ui/manageAllKeys.xul",
      "", "chrome,dialog,centerscreen,resizable,modal");
  },

  /**
   * Open a window, or focus it if it is already open
   *
   * @winName   : String - name of the window; used to identify if it is already open
   * @spec      : String - window URL (e.g. chrome://autocrypt/content/ui/test.xul)
   * @winOptions: String - window options as defined in nsIWindow.open
   * @optObj    : any    - an Object, Array, String, etc. that is passed as parameter
   *                       to the window
   */
  openWin: function(winName, spec, winOptions, optObj) {
    var windowManager = Cc[APPSHELL_MEDIATOR_CONTRACTID].getService(Ci.nsIWindowMediator);

    var winEnum = windowManager.getEnumerator(null);
    var recentWin = null;
    while (winEnum.hasMoreElements() && !recentWin) {
      var thisWin = winEnum.getNext();
      if (thisWin.location.href == spec) {
        recentWin = thisWin;
        break;
      }
      if (winName && thisWin.name && thisWin.name == winName) {
        thisWin.focus();
        break;
      }

    }

    if (recentWin) {
      recentWin.focus();
    }
    else {
      var appShellSvc = Cc[APPSHSVC_CONTRACTID].getService(Ci.nsIAppShellService);
      var domWin = appShellSvc.hiddenDOMWindow;
      try {
        domWin.open(spec, winName, "chrome," + winOptions, optObj);
      }
      catch (ex) {
        domWin = windowManager.getMostRecentWindow(null);
        domWin.open(spec, winName, "chrome," + winOptions, optObj);
      }
    }
  },

  /**
   * Determine the best possible window to serve as parent window for dialogs.
   *
   * @return: nsIWindow object
   */
  getBestParentWin: function() {
    var windowManager = Cc[APPSHELL_MEDIATOR_CONTRACTID].getService(Ci.nsIWindowMediator);

    var bestFit = null;
    var winEnum = windowManager.getEnumerator(null);

    while (winEnum.hasMoreElements()) {
      var thisWin = winEnum.getNext();
      if (thisWin.location.href.search(/\/messenger.xul$/) > 0) {
        bestFit = thisWin;
      }
      if (!bestFit && thisWin.location.href.search(/\/messengercompose.xul$/) > 0) {
        bestFit = thisWin;
      }
    }

    if (!bestFit) {
      winEnum = windowManager.getEnumerator(null);
      bestFit = winEnum.getNext();
    }

    return bestFit;
  },

  /**
   * Iterate through the frames of a window and return the first frame with a
   * matching name.
   *
   * @win:       nsIWindow - XUL window to search
   * @frameName: String    - name of the frame to seach
   *
   * @return:    the frame object or null if not found
   */
  getFrame: function(win, frameName) {
    AutocryptLog.DEBUG("windows.jsm: getFrame: name=" + frameName + "\n");
    for (var j = 0; j < win.frames.length; j++) {
      if (win.frames[j].name == frameName) {
        return win.frames[j];
      }
    }
    return null;
  },

  getMostRecentWindow: function() {
    var windowManager = Cc[APPSHELL_MEDIATOR_CONTRACTID].getService(Ci.nsIWindowMediator);
    return windowManager.getMostRecentWindow(null);
  },

  /**
   * Display Autocrypt Setup Passwd dialog.
   *
   * @param dlgMode:       String - dialog mode: "input" / "display"
   * @param passwdType:    String - type of password ("numeric9x4" / "generic")
   * @param password:      String - password or initial two digits of password
   *
   * @return String entered password (in input mode) or NULL
   */
  autocryptSetupPasswd: function(window, dlgMode, passwdType = "numeric9x4", password) {
    if (!window) {
      window = this.getBestParentWin();
    }

    let inputObj = {
      password: null,
      passwdType: passwdType,
      dlgMode: dlgMode
    };

    if (password) inputObj.initialPasswd = password;

    window.openDialog("chrome://autocrypt/content/ui/autocryptSetupPasswd.xul",
      "", "dialog,modal,centerscreen", inputObj);

    return inputObj.password;
  },

  /**
   * Open a URL in a tab on the main window. The URL can either be a web page
   * (e.g. https://enigmail.net/ or a chrome document (e.g. chrome://autocrypt/content/ui/x.xul))
   *
   * @param aURL:    String - the URL to open
   * @param winName: String - name of the window; used to identify if it is already open
   */
  openMailTab: function(aURL, windowName) {

    if (!AutocryptApp.isSuite()) {
      let tabs = AutocryptStdlib.getMail3Pane().document.getElementById("tabmail");

      for (let i = 0; i < tabs.tabInfo.length; i++) {
        if ("openedUrl" in tabs.tabInfo[i] && tabs.tabInfo[i].openedUrl.startsWith(aURL)) {
          tabs.switchToTab(i);
          return;
        }
      }

      let gotTab = tabs.openTab("chromeTab", {
        chromePage: aURL
      });
      gotTab.openedUrl = aURL;
    }
    else {
      AutocryptWindows.openWin(windowName,
        aURL, "resizable,centerscreen");
    }
  },

  shutdown: function(reason) {
    AutocryptLog.DEBUG("windows.jsm: shutdown()\n");

    let tabs = AutocryptStdlib.getMail3Pane().document.getElementById("tabmail");

    for (let i = tabs.tabInfo.length - 1; i >= 0; i--) {
      if ("openedUrl" in tabs.tabInfo[i] && tabs.tabInfo[i].openedUrl.startsWith("chrome://autocrypt/")) {
        tabs.closeTab(tabs.tabInfo[i]);
      }
    }
  }
};
