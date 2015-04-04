/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
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
 * The Original Code is Enigmail.
 *
 * The Initial Developer of the Original Code is Patrick Brunschwig.
 * Portions created by Patrick Brunschwig <patrick@enigmail.net> are
 * Copyright (C) 2013 Patrick Brunschwig. All Rights Reserved.
 *
 * Contributor(s):
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 * ***** END LICENSE BLOCK ***** */

'use strict';

Components.utils.import("resource://enigmail/subprocess.jsm");

var EXPORTED_SYMBOLS = [ "EnigmailGpgAgent" ];

const Cc = Components.classes;
const Ci = Components.interfaces;

const NS_FILE_CONTRACTID = "@mozilla.org/file/local;1";

var gIsGpgAgent = -1;

var Ec = null;

function DEBUG_LOG(str) {
  if (Ec) Ec.DEBUG_LOG(str);
}

var EnigmailGpgAgent = {

  setEnigmailCommon: function(enigCommon) {
    Ec = enigCommon;
  },

  resetGpgAgent: function() {
    DEBUG_LOG("gpgAgentHandler.jsm: resetGpgAgent\n");
    gIsGpgAgent = -1;
  },

  readString: function(data, length) {
    var r = '';
    for(var i = 0; i < length; i++) {
      r += String.fromCharCode(data[i]);
    }

    return r;
  },

  isAbsolutePath: function (filePath, isDosLike) {
    // Check if absolute path
    if (isDosLike) {
      return ((filePath.search(/^\w+:\\/) == 0) || (filePath.search(/^\\\\/) == 0)
              || (filePath.search(/^\/\//) == 0));
    } else {
      return (filePath.search(/^\//) == 0);
    }
  },

  initPath: function (localFileObj, pathStr) {
    localFileObj.initWithPath(pathStr);

    if (! localFileObj.exists()) {
      localFileObj.persistentDescriptor = pathStr;
    }
  },

  resolvePath: function (filePath, envPath, isDosLike) {
    DEBUG_LOG("gpgAgentHandler.jsm: resolvePath: filePath="+filePath+"\n");

    if (this.isAbsolutePath(filePath, isDosLike))
      return filePath;

    if (!envPath)
       return null;

    var fileNames = filePath.split(";");

    var pathDirs = envPath.split(isDosLike ? ";" : ":");

    for (var i=0; i < fileNames.length; i++) {
      for (var j=0; j<pathDirs.length; j++) {
         try {
            var pathDir = Cc[NS_FILE_CONTRACTID].createInstance(Ci.nsIFile);

            DEBUG_LOG("gpgAgentHandler.jsm: resolvePath: checking for "+pathDirs[j]+"/"+fileNames[i]+"\n");

            this.initPath(pathDir, pathDirs[j]);

            try {
              if (pathDir.exists() && pathDir.isDirectory()) {
                 pathDir.appendRelativePath(fileNames[i]);

                 if (pathDir.exists() && !pathDir.isDirectory()) {
                    return pathDir;
                 }
              }
            }
            catch (ex) {}
         }
         catch (ex) {}
      }
    }
    return null;
  },

  isCmdGpgAgent: function(pid) {
    DEBUG_LOG("gpgAgentHandler.jsm: isCmdGpgAgent:\n");

    var environment = Cc["@mozilla.org/process/environment;1"].getService(Ci.nsIEnvironment);
    var ret = false;

    var path = environment.get("PATH");
    if (! path || path.length == 0) {
      path = "/bin:/usr/bin:/usr/local/bin";
    }

    var psCmd = this.resolvePath("ps", path, false);

    var proc = {
      command:     psCmd,
      arguments:   [ "-o", "comm", "-p", pid ],
      environment: Ec.envList,
      charset: null,
      done: function(result) {
        DEBUG_LOG("gpgAgentHandler.jsm: isCmdGpgAgent: got data: '"+result.stdout+"'\n");
        var data = result.stdout.replace(/[\r\n]/g, " ");
        if (data.search(/gpg-agent/) >= 0)
          ret = true;
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

    DEBUG_LOG("gpgAgentHandler.jsm: isAgentTypeGpgAgent:\n");

    // to my knowledge there is no other agent than gpg-agent on Windows
    if (Ec.getOS() == "WINNT") return true;

    if (gIsGpgAgent >= 0)
      return gIsGpgAgent == 1;

    var pid = -1;
    var exitCode = -1;
    var svc = Ec.getService();
    if (! svc) return false;

    var proc = {
      command:     svc.connGpgAgentPath,
      arguments:   [],
      charset: null,
      environment: Ec.envList,
      stdin: function(pipe) {
        pipe.write("/subst\n");
        pipe.write("/serverpid\n");
        pipe.write("/echo pid: ${get serverpid}\n");
        pipe.write("/bye\n");
        pipe.close();
      },
      done: function(result) {
        exitCode = result.exitCode;
        var data = result.stdout.replace(/[\r\n]/g, "");
        if (data.search(/^pid: [0-9]+$/) == 0) {
          pid = data.replace(/^pid: /, "");
        }
      }
    };

    try {
      subprocess.call(proc).wait();
      if (exitCode) pid = -2;
    }
    catch (ex) {}

    DEBUG_LOG("gpgAgentHandler.jsm: isAgentTypeGpgAgent: pid="+pid+"\n");

    this.isCmdGpgAgent(pid);
    var isAgent = false;

    try {
      isAgent = this.isCmdGpgAgent(pid);
      gIsGpgAgent = isAgent ? 1 : 0;
    }
    catch(ex) {}

    return isAgent;
  },

  getAgentMaxIdle: function() {
    DEBUG_LOG("gpgAgentHandler.jsm: getAgentMaxIdle:\n");
    var svc = Ec.getService();
    var maxIdle = -1;

    if (! svc) return maxIdle;

    const DEFAULT = 7;
    const CFGVALUE = 9;

    var proc = {
      command:     svc.gpgconfPath,
      arguments:   [ "--list-options", "gpg-agent" ],
      charset: null,
      environment: Ec.envList,
      done: function(result) {
        var lines = result.stdout.split(/[\r\n]/);
        var i;

        for (i=0; i < lines.length; i++) {
          DEBUG_LOG("gpgAgentHandler.jsm: getAgentMaxIdle: line: "+lines[i]+"\n");

          if (lines[i].search(/^default-cache-ttl:/) == 0) {
            var m = lines[i].split(/:/);
            if (m[CFGVALUE].length == 0) {
              maxIdle = Math.round(m[DEFAULT] / 60);
            }
            else
              maxIdle = Math.round(m[CFGVALUE] / 60);

            break;
          }
        }
      }
    };

    subprocess.call(proc).wait();

    return maxIdle;
  },

  setAgentMaxIdle: function(idleMinutes) {
    DEBUG_LOG("gpgAgentHandler.jsm: setAgentMaxIdle:\n");
    var svc = Ec.getService();

    if (! svc) return;

    const RUNTIME = 8;

    var proc = {
      command:     svc.gpgconfPath,
      arguments:   [ "--change-options", "gpg-agent" ],
      environment: Ec.envList,
      charset: null,
      mergeStderr: true,
      stdin: function(pipe) {
        pipe.write("default-cache-ttl:"+ RUNTIME +":" + (idleMinutes * 60) +"\n");
        pipe.write("max-cache-ttl:"+ RUNTIME +":" + (idleMinutes * 600) +"\n");
        pipe.close();
      },
      stdout: function (data) {
        DEBUG_LOG("gpgAgentHandler.jsm: setAgentMaxIdle.stdout: "+data+"\n");
      },
      done: function(result) {
        DEBUG_LOG("gpgAgentHandler.jsm: setAgentMaxIdle.stdout: gpgconf exitCode="+result.exitCode+"\n");
      }
    };

    try {
      subprocess.call(proc);
    }
    catch (ex) {
      DEBUG_LOG("gpgAgentHandler.jsm: setAgentMaxIdle: exception: "+ex.toString()+"\n");
    }
  },

  getMaxIdlePref: function(win) {
    let maxIdle = Ec.getPref("maxIdleMinutes");

    try {
      var svc = Ec.getService(win);
      if (svc) {
        if (svc.gpgconfPath &&
           svc.connGpgAgentPath) {

          if (this.isAgentTypeGpgAgent()) {
            let m = this.getAgentMaxIdle();
            if (m > -1) maxIdle = m;
          }

        }
      }
    }
    catch(ex) {}

    return maxIdle;
  },

  setMaxIdlePref: function(minutes) {
    Ec.setPref("maxIdleMinutes", minutes);

    if (this.isAgentTypeGpgAgent()) {
      try {
        this.setAgentMaxIdle(minutes);
      }
      catch(ex) {}
    }
  }
}
