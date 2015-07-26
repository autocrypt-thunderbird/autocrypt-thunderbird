/*global Components: false, EnigmailLog: false */
/*jshint -W097 */
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
 * Copyright (C) 2010 Patrick Brunschwig. All Rights Reserved.
 *
 * Contributor(s):
 *  Patrick Brunschwig <patrick@enigmail.net>
 *  Janosch Rux <rux@informatik.uni-luebeck.de>
 *  Fan Jiang <fanjiang@thoughtworks.com>
 *  Iván Pazmiño <iapazmino@thoughtworks.com>
 *  Ola Bini <obini@thoughtworks.com>
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

"use strict";

const EXPORTED_SYMBOLS = ["EnigmailArmor"];

Components.utils.import("resource://enigmail/log.jsm");

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
