/*
 * This Source Code Form is licensed under the GNU LGPL 3.0 license.
 *
 */

"use strict";

/**
 * This code is taken from openpgp.js
 *
 * Do OpenPGP packet parsing
 */

/* global Components: false */
/* eslint no-invalid-this: 0 */

var EXPORTED_SYMBOLS = ["EnigmailOpenPGP"];


const Cu = Components.utils;
const Cc = Components.classes;
const Ci = Components.interfaces;


var appShellSvc = Cc["@mozilla.org/appshell/appShellService;1"].getService(Ci.nsIAppShellService);

var window = appShellSvc.hiddenDOMWindow;
var document = window.document;

Components.utils.import("resource://gre/modules/Services.jsm"); /* global Services: false */

Services.scriptloader.loadSubScript("resource://enigmail/stdlib/openpgp-lib.js", this, "UTF-8"); /* global openpgp: false */


var EnigmailOpenPGP = window.openpgp;
