/*global Components: false*/
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

"use strict";

var EXPORTED_SYMBOLS = ["EnigmailOverlays"];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import("resource://enigmail/constants.jsm"); /*global EnigmailConstants: false */
Cu.import("resource://enigmail/log.jsm"); /*global EnigmailLog: false */

const {
  Services, Promise
} = Cu.import("resource://gre/modules/Services.jsm", {});

const BASE_PATH = "chrome://enigmail/content/";

const overlays = {
  // "chrome://messenger/content/messenger.xul": [
  //   "chrome://enigmail/content/enigmailCheckLanguage.xul",
  //   "chrome://enigmail/content/columnOverlay.xul", {
  //     // Overlay for mailWindowOverlay on Thunderbird
  //     url: "chrome://enigmail/content/messengerOverlay-tbird.xul",
  //     application: "!{92650c4d-4b8e-4d2a-b7eb-24ecf4f6b63a}"
  //   }, {
  //     // Overlay for mailWindowOverlay on SeaMonkey
  //     url: "chrome://enigmail/content/messengerOverlay-sm.xul",
  //     application: "{92650c4d-4b8e-4d2a-b7eb-24ecf4f6b63a}"
  //   },
  //   "chrome://enigmail/content/enigmailMessengerOverlay.xul",
  //   "chrome://enigmail/content/enigmailMsgHdrViewOverlay.xul"
  // ],

  "chrome://messenger/content/messengercompose/messengercompose.xul": [
    //"chrome://enigmail/content/enigmailCheckLanguage.xul",
    "enigmailMsgComposeOverlay.xul"
  ]

  // "chrome://messenger/content/FilterEditor.xul": ["chrome://enigmail/content/enigmailFilterEditorOverlay.xul"],
  // "chrome://messenger/content/FilterListDialog.xul": ["chrome://enigmail/content/enigmailFilterListOverlay.xul"],
  // "chrome://messenger/content/msgPrintEngine.xul": ["chrome://enigmail/content/enigmailMsgPrintOverlay.xul"],
  // "chrome://messenger/content/am-identity-edit.xul": [
  //   "chrome://enigmail/content/enigmailAmIdEditOverlay.xul",
  //   "chrome://enigmail/content/enigmailEditIdentity.xul"
  // ],
  // "chrome://messenger/content/addressbook/addressbook.xul": ["chrome://enigmail/content/enigmailAbCardViewOverlay.xul"],
  // "chrome://messenger/content/addressbook/csContactsOverlay.xul": ["chrome://enigmail/content/enigmailAbCardViewOverlay.xul"],
  // "chrome://messenger/content/addressbook/abContactsPanel.xul": ["chrome://enigmail/content/enigmailAbContactsPanel.xul"],
  // "chrome://global/content/customizeToolbar.xul": ["chrome://enigmail/content/enigmailCustToolOverlay.xul"],
  // "chrome://enigmail/content/am-enigprefs.xul": ["chrome://enigmail/content/enigmailEditIdentity.xul"],
  // "chrome://enigmail/content/am-enigprefs-edit.xul": ["chrome://enigmail/content/enigmailEditIdentity.xul"],
  //
  // // Overlay for privacy preferences in Thunderbird
  // "chrome://messenger/content/preferences/privacy.xul": ["chrome://enigmail/content/enigmailPrivacyOverlay.xul"],
  //
  // // Overlay for S/Mime preferences
  // "chrome://messenger/content/am-smime.xul": ["chrome://enigmail/content/enigmail-am-smime.xul"]
};



var WindowListener = {
  setupUI: function(window, overlayDefs) {
    EnigmailLog.DEBUG("overlays.jsm: setupUI(" + window.document.location.href + ")\n");

    loadOverlay(window, overlayDefs, 0);
  },

  tearDownUI: function(window) {
    let document = window.document;

    // Take any steps to remove UI or anything from the browser window
    // document.getElementById() etc. will work here
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


var EnigmailOverlays = {
  startup: function(reason) {
    let wm = Cc["@mozilla.org/appshell/window-mediator;1"].
    getService(Ci.nsIWindowMediator);

    // Get the list of browser windows already open
    let windows = wm.getEnumerator(null);
    while (windows.hasMoreElements()) {
      let domWindow = windows.getNext().QueryInterface(Ci.nsIDOMWindow);

      for (let w in overlays) {
        // If this is a relevant window then setup its UI
        if (domWindow.document.location.href.startsWith(w))
          WindowListener.setupUI(domWindow, overlays[w]);
      }
    }

    // Wait for any new browser windows to open
    wm.addListener(WindowListener);
  },

  shutdown: function(reason) {
    // When the application is shutting down we normally don't have to clean
    // up any UI changes made
    if (reason == EnigmailConstants.APP_SHUTDOWN)
      return;

    let wm = Cc["@mozilla.org/appshell/window-mediator;1"].getService(Ci.nsIWindowMediator);

    // Get the list of browser windows already open
    let windows = wm.getEnumerator(null);
    while (windows.hasMoreElements()) {
      let domWindow = windows.getNext().QueryInterface(Ci.nsIDOMWindow);

      WindowListener.tearDownUI(domWindow);
    }

    // Stop listening for any new browser windows to open
    wm.removeListener(WindowListener);
  }
};

function getAppId() {
  return Cc["@mozilla.org/xre/app-info;1"].getService(Ci.nsIXULAppInfo).ID;
}


/**
 * Register a new overlay (XUL)
 * @param xul:      DOM-tre  - source XUL to register
 * @param window:   Object   - target window
 * @param document: Object   - document in target window
 */


/**
 * Load XUL into window
 * @param srcUrl:   String - URL of XUL to load
 * @param window:   Object - target window
 * @param document: Object - document in target window
 */

function insertXul(srcUrl, window, document, callback) {


  function injectDOM(xul) {
    function $(id) {
      return document.getElementById(id);
    }

    function $$(q) {
      return document.querySelector(q);
    }

    // loadOverlay for the poor
    function addNode(target, node) {
      // helper: insert according to position
      function insertX(nn, attr, callback) {
        if (!nn.hasAttribute(attr)) {
          return false;
        }
        let places = nn.getAttribute(attr)
          .split(',')
          .map(p => p.trim())
          .filter(p => Boolean(p));
        for (let p of places) {
          let pn = $$('#' + target.id + ' > #' + p);
          if (!pn) {
            continue;
          }
          if (callback) callback(pn);
          return true;
        }
        return false;
      }

      // bring the node to be inserted into the document
      let nn = document.importNode(node, true);

      // try to insert according to insertafter/before
      if (insertX(nn, 'insertafter',
          pn => pn.parentNode.insertBefore(nn, pn.nextSibling)) ||
        insertX(nn, 'insertbefore',
          pn => pn.parentNode.insertBefore(nn, pn))) {}
      // just append
      else {
        target.appendChild(nn);
      }
      return nn;
    }
    EnigmailLog.DEBUG("overlays.jsm: registerOverlay: gonna stuff: " + srcUrl + " into: " + document.location.href + "\n");

    try {
      // store unloaders for all elements inserted
      let unloaders = [];

      // Add all overlays
      for (let id in xul) {
        let target = $(id);
        if (!target) {
          if (xul[id].tagName === "toolbarpalette") {
            let toolboxId = xul[id].getAttribute("toolbox");
            let toolbox = $(toolboxId);
            let palette = toolbox.palette;
            let c = xul[id].children;

            for (let i = 0; i < c.length; i++) {
              if (c[i].tagName && c[i].tagName === "toolbarbutton") {
                addToolbarButton(palette, c[i]);
              }
            }
          }
          else {
            EnigmailLog.DEBUG("overlays.jsm: registerOverlay: no target for " + id + ", not inserting\n");
          }
          continue;
        }

        // insert all children
        for (let n of xul[id].children) {
          if (n.nodeType != n.ELEMENT_NODE) {
            continue;
          }
          let nn = addNode(target, n);
          unloaders.push(() => nn.parentNode.removeChild(nn));
        }
      }
      // install per-window unloader
      // if (unloaders.length) {
      //   exports.unloadWindow(window, () => unloaders.forEach(u => u()));
      // }

      if (callback) {
        callback(window, document);
      }
    }
    catch (ex) {
      EnigmailLog.ERROR("overlays.jsm: registerOverlay: failed to inject xul " + ex.toString());
    }
  }

  let xmlReq = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"].createInstance();

  xmlReq.onload = function() {
    EnigmailLog.DEBUG("loaded: " + srcUrl + "\n");
    let document = xmlReq.responseXML;

    // clean the document a bit
    let emptyNodes = document.evaluate(
      "//text()[normalize-space(.) = '']", document, null, 7, null);
    for (let i = 0, e = emptyNodes.snapshotLength; i < e; ++i) {
      let n = emptyNodes.snapshotItem(i);
      n.parentNode.removeChild(n);
    }

    // prepare all elements to be inserted
    let xul = {};
    for (let n = document.documentElement.firstChild; n; n = n.nextSibling) {
      if (n.nodeType != n.ELEMENT_NODE || !n.hasAttribute("id")) {
        continue;
      }
      let id = n.getAttribute("id");
      xul[id] = n;
    }
    if (!Object.keys(xul).length) {
      EnigmailLog.DEBUG("There is only XUL ... but there wasn't\n");
      return;
    }

    injectDOM(xul, window, document);

    // load scripts into window
    let sc = document.getElementsByTagName("script");
    for (let i = 0; i < sc.length; i++) {
      let src = sc[i].getAttribute("src");
      if (src) {
        loadScript(src, window);
      }
    }
    callback(1);
  };


  xmlReq.onerror = xmlReq.onabort = function() {
    EnigmailLog.ERROR("Failed to load " + srcUrl + "\n");
    callback(0);
  };

  xmlReq.overrideMimeType("application/xml");
  xmlReq.open("GET", BASE_PATH + srcUrl);

  // Elevate the request, so DTDs will work. Not a security issue since we
  // always load from BASE_PATH, and that is our privileged chrome package.
  // This is no different than regular overlays.

  let sec = Cc['@mozilla.org/scriptsecuritymanager;1'].getService(Ci.nsIScriptSecurityManager);
  try {
    xmlReq.channel.owner = sec.getSystemPrincipal();
  }
  catch (ex) {
    EnigmailLog.ERROR("Failed to set system principal\n");
  }

  xmlReq.send();

}

function loadOverlay(window, overlayDefs, index) {

  try {
    if (index < overlayDefs.length) {
      let overlayDef = overlayDefs[index];
      let document = window.document;
      let url = overlayDef;

      if (typeof(overlayDef) !== "string") {
        url = overlayDef.url;
        if (overlayDef.application.substr(0, 1) === "!") {
          if (overlayDef.application.indexOf(getAppId()) > 0) {
            loadOverlay(window, overlayDefs, index + 1);
            return;
          }
        }
        else if (overlayDef.application.indexOf(getAppId()) < 0) {
          loadOverlay(window, overlayDefs, index + 1);
          return;
        }
      }

      let observer = function(result) {
        loadOverlay(window, overlayDefs, index + 1);
      };

      insertXul(url, window, document, observer);
    }
    // else {
    //   let event = new Event("enigmail-window-load");
    //   window.dispatchEvent(event);
    //   EnigmailLog.DEBUG("overlays.jsm: loadOverlay: sent event\n");
    // }
  }
  catch (ex) {
    EnigmailLog.ERROR("overlays.jsm: could not overlay for " + window.document.location.href + ":\n" + ex.toString() + "\n");
  }
}



// Add Toolbar button function -- TODO Adapt for TB
function addToolbarButton(palette, toolbarButton, toolbarId) {
  // var toolbar = document.getElementById(toolbarId);

  palette.appendChild(toolbarButton);

  /*
  var currentset = toolbar.getAttribute("currentset").split(",");
  var index = currentset.indexOf(buttonId);
  if (index == -1) {
    if (firstRun) {
      // No button yet so add it to the toolbar.
      toolbar.appendChild(toolbarButton);
      toolbar.setAttribute("currentset", toolbar.currentSet);
      document.persist(toolbar.id, "currentset");
    }
  }
  else {
    // The ID is in the currentset, so find the position and
    // insert the button there.
    var before = null;
    for (var i = index + 1; i < currentset.length; i++) {
      before = document.getElementById(currentset[i]);
      if (before) {
        toolbar.insertItem(buttonId, before);
        break;
      }
    }
    if (!before) {
      toolbar.insertItem(buttonId);
    }
  } */
}


function loadScript(url, targetWindow) {
  let loader = Cc["@mozilla.org/moz/jssubscript-loader;1"].getService(Ci.mozIJSSubScriptLoader);
  //The magic happens here
  try {
    loader.loadSubScript(url, targetWindow);
  }
  catch (ex) {
    EnigmailLog.ERROR("Error while loading script " + url + ":\n" + ex.toString() + "\n");
  }
}
