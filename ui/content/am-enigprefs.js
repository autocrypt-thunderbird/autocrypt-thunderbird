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
 * Portions created by Patrick Brunschwig <patrick.brunschwig@gmx.net>
 * are Copyright (C) 2003 Patrick Brunschwig.
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

var gPref = null;
var gIdentity;
var gEnablePgp;
var gPgpKeyMode;
var gPgpkeyId;
var gEnigPrefbranch;
var gEncryptionChoicesEnabled;
var gPgpSignPlainPolicy;
var gPgpSignEncPolicy;
var gEncryptionPolicy;

var gAccount;

EnigInitCommon("pref-enigmail");

function onInit()
{
  // initialize all of our elements based on the current identity values....
  gEnablePgp          = document.getElementById("enablePgp");
  gPgpKeyMode         = document.getElementById("pgpKeyMode");

  gEnablePgp.checked = gIdentity.getBoolAttribute("enablePgp");
  gEncryptionChoicesEnabled = gEnablePgp.checked;

  var selectedItemId = null;
  var keyPolicy = gIdentity.getIntAttribute("pgpKeyMode");
  switch (keyPolicy)
  {
    case 1:
      selectedItemId = 'keymode_usePgpkeyId';
      break;
    default:
      selectedItemId = 'keymode_useFromAddress';
      break;
  }

  gPgpKeyMode.selectedItem = document.getElementById(selectedItemId);
  gPgpkeyId = document.getElementById("identity.pgpkeyId");
  gPgpkeyId.value = gIdentity.getCharAttribute("pgpkeyId");
  EnigGetSignMsg(gIdentity);
  gPgpSignEncPolicy = document.getElementById("sign_encrypted");
  gPgpSignEncPolicy.checked = gIdentity.getBoolAttribute("pgpSignEncrypted");
  gPgpSignPlainPolicy = document.getElementById("sign_notEncrypted");
  gPgpSignPlainPolicy.checked = gIdentity.getBoolAttribute("pgpSignPlain");

  gEncryptionPolicy = document.getElementById("encrypt_ifPossible");
  gEncryptionPolicy.checked = (gIdentity.getIntAttribute("defaultEncryptionPolicy")>0);

  // Disable all locked elements on the panel
  //onLockPreference();
  enigEnableAllPrefs();
}

function onPreInit(account, accountValues)
{
  gIdentity = account.defaultIdentity;
  gAccount = account;
}

function onSave()
{
  gIdentity.setBoolAttribute("enablePgp", gEnablePgp.checked);

  if (gEnablePgp.checked) {
    // PGP is enabled
    gIdentity.setIntAttribute("pgpKeyMode", gPgpKeyMode.selectedItem.value);
    gIdentity.setCharAttribute("pgpkeyId", gPgpkeyId.value);
    gIdentity.setBoolAttribute("pgpSignEncrypted", gPgpSignEncPolicy.checked);
    gIdentity.setBoolAttribute("pgpSignPlain", gPgpSignPlainPolicy.checked);
    gIdentity.setIntAttribute("defaultEncryptionPolicy", (gEncryptionPolicy.checked ? 1 : 0));
  }
}

function onLockPreference()
{
  var i=0;
}


// Does the work of disabling an element given the array which contains xul id/prefstring pairs.
// Also saves the id/locked state in an array so that other areas of the code can avoid
// stomping on the disabled state indiscriminately.
function disableIfLocked( prefstrArray )
{

  var i=1;
}

function enigToggleEnable() {
  gEncryptionChoicesEnabled = (! gEncryptionChoicesEnabled);
  enigEnableAllPrefs();
}

function enigEnableAllPrefs()
{
  var allItems = ["pgpKeyMode",
                  "keymode_useFromAddress",
                  "keymode_usePgpkeyId",
                  "encrypt_ifPossible",
                  "sign_encrypted",
                  "sign_notEncrypted",
                  "enigmailPrefs"];

  var enable = gEncryptionChoicesEnabled;

  var i;
  for (i=0; i<allItems.length; i++) {
    if (enable) {
      document.getElementById(allItems[i]).removeAttribute("disabled");
    }
    else {
      document.getElementById(allItems[i]).setAttribute("disabled", "true");
    }
  }

  enigEnableKeySel(enable && (gPgpKeyMode.value == 1));

}

function enigEnableKeySel(enable)
{
  if (enable) {
    document.getElementById("identity.pgpkeyId").removeAttribute("disabled");
    document.getElementById("selectPgpKey").removeAttribute("disabled");
  }
  else {
    document.getElementById("identity.pgpkeyId").setAttribute("disabled", "true");
    document.getElementById("selectPgpKey").setAttribute("disabled", "true");
  }
}

function enigSelectKeyId()
{
  var resultObj = new Object();
  var inputObj = new Object();
  inputObj.dialogHeader = EnigGetString("encryptKeyHeader");
  inputObj.options = "single,hidexpired,private,nosending";


  window.openDialog("chrome://enigmail/content/enigmailUserSelection.xul","", "dialog,modal,centerscreen", inputObj, resultObj);
  try {
    if (resultObj.cancelled) return;
    var selKey = resultObj.userList[0];
    selKey = "0x"+selKey.substring(10,18)
    gPgpkeyId.value = selKey;
  } catch (ex) {
    // cancel pressed -> don't send mail
    return;
  }
}

