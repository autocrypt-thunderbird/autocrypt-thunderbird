/*global Components: false, escape: false */
/*jshint -W097 */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

"use strict";

var EXPORTED_SYMBOLS = ["EnigmailWindows"];

const EnigmailLog = ChromeUtils.import("chrome://autocrypt/content/modules/log.jsm").EnigmailLog;
const EnigmailCore = ChromeUtils.import("chrome://autocrypt/content/modules/core.jsm").EnigmailCore;
const EnigmailLocale = ChromeUtils.import("chrome://autocrypt/content/modules/locale.jsm").EnigmailLocale;
const EnigmailApp = ChromeUtils.import("chrome://autocrypt/content/modules/app.jsm").EnigmailApp;
const PromiseUtils = ChromeUtils.import("resource://gre/modules/PromiseUtils.jsm").PromiseUtils;
const EnigmailStdlib = ChromeUtils.import("chrome://autocrypt/content/modules/stdlib.jsm").EnigmailStdlib;

const APPSHELL_MEDIATOR_CONTRACTID = "@mozilla.org/appshell/window-mediator;1";
const APPSHSVC_CONTRACTID = "@mozilla.org/appshell/appShellService;1";

const LOCAL_FILE_CONTRACTID = "@mozilla.org/file/local;1";
const IOSERVICE_CONTRACTID = "@mozilla.org/network/io-service;1";

var EnigmailWindows = {
  openSetupWizard: function(win, setupType) {
    EnigmailLog.DEBUG("windows.jsm: openSetupWizard()\n");

    win.open("chrome://autocrypt/content/ui/setupWizardAutocrypt.xul",
      "", "chrome,dialog,centerscreen,resizable,modal");
  },

  openAutocryptSettings: function(win) {
    EnigmailLog.DEBUG("windows.jsm: openAutocryptSettings()\n");

    if (!EnigmailStdlib.hasConfiguredAccounts()) {
      EnigmailLog.DEBUG("windows.jsm: openAutocryptSettings: no configured accounts\n");
      return;
    }

    win.open("chrome://autocrypt/content/ui/autocryptSettings.xul",
      "", "chrome,dialog,centerscreen,resizable,modal");
  },

  openManageAllKeys: function(win) {
    EnigmailLog.DEBUG("windows.jsm: openManageAllKeys()\n");

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
    EnigmailLog.DEBUG("windows.jsm: getFrame: name=" + frameName + "\n");
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
   * Display the key help window
   *
   * @source - |string| containing the name of the file to display
   *
   * no return value
   */

  openHelpWindow: function(source) {
    EnigmailWindows.openWin("enigmail:help",
      "chrome://autocrypt/content/ui/enigmailHelp.xul?src=" + source,
      "centerscreen,resizable");
  },

  /**
   * Display the "About Enigmail" window
   *
   * no return value
   */
  openAboutWindow: function() {
    EnigmailWindows.openMailTab("chrome://autocrypt/content/ui/aboutEnigmail.html");
  },

    /**
   * Open the Enigmail Documentation page in a new window
   *
   * no return value
   */
  openEnigmailDocu: function(parent) {
    if (!parent) {
      parent = this.getMostRecentWindow();
    }

    parent.open("https://enigmail.net/faq/docu.php", "", "chrome,width=600,height=500,resizable");
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
   * Display dialog to initiate the Autocrypt Setup Message.
   *
   */
  inititateAcSetupMessage: function(window) {
    if (!window) {
      window = this.getBestParentWin();
    }

    window.openDialog("chrome://autocrypt/content/ui/autocryptInitiateBackup.xul",
      "", "dialog,centerscreen");
  },

  /**
   * Open a URL in a tab on the main window. The URL can either be a web page
   * (e.g. https://enigmail.net/ or a chrome document (e.g. chrome://autocrypt/content/ui/x.xul))
   *
   * @param aURL:    String - the URL to open
   * @param winName: String - name of the window; used to identify if it is already open
   */
  openMailTab: function(aURL, windowName) {

    if (!EnigmailApp.isSuite()) {
      let tabs = EnigmailStdlib.getMail3Pane().document.getElementById("tabmail");

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
      EnigmailWindows.openWin(windowName,
        aURL, "resizable,centerscreen");
    }
  },

  shutdown: function(reason) {
    EnigmailLog.DEBUG("windows.jsm: shutdown()\n");

    let tabs = EnigmailStdlib.getMail3Pane().document.getElementById("tabmail");

    for (let i = tabs.tabInfo.length - 1; i >= 0; i--) {
      if ("openedUrl" in tabs.tabInfo[i] && tabs.tabInfo[i].openedUrl.startsWith("chrome://autocrypt/")) {
        tabs.closeTab(tabs.tabInfo[i]);
      }
    }
  }
};
