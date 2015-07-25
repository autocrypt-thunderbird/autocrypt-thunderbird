/*
 * ***** BEGIN LICENSE BLOCK *****
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
 * Copyright (C) 2004 Patrick Brunschwig. All Rights Reserved.
 *
 * Contributor(s):
 *   Russell Francis <rf358197@ohio.edu>
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
 * ***** END LICENSE BLOCK ***** *
 */


EnigInitCommon("enigmailViewKeySigDlg");

var gKeyListArr;

function onLoad() {
  gKeyListArr = window.arguments[0].keyListArr;
  window.arguments[1].refresh = false;
  loadList();
}

function setWindowPos(x, y) {
  window.screenX = x;
  window.screenY = y;
}

function loadList() {
  var enigmailSvc = GetEnigmailSvc();
  if (!enigmailSvc) {
    EnigAlert(EnigGetString("accessError"));
    window.close();
    return;
  }

  var inArg = window.arguments[0];
  var keyId = inArg.keyId;
  var keyIdValue = document.getElementById("keyIdValue");

  if (typeof(inArg.posX) == "number" &&
    typeof(inArg.posY) == "number") {
    EnigmailEvents.dispatchEvent(setWindowPos, 0, inArg.posX, inArg.posY);
  }

  keyIdValue.value = gKeyListArr[keyId].userId + " - 0x" + inArg.keyId.substr(-8, 8);

  var exitCodeObj = {};
  var errorMsgObj = {};

  var sigList = EnigmailKeyRing.getKeySig("0x" + keyId, exitCodeObj, errorMsgObj);

  if (exitCodeObj.value !== 0) {
    EnigAlert(errorMsgObj.value);
    window.close();
    return;
  }


  var keySigList = document.getElementById("keySigList");
  var treeChildren = keySigList.getElementsByAttribute("id", "keySigListChildren")[0];

  // aSigList holds all signature packets, each line per element
  var aSigList = sigList.split(/\n/);

  // aSigSort holds an index (for use within aSigList) and the creation time of the picked signature lines for one uid, separated by a comma
  var aSigSort = [];

  // Indices for aSigSort elements when splitted at the comma
  const aSigSort_index = 0;
  const aSigSort_creation_time = 1;

  // store the last encountered Uid record
  var currUid = "";

  // This function sorts by date (second part of a aSigSort element)
  var sortSigbyDate = function(a, b) {
    var a_sortlistRow = a.split(/,/);
    var b_sortlistRow = b.split(/,/);
    if (a_sortlistRow[aSigSort_creation_time] < b_sortlistRow[aSigSort_creation_time]) {
      return -1;
    }
    else {
      return 1;
    }
  };


  /**
   * converts all collected signatures (by their indices in aSigSort) to dialog cells
   *
   * input parameters: none (expects aSigSort filled or empty)
   * output parameters: signatures displayed in window
   *
   * @return:  nothing
   **/

  function put_all_signatures() {
    // First sort the signature packets by date
    aSigSort.sort(sortSigbyDate);

    // now process all sig/rev lines
    for (var i = 0; i < aSigSort.length; i++) {
      var SortRow = aSigSort[i].split(/,/);
      var listRow = aSigList[SortRow[aSigSort_index]].split(/:/);
      if (listRow[0] == "rev") {
        var nodes = document.getElementsByAttribute("sigID", currUid + "-" + listRow[ENIG_KEY_ID]);
        for (var node = 0; node < nodes.length; node++) {
          try {
            nodes[node].childNodes[3].setAttribute("label", EnigGetString("keyValid.revoked"));
            var cNode = nodes[node].firstChild;
            while (cNode) {
              cNode.setAttribute("properties", "enigKeyInactive");
              cNode = cNode.nextSibling;
            }
          }
          catch (ex) {}
        }
      }
      else {
        userRow = document.createElement("treerow");
        if (typeof(gKeyListArr[listRow[ENIG_KEY_ID]]) == "object") {
          addCell(userRow, "   " + EnigConvertGpgToUnicode(listRow[ENIG_USER_ID]));
        }
        else {
          addCell(userRow, "   " + EnigGetString("userIdNotFound"));
        }
        addCell(userRow, listRow[ENIG_KEY_ID].substr(-8, 8));
        if (listRow[ENIG_SIG_TYPE].substr(2, 1) == "x") {
          addCell(userRow, EnigGetString("keySignatureExportable"));
        }
        else {
          addCell(userRow, EnigGetString("keySignatureLocal"));
        }
        if (typeof(gKeyListArr[listRow[ENIG_KEY_ID]]) == "object") {
          addCell(userRow, EnigGetString("signatureValid"));
        }
        else {
          addCell(userRow, EnigGetString("keySignatureNoKey"));
          userRow.setAttribute("noKey", "true");
        }

        userRow.setAttribute("keyID", listRow[ENIG_KEY_ID]);
        userRow.setAttribute("sigID", currUid + "-" + listRow[ENIG_KEY_ID]);
        addCell(userRow, EnigGetDateTime(listRow[ENIG_CREATED], true, false));
        treeItem = document.createElement("treeitem");
        treeItem.appendChild(userRow);
        treeChildren.appendChild(treeItem);
      }
    }
    aSigSort = [];
  }

  for (var i = 0; i < aSigList.length; i++) {
    var listRow = aSigList[i].split(/:/);
    if (listRow.length >= 0) {
      if ((listRow[0] == "uid" || listRow[0] == "pub" || listRow[0] == "uat") && (listRow[ENIG_USER_ID].length > 0)) {
        // First put all collected signatures in the dialog
        put_all_signatures();

        var userRow = document.createElement("treerow");
        if (typeof(listRow[ENIG_KEY_USE_FOR]) != "string") {
          listRow[ENIG_KEY_USE_FOR] = "";
        }
        var keyValid = (ENIG_KEY_NOT_VALID.indexOf(listRow[ENIG_KEY_TRUST]) < 0 &&
          listRow[ENIG_KEY_USE_FOR].indexOf("D") < 0);
        if (listRow[0] == "uat") {
          listRow[ENIG_USER_ID] = EnigGetString("userAtt.photo");
        }

        if (listRow[0] == "uid" || listRow[0] == "uat") {
          currUid = listRow[ENIG_UID_ID];
        }
        addCell(userRow, EnigConvertGpgToUnicode(listRow[ENIG_USER_ID]), true, keyValid);
        var treeItem = document.createElement("treeitem");
        treeItem.appendChild(userRow);
        treeChildren.appendChild(treeItem);
      }
      else if (listRow[0] == "sig") {
        if (listRow[ENIG_USER_ID].length === 0) {
          listRow[ENIG_USER_ID] = "-";
        }
        if (listRow[ENIG_SIG_TYPE].substr(0, 2).toLowerCase() != "1f") {
          // ignore "revoker" signatures
          aSigSort.push(i + "," + listRow[ENIG_CREATED]);
        }
      }
      else if (listRow[0] == "sub") {
        // subkeys do not carry signature packets -> discard
        break;
      }
      else if (listRow[0] == "rev") {
        aSigSort.push(i + "," + listRow[ENIG_CREATED]);
      }
    }
  }

  // put all collected signatures in the dialog
  put_all_signatures();
  // append created window structure
  keySigList.appendChild(treeChildren);
  return;
}

function addCell(row, label, subkeyRow, keyActive) {
  var cell = document.createElement("treecell");
  cell.setAttribute("label", label);
  if (subkeyRow) {
    if (keyActive) {
      cell.setAttribute("properties", "enigmailSubkeyTitle");
    }
    else {
      cell.setAttribute("properties", "enigmailSubkeyTitle enigKeyInactive");
    }
  }
  row.appendChild(cell);
  return cell;
}

function getSelectedRows() {
  var sigList = document.getElementById("keySigList");
  var numRanges = sigList.view.selection.getRangeCount();
  var selectedRows = [];
  var start = {};
  var end = {};

  for (var i = 0; i < numRanges; ++i) {
    sigList.view.selection.getRangeAt(i, start, end);
    for (var j = start.value; j <= end.value; ++j) {
      selectedRows.push(j);
    }
  }

  return (selectedRows);
}

function getRowByIndex(index) {
  var sigList = document.getElementById("keySigList");
  var item = sigList.view.getItemAtIndex(index);
  if (item) {
    return item.firstChild;
  }
  return null;
}

function getCurrRow() {
  var sigList = document.getElementById("keySigList");
  var item = sigList.view.getItemAtIndex(sigList.view.selection.currentIndex);
  if (item) {
    return item.firstChild;
  }
  return null;
}

function showSigCtxMenu() {
  var viewDetailsDisabled = "true";
  var importKeyDisabled = "true";
  var selectedRows = getSelectedRows();
  var row;

  if (selectedRows.length == 1) {
    row = getRowByIndex(selectedRows[0]);
    if (row.hasAttribute("keyID")) {
      if (row.hasAttribute("noKey")) {
        importKeyDisabled = "false";
      }
      else {
        viewDetailsDisabled = "false";
      }
    }
  }
  else {
    /* We have more than one row. If any of them are importable, enable
     * the import menuitem.
     */
    for (var i = 0; i < selectedRows.length; ++i) {
      row = getRowByIndex(selectedRows[i]);
      if (row.hasAttribute("keyID") && row.hasAttribute("noKey")) {
        importKeyDisabled = "false";
        break;
      }
    }
  }
  document.getElementById("bcViewDetails").setAttribute("disabled", viewDetailsDisabled);
  document.getElementById("ctxImportKey").setAttribute("disabled", importKeyDisabled);
}

function listSig() {
  var row = getCurrRow();
  var inputObj = {
    keyId: row.getAttribute("keyID"),
    keyListArr: gKeyListArr,
    posX: window.screenX + 10,
    posY: window.screenY + 10
  };
  var resultObj = {};

  window.openDialog("chrome://enigmail/content/enigmailViewKeySigDlg.xul",
    "", "dialog,modal,centerscreen,resizable=yes", inputObj, resultObj);
  if (resultObj.refresh) {
    window.arguments[1].refresh = true;
  }
}

function viewKeyDetails() {
  var row = getCurrRow();
  var keyId = row.getAttribute("keyID");

  var inputObj = {
    keyId: keyId,
    keyListArr: gKeyListArr,
    secKey: gKeyListArr[keyId].secretAvailable
  };
  var resultObj = {
    refresh: true
  };
  window.openDialog("chrome://enigmail/content/enigmailKeyDetailsDlg.xul",
    "", "dialog,modal,centerscreen", inputObj, resultObj);
  if (resultObj.refresh) {
    window.arguments[1].refresh = true;
  }
}

function importKey() {
  var resultObj = {};
  var inputObj = {};
  inputObj.searchList = [];
  var selectedRows = getSelectedRows();
  for (var i = 0; i < selectedRows.length; ++i) {
    var row = getRowByIndex(selectedRows[i]);
    if (row.hasAttribute("keyID") && row.hasAttribute("noKey")) {
      inputObj.searchList.push("0x" + row.getAttribute("keyID").substr(-8, 8));
    }
  }

  EnigDownloadKeys(inputObj, resultObj);
  if (resultObj.importedKeys > 0) {
    var treeChildren = document.getElementById("keySigListChildren");
    while (treeChildren.firstChild) {
      treeChildren.removeChild(treeChildren.firstChild);
    }
    var keyListObj = {};
    EnigLoadKeyList(true, keyListObj);
    gKeyListArr = keyListObj.keyList;
    window.arguments[1].refresh = true;
    loadList();
  }
}

function handleDblClick(event) {
  if (event) {
    if (event.button !== 0) return;
  }
  var row = getCurrRow();
  if (row.hasAttribute("keyID")) {
    if (row.hasAttribute("noKey")) {
      if (EnigConfirm(EnigGetString("retrieveKeyConfirm"))) {
        importKey();
      }
    }
    else {
      listSig();
    }
  }
}