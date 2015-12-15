/*global Components: false */
/*jshint -W097 */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */


"use strict";

var EXPORTED_SYMBOLS = ["EnigmailArmor"];

Components.utils.import("resource://enigmail/log.jsm"); /* global EnigmailLog: false */

const Ci = Components.interfaces;

const nsIEnigmail = Ci.nsIEnigmail;

// Locates STRing in TEXT occurring only at the beginning of a line
function indexOfArmorDelimiter(text, str, offset) {
  let currentOffset = offset;

  while (currentOffset < text.length) {
    let loc = text.indexOf(str, currentOffset);

    if (loc === -1 || loc === 0 || text.charAt(loc - 1) == "\n") {
      return loc;
    }

    currentOffset = loc + str.length;
  }

  return -1;
}

function searchBlankLine(str, then) {
  var offset = str.search(/\n\s*\r?\n/);
  if (offset === -1) {
    return "";
  }
  else {
    return then(offset);
  }
}

function indexOfNewline(str, off, then) {
  var offset = str.indexOf("\n", off);
  if (offset === -1) {
    return "";
  }
  else {
    return then(offset);
  }
}

const EnigmailArmor = {
  // Locates offsets bracketing PGP armored block in text,
  // starting from given offset, and returns block type string.
  // beginIndex = offset of first character of block
  // endIndex = offset of last character of block (newline)
  // If block is not found, the null string is returned;
  locateArmoredBlock: function(text, offset, indentStr, beginIndexObj, endIndexObj, indentStrObj) {
    EnigmailLog.DEBUG("enigmail.js: Enigmail.locateArmoredBlock: " + offset + ", '" + indentStr + "'\n");

    beginIndexObj.value = -1;
    endIndexObj.value = -1;

    var beginIndex = indexOfArmorDelimiter(text, indentStr + "-----BEGIN PGP ", offset);

    if (beginIndex == -1) {
      var blockStart = text.indexOf("-----BEGIN PGP ");
      if (blockStart >= 0) {
        var indentStart = text.search(/\n.*\-\-\-\-\-BEGIN PGP /) + 1;
        indentStrObj.value = text.substring(indentStart, blockStart);
        indentStr = indentStrObj.value;
        beginIndex = indexOfArmorDelimiter(text, indentStr + "-----BEGIN PGP ", offset);
      }
    }

    if (beginIndex == -1)
      return "";

    // Locate newline at end of armor header
    offset = text.indexOf("\n", beginIndex);

    if (offset == -1)
      return "";

    var endIndex = indexOfArmorDelimiter(text, indentStr + "-----END PGP ", offset);

    if (endIndex == -1)
      return "";

    // Locate newline at end of PGP block
    endIndex = text.indexOf("\n", endIndex);

    if (endIndex == -1) {
      // No terminating newline
      endIndex = text.length - 1;
    }

    var blockHeader = text.substr(beginIndex, offset - beginIndex + 1);

    var blockRegex = new RegExp("^" + indentStr +
      "-----BEGIN PGP (.*)-----\\s*\\r?\\n");

    var matches = blockHeader.match(blockRegex);

    var blockType = "";
    if (matches && (matches.length > 1)) {
      blockType = matches[1];
      EnigmailLog.DEBUG("enigmail.js: Enigmail.locateArmoredBlock: blockType=" + blockType + "\n");
    }

    if (blockType == "UNVERIFIED MESSAGE") {
      // Skip any unverified message block
      return EnigmailArmor.locateArmoredBlock(text, endIndex + 1, indentStr, beginIndexObj, endIndexObj, indentStrObj);
    }

    beginIndexObj.value = beginIndex;
    endIndexObj.value = endIndex;

    return blockType;
  },

  /*
   *     locateArmoredBlocks returns an array with GPGBlock positions
   *
   *      Struct:
   *        int obj.begin
   *        int obj.end
   *        string obj.blocktype
   *
   *
   *     @param string text
   *
   *     @return empty array if no block was found
   *
   */
  locateArmoredBlocks: function(text) {
    var beginObj = {};
    var endObj = {};
    var blocks = [];
    var i = 0;
    var b;

    while ((b = EnigmailArmor.locateArmoredBlock(text, i, "", beginObj, endObj, {})) !== "") {
      blocks.push({
        begin: beginObj.value,
        end: endObj.value,
        blocktype: b
      });

      i = endObj.value;
    }

    EnigmailLog.DEBUG("enigmail.js: locateArmorBlocks: Found " + blocks.length + " Blocks\n");
    return blocks;
  },

  extractSignaturePart: function(signatureBlock, part) {
    EnigmailLog.DEBUG("enigmail.js: Enigmail.extractSignaturePart: part=" + part + "\n");

    return searchBlankLine(signatureBlock, function(offset) {
      return indexOfNewline(signatureBlock, offset + 1, function(offset) {
        var beginIndex = signatureBlock.indexOf("-----BEGIN PGP SIGNATURE-----", offset + 1);
        if (beginIndex == -1) {
          return "";
        }

        if (part === nsIEnigmail.SIGNATURE_TEXT) {
          return signatureBlock.substr(offset + 1, beginIndex - offset - 1).
          replace(/^- -/, "-").
          replace(/\n- -/g, "\n-").
          replace(/\r- -/g, "\r-");
        }

        return indexOfNewline(signatureBlock, beginIndex, function(offset) {
          var endIndex = signatureBlock.indexOf("-----END PGP SIGNATURE-----", offset);
          if (endIndex == -1) {
            return "";
          }

          var signBlock = signatureBlock.substr(offset, endIndex - offset);

          return searchBlankLine(signBlock, function(armorIndex) {
            if (part == nsIEnigmail.SIGNATURE_HEADERS) {
              return signBlock.substr(1, armorIndex);
            }

            return indexOfNewline(signBlock, armorIndex + 1, function(armorIndex) {
              if (part == nsIEnigmail.SIGNATURE_ARMOR) {
                return signBlock.substr(armorIndex, endIndex - armorIndex).
                replace(/\s*/g, "");
              }
              else {
                return "";
              }
            });
          });
        });
      });
    });
  },

  registerOn: function(target) {
    target.locateArmoredBlock = EnigmailArmor.locateArmoredBlock;
    target.locateArmoredBlocks = EnigmailArmor.locateArmoredBlocks;
    target.extractSignaturePart = EnigmailArmor.extractSignaturePart;
  }
};
