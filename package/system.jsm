/*global Components: false */
/*jshint -W097 */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


"use strict";

var EXPORTED_SYMBOLS = ["EnigmailSystem"];

Components.utils.import("resource://gre/modules/ctypes.jsm"); /* global ctypes: false */
Components.utils.import("resource://enigmail/os.jsm"); /* global EnigmailOS: false */
Components.utils.import("resource://enigmail/data.jsm"); /* global EnigmailData: false */
Components.utils.import("resource://enigmail/subprocess.jsm"); /* global subprocess: false */

const Cc = Components.classes;
const Ci = Components.interfaces;

var gKernel32Dll = null;
var gSystemCharset = null;

/**
 * Get the default codepage that is set on Windows (which equals to the chatset of the console output of gpg)
 */
function getWindowsCopdepage() {
  let output = "";

  let p = subprocess.call({
    command: "C:\\windows\\system32\\chcp.com",
    arguments: [],
    environment: [],
    charset: null,
    mergeStderr: false,
    done: function(result) {
      output = result.stdout;
    }
  });
  p.wait();

  output = output.replace(/^(.* )([0-9]+)[\r\n]*$/, "$2");

  return Number(output);
}

/**
 * Get the charset defined with LC_ALL or locale. That's the charset used by gpg console output
 */
function getUnixCharset() {
  let env = Cc["@mozilla.org/process/environment;1"].getService(Ci.nsIEnvironment);
  let lc = env.get("LC_ALL");


  if (lc.length === 0) {
    let places = [
      "/usr/bin/locale",
      "/usr/local/bin/locale",
      "/opt/bin/locale"
    ];
    var localeFile = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);

    for (let i = 0; i < places.length; i++) {
      localeFile.initWithPath(places[i]);
      if (localeFile.exists()) break;
    }

    if (!localeFile.exists()) return "iso-8859-1";

    let output = "";

    let p = subprocess.call({
      command: localeFile,
      arguments: [],
      environment: [],
      charset: null,
      mergeStderr: false,
      done: function(result) {
        output = result.stdout;
      }
    });
    p.wait();

    let m = output.match(/^(LC_ALL=)(.*)$/m);
    if (m && m.length > 2) {
      lc = m[2].replace(/\"/g, "");
    }
    else return "iso-8859-1";
  }

  let i = lc.search(/[\.@]/);

  if (i < 0) return "iso-8859-1";

  lc = lc.substr(i + 1);

  return lc;

}

var EnigmailSystem = {


  determineSystemCharset: function() {
    if (!gSystemCharset) {
      if (EnigmailOS.isWin32) {
        gSystemCharset = getWindowsCopdepage();
      }
      else {
        gSystemCharset = getUnixCharset();
      }
    }

    return gSystemCharset;
  },

  /**
   * Convert system output coming in a native charset into Unicode (Gecko-platfrom)
   * applying an appropriate charset conversion
   *
   * @param str   String - input string in native charset
   *
   * @param String - output in Unicode format. If something failed, the unmodified
   *                 input isreturned.
   */

  convertNativeToUnicode: function(str) {
    try {
      let cs = this.determineSystemCharset();

      if (EnigmailOS.isWin32) {
        return this.winConvertNativeToUnichar(str, cs);
      }
      else {
        return EnigmailData.convertToUnicode(str, cs);
      }
    }
    catch (ex) {
      return ex.toString();
    }
  },

  /**
   * Convert from native Windows output (often Codepage 437) to a Mozilla Unichar string
   *
   * @param byteStr: String - the data to convert in the current Windows codepage
   *
   * @return String: the Unicode string directly display-able
   */
  winConvertNativeToUnichar: function(byteStr, codePage) {
    /*
    int MultiByteToWideChar(
    _In_      UINT   CodePage,
    _In_      DWORD  dwFlags,
    _In_      LPCSTR lpMultiByteStr,
    _In_      int    cbMultiByte,
    _Out_opt_ LPWSTR lpWideCharStr,
    _In_      int    cchWideChar
    );
    */

    if (!gKernel32Dll) {
      if (EnigmailOS.isWin32) {
        gKernel32Dll = ctypes.open("kernel32.dll");
      }
      else {
        return byteStr;
      }
    }

    var multiByteToWideChar = gKernel32Dll.declare("MultiByteToWideChar",
      ctypes.winapi_abi,
      ctypes.int, // return value
      ctypes.unsigned_int, // Codepage
      ctypes.uint32_t, // dwFlags
      ctypes.char.ptr, // input string
      ctypes.int, // cbMultiByte
      ctypes.jschar.ptr, // widechar string
      ctypes.int // ccWideChar
    );

    let n = multiByteToWideChar(codePage, 0, byteStr, byteStr.length, null, 0);

    if (n > 0) {
      let OutStrType = ctypes.jschar.array(n + 1);
      let outStr = new OutStrType();

      multiByteToWideChar(codePage, 0, byteStr, byteStr.length, outStr.addressOfElement(0), n);

      let r = new RegExp(String.fromCharCode(9516), "g");
      return outStr.readString().replace(r, "");

    }
    else
      return byteStr;
  }
};
