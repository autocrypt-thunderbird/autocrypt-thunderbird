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
 * are Copyright (C) 2005 Patrick Brunschwig.
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

var gEnigIdentity;
var gEnablePgp;
var gPgpKeyMode;
var gPgpkeyId;
var gEnigPrefbranch;
var gEncryptionChoicesEnabled;
var gPgpSignPlainPolicy;
var gPgpSignEncPolicy;
var gEncryptionPolicy;
var gOpenPgpHeaderKeyId;
var gOpenPgpHeaderUrl;
var gOpenPgpUrlName;
var gEnigAccount;
var gEnigDlgOnAccept;

const ENIG_HEADERMODE_KEYID = 0x01;
const ENIG_HEADERMODE_URL   = 0x10;

EnigInitCommon("pref-enigmail");

function enigOnInit()
{
  // initialize all of our elements based on the current identity values....
  gEnablePgp          = document.getElementById("enablePgp");
  gPgpKeyMode         = document.getElementById("pgpKeyMode");
  gOpenPgpHeaderKeyId = document.getElementById("openpgpHeaderMode.keyId");
  gOpenPgpHeaderUrl   = document.getElementById("openpgpHeaderMode.url");
  gOpenPgpUrlName     = document.getElementById("openpgpHeaderMode.url.name");
  gPgpkeyId           = document.getElementById("identity.pgpkeyId");
  gPgpSignEncPolicy   = document.getElementById("sign_encrypted");
  gPgpSignPlainPolicy = document.getElementById("sign_notEncrypted");
  gEncryptionPolicy   = document.getElementById("encrypt_ifPossible");

  if (gEnigIdentity) {
    gEnablePgp.checked  = gEnigIdentity.getBoolAttribute("enablePgp");
    gEncryptionChoicesEnabled = gEnablePgp.checked;

    var selectedItemId = null;
    var keyPolicy = gEnigIdentity.getIntAttribute("pgpKeyMode");
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

    var openPgpHeaderMode=gEnigIdentity.getIntAttribute("openPgpHeaderMode");
    if (openPgpHeaderMode & ENIG_HEADERMODE_KEYID)
      gOpenPgpHeaderKeyId.checked = true;

    if (openPgpHeaderMode & ENIG_HEADERMODE_URL)
      gOpenPgpHeaderUrl.checked = true;

    gPgpkeyId.value = gEnigIdentity.getCharAttribute("pgpkeyId");
    EnigGetSignMsg(gEnigIdentity);
    gPgpSignEncPolicy.checked = gEnigIdentity.getBoolAttribute("pgpSignEncrypted");
    gPgpSignPlainPolicy.checked = gEnigIdentity.getBoolAttribute("pgpSignPlain");
    gEncryptionPolicy.checked = (gEnigIdentity.getIntAttribute("defaultEncryptionPolicy")>0);
    gOpenPgpUrlName.value = gEnigIdentity.getCharAttribute("openPgpUrlName");
  }
  else {
    gEnablePgp.checked=false;
    gEncryptionChoicesEnabled=false;
  }
  
  // Disable all locked elements on the panel
  //onLockPreference();
  enigEnableAllPrefs();
}

function enigOnLoadEditor() {
  if (typeof(gAccount) == "object") {
    gEnigAccount  = gAccount;
    gEnigIdentity = gIdentity;
  }
  else {
    gEnigIdentity = window.arguments[0].identity;
    gEnigAccount = window.arguments[0].account;
  }
  
  if (gEnigIdentity) {
    var idLabel = EnigGetString("identityName", gEnigIdentity.identityName);
    document.getElementById("identityName").value = idLabel;
  }
  
  var dlg = document.getElementsByTagName("dialog")[0];
  dlg.setAttribute("ondialogaccept", "return enigOnAcceptEditor();");
  
  enigOnInit();
}

function enigOnAcceptEditor() {
  try {
    if (onOk()==false) {
      return false;
    }
  }
  catch (ex) {}
  enigOnSave();
}

function onPreInit(account, accountValues)
{
  gEnigIdentity = account.defaultIdentity;
  gEnigAccount = account;
}

function enigOnSave()
{
  if (! gEnigIdentity) {
    gEnigIdentity = gIdentity;
  }
  gEnigIdentity.setBoolAttribute("enablePgp", gEnablePgp.checked);

  if (gEnablePgp.checked) {
    // PGP is enabled
    
    var openPgpHeaderMode = 0;
    
    if (gOpenPgpHeaderKeyId.checked)
      openPgpHeaderMode += ENIG_HEADERMODE_KEYID;

    if (gOpenPgpHeaderUrl.checked)
      openPgpHeaderMode += ENIG_HEADERMODE_URL;

    gEnigIdentity.setIntAttribute("pgpKeyMode", gPgpKeyMode.selectedItem.value);
    gEnigIdentity.setCharAttribute("pgpkeyId", gPgpkeyId.value);
    gEnigIdentity.setBoolAttribute("pgpSignEncrypted", gPgpSignEncPolicy.checked);
    gEnigIdentity.setBoolAttribute("pgpSignPlain", gPgpSignPlainPolicy.checked);
    gEnigIdentity.setIntAttribute("defaultEncryptionPolicy", (gEncryptionPolicy.checked ? 1 : 0));
    gEnigIdentity.setIntAttribute("openPgpHeaderMode", openPgpHeaderMode);
    gEnigIdentity.setCharAttribute("openPgpUrlName", gOpenPgpUrlName.value)
  }
}

function enigToggleEnable() {
  gEncryptionChoicesEnabled = (! gEncryptionChoicesEnabled);
  enigEnableAllPrefs();
}

function enigEnableAllPrefs()
{
  var elem = document.getElementById("bcEnablePgp");
  if (gEncryptionChoicesEnabled) {
    if (elem) elem.removeAttribute("disabled");
  }
  else {
    if (elem) elem.setAttribute("disabled", "true");
  }

  enigEnableKeySel(gEncryptionChoicesEnabled && (gPgpKeyMode.value == 1));

}

function enigEnableKeySel(enable)
{
  if (enable) {
    document.getElementById("bcUseKeyId").removeAttribute("disabled");
  }
  else {
    document.getElementById("bcUseKeyId").setAttribute("disabled", "true");
  }
  enigEnableUrlName();
}

function enigEnableUrlName() {
  if (gOpenPgpHeaderUrl.checked) {
    document.getElementById("bcUseUrl").removeAttribute("disabled");
  }
  else {
    document.getElementById("bcUseUrl").setAttribute("disabled", "true");
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

