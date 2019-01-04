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

function getOpenPGPLibrary(window) {

  /* Prerequisites required by openpgp-lib.js */

  let setTimeout = ChromeUtils.import("resource://gre/modules/Timer.jsm").setTimeout;

  if (!window) {
    let appShellSvc = Cc["@mozilla.org/appshell/appShellService;1"].getService(Ci.nsIAppShellService);
    window = appShellSvc.hiddenDOMWindow;
  }

  let document = window.document;
  let navigator = window.navigator;
  /*
    let TransformStream = (function(x, y) {
      return window.TransformStream;
    })();

    let WritableStream = (function(x, y) {
      return window.WritableStream;
    })();

    //const ReadableStream = window.ReadableStream;
  */

  const console = {
    assert: function() {},
    log: function() {},
    error: function() {},
    table: function() {},
    warn: function() {}
  };

  /* OpenPGP-LS library code will be copied below this line */
