/*global Components: false, unescape: false */
/*jshint -W097 */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */


"use strict";

var EXPORTED_SYMBOLS = ["EnigmailGpgAgent"];

const Cu = Components.utils;

Cu.import("resource://gre/modules/ctypes.jsm"); /*global ctypes: false */
Cu.import("resource://enigmail/subprocess.jsm"); /*global subprocess: false */
Cu.import("resource://enigmail/core.jsm"); /*global EnigmailCore: false */
Cu.import("resource://enigmail/files.jsm"); /*global EnigmailFiles: false */
Cu.import("resource://enigmail/log.jsm"); /*global EnigmailLog: false */
Cu.import("resource://enigmail/prefs.jsm"); /*global EnigmailPrefs: false */
Cu.import("resource://enigmail/os.jsm"); /*global EnigmailOS: false */
Cu.import("resource://enigmail/locale.jsm"); /*global EnigmailLocale: false */
Cu.import("resource://enigmail/dialog.jsm"); /*global EnigmailDialog: false */
Cu.import("resource://enigmail/windows.jsm"); /*global EnigmailWindows: false */
Cu.import("resource://enigmail/app.jsm"); /*global EnigmailApp: false */
Cu.import("resource://enigmail/gpg.jsm"); /*global EnigmailGpg: false */
Cu.import("resource://enigmail/execution.jsm"); /*global EnigmailExecution: false */
Cu.import("resource://enigmail/passwords.jsm"); /*global EnigmailPassword: false */
Cu.import("resource://enigmail/system.jsm"); /*global EnigmailSystem: false */
Cu.import("resource://enigmail/data.jsm"); /*global EnigmailData: false */

const Cc = Components.classes;
const Ci = Components.interfaces;

const nsIEnigmail = Ci.nsIEnigmail;

const NS_LOCAL_FILE_CONTRACTID = "@mozilla.org/file/local;1";
const DIR_SERV_CONTRACTID = "@mozilla.org/file/directory_service;1";
const NS_LOCALFILEOUTPUTSTREAM_CONTRACTID = "@mozilla.org/network/file-output-stream;1";

const DEFAULT_FILE_PERMS = 0x180; // equals 0600

// Making this a var makes it possible to test windows things on linux
var nsIWindowsRegKey = Ci.nsIWindowsRegKey;

var gIsGpgAgent = -1;

const DUMMY_AGENT_INFO = "none";

function cloneOrNull(v) {
  if (v && typeof v.clone === "function") {
    return v.clone();
  }
  else {
    return v;
  }
}

function extractAgentInfo(fullStr) {
  if (fullStr) {
    return fullStr.
    replace(/[\r\n]/g, "").
    replace(/^.*\=/, "").
    replace(/\;.*$/, "");
  }
  else {
    return "";
  }
}

function getHomedirFromParam(param) {
  let i = param.search(/--homedir/);
  if (i >= 0) {
    param = param.substr(i + 9);

    let m = param.match(/^(\s*)([^\\]".+[^\\]")/);
    if (m && m.length > 2) {
      param = m[2].substr(1);
      let j = param.search(/[^\\]"/);
      return param.substr(1, j);
    }

    m = param.match(/^(\s*)([^\\]'.+[^\\]')/);
    if (m && m.length > 2) {
      param = m[2].substr(1);
      let j = param.search(/[^\\]'/);
      return param.substr(1, j);
    }

    m = param.match(/^(\s*)(\S+)/);
    if (m && m.length > 2) {
      return m[2];
    }
  }

  return null;
}

var EnigmailGpgAgent = {
  agentType: "",
  agentPath: null,
  connGpgAgentPath: null,
  gpgconfPath: null,
  gpgAgentInfo: {
    preStarted: false,
    envStr: ""
  },
  gpgAgentProcess: null,
  gpgAgentIsOptional: true,

  isDummy: function() {
    return EnigmailGpgAgent.gpgAgentInfo.envStr === DUMMY_AGENT_INFO;
  },

  useGpgAgent: function() {
    let useAgent = false;

    try {
      if (EnigmailOS.isDosLike() && !EnigmailGpg.getGpgFeature("supports-gpg-agent")) {
        useAgent = false;
      }
      else {
        // gpg version >= 2.0.16 launches gpg-agent automatically
        if (EnigmailGpg.getGpgFeature("autostart-gpg-agent")) {
          useAgent = true;
          EnigmailLog.DEBUG("enigmail.js: Setting useAgent to " + useAgent + " for gpg2 >= 2.0.16\n");
        }
        else {
          useAgent = (EnigmailGpgAgent.gpgAgentInfo.envStr.length > 0 || EnigmailPrefs.getPrefBranch().getBoolPref("useGpgAgent"));
        }
      }
    }
    catch (ex) {}
    return useAgent;
  },

  resetGpgAgent: function() {
    EnigmailLog.DEBUG("gpgAgent.jsm: resetGpgAgent\n");
    gIsGpgAgent = -1;
  },

  isCmdGpgAgent: function(pid) {
    EnigmailLog.DEBUG("gpgAgent.jsm: isCmdGpgAgent:\n");

    const environment = Cc["@mozilla.org/process/environment;1"].getService(Ci.nsIEnvironment);
    let ret = false;

    let path = environment.get("PATH");
    if (!path || path.length === 0) {
      path = "/bin:/usr/bin:/usr/local/bin";
    }

    const psCmd = EnigmailFiles.resolvePath("ps", path, false);

    const proc = {
      command: psCmd,
      arguments: ["-o", "comm", "-p", pid],
      environment: EnigmailCore.getEnvList(),
      charset: null,
      done: function(result) {
        EnigmailLog.DEBUG("gpgAgent.jsm: isCmdGpgAgent: got data: '" + result.stdout + "'\n");
        var data = result.stdout.replace(/[\r\n]/g, " ");
        if (data.search(/gpg-agent/) >= 0) {
          ret = true;
        }
      }
    };

    try {
      subprocess.call(proc).wait();
    }
    catch (ex) {}

    return ret;

  },

  isAgentTypeGpgAgent: function() {
    // determine if the used agent is a gpg-agent

    EnigmailLog.DEBUG("gpgAgent.jsm: isAgentTypeGpgAgent:\n");

    // to my knowledge there is no other agent than gpg-agent on Windows
    if (EnigmailOS.getOS() == "WINNT") return true;

    if (gIsGpgAgent >= 0) {
      return gIsGpgAgent == 1;
    }

    let pid = -1;
    let exitCode = -1;
    if (!EnigmailCore.getService()) return false;

    const proc = {
      command: EnigmailGpgAgent.connGpgAgentPath,
      arguments: [],
      charset: null,
      environment: EnigmailCore.getEnvList(),
      stdin: function(pipe) {
        pipe.write("/subst\n");
        pipe.write("/serverpid\n");
        pipe.write("/echo pid: ${get serverpid}\n");
        pipe.write("/bye\n");
        pipe.close();
      },
      done: function(result) {
        exitCode = result.exitCode;
        const data = result.stdout.replace(/[\r\n]/g, "");
        if (data.search(/^pid: [0-9]+$/) === 0) {
          pid = data.replace(/^pid: /, "");
        }
      }
    };

    try {
      subprocess.call(proc).wait();
      if (exitCode) pid = -2;
    }
    catch (ex) {}

    EnigmailLog.DEBUG("gpgAgent.jsm: isAgentTypeGpgAgent: pid=" + pid + "\n");

    EnigmailGpgAgent.isCmdGpgAgent(pid);
    let isAgent = false;

    try {
      isAgent = EnigmailGpgAgent.isCmdGpgAgent(pid);
      gIsGpgAgent = isAgent ? 1 : 0;
    }
    catch (ex) {}

    return isAgent;
  },

  getAgentMaxIdle: function() {
    EnigmailLog.DEBUG("gpgAgent.jsm: getAgentMaxIdle:\n");
    let maxIdle = -1;

    if (!EnigmailCore.getService()) return maxIdle;

    const DEFAULT = 7;
    const CFGVALUE = 9;

    const proc = {
      command: EnigmailGpgAgent.gpgconfPath,
      arguments: ["--list-options", "gpg-agent"],
      charset: null,
      environment: EnigmailCore.getEnvList(),
      done: function(result) {
        const lines = result.stdout.split(/[\r\n]/);

        for (let i = 0; i < lines.length; i++) {
          EnigmailLog.DEBUG("gpgAgent.jsm: getAgentMaxIdle: line: " + lines[i] + "\n");

          if (lines[i].search(/^default-cache-ttl:/) === 0) {
            const m = lines[i].split(/:/);
            if (m[CFGVALUE].length === 0) {
              maxIdle = Math.round(m[DEFAULT] / 60);
            }
            else {
              maxIdle = Math.round(m[CFGVALUE] / 60);
            }

            break;
          }
        }
      }
    };

    subprocess.call(proc).wait();
    return maxIdle;
  },

  setAgentMaxIdle: function(idleMinutes) {
    EnigmailLog.DEBUG("gpgAgent.jsm: setAgentMaxIdle:\n");
    if (!EnigmailCore.getService()) return;

    const RUNTIME = 8;

    const proc = {
      command: EnigmailGpgAgent.gpgconfPath,
      arguments: ["--runtime", "--change-options", "gpg-agent"],
      environment: EnigmailCore.getEnvList(),
      charset: null,
      mergeStderr: true,
      stdin: function(pipe) {
        pipe.write("default-cache-ttl:" + RUNTIME + ":" + (idleMinutes * 60) + "\n");
        pipe.write("max-cache-ttl:" + RUNTIME + ":" + (idleMinutes * 600) + "\n");
        pipe.close();
      },
      stdout: function(data) {
        EnigmailLog.DEBUG("gpgAgent.jsm: setAgentMaxIdle.stdout: " + data + "\n");
      },
      done: function(result) {
        EnigmailLog.DEBUG("gpgAgent.jsm: setAgentMaxIdle.stdout: gpgconf exitCode=" + result.exitCode + "\n");
      }
    };

    try {
      subprocess.call(proc);
    }
    catch (ex) {
      EnigmailLog.DEBUG("gpgAgent.jsm: setAgentMaxIdle: exception: " + ex.toString() + "\n");
    }
  },

  getMaxIdlePref: function(win) {
    let maxIdle = EnigmailPrefs.getPref("maxIdleMinutes");

    try {
      if (EnigmailCore.getService(win)) {
        if (EnigmailGpgAgent.gpgconfPath &&
          EnigmailGpgAgent.connGpgAgentPath) {

          if (EnigmailGpgAgent.isAgentTypeGpgAgent()) {
            const m = EnigmailGpgAgent.getAgentMaxIdle();
            if (m > -1) maxIdle = m;
          }
        }
      }
    }
    catch (ex) {}

    return maxIdle;
  },

  setMaxIdlePref: function(minutes) {
    EnigmailPrefs.setPref("maxIdleMinutes", minutes);

    if (EnigmailGpgAgent.isAgentTypeGpgAgent()) {
      try {
        EnigmailGpgAgent.setAgentMaxIdle(minutes);
      }
      catch (ex) {}
    }
  },

  /**
   * Determine the "gpg home dir", i.e. the directory where gpg.conf and the keyring are
   * stored
   *
   * @return String - directory name, or NULL (in case the command did not succeed)
   */
  getGpgHomeDir: function() {


    let param = EnigmailPrefs.getPref("agentAdditionalParam");

    if (param) {
      let hd = getHomedirFromParam(param);

      if (hd) return hd;
    }

    if (EnigmailGpgAgent.gpgconfPath === null) return null;

    const command = EnigmailGpgAgent.gpgconfPath;
    let args = ["--list-dirs"];

    let exitCode = -1;
    let outStr = "";
    EnigmailLog.DEBUG("enigmail.js: Enigmail.setAgentPath: calling subprocess with '" + command.path + "'\n");

    EnigmailLog.CONSOLE("enigmail> " + EnigmailFiles.formatCmdLine(command, args) + "\n");

    const proc = {
      command: command,
      arguments: args,
      environment: EnigmailCore.getEnvList(),
      charset: null,
      done: function(result) {
        exitCode = result.exitCode;
        outStr = result.stdout;
      },
      mergeStderr: false
    };

    try {
      subprocess.call(proc).wait();
    }
    catch (ex) {
      EnigmailLog.ERROR("enigmail.js: Enigmail.getGpgHomeDir: subprocess.call failed with '" + ex.toString() + "'\n");
      EnigmailLog.DEBUG("  enigmail> DONE with FAILURE\n");
      throw ex;
    }

    let m = outStr.match(/^(homedir:)(.*)$/mi);
    if (m && m.length > 2) {
      return EnigmailData.convertGpgToUnicode(unescape(m[2]));
    }

    return null;
  },

  setAgentPath: function(domWindow, esvc) {
    let agentPath = "";
    try {
      agentPath = EnigmailPrefs.getPrefBranch().getCharPref("agentPath");
    }
    catch (ex) {}

    var agentType = "gpg";
    var agentName = "";

    EnigmailGpgAgent.resetGpgAgent();

    if (EnigmailOS.isDosLike()) {
      agentName = "gpg2.exe;gpg.exe;gpg1.exe";
    }
    else {
      agentName = "gpg2;gpg;gpg1";
    }


    if (agentPath) {
      // Locate GnuPG executable

      // Append default .exe extension for DOS-Like systems, if needed
      if (EnigmailOS.isDosLike() && (agentPath.search(/\.\w+$/) < 0)) {
        agentPath += ".exe";
      }

      try {
        let pathDir = Cc[NS_LOCAL_FILE_CONTRACTID].createInstance(Ci.nsIFile);

        if (!EnigmailFiles.isAbsolutePath(agentPath, EnigmailOS.isDosLike())) {
          // path relative to Mozilla installation dir
          const ds = Cc[DIR_SERV_CONTRACTID].getService();
          const dsprops = ds.QueryInterface(Ci.nsIProperties);
          pathDir = dsprops.get("CurProcD", Ci.nsIFile);

          const dirs = agentPath.split(new RegExp(EnigmailOS.isDosLike() ? "\\\\" : "/"));
          for (let i = 0; i < dirs.length; i++) {
            if (dirs[i] != ".") {
              pathDir.append(dirs[i]);
            }
          }
          pathDir.normalize();
        }
        else {
          // absolute path
          EnigmailFiles.initPath(pathDir, agentPath);
        }
        if (!(pathDir.isFile() /* && pathDir.isExecutable()*/ )) {
          throw Components.results.NS_ERROR_FAILURE;
        }
        agentPath = pathDir.QueryInterface(Ci.nsIFile);

      }
      catch (ex) {
        esvc.initializationError = EnigmailLocale.getString("gpgNotFound", [agentPath]);
        EnigmailLog.ERROR("enigmail.js: Enigmail.initialize: Error - " + esvc.initializationError + "\n");
        throw Components.results.NS_ERROR_FAILURE;
      }
    }
    else {
      // Resolve relative path using PATH environment variable
      const envPath = esvc.environment.get("PATH");
      agentPath = EnigmailFiles.resolvePath(agentName, envPath, EnigmailOS.isDosLike());

      if (!agentPath && EnigmailOS.isDosLike()) {
        // DOS-like systems: search for GPG in c:\gnupg, c:\gnupg\bin, d:\gnupg, d:\gnupg\bin
        let gpgPath = "c:\\gnupg;c:\\gnupg\\bin;d:\\gnupg;d:\\gnupg\\bin";
        agentPath = EnigmailFiles.resolvePath(agentName, gpgPath, EnigmailOS.isDosLike());
      }

      if ((!agentPath) && EnigmailOS.isWin32) {
        // Look up in Windows Registry
        try {
          let gpgPath = EnigmailOS.getWinRegistryString("Software\\GNU\\GNUPG", "Install Directory", nsIWindowsRegKey.ROOT_KEY_LOCAL_MACHINE);
          agentPath = EnigmailFiles.resolvePath(agentName, gpgPath, EnigmailOS.isDosLike());
        }
        catch (ex) {}

        if (!agentPath) {
          let gpgPath = gpgPath + "\\pub";
          agentPath = EnigmailFiles.resolvePath(agentName, gpgPath, EnigmailOS.isDosLike());
        }
      }

      if (!agentPath && !EnigmailOS.isDosLike()) {
        // Unix-like systems: check /usr/bin and /usr/local/bin
        let gpgPath = "/usr/bin:/usr/local/bin";
        agentPath = EnigmailFiles.resolvePath(agentName, gpgPath, EnigmailOS.isDosLike());
      }

      if (!agentPath) {
        esvc.initializationError = EnigmailLocale.getString("gpgNotInPath");
        EnigmailLog.ERROR("enigmail.js: Enigmail: Error - " + esvc.initializationError + "\n");
        throw Components.results.NS_ERROR_FAILURE;
      }
      agentPath = agentPath.QueryInterface(Ci.nsIFile);
    }

    EnigmailLog.CONSOLE("EnigmailAgentPath=" + EnigmailFiles.getFilePathDesc(agentPath) + "\n\n");

    EnigmailGpgAgent.agentType = agentType;
    EnigmailGpgAgent.agentPath = agentPath;
    EnigmailGpg.setAgentPath(agentPath);
    EnigmailExecution.agentType = agentType;

    const command = agentPath;
    let args = [];
    if (agentType == "gpg") {
      args = ["--version", "--version", "--batch", "--no-tty", "--charset", "utf-8", "--display-charset", "utf-8"];
    }

    let exitCode = -1;
    let outStr = "";
    let errStr = "";
    EnigmailLog.DEBUG("enigmail.js: Enigmail.setAgentPath: calling subprocess with '" + command.path + "'\n");

    EnigmailLog.CONSOLE("enigmail> " + EnigmailFiles.formatCmdLine(command, args) + "\n");

    const proc = {
      command: command,
      arguments: args,
      environment: EnigmailCore.getEnvList(),
      charset: null,
      done: function(result) {
        exitCode = result.exitCode;
        outStr = result.stdout;
        errStr = result.stderr;
      },
      mergeStderr: false
    };

    try {
      subprocess.call(proc).wait();
    }
    catch (ex) {
      EnigmailLog.ERROR("enigmail.js: Enigmail.setAgentPath: subprocess.call failed with '" + ex.toString() + "'\n");
      EnigmailLog.DEBUG("  enigmail> DONE with FAILURE\n");
      throw ex;
    }
    EnigmailLog.DEBUG("  enigmail> DONE\n");

    outStr = EnigmailSystem.convertNativeToUnicode(outStr);

    if (exitCode !== 0) {
      EnigmailLog.ERROR("enigmail.js: Enigmail.setAgentPath: gpg failed with exitCode " + exitCode + " msg='" + outStr + " " + errStr + "'\n");
      throw Components.results.NS_ERROR_FAILURE;
    }

    EnigmailLog.CONSOLE(outStr + "\n");

    // detection for Gpg4Win wrapper
    if (outStr.search(/^gpgwrap.*;/) === 0) {
      const outLines = outStr.split(/[\n\r]+/);
      const firstLine = outLines[0];
      outLines.splice(0, 1);
      outStr = outLines.join("\n");
      agentPath = firstLine.replace(/^.*;[ \t]*/, "");

      EnigmailLog.CONSOLE("gpg4win-gpgwrapper detected; EnigmailAgentPath=" + agentPath + "\n\n");
    }

    const versionParts = outStr.replace(/[\r\n].*/g, "").replace(/ *\(gpg4win.*\)/i, "").split(/ /);
    const gpgVersion = versionParts[versionParts.length - 1];

    EnigmailLog.DEBUG("enigmail.js: detected GnuPG version '" + gpgVersion + "'\n");
    EnigmailGpg.agentVersion = gpgVersion;

    if (!EnigmailGpg.getGpgFeature("version-supported")) {
      if (!domWindow) {
        domWindow = EnigmailWindows.getBestParentWin();
      }
      EnigmailDialog.alert(domWindow, EnigmailLocale.getString("oldGpgVersion14", [gpgVersion]));
      throw Components.results.NS_ERROR_FAILURE;
    }

    EnigmailGpgAgent.gpgconfPath = EnigmailGpgAgent.resolveToolPath("gpgconf");
    EnigmailGpgAgent.connGpgAgentPath = EnigmailGpgAgent.resolveToolPath("gpg-connect-agent");

    EnigmailLog.DEBUG("enigmail.js: Enigmail.setAgentPath: gpgconf found: " + (EnigmailGpgAgent.gpgconfPath ? "yes" : "no") + "\n");
  },

  // resolve the path for GnuPG helper tools
  resolveToolPath: function(fileName) {
    if (EnigmailOS.isDosLike()) {
      fileName += ".exe";
    }

    let filePath = cloneOrNull(EnigmailGpgAgent.agentPath);

    if (filePath) filePath = filePath.parent;
    if (filePath) {
      filePath.append(fileName);
      if (filePath.exists()) {
        filePath.normalize();
        return filePath;
      }
    }

    const foundPath = EnigmailFiles.resolvePath(fileName, EnigmailCore.getEnigmailService().environment.get("PATH"), EnigmailOS.isDosLike());
    if (foundPath) {
      foundPath.normalize();
    }
    return foundPath;
  },

  detectGpgAgent: function(domWindow, esvc) {
    EnigmailLog.DEBUG("enigmail.js: detectGpgAgent\n");

    var gpgAgentInfo = esvc.environment.get("GPG_AGENT_INFO");
    if (gpgAgentInfo && gpgAgentInfo.length > 0) {
      EnigmailLog.DEBUG("enigmail.js: detectGpgAgent: GPG_AGENT_INFO variable available\n");
      // env. variable suggests running gpg-agent
      EnigmailGpgAgent.gpgAgentInfo.preStarted = true;
      EnigmailGpgAgent.gpgAgentInfo.envStr = gpgAgentInfo;
      EnigmailGpgAgent.gpgAgentIsOptional = false;
    }
    else {
      EnigmailLog.DEBUG("enigmail.js: detectGpgAgent: no GPG_AGENT_INFO variable set\n");
      EnigmailGpgAgent.gpgAgentInfo.preStarted = false;

      var command = null;
      var outStr = "";
      var errorStr = "";
      var exitCode = -1;
      EnigmailGpgAgent.gpgAgentIsOptional = false;
      if (EnigmailGpg.getGpgFeature("autostart-gpg-agent")) {
        EnigmailLog.DEBUG("enigmail.js: detectGpgAgent: gpg 2.0.16 or newer - not starting agent\n");
      }
      else {
        if (EnigmailGpgAgent.connGpgAgentPath && EnigmailGpgAgent.connGpgAgentPath.isExecutable()) {
          // try to connect to a running gpg-agent

          EnigmailLog.DEBUG("enigmail.js: detectGpgAgent: gpg-connect-agent is executable\n");

          EnigmailGpgAgent.gpgAgentInfo.envStr = DUMMY_AGENT_INFO;

          command = EnigmailGpgAgent.connGpgAgentPath.QueryInterface(Ci.nsIFile);

          EnigmailLog.CONSOLE("enigmail> " + command.path + "\n");

          try {
            subprocess.call({
              command: command,
              environment: EnigmailCore.getEnvList(),
              stdin: "/echo OK\n",
              charset: null,
              done: function(result) {
                EnigmailLog.DEBUG("detectGpgAgent detection terminated with " + result.exitCode + "\n");
                exitCode = result.exitCode;
                outStr = result.stdout;
                errorStr = result.stderr;
                if (result.stdout.substr(0, 2) == "OK") exitCode = 0;
              },
              mergeStderr: false
            }).wait();
          }
          catch (ex) {
            EnigmailLog.ERROR("enigmail.js: detectGpgAgent: " + command.path + " failed\n");
            EnigmailLog.DEBUG("  enigmail> DONE with FAILURE\n");
            exitCode = -1;
          }
          EnigmailLog.DEBUG("  enigmail> DONE\n");

          if (exitCode === 0) {
            EnigmailLog.DEBUG("enigmail.js: detectGpgAgent: found running gpg-agent\n");
            return;
          }
          else {
            EnigmailLog.DEBUG("enigmail.js: detectGpgAgent: no running gpg-agent. Output='" + outStr + "' error text='" + errorStr + "'\n");
          }

        }

        // and finally try to start gpg-agent
        var commandFile = EnigmailGpgAgent.resolveToolPath("gpg-agent");
        var agentProcess = null;

        if ((!commandFile) || (!commandFile.exists())) {
          commandFile = EnigmailGpgAgent.resolveToolPath("gpg-agent2");
        }

        if (commandFile && commandFile.exists()) {
          command = commandFile.QueryInterface(Ci.nsIFile);
        }

        if (command === null) {
          EnigmailLog.ERROR("enigmail.js: detectGpgAgent: gpg-agent not found\n");
          EnigmailDialog.alert(domWindow, EnigmailLocale.getString("gpgAgentNotStarted", [EnigmailGpg.agentVersion]));
          throw Components.results.NS_ERROR_FAILURE;
        }
      }

      if ((!EnigmailOS.isDosLike()) && (!EnigmailGpg.getGpgFeature("autostart-gpg-agent"))) {

        // create unique tmp file
        var ds = Cc[DIR_SERV_CONTRACTID].getService();
        var dsprops = ds.QueryInterface(Ci.nsIProperties);
        var tmpFile = dsprops.get("TmpD", Ci.nsIFile);
        tmpFile.append("gpg-wrapper.tmp");
        tmpFile.createUnique(tmpFile.NORMAL_FILE_TYPE, DEFAULT_FILE_PERMS);
        let args = [command.path,
          tmpFile.path,
          "--sh", "--no-use-standard-socket",
          "--daemon",
          "--default-cache-ttl", (EnigmailPassword.getMaxIdleMinutes() * 60).toString(),
          "--max-cache-ttl", "999999"
        ]; // ca. 11 days

        try {
          var process = Cc["@mozilla.org/process/util;1"].createInstance(Ci.nsIProcess);
          var exec = EnigmailApp.getInstallLocation().clone();
          exec.append("wrappers");
          exec.append("gpg-agent-wrapper.sh");
          process.init(exec);
          process.run(true, args, args.length);

          if (!tmpFile.exists()) {
            EnigmailLog.ERROR("enigmail.js: detectGpgAgent no temp file created\n");
          }
          else {
            outStr = EnigmailFiles.readFile(tmpFile);
            tmpFile.remove(false);
            exitCode = 0;
          }
        }
        catch (ex) {
          EnigmailLog.ERROR("enigmail.js: detectGpgAgent: failed with '" + ex + "'\n");
          exitCode = -1;
        }

        if (exitCode === 0) {
          EnigmailGpgAgent.gpgAgentInfo.envStr = extractAgentInfo(outStr);
          EnigmailLog.DEBUG("enigmail.js: detectGpgAgent: started -> " + EnigmailGpgAgent.gpgAgentInfo.envStr + "\n");
          EnigmailGpgAgent.gpgAgentProcess = EnigmailGpgAgent.gpgAgentInfo.envStr.split(":")[1];
        }
        else {
          EnigmailLog.ERROR("enigmail.js: detectGpgAgent: gpg-agent output: " + outStr + "\n");
          EnigmailDialog.alert(domWindow, EnigmailLocale.getString("gpgAgentNotStarted", [EnigmailGpg.agentVersion]));
          throw Components.results.NS_ERROR_FAILURE;
        }
      }
      else {
        EnigmailGpgAgent.gpgAgentInfo.envStr = DUMMY_AGENT_INFO;
        var envFile = Components.classes[NS_LOCAL_FILE_CONTRACTID].createInstance(Ci.nsIFile);
        EnigmailFiles.initPath(envFile, EnigmailGpgAgent.determineGpgHomeDir(esvc));
        envFile.append("gpg-agent.conf");

        var data = "default-cache-ttl " + (EnigmailPassword.getMaxIdleMinutes() * 60) + "\n";
        data += "max-cache-ttl 999999";
        if (!envFile.exists()) {
          try {
            var flags = 0x02 | 0x08 | 0x20;
            var fileOutStream = Cc[NS_LOCALFILEOUTPUTSTREAM_CONTRACTID].createInstance(Ci.nsIFileOutputStream);
            fileOutStream.init(envFile, flags, 384, 0); // 0600
            fileOutStream.write(data, data.length);
            fileOutStream.flush();
            fileOutStream.close();
          }
          catch (ex) {} // ignore file write errors
        }
      }
    }
    EnigmailLog.DEBUG("enigmail.js: detectGpgAgent: GPG_AGENT_INFO='" + EnigmailGpgAgent.gpgAgentInfo.envStr + "'\n");
  },

  determineGpgHomeDir: function(esvc) {
    let homeDir = esvc.environment.get("GNUPGHOME");

    if (!homeDir && EnigmailOS.isWin32) {
      homeDir = EnigmailOS.getWinRegistryString("Software\\GNU\\GNUPG", "HomeDir", nsIWindowsRegKey.ROOT_KEY_CURRENT_USER);

      if (!homeDir) {
        homeDir = esvc.environment.get("USERPROFILE") || esvc.environment.get("SystemRoot");

        if (homeDir) homeDir += "\\Application Data\\GnuPG";
      }

      if (!homeDir) homeDir = "C:\\gnupg";
    }

    if (!homeDir) homeDir = esvc.environment.get("HOME") + "/.gnupg";

    return homeDir;
  },

  finalize: function() {
    if (EnigmailGpgAgent.gpgAgentProcess) {
      EnigmailLog.DEBUG("gpgAgent.jsm: EnigmailGpgAgent.finalize: stopping gpg-agent PID=" + EnigmailGpgAgent.gpgAgentProcess + "\n");
      try {
        const libc = ctypes.open(subprocess.getPlatformValue(0));

        //int kill(pid_t pid, int sig);
        const kill = libc.declare("kill",
          ctypes.default_abi,
          ctypes.int,
          ctypes.int32_t,
          ctypes.int);

        kill(parseInt(EnigmailGpgAgent.gpgAgentProcess, 10), 15);
      }
      catch (ex) {
        EnigmailLog.ERROR("gpgAgent.jsm: EnigmailGpgAgent.finalize ERROR: " + ex + "\n");
      }
    }
  }
};
