/*
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
 * The Initial Developer of this code is Patrick Brunschwig.
 * Portions created by Patrick Brunschwig <patrick@mozilla-enigmail.org>
 * are Copyright (C) 2010 Patrick Brunschwig.
 * All Rights Reserved.
 *
 * Contributor(s):
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


/*
 * Import into a JS component using
 * 'Components.utils.import("resource://enigmail/enigmailCommon.jsmm");'
 */


var EXPORTED_SYMBOLS = [ "EnigCommon" ];

const Cc = Components.classes;
const Ci = Components.interfaces;

const NS_ISCRIPTABLEUNICODECONVERTER_CONTRACTID = "@mozilla.org/intl/scriptableunicodeconverter";

const nsIEnigmail = Ci.nsIEnigmail;

const hexTable = "0123456789abcdef";

var gLogLevel = 3;


var gStatusFlags = {GOODSIG:         nsIEnigmail.GOOD_SIGNATURE,
                    BADSIG:          nsIEnigmail.BAD_SIGNATURE,
                    ERRSIG:          nsIEnigmail.UNVERIFIED_SIGNATURE,
                    EXPSIG:          nsIEnigmail.EXPIRED_SIGNATURE,
                    REVKEYSIG:       nsIEnigmail.GOOD_SIGNATURE,
                    EXPKEYSIG:       nsIEnigmail.EXPIRED_KEY_SIGNATURE,
                    KEYEXPIRED:      nsIEnigmail.EXPIRED_KEY,
                    KEYREVOKED:      nsIEnigmail.REVOKED_KEY,
                    NO_PUBKEY:       nsIEnigmail.NO_PUBKEY,
                    NO_SECKEY:       nsIEnigmail.NO_SECKEY,
                    IMPORTED:        nsIEnigmail.IMPORTED_KEY,
                    INV_RECP:        nsIEnigmail.INVALID_RECIPIENT,
                    MISSING_PASSPHRASE: nsIEnigmail.MISSING_PASSPHRASE,
                    BAD_PASSPHRASE:  nsIEnigmail.BAD_PASSPHRASE,
                    BADARMOR:        nsIEnigmail.BAD_ARMOR,
                    NODATA:          nsIEnigmail.NODATA,
                    ERROR:           nsIEnigmail.BAD_SIGNATURE | nsIEnigmail.DECRYPTION_FAILED,
                    DECRYPTION_FAILED: nsIEnigmail.DECRYPTION_FAILED,
                    DECRYPTION_OKAY: nsIEnigmail.DECRYPTION_OKAY,
                    TRUST_UNDEFINED: nsIEnigmail.UNTRUSTED_IDENTITY,
                    TRUST_NEVER:     nsIEnigmail.UNTRUSTED_IDENTITY,
                    TRUST_MARGINAL:  nsIEnigmail.UNTRUSTED_IDENTITY,
                    TRUST_FULLY:     nsIEnigmail.TRUSTED_IDENTITY,
                    TRUST_ULTIMATE:  nsIEnigmail.TRUSTED_IDENTITY,
                    CARDCTRL:        nsIEnigmail.CARDCTRL,
                    SC_OP_FAILURE:   nsIEnigmail.SC_OP_FAILURE,
                    UNKNOWN_ALGO:    nsIEnigmail.UNKNOWN_ALGO,
                    SIG_CREATED:     nsIEnigmail.SIG_CREATED,
                    END_ENCRYPTION : nsIEnigmail.END_ENCRYPTION,
                    INV_SGNR:				 0x100000000
};

var EnigCommon = {

  enigmailSvc: null,
  enigStringBundle: null,

  WRITE_LOG: function (str) {
    function f00(val, digits) {
      return ("0000"+val.toString()).substr(-digits);
    }

    var d = new Date();
    var datStr=d.getFullYear()+"-"+f00(d.getMonth()+1, 2)+"-"+f00(d.getDate(),2)+" "+f00(d.getHours(),2)+":"+f00(d.getMinutes(),2)+":"+f00(d.getSeconds(),2)+"."+f00(d.getMilliseconds(),3)+" ";
    if (gLogLevel >= 4)
      dump(datStr+str);

    if (this.enigmailSvc && this.enigmailSvc.logFileStream) {
      this.enigmailSvc.logFileStream.write(datStr, datStr.length);
      this.enigmailSvc.logFileStream.write(str, str.length);
    }
  },

  DEBUG_LOG: function (str) {
    if ((gLogLevel >= 4) || (this.enigmailSvc && this.enigmailSvc.logFileStream))
      this.WRITE_LOG("[DEBUG] "+str);
  },

  WARNING_LOG: function (str) {
    if (gLogLevel >= 3)
      this.WRITE_LOG("[WARN] "+str);

    if (this.enigmailSvc && this.enigmailSvc.console)
      this.enigmailSvc.console.write(str);
  },

  ERROR_LOG: function (str) {
    try {
      var consoleSvc = Cc["@mozilla.org/consoleservice;1"].
          getService(Ci.nsIConsoleService);

      var scriptError = Cc["@mozilla.org/scripterror;1"]
                                  .createInstance(Ci.nsIScriptError);
      scriptError.init(str, null, null, 0,
                       0, scriptError.errorFlag, "Enigmail");
      consoleSvc.logMessage(scriptError);

    }
    catch (ex) {}

    if (gLogLevel >= 2)
      this.WRITE_LOG("[ERROR] "+str);
  },

  CONSOLE_LOG: function (str) {
    if (gLogLevel >= 3)
      this.WRITE_LOG("[CONSOLE] "+str);

    if (this.enigmailSvc && this.enigmailSvc.console)
      this.enigmailSvc.console.write(str);
  },

  // retrieves a localized string from the enigmail.properties stringbundle
  getString: function (aStr) {
    var restCount = arguments.length - 1;
    if (!this.enigStringBundle) {
      try {
        var strBundleService = Cc["@mozilla.org/intl/stringbundle;1"].getService();
        strBundleService = strBundleService.QueryInterface(Ci.nsIStringBundleService);
        this.enigStringBundle = strBundleService.createBundle("chrome://enigmail/locale/enigmail.properties");
      } catch (ex) {
        this.ERROR_LOG("enigmailCommon.jsm: Error in instantiating stringBundleService\n");
      }
    }
    if (this.enigStringBundle) {
      try {
        if(restCount > 0) {
          var subPhrases = new Array();
          for (var i = 1; i < arguments.length; i++) {
            subPhrases.push(arguments[i]);
          }
          return this.enigStringBundle.formatStringFromName(aStr, subPhrases, subPhrases.length);
        }
        else {
          return this.enigStringBundle.GetStringFromName(aStr);
        }
      } catch (ex) {
        this.ERROR_LOG("enigmailCommon.jsm: Error in querying stringBundleService for string '"+aStr+"'\n");
      }
    }
    return aStr;
  },

  convertToUnicode: function (text, charset) {
    this.DEBUG_LOG("enigmailCommon.jsm: convertToUnicode: "+charset+"\n");

    if (!text || (charset && (charset.toLowerCase() == "iso-8859-1")))
      return text;

    if (! charset) charset = "utf-8";

    // Encode plaintext
    try {
      var unicodeConv = Cc[NS_ISCRIPTABLEUNICODECONVERTER_CONTRACTID].getService(Components.interfaces.nsIScriptableUnicodeConverter);

      unicodeConv.charset = charset;
      return unicodeConv.ConvertToUnicode(text);

    } catch (ex) {
      return text;
    }
  },

  convertFromUnicode: function (text, charset) {
    this.DEBUG_LOG("enigmailCommon.jsm: convertFromUnicode: "+charset+"\n");

    if (!text)
      return "";

    if (! charset) charset="utf-8";

    // Encode plaintext
    try {
      var unicodeConv = Cc[NS_ISCRIPTABLEUNICODECONVERTER_CONTRACTID].getService(Components.interfaces.nsIScriptableUnicodeConverter);

      unicodeConv.charset = charset;
      return unicodeConv.ConvertFromUnicode(text);

    } catch (ex) {
      this.DEBUG_LOG("enigmailCommon.jsm: convertFromUnicode: caught an exception\n");

      return text;
    }
  },

  convertFromGpg: function (text) {
    if (typeof(text)=="string") {
      text = text.replace(/\\x3a/ig, "\\e3A");
      var a=text.search(/\\x[0-9a-fA-F]{2}/);
      while (a>=0) {
          var ch=unescape('%'+text.substr(a+2,2));
          var r= new RegExp("\\"+text.substr(a,4));
          text=text.replace(r, ch);

          a=text.search(/\\x[0-9a-fA-F]{2}/);
      }

      text = this.convertToUnicode(text, "utf-8").replace(/\\e3A/g, ":");
    }

    return text;
  },

  parseErrorOutput: function (errOutput, statusFlagsObj, statusMsgObj, blockSeparationObj) {

    this.WRITE_LOG("enigmailCommon.jsm: parseErrorOutput:\n");
    var errLines = errOutput.split(/\r?\n/);

    // Discard last null string, if any
    if ((errLines.length > 1) && !errLines[errLines.length-1])
      errLines.pop();

    var errArray    = new Array();
    var statusArray = new Array();
    var lineSplit = null;
    var errCode = 0;
    var detectedCard = null;
    var requestedCard = null;
    var errorMsg = "";
    statusMsgObj.value = "";

    var statusPat = /^\[GNUPG:\] /;
    var statusFlags = 0;

    for (var j=0; j<errLines.length; j++) {
      if (errLines[j].search(statusPat) == 0) {
        var statusLine = errLines[j].replace(statusPat,"");
        statusArray.push(statusLine);

        var matches = statusLine.match(/^(\w+)\b/);

        if (matches && (matches.length > 1)) {
          var flag = gStatusFlags[matches[1]];

          if (flag == Ci.nsIEnigmail.NODATA) {
            // Recognize only "NODATA 1"
            if (statusLine.search(/NODATA 1\b/) < 0)
              flag = 0;
          }
          else if (flag == Ci.nsIEnigmail.CARDCTRL) {
            lineSplit = statusLine.split(/ +/);
            if (lineSplit[1] == "3") {
              detectedCard=lineSplit[2];
            }
            else {
              errCode = Number(lineSplit[1]);
              if (errCode == 1) requestedCard = lineSplit[2];
            }
          }
          else if (flag == Ci.nsIEnigmail.UNVERIFIED_SIGNATURE) {
            lineSplit = statusLine.split(/ +/);
            if (lineSplit.length > 7 && lineSplit[7] == "4") {
              flag = Ci.nsIEnigmail.UNKNOWN_ALGO;
            }
          }
          else if (flag == gStatusFlags["INV_SGNR"]) {
            lineSplit = statusLine.split(/ +/);
            statusFlags |= Ci.nsIEnigmail.DISPLAY_MESSAGE;
            flag = 0;
            this.DEBUG_LOG("enigmailCommon.jsm: detected invalid sender: "+lineSplit[2]+" / code: "+lineSplit[1]+"\n");
            statusMsgObj.value += this.getString("gnupg.invalidKey.desc", lineSplit[2]);
          }

          if (flag)
            statusFlags |= flag;

          //this.DEBUG_LOG("enigmailCommon.jsm: Enigmail.parseErrorOutput: status match '+matches[1]+"\n");
        }

      } else {
        errArray.push(errLines[j]);
      }
    }

    // detect forged message insets

    if (! blockSeparationObj) {
      blockSeparationObj = new Object();
    }
    blockSeparationObj.value = "";

    var plaintextCount=0;
    var withinCryptoMsg = false;
    var cryptoStartPat = /^BEGIN_DECRYPTION/;
    var cryptoEndPat = /^END_DECRYPTION/;
    var plaintextPat = /^PLAINTEXT /;
    var plaintextLengthPat = /^PLAINTEXT_LENGTH /;
    for (j=0; j<statusArray.length; j++) {
      if (statusArray[j].search(cryptoStartPat) == 0) {
        withinCryptoMsg = true;
      }
      else if (withinCryptoMsg && statusArray[j].search(cryptoEndPat) == 0) {
        withinCryptoMsg = false;
      }
      else if (statusArray[j].search(plaintextPat) == 0) {
        ++plaintextCount;
        if ((statusArray.length > j+1) && (statusArray[j+1].search(plaintextLengthPat) == 0)) {
          matches = statusArray[j+1].match(/(\w+) (\d+)/);
          if (matches.length>=3) {
            blockSeparationObj.value += (withinCryptoMsg ? "1" : "0") + ":"+matches[2]+" ";
          }
        }
        else {
          // strange: we got PLAINTEXT XX, but not PLAINTEXT_LENGTH XX
          blockSeparationObj.value += (withinCryptoMsg ? "1" : "0") + ":0 ";
        }
      }
    }

    if (plaintextCount > 1) statusFlags |= (Ci.nsIEnigmail.PARTIALLY_PGP | Ci.nsIEnigmail.DECRYPTION_FAILED | Ci.nsIEnigmail.BAD_SIGNATURE);

    blockSeparationObj.value = blockSeparationObj.value.replace(/ $/, "");
    statusFlagsObj.value = statusFlags;
    if (statusMsgObj.value.length == 0) statusMsgObj.value = statusArray.join("\n");
    if (errorMsg.length == 0)
      errorMsg = errArray.map(this.convertFromGpg, this).join("\n");


    if ((statusFlags & Ci.nsIEnigmail.CARDCTRL) && errCode >0) {
      switch (errCode) {
      case 1:
        if (detectedCard) {
          errorMsg = this.getString("sc.wrongCardAvailable", detectedCard, requestedCard);
        }
        else
          errorMsg = this.getString("sc.insertCard", requestedCard);
        break;
      case 2:
        errorMsg = this.getString("sc.removeCard");
      case 4:
        errorMsg = this.getString("sc.noCardAvailable");
        break;
      case 5:
        errorMsg = this.getString("sc.noReaderAvailable");
        break;
      }
      statusFlags |= Ci.nsIEnigmail.DISPLAY_MESSAGE;
    }


    this.DEBUG_LOG("enigmailCommon.jsm: parseErrorOutput: statusFlags = "+this.bytesToHex(this.pack(statusFlags,4))+"\n");

    return errorMsg;
  },

  // pack/unpack: Network (big-endian) byte order

  pack: function (value, bytes) {
    var str = '';
    var mask = 0xff;
    for (var j=0; j < bytes; j++) {
      str = String.fromCharCode( (value & mask) >> j*8 ) + str;
      mask <<= 8;
    }

    return str;
  },

  unpack: function (str) {
    var len = str.length;
    var value = 0;

    for (var j=0; j < len; j++) {
      value <<= 8;
      value  |= str.charCodeAt(j);
    }

    return value;
  },



  bytesToHex: function (str) {
    var len = str.length;

    var hex = '';
    for (var j=0; j < len; j++) {
      var charCode = str.charCodeAt(j);
      hex += hexTable.charAt((charCode & 0xf0) >> 4) +
             hexTable.charAt((charCode & 0x0f));
    }

    return hex;
  },

  getLogLevel: function() {
    return gLogLevel;
  },

  initialize: function (enigmailSvc, logLevel) {
    this.enigmailSvc = enigmailSvc;
    gLogLevel = logLevel;
  }
};

