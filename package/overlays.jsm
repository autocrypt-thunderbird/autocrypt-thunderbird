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
 * Event listeners registering to listen for a "load" event now need to listen to "load-"+ addonID
 */

"use strict";

var EXPORTED_SYMBOLS = ["Overlays"];

const {
  Services
} = ChromeUtils.import("resource://gre/modules/Services.jsm", {});

Cu.importGlobalProperties(["XMLHttpRequest"]);


function DEBUG_LOG(str) {
  //dump("overlays.jsm: " + str + "\n");
}

function ERROR_LOG(str) {
  Cu.reportError("overlays.jsm: " + str + "\n");
}

const gWindowListeners = {};

var Overlays = {
  loadOverlays: function(addonID, targetWindow, listOfXul) {
    return mergeXulFiles(addonID, targetWindow, listOfXul);
  },

  unloadOverlays: function(addonID, targetWindow) {
    let document = targetWindow.document;

    // unload UI elements
    let s = document.querySelectorAll("[overlay_source='" + addonID + "']");

    for (let i = 0; i < s.length; i++) {
      let p = s[i].parentNode;
      p.removeChild(s[i]);
    }

    let e = new Event("unload-" + addonID);
    targetWindow.dispatchEvent(e);

    // unload CSS
    s = document.querySelectorAll("overlayed_css[source='" + addonID + "']");
    for (let i = 0; i < s.length; i++) {
      unloadCSS(s[i].getAttribute("href"), targetWindow);

      let p = s[i].parentNode;
      p.removeChild(s[i]);
    }
  }
};

/**
 * Load XUL into window
 * @param srcUrl:   String - URL of XUL to load
 * @param window:   Object - target window
 * @param document: Object - document in target window
 * @param callback: function(result) - called when XUL file is inserted.
 *                        result: Number - 0 for no error, other values for error
 */

function insertXul(addonId, srcUrl, window, document, callback) {

  function injectDOM(xul) {
    function $(id) {
      return document.getElementById(id);
    }

    function $$(q) {
      return document.querySelector(q);
    }

    function getToolbarNthTag(toolbar, tagName, elemIndex) {
      if (elemIndex >= 0) {
        let s = new RegExp("^" + tagName + "[0-9]+$");
        let node = toolbar.firstChild;
        let n = -1;
        while (node) {
          if (node.id.search(s) === 0) n++;
          if (n == elemIndex) return node;
          node = node.nextSibling;
        }
      }

      return null;
    }

    /**
     * get toolbar element for separator, spacer and spring
     */
    function getToolbarElem(toolbar, currentset, index) {
      if (currentset[index] && (currentset[index].search(/^(separator|spacer|spring)$/) === 0)) {
        let target = currentset[index];
        let foundIndex = -1;
        // find the n-th separator/spacer/spring
        for (let i = 0; i < index + 1; i++) {
          if (currentset[i] === target) ++foundIndex;
        }

        return getToolbarNthTag(toolbar, target, foundIndex);
      }
      return null;
    }

    /**
     * Add a button at the correct place on a toolbar.
     * Buttons are always added to the toolbar palette. Whether or not the button is added to the
     * toolbar depends on:
     * 1. if it's in the currentset of the toolbar (i.e. added previously)
     * 2. if it's defined a default button and the button has never been added to the toolbar before
     *
     * @param palette:      Object - the toolbar palette containing all buttons (also invisible ones)
     * @param toolbarButton Object - the button to add
     * @param toolbarId     String - the ID of the toolbar where the button shall be added
     *
     */
    function addToolbarButton(palette, toolbarButton, toolbarId) {
      DEBUG_LOG("adding button '" + toolbarButton.id + " to " + toolbarId + "'");

      let toolbar = $(toolbarId);
      let buttonId = toolbarButton.id;
      let firstRun = false;

      let currentset = toolbar.getAttribute("currentset").split(/,/);
      if (toolbar.getAttribute("currentset").length === 0) {
        currentset = toolbar.getAttribute("defaultset").split(/,/);
      }

      toolbarButton.setAttribute("overlay_source", addonId);
      palette.appendChild(toolbarButton);

      let index = currentset.indexOf(buttonId);
      if (index >= 0) {
        // button was added before
        let before = null;

        for (let i = index + 1; i < currentset.length; i++) {
          if (currentset[i].search(/^(separator|spacer|spring)$/) < 0) {
            before = $(currentset[i]);
          }
          else {
            before = getToolbarElem(toolbar, currentset, i);
          }
          if (before) break;
        }

        toolbar.insertItem(buttonId, before);
      }
    }


    // loadOverlay for the poor
    function addNode(target, node) {
      // helper: insert according to position
      function insertX(nn, attr, callbackFunc) {
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
          if (callbackFunc) callbackFunc(pn);
          return true;
        }
        return false;
      }

      node.setAttribute("overlay_source", addonId);

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

    if (document.location)
      DEBUG_LOG("injectDOM: gonna stuff: " + srcUrl + " into: " + document.location.href);

    try {
      let rootNode = null;

      for (let n = document.documentElement.firstChild; n; n = n.nextSibling) {
        if (n.nodeType == n.ELEMENT_NODE) {
          rootNode = n;
          break;
        }
      }
      if (!rootNode) {
        ERROR_LOG("injectDOM: no root node found");
      }

      // Add all overlays
      for (let i in xul) {
        let target;

        if (xul[i].hasAttribute("id")) {
          target = $(xul[i].id);
        }
        else if (xul[i].hasAttribute("overlay_target")) {
          target = $$(xul[i].getAttribute("overlay_target"));
          if (target && !target.hasAttribute("id")) {
            target.id = addonId + "_overlay_" + i;
          }
        }
        else {
          target = rootNode;
        }

        if (xul[i].tagName === "toolbarpalette") {
          let toolboxId = xul[i].getAttribute("targetToolbox");
          let toolbarId = xul[i].getAttribute("targetToolbar");
          let defaultSet = xul[i].getAttribute("targetToolbarDefaultset");
          if (!toolboxId) {
            DEBUG_LOG("injectDOM: cannot overlay toolbarpalette: no target toolbox defined");
            continue;
          }
          if (!toolbarId) {
            DEBUG_LOG("injectDOM: cannot overlay toolbarpalette: no target toolbar defined");
            continue;
          }

          if (defaultSet) {
            let toolbar = $(toolbarId);
            if (toolbar) {
              toolbar.setAttribute("defaultset", defaultSet);
            }
          }

          let toolbox = $(toolboxId);
          let palette = toolbox.palette;
          let c = xul[i].children;

          while (c.length > 0) {
            // added toolbar buttons are removed from the palette's children
            if (c[0].tagName && c[0].tagName === "toolbarbutton") {
              addToolbarButton(palette, c[0], toolbarId);
            }
          }
        }
        else if (!target) {
          DEBUG_LOG("injectDOM: no target for " + xul[i].tagName + ", not inserting");
          continue;
        }

        // insert all children
        for (let n of xul[i].children) {
          if (n.nodeType != n.ELEMENT_NODE) {
            continue;
          }
          let nn = addNode(target, n);
        }
      }
    }
    catch (ex) {
      ERROR_LOG("insertXul: injectDOM: failed to inject xul " + ex.message);
    }
  }

  DEBUG_LOG("insertXul(" + srcUrl + ")");

  let xmlReq = new XMLHttpRequest();

  xmlReq.onload = function() {
    DEBUG_LOG("loaded: " + srcUrl + "\n");
    let document = xmlReq.responseXML;

    // clean the document a bit
    let emptyNodes = document.evaluate(
      "//text()[normalize-space(.) = '']", document, null, 7, null);
    for (let i = 0, e = emptyNodes.snapshotLength; i < e; ++i) {
      let n = emptyNodes.snapshotItem(i);
      n.parentNode.removeChild(n);
    }

    // prepare all elements to be inserted
    let xul = [];
    let foundElement = false;
    for (let n = document.documentElement.firstChild; n; n = n.nextSibling) {
      if (n.nodeType != n.ELEMENT_NODE) {
        continue;
      }
      if (n.tagName === "script" || n.tagName === "link") {
        foundElement = true;
        continue;
      }

      foundElement = true;
      xul.push(n);
    }
    if (!foundElement) {
      ERROR_LOG("insertXul: No element to overlay found. Maybe a parsing error?\n");
      return;
    }

    injectDOM(xul);

    // load css into window
    let css = document.getElementsByTagName("link");
    for (let i = 0; i < css.length; i++) {
      let rel = css[i].getAttribute("rel");
      if (rel && rel === "stylesheet") {
        loadCss(addonId, css[i].getAttribute("href"), window);
      }
    }

    // load scripts into window
    let sc = document.getElementsByTagName("script");
    for (let i = 0; i < sc.length; i++) {
      let src = sc[i].getAttribute("src");
      if (src) {
        loadScript(src, window);
      }
    }

    if (callback) {
      callback(0);
    }
  };

  if (typeof(srcUrl) !== "string" ||
    (srcUrl.search(/^(chrome|resource|file):\/\//) < 0)) {
    ERROR_LOG("insertXul: " + srcUrl + " is not a valid chrome/resource/file URL\n");
    callback(1);
    return;
  }

  xmlReq.onerror = xmlReq.onabort = function() {
    ERROR_LOG("insertXul: Failed to load " + srcUrl + "\n");
    callback(2);
  };

  xmlReq.overrideMimeType("application/xml");
  xmlReq.open("GET", srcUrl);

  // Elevate the request, so DTDs will work. Should not be a security issue since we
  // only load chrome, resource and file URLs, and that is our privileged chrome package.

  let sec = Cc['@mozilla.org/scriptsecuritymanager;1'].getService(Ci.nsIScriptSecurityManager);
  try {
    xmlReq.channel.owner = sec.getSystemPrincipal();
  }
  catch (ex) {
    ERROR_LOG("insertXul: Failed to set system principal\n");
    xmlReq.close();
    return;
  }

  xmlReq.send();
}

/**
 * Load one or more overlays into a window.
 *
 * @param window:         nsIDOMWindow - the target window
 * @param overlayDefsArr: Array of String - the list of overlays to load
 *
 * @return Promise (numOverlays - the number of overlays loaded)
 */
function mergeXulFiles(addonId, window, overlayDefsArr) {

  let p = new Promise((resolve, reject) => {
    function loadOverlay(window, overlayDefs, index) {
      DEBUG_LOG("loadOverlay(" + index + ")\n");

      try {
        if (index < overlayDefs.length) {
          let url = overlayDefs[index];
          let document = window.document;

          let observer = function(result) {
            loadOverlay(window, overlayDefs, index + 1);
          };

          insertXul(addonId, url, window, document, observer);
        }
        else {
          DEBUG_LOG("loadOverlay: completed");

          let e = new Event("load-" + addonId);
          window.dispatchEvent(e);
          DEBUG_LOG("loadOverlay: event completed");

          resolve(index);
        }
      }
      catch (ex) {
        ERROR_LOG("mergeXulFiles: could not overlay for " + window.document.location.href + ":\n" + ex.message + "\n");
        reject(index);
      }
    }

    loadOverlay(window, overlayDefsArr, 0);
  });

  return p;
}


function unloadCSS(url, targetWindow) {
  let domWindowUtils = targetWindow.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIDOMWindowUtils);
  domWindowUtils.removeSheetUsingURIString(url, 1);
}

function loadCss(addonId, url, targetWindow) {
  DEBUG_LOG("loadCss(" + url + ")");

  try {
    let domWindowUtils = targetWindow.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIDOMWindowUtils);
    domWindowUtils.loadSheetUsingURIString(url, 1);
    let document = targetWindow.document;
    let e = document.createElement("overlayed_css");
    e.setAttribute("href", url);
    e.setAttribute("source", addonId);

    let node = document.firstChild;
    while (node && (!node.tagName)) {
      node = node.nextSibling;
    }
    if (node) node.appendChild(e);
  }
  catch (ex) {
    ERROR_LOG("loadCss: Error with loading CSS " + url + ":\n" + ex.message + "\n");
  }
}

function loadScript(url, targetWindow) {
  let loader = Cc["@mozilla.org/moz/jssubscript-loader;1"].getService(Ci.mozIJSSubScriptLoader);

  try {
    loader.loadSubScript(url, targetWindow);
  }
  catch (ex) {
    ERROR_LOG("loadScript: Error with loading script " + url + ":\n" + ex.message + "\n");
  }
}
