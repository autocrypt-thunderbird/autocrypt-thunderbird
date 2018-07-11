/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

/**
 * Load overlays in a similar way as XUL did for non-bootstrapped addons
 * Unlike "real" XUL, overlays are only loaded over window URLs, and no longer
 * over any XUL file that is loaded somewhere.
 *
 *
 * 1. Prepare your XUL files:
 *
 * If you add buttons to a toolbar using <toolbarpalette/> in your XUL, add the
 * following attributes to the toolbarpalette:
 *   targetToolbox="some_id"   --> the ID of the *toolbox* where the buttons are added
 *   targetToolbar="some_id"   --> the ID of the *toolbar* where the buttons are added
 *
 * 2. Prepare your JavaScript:
 *
 * Event listeners registering to listen for a "load" event now need to listen to "load-"+ addonID
 */

/* eslint no-invalid-this: 0 */

/* global ConsoleAPI: false, Services: false */

"use strict";

var EXPORTED_SYMBOLS = ["Overlays"];

const Cu = Components.utils;
const Cc = Components.classes;
const Ci = Components.interfaces;

Cu.import("resource://gre/modules/Console.jsm");
Cu.import("resource://gre/modules/Services.jsm");

Cu.importGlobalProperties(["XMLHttpRequest"]);

let oconsole = new ConsoleAPI({
  prefix: "Overlays.jsm",
  consoleID: "overlays-jsm",
  maxLogLevel: "warn" // "all"
});

var Overlays = {
  /**
   * Load one or more overlays into a window.
   *
   * @param {String} addonID            The ID of the addon (e.g. "addon@example.com")
   * @param {DOMWindow} targetWindow    The target window where to merge XUL files
   * @param {String[]} listOfXul        The list of overlays (URLs) to load
   *
   * @return {Promise<Number>}          Promise resolving with the number of overlays loaded
   */
  async loadOverlays(addonID, targetWindow, listOfXul) {
      let document = targetWindow.document;
      let deferredLoad = [];
      for (let url of listOfXul) {
        oconsole.log(`loadOverlay(${url})`);
        // TODO can we do this in parallel?
        deferredLoad.push(...await insertXul(addonID, url, targetWindow, document));
      }


      if (document.readyState == "complete") {
        let fakeEvent = new targetWindow.UIEvent("load", {
          view: targetWindow
        });
        for (let listener of deferredLoad) {
          if (typeof listener == "function") {
            listener(fakeEvent);
          }
          else if (listener && typeof listener == "object") {
            listener.handleEvent(fakeEvent);
          }
        }
      }
      else {
        for (let listener of deferredLoad) {
          targetWindow.addEventListener("load", listener);
        }
      }

      oconsole.log("loadOverlay: completed");

      let e = new Event("load-" + addonID);
      targetWindow.dispatchEvent(e);
      oconsole.log("loadOverlay: event completed");

      return listOfXul.length;
    },

    /**
     * Unload overlays from a window, e.g. if an addon is disabled.
     * UI elements and CSS added by loadOverlays() are removed with this function.
     * JavaScript needs to be unloaded manually.
     *
     * @param {String} addonID            The ID of the addon (e.g. "addon@example.com")
     * @param {DOMWindow} targetWindow    The target window where to merge XUL files
     */
    unloadOverlays(addonID, targetWindow) {
      let document = targetWindow.document;

      // unload UI elements
      let sources = document.querySelectorAll(`[overlay_source='${addonID}']`);
      for (let node of sources) {
        node.remove();
      }

      let event = new Event("unload-" + addonID);
      targetWindow.dispatchEvent(event);

      // unload CSS
      sources = document.querySelectorAll(`overlayed_css[source='${addonID}']`);
      for (let node of sources) {
        unloadCSS(node.getAttribute("href"), targetWindow);
        node.remove();
      }
    }
};


// ////////////////////////////////////////////////////////////////////////////////////// //
// Private functions                                                                      //
// ////////////////////////////////////////////////////////////////////////////////////// //

/**
 * Fetches the xul overlay from srcUrl.
 *
 * @param {String} srcUrl                   The source url to fetch
 * @return {Promise<XMLHttpRequest>}        The XHR loaded with the results
 */
function fetchOverlay(srcUrl) {
  return new Promise((resolve, reject) => {
    let xhr = new XMLHttpRequest();
    xhr.onload = () => {
      resolve(xhr);
    };
    xhr.onerror = xhr.onabort = (e) => {
      reject(e);
    };

    xhr.overrideMimeType("application/xml");
    xhr.open("GET", srcUrl);

    // Elevate the request, so DTDs will work. Should not be a security issue since we
    // only load chrome, resource and file URLs, and that is our privileged chrome package.
    try {
      xhr.channel.owner = Services.scriptSecurityManager.getSystemPrincipal();
    }
    catch (ex) {
      oconsole.error("insertXul: Failed to set system principal");
      xhr.close();
      reject("Failed to set system principal");
      return;
    }

    xhr.send();
  });
}



/**
 * Load XUL into window
 *
 * @param {String} addonID      The addon loading these overlays
 * @param {String} srcUrl       URL of XUL to load
 * @param {DOMWindow} window    Target window
 * @param {Document} document   Document in target window
 * @return {Promise}            Promise resolving when document is completed
 */
async function insertXul(addonID, srcUrl, window, document) {
  function injectDOM(xul) {
    function $(id) {
      return document.getElementById(id);
    }

    function $$(q) {
      return document.querySelector(q);
    }

    function getToolbarNthTag(toolbar, tagName, elemIndex) {
      if (elemIndex >= 0) {
        let s = new RegExp(`^${tagName}[0-9]+$`);
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
      oconsole.log(`adding button '${toolbarButton.id}' to '${toolbarId}'`);

      let toolbar = $(toolbarId);
      let buttonId = toolbarButton.id;

      let currentset = toolbar.getAttribute("currentset").split(/,/);
      if (toolbar.getAttribute("currentset").length === 0) {
        currentset = toolbar.getAttribute("defaultset").split(/,/);
      }

      toolbarButton.setAttribute("overlay_source", addonID);
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

          if (before) {
            break;
          }
        }

        toolbar.insertItem(buttonId, before);
      }
    }


    // loadOverlay for the poor
    function addNode(target, node) {
      // helper: insert according to position
      function insertX(nn, attr) {
        if (!nn.hasAttribute(attr)) {
          return null;
        }
        let places = nn.getAttribute(attr)
          .split(",")
          .map(p => p.trim())
          .filter(p => Boolean(p));
        for (let p of places) {
          let pn = $$(`#${target.id} > #${p}`);
          if (!pn) {
            continue;
          }
          return pn;
        }
        return null;
      }

      node.setAttribute("overlay_source", addonID);

      // bring the node to be inserted into the document
      let nn = document.importNode(node, true);

      let pn = insertX(nn, "insertafter");
      if (pn) {
        pn.parentNode.insertBefore(nn, pn.nextSibling);
      }
      else {
        pn = insertX(nn, "insertbefore");
        if (pn) {
          pn.parentNode.insertBefore(nn, pn);
        }
        else {
          target.appendChild(nn);
        }
      }

      return nn;
    }

    if (document.location) {
      oconsole.log(`injectDOM: gonna stuff: ${srcUrl} into: ${document.location.href}`);
    }

    try {
      let anonymousTargetId = 0;
      let rootNode = document.documentElement.firstElementChild;
      if (!rootNode) {
        oconsole.error("injectDOM: no root node found");
      }

      // Add all overlays
      for (let node of xul) {
        let target;

        if (node.hasAttribute("id")) {
          target = $(node.id);
        }
        else if (node.hasAttribute("overlay_target")) {
          target = $$(node.getAttribute("overlay_target"));
          if (target && !target.hasAttribute("id")) {
            target.id = `${addonID}_overlay_${anonymousTargetId++}`;
          }
        }
        else {
          target = rootNode;
        }

        if (node.tagName === "toolbarpalette") {
          let toolboxId = node.getAttribute("targetToolbox");
          let toolbarId = node.getAttribute("targetToolbar");
          let defaultSet = node.getAttribute("targetToolbarDefaultset");
          if (!toolboxId) {
            oconsole.log("injectDOM: cannot overlay toolbarpalette: no target toolbox defined");
            continue;
          }
          if (!toolbarId) {
            oconsole.log("injectDOM: cannot overlay toolbarpalette: no target toolbar defined");
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
          let c = node.children;

          while (c.length > 0) {
            // added toolbar buttons are removed from the palette's children
            if (c[0].tagName && c[0].tagName === "toolbarbutton") {
              addToolbarButton(palette, c[0], toolbarId);
            }
          }
        }
        else if (!target) {
          oconsole.log(`injectDOM: no target for ${node.tagName}, not inserting`);
          continue;
        }

        // insert all children
        for (let n of node.children) {
          addNode(target, n);
        }
      }
    }
    catch (ex) {
      oconsole.error("insertXul: injectDOM: failed to inject xul " + ex.message);
    }
  }

  oconsole.log(`insertXul(${srcUrl})`);

  if (typeof(srcUrl) !== "string" || (srcUrl.search(/^(chrome|resource|file):\/\//) < 0)) {
    oconsole.error(`insertXul ${srcUrl} is not a valid chrome/resource/file URL`);
    throw new Error(`insertXul ${srcUrl} is not a valid chrome/resource/file URL`);
  }

  let xhr = await fetchOverlay(srcUrl);

  oconsole.log(`loaded: ${srcUrl}`);
  let overlaydoc = xhr.responseXML;

  // clean the document a bit

  let emptyNodes = overlaydoc.evaluate("//text()[normalize-space(.) = '']", overlaydoc, null, 7, null);
  for (let i = 0, len = emptyNodes.snapshotLength; i < len; ++i) {
    let node = emptyNodes.snapshotItem(i);
    node.remove();
  }

  // prepare all elements to be inserted
  let xul = [];
  let scripts = [];
  let links = [];
  for (let node of overlaydoc.documentElement.children) {
    if (node.tagName == "script") {
      scripts.push(node);
    }
    else if (node.tagName == "link") {
      links.push(node);
    }
    else {
      xul.push(node);
    }
  }

  if (xul.length === 0 && links.length === 0 && scripts.length === 0) {
    oconsole.error("insertXul: No element to overlay found. Maybe a parsing error?");
    return [];
  }

  injectDOM(xul);

  // Load sheets from xml-stylesheet PI
  let stylesheets = overlaydoc.evaluate("/processing-instruction('xml-stylesheet')", overlaydoc, null, 7, null);
  for (let i = 0, len = stylesheets.snapshotLength; i < len; ++i) {
    let node = stylesheets.snapshotItem(i);
    let match = node.nodeValue.match(/href=["']([^"']*)["']/);
    if (match) {
      loadCss(addonID, match[1], window);
      oconsole.log(match[1]);
    }
  }

  // load css into window
  for (let node of links) {
    if (node.getAttribute("rel") === "stylesheet") {
      loadCss(addonID, node.getAttribute("href"), window);
    }
  }

  // load scripts into window
  let deferredLoad = [];
  for (let node of scripts) {
    let src = node.getAttribute("src");
    if (src) {
      oconsole.log("Loading script " + src);
      deferredLoad.push(...loadScriptFromUrl(src, window));
    }
    else {
      if (node.firstChild && node.firstChild.nodeName.search(/^#(text|cdata-section)$/) === 0) {
        oconsole.log("Loading inline script " + node.firstChild.wholeText.substr(0, 20));
        deferredLoad.push(...loadInlineScript(node.firstChild.wholeText, window));
      }
    }
  }

  let loadExtraOverlays = [];
  let processingInstructions = overlaydoc.evaluate("/processing-instruction('xul-overlay')", overlaydoc, null, 7, null);
  for (let i = 0, len = processingInstructions.snapshotLength; i < len; ++i) {
    let node = processingInstructions.snapshotItem(i);
    let match = node.nodeValue.match(/href=["']([^"']*)["']/);
    if (match) {
      loadExtraOverlays.push(insertXul(addonID, match[1], window, document));
      oconsole.log(match[1]);
    }
  }

  await Promise.all(loadExtraOverlays);

  return deferredLoad;
}


/**
 * Unload CSS from the given window
 *
 * @param {String} url              The url of the css to unload
 * @param {DOMWindow} targetWindow  DOM window to unload from
 */
function unloadCSS(url, targetWindow) {
  let domWindowUtils = targetWindow.QueryInterface(Ci.nsIInterfaceRequestor)
    .getInterface(Ci.nsIDOMWindowUtils);
  domWindowUtils.removeSheetUsingURIString(url, 1);
}

/**
 * Load CSS into the given window
 *
 * @param {String} addonID          The addon loading these css files
 * @param {String} url              The CSS url to load
 * @param {DOMWindow} targetWindow  THe target window to load into
 */
function loadCss(addonID, url, targetWindow) {
  oconsole.log(`loadCss(${url})`);

  try {
    let domWindowUtils = targetWindow.QueryInterface(Ci.nsIInterfaceRequestor)
      .getInterface(Ci.nsIDOMWindowUtils);
    domWindowUtils.loadSheetUsingURIString(url, 1);
    let document = targetWindow.document;
    let element = document.createElement("overlayed_css");
    element.setAttribute("href", url);
    element.setAttribute("source", addonID);

    let node = document.firstChild;
    while (node && !node.tagName) {
      node = node.nextSibling;
    }
    if (node) {
      node.appendChild(element);
    }
  }
  catch (ex) {
    oconsole.error(`loadCss: Error with loading CSS ${url}:\n${ex.message}`);
  }
}

/**
 * Load a subscript into the given window
 *
 * @param {String} url                  The URL to load
 * @param {DOMWindow} targetWindow      The window global to load into
 */
function loadScriptFromUrl(url, targetWindow) {
  let deferredLoad = [];

  let oldAddEventListener = targetWindow.addEventListener;
  targetWindow.addEventListener = function(type, listener, ...args) {
    if (type == "load") {
      deferredLoad.push(listener);
      return null;
    }
    return oldAddEventListener.call(this, type, listener, ...args);
  };

  try {
    Services.scriptloader.loadSubScript(url, targetWindow);
  }
  catch (ex) {
    oconsole.error(`loadScriptFromUrl: Error with loading script ${url}:\n${ex.message}`);
  }

  targetWindow.addEventListener = oldAddEventListener;

  // This works because we only care about immediately executed addEventListener calls and
  // loadSubScript is synchronous. Everyone else should be checking readyState anyway.
  return deferredLoad;
}

/**
 * Load a subscript into the given window
 *
 * @param {String} scriptCode           The JavaScript code to load
 * @param {DOMWindow} targetWindow      The window global to load into
 */
function loadInlineScript(scriptCode, targetWindow) {
  let deferredLoad = [];

  let oldAddEventListener = targetWindow.addEventListener;
  targetWindow.addEventListener = function(type, listener, ...args) {
    if (type == "load") {
      deferredLoad.push(listener);
      return null;
    }
    return oldAddEventListener.call(this, type, listener, ...args);
  };

  try {
    //targetWindow.eval(scriptCode);
    throw "not supported";
  }
  catch (ex) {
    oconsole.error(`loadInlineScript: Error with loading script:\n${ex.message}`);
  }

  targetWindow.addEventListener = oldAddEventListener;

  // This works because we only care about immediately executed addEventListener calls and
  // loadSubScript is synchronous. Everyone else should be checking readyState anyway.
  return deferredLoad;
}
