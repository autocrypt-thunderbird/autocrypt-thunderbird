/*
 * This Source Code Form is licensed under the GNU LGPL 3.0 license.
 *
 */

var EXPORTED_SYMBOLS = ["getOpenPGPLibrary"];

function getOpenPGPLibrary(window) {

  /* Prerequisites required by openpgp-lib.js */

  let setTimeout = ChromeUtils.import("resource://gre/modules/Timer.jsm").setTimeout;

  if (! window) {
    let appShellSvc = Cc["@mozilla.org/appshell/appShellService;1"].getService(Ci.nsIAppShellService);
    window = appShellSvc.hiddenDOMWindow;
  }

  let document = window.document;

  const console = {
    assert: function() {},
    log: function() {},
    error: function() {},
    table: function() {},
    warn: function() {}
  };
