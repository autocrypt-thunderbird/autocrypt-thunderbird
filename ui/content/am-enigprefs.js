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
 * Portions created by Patrick Brunschwig <patrick.brunschwig@gmx.net> are
 * Copyright (C) 2003 Patrick Brunschwig. All Rights Reserved.
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
var gPgpAlwaysSign;
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
  gPgpAlwaysSign = document.getElementById("pgpAlwaysSign");
  gPgpAlwaysSign.checked = gIdentity.getBoolAttribute("pgpAlwaysSign");

  gEncryptionPolicy = document.getElementById("defaultEncryptionPolicy");
  var encryptionPolicy = gIdentity.getIntAttribute("defaultEncryptionPolicy");

  switch (encryptionPolicy)
  {
    case 1:
      selectedItemId = 'encrypt_ifPossible';
      break;
    default:
      selectedItemId = 'encrypt_never';
      break;
  }

  gEncryptionPolicy.selectedItem = document.getElementById(selectedItemId);

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
    gIdentity.setBoolAttribute("pgpAlwaysSign", gPgpAlwaysSign.checked);
    gIdentity.setIntAttribute("defaultEncryptionPolicy", gEncryptionPolicy.selectedItem.value)

    /*
    if (gIdentity.getBoolAttribute("compose_html")) {
      var prefService = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefService);
      var finalPrefString = "mail.identity." + gIdentity.key + ".";
      var prefBranch = prefService.getBranch(finalPrefString);

      if (EnigConfirm(EnigGetString("turnOffHtml")))
        prefBranch.setBoolPref("compose_html", false);
    } */
  }
}

function onLockPreference()
{
/*
  var initPrefString = "mail.identity";
  var finalPrefString;

  var prefService = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefService);

  var allPrefElements = [
    { prefstring:"enablePgp", id:"enablePgp"} /*,
    { prefstring:"encryptionCertSelectButton", id:"encryptionCertSelectButton"},
    { prefstring:"sign_mail", id:"identity.sign_mail"},
    { prefstring:"keyPolicy", id:"encryptionChoices"}
  ];

  finalPrefString = initPrefString + "." + gIdentity.key + ".";
  gEnigPrefbranch = prefService.getBranch(finalPrefString);

  disableIfLocked( allPrefElements ); */
  var i=0;
}


// Does the work of disabling an element given the array which contains xul id/prefstring pairs.
// Also saves the id/locked state in an array so that other areas of the code can avoid
// stomping on the disabled state indiscriminately.
function disableIfLocked( prefstrArray )
{
/*  var i;
  for (i=0; i<prefstrArray.length; i++) {
    var id = prefstrArray[i].id;
    var element = document.getElementById(id);
    if (gEnigPrefbranch.prefIsLocked(prefstrArray[i].prefstring)) {
      // If encryption choices radio group is locked, make sure the individual
      // choices in the group are locked. Set a global (gEncryptionChoicesEnabled)
      // indicating the status so that locking can be maintained further.
      if (id == "enablePgp") {
        document.getElementById("noPgpPassphrase").setAttribute("disabled", "true");
        gEncryptionChoicesEnabled = true;
      }
      // If option to sign mail is locked (with true/false set in config file), disable
      // the corresponding checkbox and set a global (gSigningChoicesLocked) in order to
      // honor the locking as user changes other elements on the panel.
      /*
      if (id == "identity.sign_mail") {
        document.getElementById("identity.sign_mail").setAttribute("disabled", "true");
        gSigningChoicesLocked = true;
      }
      else {
        element.setAttribute("disabled", "true");
        if (id == "signingCertSelectButton") {
          document.getElementById("signingCertClearButton").setAttribute("disabled", "true");
        }
        else if (id == "encryptionCertSelectButton") {
          document.getElementById("encryptionCertClearButton").setAttribute("disabled", "true");
        }
      }
    }
  } */

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
                  "pgpAlwaysSign",
                  "defaultEncryptionPolicy",
                  "encrypt_never",
                  "encrypt_ifPossible",
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
