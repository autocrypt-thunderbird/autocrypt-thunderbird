/*
 * ipc.js: Helper functions for ipctest.js and buftest.js
 *
 * The contents of this file are subject to the Mozilla Public
 * License Version 1.1 (the "MPL"); you may not use this file
 * except in compliance with the MPL. You may obtain a copy of
 * the MPL at http://www.mozilla.org/MPL/
 *
 * Software distributed under the MPL is distributed on an "AS
 * IS" basis, WITHOUT WARRANTY OF ANY KIND, either express or
 * implied. See the MPL for the specific language governing
 * rights and limitations under the MPL.
 *
 * The Original Code is protoZilla.
 *
 * The Initial Developer of the Original Code is Ramalingam Saravanan.
 * Portions created by Ramalingam Saravanan <svn@xmlterm.org> are
 * Copyright (C) 2001 Ramalingam Saravanan. All Rights Reserved.
 *
 * Contributor(s):
 * Patrick Brunschwig <patrick@mozilla-enigmail.org>
 *
 * Alternatively, the contents of this file may be used under the
 * terms of the GNU General Public License (the "GPL"), in which case
 * the provisions of the GPL are applicable instead of
 * those above. If you wish to allow use of your version of this
 * file only under the terms of the GPL and not to allow
 * others to use your version of this file under the MPL, indicate
 * your decision by deleting the provisions above and replace them
 * with the notice and other provisions required by the GPL.
 * If you do not delete the provisions above, a recipient
 * may use your version of this file under either the MPL or the
 * GPL.
*/

const NS_IPCSERVICE_CONTRACTID =
      "@mozilla.org/process/ipc-service;1";

const NS_PROCESSINFO_CONTRACTID =
      "@mozilla.org/xpcom/process-info;1";

var ipcService = Components.classes[NS_IPCSERVICE_CONTRACTID].getService(Components.interfaces.nsIIPCService);

var processInfo = Components.classes[NS_PROCESSINFO_CONTRACTID].getService(Components.interfaces.nsIProcessInfo);

var gShell = null;
var gShellParam = null;

function write(args) {
  for (var j=0; j<arguments.length; j++) {
    dump(arguments[j].toString());
  }
}

function writeln(args) {
  for (var j=0; j<arguments.length; j++) {
    dump(arguments[j].toString());
  }
  dump("\n");
}

function getPlatform() {
  var ioServ = Components.classes["@mozilla.org/network/io-service;1"].getService(Components.interfaces.nsIIOService);

  var httpHandler = ioServ.getProtocolHandler("http");
  httpHandler = httpHandler.QueryInterface(Components.interfaces.nsIHttpProtocolHandler);

  return httpHandler.platform;
}

function getEnv(name) {
  if (!processInfo) {
    ERROR_LOG("ipc.js:getEnv: ProcessInfo not available\n");
    throw Components.results.NS_ERROR_FAILURE;
  }

  var value = processInfo.getEnv(name);
  return value ? value : "";
}

function runSh(command) {
  if (!ipcService) {
    ERROR_LOG("ipc.js:exec: IPCService not available\n");
    throw Components.results.NS_ERROR_FAILURE;
  }

  DEBUG_LOG("ipc.js:runSh: command="+command+"\n");

  return ipcService.run(gShell, [gShellParam, command], 2);
}

var gLogLevel = 3;     // Output only errors/warnings by default

var nspr_log_modules = getEnv("NSPR_LOG_MODULES");

var matches = nspr_log_modules.match(/ipcservice:(\d+)/);

if (matches && (matches.length > 1)) {
    gLogLevel = matches[1];
    WARNING_LOG("ipc.js: gLogLevel="+gLogLevel+"\n");
}

function WRITE_LOG(str) {
  dump(str);
}

function DEBUG_LOG(str) {
  if (gLogLevel >= 4)
    WRITE_LOG(str);
}

function WARNING_LOG(str) {
  if (gLogLevel >= 3)
    WRITE_LOG(str);
}

function ERROR_LOG(str) {
  if (gLogLevel >= 2)
    WRITE_LOG(str);
}

function CONSOLE_LOG(str) {
  if (gLogLevel >= 3)
    WRITE_LOG(str);

  if (ipcService)
    ipcService.console.write(str);
}

function initIpcTest() {
  var pf = getPlatform();
  var shell = "";
  if ((pf.search(/Win/i) == 0) || (pf.search(/OS\/2/i) == 0)) {
    // Windows, OS/2
    shell="C:\\Windows\\command\\cmd.exe";
    gShellParam="/c";
  }
  else {
    // Unix-like systems
    shell="/bin/sh";
    gShellParam="-c";
  }

  var localfile= Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
  localfile.initWithPath(shell);
  gShell = localfile.QueryInterface(Components.interfaces.nsIFile);
}

initIpcTest();

DEBUG_LOG("ipc.js loaded.\n");
