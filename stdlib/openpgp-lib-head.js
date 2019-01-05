/*
 * This Source Code Form is licensed under the GNU LGPL 3.0 license.
 *
 */


/*
 * This bit of code embeds the openPGP-JS libary. This is the part that is added before
 * the library code.
 */


var EXPORTED_SYMBOLS = ["getOpenPGPLibrary"];

Components.utils.importGlobalProperties(["atob",
  "Blob",
  "btoa",
  "crypto",
  "CSS",
  "fetch",
  "File",
  "indexedDB",
  "NodeFilter",
  "rtcIdentityProvider",
  "TextDecoder",
  "TextEncoder",
  "URL",
  "URLSearchParams",
  "XMLHttpRequest"
]);

const {
  TransformStream,
  ReadableStream,
  WritableStream
} = ChromeUtils.import("chrome://enigmail/content/modules/stdlib/web-streams.jsm");

function getOpenPGPLibrary() {

  /* Prerequisites required by openpgp-lib.js */

  let setTimeout = ChromeUtils.import("resource://gre/modules/Timer.jsm").setTimeout;

  let appShellSvc = Cc["@mozilla.org/appshell/appShellService;1"].getService(Ci.nsIAppShellService);
  let userAgent = appShellSvc.hiddenDOMWindow.navigator.userAgent;

  const window = {};
  const document = {};
  const navigator = {
    userAgent: appShellSvc.hiddenDOMWindow.navigator.userAgent
  };
  window.document = document;
  window.navigator = navigator;
  window.crypto = crypto;

  const console = {
    assert: function() {},
    log: function() {},
    error: function() {},
    table: function() {},
    warn: function() {}
  };

  /* OpenPGP-LS library code will be copied below this line */
