/*global Components: false */

/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

/**
 * This module provides DNS query functionality via subprocesses.
 * Supported record types: MX
 *
 * The following tools are currently supported:
 *   Windows:    nslookup
 *   Unix/Linux: dig, kdig, host, nslookup
 */

"use strict";

var EXPORTED_SYMBOLS = ["EnigmailDns"];

const Cu = Components.utils;
const Cc = Components.classes;
const Ci = Components.interfaces;

const EnigmailCore = Cu.import("chrome://enigmail/content/modules/core.jsm").EnigmailCore;
const EnigmailLog = Cu.import("chrome://enigmail/content/modules/log.jsm").EnigmailLog;
const EnigmailOS = Cu.import("chrome://enigmail/content/modules/os.jsm").EnigmailOS;
const subprocess = Cu.import("chrome://enigmail/content/modules/subprocess.jsm").subprocess;
const EnigmailFiles = Cu.import("chrome://enigmail/content/modules/files.jsm").EnigmailFiles;

const RESTYPE_WIN_NLSOOKUP = 1;
const RESTYPE_UNIX_NLSOOKUP = 2;
const RESTYPE_DIG = 3;
const RESTYPE_HOST = 4;
const RESTYPE_NOT_AVAILABLE = 99;

var gHandler = null,
  gResolverExecutable = null;

var EnigmailDns = {
  /**
   * Perform a DNS lookup
   *
   * @param {String} recordType: The resource record type to query. Currently only MX is supported.
   * @param {String} queryName:  The name to search for, e.g. "enigmail.net"
   *
   * @return {Promise<Array{String}>}: array of server(s) handling
   *
   */
  lookup: async function(recordType, queryName) {
    EnigmailLog.DEBUG(`dns.jsm: lookup(${recordType}, ${queryName})\n`);
    if (!determineResolver()) return null;

    let dnsHandler = new gHandler(gResolverExecutable);
    return dnsHandler.execute(recordType, queryName);
  }
};

/**
 * Determine the DNS resolver tool to use (e.g. dig, nslookup)
 *
 * @return {Boolean}: true: tool found / false: no tool found
 */

function determineResolver() {
  if (!gHandler) {
    gHandler = GenericHandler;
    if (EnigmailOS.isWin32) {
      gResolverExecutable = EnigmailFiles.resolvePathWithEnv("nslookup");
      if (gResolverExecutable) {
        EnigmailLog.DEBUG(`dns.jsm: determineResolver: executable = ${gResolverExecutable.path}\n`);
        gHandler = NsLookupHandler;
      }
    }
    else {
      determineLinuxResolver();
    }

    if (!gResolverExecutable) EnigmailLog.DEBUG(`dns.jsm: determineResolver: no executable found\n`);

  }

  return gHandler !== GenericHandler;
}


function determineLinuxResolver() {
  EnigmailLog.DEBUG(`dns.jsm: determineLinuxResolver()\n`);
  const services = [{
    exe: "dig",
    class: DigHandler
  }, {
    exe: "kdig",
    class: DigHandler
  }, {
    exe: "host",
    class: HostHandler
  }, {
    exe: "nslookup",
    class: NsLookupHandler
  }];

  for (let i of services) {
    gResolverExecutable = EnigmailFiles.resolvePathWithEnv(i.exe);
    if (gResolverExecutable) {
      EnigmailLog.DEBUG(`dns.jsm: determineLinuxResolver: found ${i.class.handlerType}\n`);

      gHandler = i.class;
      return;
    }
  }
}


class GenericHandler {
  constructor(handlerFile) {
    this._handlerFile = handlerFile;
    this.recordType = "";
    this.hostName = "";
  }

  getCmdArgs() {
    return [];
  }

  execute(recordType, hostName) {
    return new Promise((resolve, reject) => {

      this.recordType = recordType;
      this.hostName = hostName;
      let args = this.getCmdArgs();

      if (args.length === 0) {
        resolve([]);
        return;
      }

      let stdoutData = "",
        stderrData = "";
      let self = this;

      EnigmailLog.DEBUG(`dns.jsm: execute(): launching ${EnigmailFiles.formatCmdLine(this._handlerFile, args)}\n`);

      subprocess.call({
        command: this._handlerFile,
        arguments: args,
        environment: EnigmailCore.getEnvList(),
        charset: null,
        stdout: function(data) {
          //EnigmailLog.DEBUG(`dns.jsm: execute.stdout: got data ${data}\n`);
          stdoutData += data;
        },
        stderr: function(data) {
          //EnigmailLog.DEBUG(`dns.jsm: execute.stderr: got data ${data}\n`);
          stderrData += data;
        },
        done: function(result) {
          EnigmailLog.DEBUG(`dns.jsm: execute.done(${result.exitCode})\n`);
          try {
            if (result.exitCode === 0) {
              resolve(self.parseResult(stdoutData));
            }
            else {
              resolve([]);
            }
          }
          catch (ex) {
            reject(ex);
          }
        },
        mergeStderr: false
      });
    });
  }

  parseResult() {
    return [];
  }
}


class DigHandler extends GenericHandler {
  constructor(handlerFile) {
    super(handlerFile);
    this.handlerType = "dig";
  }

  getCmdArgs() {
    return ["-t", this.recordType, "+short", this.hostName];
  }

  parseResult(stdoutData) {
    let hosts = [];
    let lines = stdoutData.split(/[\r\n]+/);

    if (this.recordType.toUpperCase() === "MX") {
      for (let i = 0; i < lines.length; i++) {
        let m = lines[i].match(/^(\d+ )(.*)\./);

        if (m && m.length >= 3) hosts.push(m[2]);
      }
    }

    return hosts;
  }

}

class HostHandler extends GenericHandler {
  constructor(handlerFile) {
    super(handlerFile);
    this.handlerType = "host";
  }

  getCmdArgs() {
    return ["-t", this.recordType, this.hostName];
  }

  parseResult(stdoutData) {
    if (stdoutData.search(/3\(NXDOMAIN\)/) >= 0) return [];

    let hosts = [];
    let lines = stdoutData.split(/[\r\n]+/);

    if (this.recordType.toUpperCase() === "MX") {
      for (let i = 0; i < lines.length; i++) {
        let m = lines[i].match(/^(.* )([^ ]+)\.$/);

        if (m && m.length >= 3) hosts.push(m[2]);
      }
    }

    return hosts;
  }
}

class NsLookupHandler extends GenericHandler {
  constructor(handlerFile) {
    super(handlerFile);
    this.handlerType = "nslookup";
  }

  getCmdArgs() {
    return ["-type=" + this.recordType, this.hostName];
  }

  parseResult(stdoutData) {
    let hosts = [];
    let lines = stdoutData.split(/[\r\n]+/);

    if (lines.length > 3 && lines[3].search(/: NXDOMAIN/) > 0) return [];

    if (this.recordType.toUpperCase() === "MX") {
      let reg = new RegExp("^" + this.hostName.toLowerCase() + "(.* )([^ \t]+.*[^\.])\\.?$");
      for (let i = 2; i < lines.length; i++) {
        let m = lines[i].match(reg);

        if (m && m.length >= 3) hosts.push(m[2]);
        if (lines[i].length < 5) break;
      }
    }
    return hosts;
  }
}
