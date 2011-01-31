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
 * The Initial Developer of the Original Code is Ramalingam Saravanan.
 * Portions created by Ramalingam Saravanan <svn@xmlterm.org> are
 * Copyright (C) 2001 Ramalingam Saravanan. All Rights Reserved.
 *
 * Contributor(s):
 *   Patrick Brunschwig <patrick@mozilla-enigmail.org>
 *   Ludwig Hügelschäfer <ludwig@hammernoch.net>
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


try {
  // TB with omnijar
  Components.utils.import("resource:///modules/gloda/mimemsg.js");
}
catch (ex) {
  // TB without omnijar
  Components.utils.import("resource://app/modules/gloda/mimemsg.js");
}

Components.utils.import("resource://enigmail/enigmailCommon.jsm");
Components.utils.import("resource://enigmail/commonFuncs.jsm");

if (! Enigmail) var Enigmail = {};

Enigmail.msg = {
// List of hash algorithms for PGP/MIME signatures
  mimeHashAlgo: [null, "sha1", "ripemd160", "sha256", "sha384", "sha512", "sha224"],
  editor: null,
  dirty: null,
  processed: null,
  timeoutId: null,
  sendPgpMime: false,
  sendMode: null,
  sendModeDirty: 0,
  nextCommandId: null,
  docaStateListener: null,
  identity: null,
  enableRules: null,
  modifiedAttach: null,
  lastFocusedWindow: null,
  determineSendFlagId: null,
  signRules: 1,
  encryptRules: 1,
  attachOwnKeyObj: {
      appendAttachment: false,
      attachedObj: null,
      attachedKey: null
  },

  compFieldsEnig_CID: "@mozdev.org/enigmail/composefields;1",

  composeStartup: function ()
  {
    EnigmailCommon.DEBUG_LOG("enigmailMsgComposeOverlay.js: Enigmail.msg.composeStartup\n");

    // Relabel/hide SMIME button and menu item
    var smimeButton = document.getElementById("button-security");

    if (smimeButton) {
      smimeButton.setAttribute("label", "S/MIME");
    }

    var enigButton = document.getElementById("button-enigmail-send");

    var msgId = document.getElementById("msgIdentityPopup");
    if (msgId)
      msgId.setAttribute("oncommand", "Enigmail.msg.setIdentityCallback();");

    var subj = document.getElementById("msgSubject");

    subj.setAttribute('onfocus', "Enigmail.msg.fireSendFlags()");

    this.setIdentityDefaults();
    this.msgComposeReset(false);
    this.composeOpen();
  },


  composeUnload: function ()
  {
    EnigmailCommon.DEBUG_LOG("enigmailMsgComposeOverlay.js: Enigmail.msg.composeUnload\n");
    if (gMsgCompose)
      gMsgCompose.UnregisterStateListener(Enigmail.composeStateListener);

  },


  handleClick: function (event, modifyType)
  {
    EnigmailCommon.DEBUG_LOG("enigmailMsgComposeOverlay.js: Enigmail.msg.handleClick\n");
    switch (event.button) {
    case 2:
      // do not process the event any futher
      // needed on Windows to prevent displaying the context menu
      event.preventDefault();
      this.doPgpButton();
      break;
    case 0:
      this.doPgpButton(modifyType);
      break;
    }
  },


  setIdentityCallback: function (elementId)
  {
    EnigmailCommon.DEBUG_LOG("enigmailMsgComposeOverlay.js: Enigmail.msg.setIdentityCallback: elementId="+elementId+"\n");
    this.setIdentityDefaults();
  },

  getAccDefault: function (value)
  {
    EnigmailCommon.DEBUG_LOG("enigmailMsgComposeOverlay.js: Enigmail.msg.getAccDefault: identity="+this.identity.key+" value="+value+"\n");

    var enabled = this.identity.getBoolAttribute("enablePgp");
    if (value == "enabled")
      return enabled;
    if (enabled) {
      var r=null;
      switch (value) {
      case 'encrypt':
        r=this.identity.getIntAttribute("defaultEncryptionPolicy");
        break;
      case 'signPlain':
        r=this.identity.getBoolAttribute("pgpSignPlain");
        break;
      case 'signEnc':
        r=this.identity.getBoolAttribute("pgpSignEncrypted");
        break;
      case 'pgpMimeMode':
      case 'attachPgpKey':
        r=this.identity.getBoolAttribute(value);
        break;
      }
      EnigmailCommon.DEBUG_LOG("  "+value+"="+r+"\n");
      return r;
    }
    else {
      switch (value) {
      case 'encrypt':
        return 0;
      case 'signPlain':
      case 'signEnc':
      case 'pgpMimeMode':
      case 'attachPgpKey':
        return false;
      }
    }
    return null;
  },

  setIdentityDefaults: function ()
  {
    EnigmailCommon.DEBUG_LOG("enigmailMsgComposeOverlay.js: Enigmail.msg.setIdentityDefaults\n");

    this.identity = getCurrentIdentity();
    if (this.getAccDefault("enabled")) {
      EnigmailFuncs.getSignMsg(this.identity);
    }

    if (! this.sendModeDirty) {
      this.setSendDefaultOptions();
      this.updateStatusBar();
    }
  },


  // set the current default for sending a message
  // depending on the identity
  setSendDefaultOptions: function ()
  {
    EnigmailCommon.DEBUG_LOG("enigmailMsgComposeOverlay.js: Enigmail.msg.setSendDefaultOptions\n");

    const nsIEnigmail = Components.interfaces.nsIEnigmail;
    const SIGN    = nsIEnigmail.SEND_SIGNED;
    const ENCRYPT = nsIEnigmail.SEND_ENCRYPTED;

    this.sendMode = 0;
    if (! this.getAccDefault("enabled")) {
      return;
    }
    if (this.getAccDefault("encrypt")>0) {
      this.sendMode |= ENCRYPT;
      if (this.getAccDefault("signEnc")) this.sendMode |= SIGN;
    }
    else {
      if (this.getAccDefault("signPlain")) this.sendMode |= SIGN;
    }

    this.sendPgpMime = this.getAccDefault("pgpMimeMode");
    this.attachOwnKeyObj.appendAttachment = this.getAccDefault("attachPgpKey");
    this.attachOwnKeyObj.attachedObj = null;
    this.attachOwnKeyObj.attachedKey = null;
  },

  getMsgProperties: function (msgUri, draft)
  {
    const nsIEnigmail = Components.interfaces.nsIEnigmail;

    var properties = 0;
    try {
      var messenger = Components.classes["@mozilla.org/messenger;1"].getService(Components.interfaces.nsIMessenger);
      var msgHdr = messenger.messageServiceFromURI(msgUri).messageURIToMsgHdr(msgUri);
      if (msgHdr) {
        properties = msgHdr.getUint32Property("enigmail");
        if (draft) {
          try {
            MsgHdrToMimeMessage(msgHdr , null, this.getMsgPropertiesCb, false);
          }
          catch (ex) {
            EnigmailCommon.DEBUG_LOG("enigmailMessengerOverlay.js: Enigmail.msg.getMsgProperties: cannot use MsgHdrToMimeMessage\n");
          }
        }
      }
    }
    catch (ex) {  }

    var enigMimeService = Components.classes[EnigmailCommon.ENIGMIMESERVICE_CONTRACTID].getService(Components.interfaces.nsIEnigMimeService);
    if (enigMimeService && enigMimeService.isEncrypted(msgUri)) {
      properties |= nsIEnigmail.DECRYPTION_OKAY;
    }

    return properties;
  },

  getMsgPropertiesCb: function  (msg, mimeMsg)
  {
    EnigmailCommon.DEBUG_LOG("enigmailMsgComposeOverlay.js: Enigmail.msg.getMsgPropertiesCb\n");

    const nsIEnigmail = Components.interfaces.nsIEnigmail;
    const SIGN    = nsIEnigmail.SEND_SIGNED;

    var flags = 0;
    if (mimeMsg && mimeMsg.headers["x-enigmail-draft-status"])
      flags = Number(mimeMsg.headers["x-enigmail-draft-status"]);

    if (flags & SIGN) this.setSendMode('sign');
  },


  composeOpen: function ()
  {
    EnigmailCommon.DEBUG_LOG("enigmailMsgComposeOverlay.js: Enigmail.msg.composeOpen\n");

    const nsIEnigmail = Components.interfaces.nsIEnigmail;
    const SIGN    = nsIEnigmail.SEND_SIGNED;
    const ENCRYPT = nsIEnigmail.SEND_ENCRYPTED;

    var msgFlags;
    var msgUri = null;
    var msgIsDraft = false;
    gMsgCompose.RegisterStateListener(Enigmail.composeStateListener);
    this.determineSendFlagId = null;

    var toobarElem = document.getElementById("composeToolbar2");
    if (toobarElem && (EnigmailCommon.getOS() == "Darwin")) {
      toobarElem.setAttribute("platform", "macos");
    }

    if (EnigmailCommon.getPref("keepSettingsForReply") && (!(this.sendMode & ENCRYPT))) {
      var enigMimeService = Components.classes[EnigmailCommon.ENIGMIMESERVICE_CONTRACTID].getService(Components.interfaces.nsIEnigMimeService);
      if (enigMimeService)
      {
        var draftId = gMsgCompose.compFields.draftId;
        if (typeof(draftId)=="string" && draftId.length>0) {
          msgUri = draftId.replace(/\?.*$/, "");
          msgIsDraft = true;
        }
        else if (typeof(gMsgCompose.originalMsgURI)=="string" && gMsgCompose.originalMsgURI.length>0) {
          msgUri = gMsgCompose.originalMsgURI;
        }

        if (msgUri != null) {
          msgFlags = this.getMsgProperties(msgUri, msgIsDraft);
          if (msgFlags & nsIEnigmail.DECRYPTION_OKAY) {
            EnigmailCommon.DEBUG_LOG("enigmailMsgComposeOverlay.js: Enigmail.msg.composeOpen: has encrypted originalMsgUri\n");
            EnigmailCommon.DEBUG_LOG("originalMsgURI="+gMsgCompose.originalMsgURI+"\n");
            this.setSendMode('encrypt');
            this.removeAttachedKey();
          }
          else if (msgFlags & (nsIEnigmail.GOOD_SIGNATURE |
              nsIEnigmail.BAD_SIGNATURE |
              nsIEnigmail.UNVERIFIED_SIGNATURE)) {
            this.setSendMode('sign');
            this.removeAttachedKey();
          }
        }
      }
    }

    // check for attached signature files and remove them
    var bucketList = document.getElementById("attachmentBucket");
    if (bucketList.hasChildNodes()) {
      var node = bucketList.firstChild;
      nodeNumber=0;
      while (node) {
        if (node.attachment.contentType == "application/pgp-signature") {
          if (! this.findRelatedAttachment(bucketList, node)) {
            node = bucketList.removeItemAt(nodeNumber);
            // Let's release the attachment object held by the node else it won't go away until the window is destroyed
            node.attachment = null;
          }
        }
        else {
          ++nodeNumber;
        }
        node = node.nextSibling;
      }
      if (! bucketList.hasChildNodes()) {
        try {
          // TB only
        ChangeAttachmentBucketVisibility(true);
        }
        catch (ex) {}
      }
    }
    this.updateStatusBar();
  },

  // check if an signature is related to another attachment
  findRelatedAttachment: function (bucketList, node)
  {

    // check if filename ends with .sig
    if (node.attachment.name.search(/\.sig$/i) < 0) return null;

    var relatedNode = bucketList.firstChild;
    var findFile = node.attachment.name.toLowerCase();
    var baseAttachment = null;
    while (relatedNode) {
      if (relatedNode.attachment.name.toLowerCase()+".sig" == findFile) baseAttachment = relatedNode.attachment;
      relatedNode = relatedNode.nextSibling;
    }
    return baseAttachment;
  },

  msgComposeReopen: function ()
  {
    EnigmailCommon.DEBUG_LOG("enigmailMsgComposeOverlay.js: Enigmail.msg.msgComposeReopen\n");
    this.msgComposeReset(false);

    this.composeOpen();
  },

  msgComposeClose: function ()
  {
    EnigmailCommon.DEBUG_LOG("enigmailMsgComposeOverlay.js: Enigmail.msg.msgComposeClose\n");

    var ioServ;
    try {
      // we should delete the original temporary files of the encrypted or signed
      // inline PGP attachments (the rest is done automatically)
      if (this.modifiedAttach) {
        ioServ = Components.classes[EnigmailCommon.IOSERVICE_CONTRACTID].getService(Components.interfaces.nsIIOService);
        if (!ioServ)
          return;

        for (var i in this.modifiedAttach) {
          if (this.modifiedAttach[i].origTemp) {
            EnigmailCommon.DEBUG_LOG("enigmailMsgComposeOverlay.js: Enigmail.msg.msgComposeClose: deleting "+this.modifiedAttach[i].origUrl+"\n");
            var fileUri = ioServ.newURI(this.modifiedAttach[i].origUrl, null, null);
            var fileHandle = Components.classes[EnigmailCommon.LOCAL_FILE_CONTRACTID].createInstance(Components.interfaces.nsILocalFile);
            fileHandle.initWithPath(fileUri.path);
            if (fileHandle.exists()) fileHandle.remove(false);
          }
        }
        this.modifiedAttach = null;
      }

    } catch (ex) {
      EnigmailCommon.ERROR_LOG("enigmailMsgComposeOverlay.js: ECSL.ComposeProcessDone: could not delete all files:\n"+ex.toString()+"\n");
    }

    this.msgComposeReset(true);
  },

  msgComposeReset: function (closing)
  {
    EnigmailCommon.DEBUG_LOG("enigmailMsgComposeOverlay.js: Enigmail.msg.msgComposeReset\n");

    this.dirty = 0;
    this.processed = null;
    this.timeoutId = null;

    this.modifiedAttach=null;
    this.sendModeDirty = 0;
    this.sendMode = 0;
    this.enableRules = true;
    this.identity = null;

    if (! closing) {
      this.setIdentityDefaults();
      document.getElementById("enigmail-rules-status").setAttribute("value", "-");
    }
  },


  initRadioMenu: function (prefName, optionIds)
  {
    EnigmailCommon.DEBUG_LOG("enigmailMessengerOverlay.js: Enigmail.msg.initRadioMenu: "+prefName+"\n");

    var encryptId;

    var prefValue = EnigmailCommon.getPref(prefName);

    if (prefValue >= optionIds.length)
      return;

    var menuItem = document.getElementById("enigmail_"+optionIds[prefValue]);
    if (menuItem)
      menuItem.setAttribute("checked", "true");
  },


  usePpgMimeOption: function (value)
  {
    EnigmailCommon.DEBUG_LOG("enigmailMessengerOverlay.js: Enigmail.msg.usePpgMimeOption: "+value+"\n");

    EnigmailCommon.setPref("usePGPMimeOption", value);

    return true;
  },

  togglePgpMime: function ()
  {
    EnigmailCommon.DEBUG_LOG("enigmailMsgComposeOverlay.js: Enigmail.msg.togglePgpMime\n");

    this.sendPgpMime = !this.sendPgpMime;
  },

  toggleAttachOwnKey: function ()
  {
    EnigmailCommon.DEBUG_LOG("enigmailMsgComposeOverlay.js: Enigmail.msg.toggleAttachOwnKey\n");
    EnigmailCommon.getService(window); // make sure Enigmail is loaded and working
    this.attachOwnKeyObj.appendAttachment = !this.attachOwnKeyObj.appendAttachment;
  },

  attachOwnKey: function ()
  {
    EnigmailCommon.DEBUG_LOG("enigmailMsgComposeOverlay.js: Enigmail.msg.attachOwnKey:\n");

    var userIdValue;

    if (this.identity.getIntAttribute("pgpKeyMode")>0) {
      userIdValue = this.identity.getCharAttribute("pgpkeyId");

      if (this.attachOwnKeyObj.attachedKey && (this.attachOwnKeyObj.attachedKey != userIdValue)) {
        // remove attached key if user ID changed
        this.removeAttachedKey();
      }

      if (! this.attachOwnKeyObj.attachedKey) {
        var attachedObj = this.extractAndAttachKey( [userIdValue] );
        if (attachedObj) {
          this.attachOwnKeyObj.attachedObj = attachedObj;
          this.attachOwnKeyObj.attachedKey = userIdValue;
        }
      }
    }
    else {
       EnigmailCommon.ERROR_LOG("enigmailMsgComposeOverlay.js: Enigmail.msg.attachOwnKey: trying to attach unknown own key!\n");
    }
  },

  attachKey: function ()
  {
    EnigmailCommon.DEBUG_LOG("enigmailMsgComposeOverlay.js: Enigmail.msg.attachKey: \n");

    var resultObj = new Object();
    var inputObj = new Object();
    inputObj.dialogHeader = EnigmailCommon.getString("keysToExport");
    inputObj.options = "multisel,allowexpired,nosending";
    var userIdValue="";

    window.openDialog("chrome://enigmail/content/enigmailUserSelection.xul","", "dialog,modal,centerscreen", inputObj, resultObj);
    try {
      if (resultObj.cancelled) return;
      this.extractAndAttachKey(resultObj.userList);
    } catch (ex) {
      // cancel pressed -> do nothing
      return;
    }
  },

  extractAndAttachKey: function (uid)
  {
    EnigmailCommon.DEBUG_LOG("enigmailMsgComposeOverlay.js: Enigmail.msg.attachKey: \n");
    var enigmailSvc = EnigmailCommon.getService(window);
    if (!enigmailSvc)
      return null;

    var tmpDir=EnigmailCommon.getTempDir();

    try {
      var tmpFile = Components.classes[EnigmailCommon.LOCAL_FILE_CONTRACTID].createInstance(Components.interfaces.nsILocalFile);
      tmpFile.initWithPath(tmpDir);
      if (!(tmpFile.isDirectory() && tmpFile.isWritable())) {
        EnigmailCommon.alert(window, EnigmailCommon.getString("noTempDir"));
        return null;
      }
    }
    catch (ex) {
      EnigmailCommon.writeException("enigmailMsgComposeOverlay.js: Enigmail.msg.extractAndAttachKey", ex);
    }
    tmpFile.append("key.asc");
    tmpFile.createUnique(Components.interfaces.nsIFile.NORMAL_FILE_TYPE, 0600);

    // save file
    var exitCodeObj= {};
    var errorMsgObj = {};

    enigmailSvc.extractKey(window, 0, uid.join(" "), tmpFile /*.path */, exitCodeObj, errorMsgObj);
    if (exitCodeObj.value != 0) {
      EnigmailCommon.alert(window, errorMsgObj.value);
      return  null;
    }

    // create attachment
    var ioServ = Components.classes[EnigmailCommon.IOSERVICE_CONTRACTID].getService(Components.interfaces.nsIIOService);
    var tmpFileURI = ioServ.newFileURI(tmpFile);
    var keyAttachment = Components.classes["@mozilla.org/messengercompose/attachment;1"].createInstance(Components.interfaces.nsIMsgAttachment);
    keyAttachment.url = tmpFileURI.spec;
    if ((uid.length == 1) && (uid[0].search(/^(0x)?[a-fA-F0-9]+$/)==0)) {
      keyAttachment.name = "0x"+uid[0].substr(-8,8)+".asc";
    }
    else {
      keyAttachment.name = "pgpkeys.asc";
    }
    keyAttachment.temporary = true;
    keyAttachment.contentType = "application/pgp-keys";

    // add attachment to msg
    this.addAttachment(keyAttachment);

    try {
      // TB only
      ChangeAttachmentBucketVisibility(false);
    }
    catch (ex) {}
    gContentChanged = true;
    return keyAttachment;
  },

  addAttachment: function (attachment)
  {
    if (typeof(AddAttachment) == "undefined") {
      // TB >= 3.0
      AddUrlAttachment(attachment);
    }
    else {
      // SeaMonkey and TB <= 3.0
      AddAttachment(attachment);
    }
  },

  undoEncryption: function ()
  {
    EnigmailCommon.DEBUG_LOG("enigmailMsgComposeOverlay.js: Enigmail.msg.undoEncryption:\n");
    if (this.processed) {
      this.replaceEditorText(this.processed.origText);

      this.processed = null;

    } else {
      this.decryptQuote(true);
    }

    var node;
    var nodeNumber;
    var bucketList = document.getElementById("attachmentBucket");
    if ( this.modifiedAttach && bucketList && bucketList.hasChildNodes() ) {
      // undo inline encryption of attachments
      for (var i=0; i<this.modifiedAttach.length; i++) {
        node = bucketList.firstChild;
        nodeNumber=-1;
        while (node) {
          ++nodeNumber;
          if (node.attachment.url == this.modifiedAttach[i].newUrl) {
            if (this.modifiedAttach[i].encrypted) {
              node.attachment.url = this.modifiedAttach[i].origUrl;
              node.attachment.name = this.modifiedAttach[i].origName;
              node.attachment.temporary = this.modifiedAttach[i].origTemp;
              node.attachment.contentType = this.modifiedAttach[i].origCType;
            }
            else {
              node = bucketList.removeItemAt(nodeNumber);
              // Let's release the attachment object held by the node else it won't go away until the window is destroyed
              node.attachment = null;
            }
            // delete encrypted file
            try {
              this.modifiedAttach[i].newFile.remove(false);
            }
            catch (ex) {}

            node = null; // next attachment please
          }
          else {
            node=node.nextSibling;
          }
        }
      }
    }

    this.removeAttachedKey();
  },

  removeAttachedKey: function ()
  {
    EnigmailCommon.DEBUG_LOG("enigmailMsgComposeOverlay.js: Enigmail.msg.removeAttachedKey: \n");

    var bucketList = document.getElementById("attachmentBucket");
    var node = bucketList.firstChild;

    if (bucketList && bucketList.hasChildNodes() && this.attachOwnKeyObj.attachedObj) {
      // undo attaching own key
      var nodeNumber=-1;
      while (node) {
        ++nodeNumber;
        if (node.attachment.url == this.attachOwnKeyObj.attachedObj.url) {
          node = bucketList.removeItemAt(nodeNumber);
          // Let's release the attachment object held by the node else it won't go away until the window is destroyed
          node.attachment = null;
          this.attachOwnKeyObj.attachedObj = null;
          this.attachOwnKeyObj.attachedKey = null;
          node = null; // exit loop
        }
        else {
          node=node.nextSibling;
        }
      }
      if (! bucketList.hasChildNodes()) {
        try {
          // TB only
          ChangeAttachmentBucketVisibility(true);
        }
        catch(ex) {}
      }
    }
  },

  replaceEditorText: function (text)
  {
    EnigmailCommon.DEBUG_LOG("enigmailMsgComposeOverlay.js: Enigmail.msg.replaceEditorText:\n");
    this.editorSelectAll();

    // Overwrite text in clipboard for security
    // (Otherwise plaintext will be available in the clipbaord)
    this.editorInsertText("Enigmail");
    this.editorSelectAll();

    this.editorInsertText(text);
  },

  goAccountManager: function ()
  {
    EnigmailCommon.DEBUG_LOG("enigmailMsgComposeOverlay.js: Enigmail.msg.goAccountManager:\n");
    EnigmailCommon.getService(window);
    var server=null;
    try {
        var currentId=getCurrentIdentity();
        var amService=Components.classes["@mozilla.org/messenger/account-manager;1"].getService();
        var servers=amService.GetServersForIdentity(currentId);
        var folderURI=servers.GetElementAt(0).QueryInterface(Components.interfaces.nsIMsgIncomingServer).serverURI;
        server=GetMsgFolderFromUri(folderURI, true).server
    } catch (ex) {}
    window.openDialog("chrome://enigmail/content/am-enigprefs-edit.xul", "", "dialog,modal,centerscreen", {identity: currentId, account: server});
    this.setIdentityDefaults();
  },

  doPgpButton: function (what)
  {
    EnigmailCommon.DEBUG_LOG("enigmailMsgComposeOverlay.js: Enigmail.msg.doPgpButton: what="+what+"\n");
    if (! what)
      what = this.nextCommandId;
    this.nextCommandId = "";
    EnigmailCommon.getService(window); // try to access Enigmail to launch the wizard if needed

    try {
      if (!this.getAccDefault("enabled")) {
        if (EnigmailCommon.confirmDlg(window, EnigmailCommon.getString("configureNow"),
              EnigmailCommon.getString("msgCompose.button.configure"))) {
          this.goAccountManager();
          if (! this.identity.getBoolAttribute("enablePgp")) return;
        }
        else {
          return;
        }
      }
    }
    catch (ex) {}
    switch (what) {
      case 'plain':
      case 'sign':
      case 'dont-sign':
      case 'sign-if-enc':
      case 'encrypt':
      case 'enc-ifpossible':
      case 'toggle-sign':
      case 'toggle-encrypt':
        this.setSendMode(what);
        break;

      case 'togglePGPMime':
        this.togglePgpMime();
        break;

      case 'toggleRules':
        this.toggleRules();
        break;

      default:
        this.displaySecuritySettings();
    }
    return;
  },

  nextCommand: function (what)
  {
    EnigmailCommon.DEBUG_LOG("enigmailMsgComposeOverlay.js: Enigmail.msg.nextCommand: what="+what+"\n");
    this.nextCommandId=what;
  },

  setSendMode: function (sendMode)
  {
    EnigmailCommon.DEBUG_LOG("enigmailMsgComposeOverlay.js: Enigmail.msg.setSendMode: sendMode="+sendMode+"\n");

    const nsIEnigmail = Components.interfaces.nsIEnigmail;
    const SIGN    = nsIEnigmail.SEND_SIGNED;
    const ENCRYPT = nsIEnigmail.SEND_ENCRYPTED;

    var origSendMode=this.sendMode;
    switch (sendMode) {
      case 'toggle-sign':
        this.displaySignClickWarn();
        this.sendModeDirty=2;
        if (this.sendMode & SIGN) {
          this.sendMode &= ~SIGN;
        }
        else {
          this.sendMode |= SIGN;
        }
        break;
      case 'toggle-encrypt':
        if (this.sendMode & ENCRYPT) {
          this.setSendMode('plain');
        }
        else {
          this.setSendMode('encrypt');
        }
        break;
      case 'encrypt':
        this.sendMode |= ENCRYPT;
        if (this.sendModeDirty<2) {
          if (this.getAccDefault("signEnc")) {
            this.sendMode |= SIGN;
          }
          else {
            this.sendMode &= ~SIGN;
          }
        }
        break;
      case 'sign':
        this.sendMode |= SIGN;
        break;
      case 'plain':
        this.sendMode &= ~ENCRYPT;
        if (this.sendModeDirty<2) {
          if (this.getAccDefault("signPlain")) {
            this.sendMode |= SIGN;
          }
          else {
            this.sendMode &= ~SIGN;
          }
        }
        break;
      default:
        EnigmailCommon.alert(window, "Enigmail.msg.setSendMode - Strange value: "+sendMode);
        break;
    }
    if (this.sendMode != origSendMode && this.sendModeDirty<2)
      this.sendModeDirty=1;
    this.updateStatusBar();
  },

  updateStatusBar: function ()
  {
    EnigmailCommon.DEBUG_LOG("enigmailMsgComposeOverlay.js: Enigmail.msg.updateStatusBar:\n");

    const nsIEnigmail = Components.interfaces.nsIEnigmail;
    const SIGN    = nsIEnigmail.SEND_SIGNED;
    const ENCRYPT = nsIEnigmail.SEND_ENCRYPTED;

    var statusBar = document.getElementById("enigmail-status-bar");

    if (!this.getAccDefault("enabled")) {
      // hide icons if enigmail not enabled
      statusBar.removeAttribute("signed");
      statusBar.removeAttribute("encrypted");
      return;
    }

    var signedIcon = document.getElementById("enigmail-signed-status");
    var encryptedIcon = document.getElementById("enigmail-encrypted-status");

    if (this.sendMode & SIGN) {
      switch (this.signRules) {
      case 0:
        statusBar.setAttribute("signed", "activeMinus"); break;
      case 1:
        statusBar.setAttribute("signed", "activeNull"); break;
      case 2:
        statusBar.setAttribute("signed", "activePlus"); break;
      }
      signedIcon.setAttribute("tooltiptext", EnigmailCommon.getString("signYes"));
    }
    else {
      switch (this.signRules) {
      case 0:
        statusBar.setAttribute("signed", "inactiveMinus"); break;
      case 1:
        statusBar.setAttribute("signed", "inactiveNull"); break;
      case 2:
        statusBar.setAttribute("signed", "inactivePlus"); break;
      }
      signedIcon.setAttribute("tooltiptext", EnigmailCommon.getString("signNo"));
    }

    if (this.sendMode & ENCRYPT) {
      switch (this.encryptRules) {
      case 0:
        statusBar.setAttribute("encrypted", "activeMinus"); break;
      case 1:
        statusBar.setAttribute("encrypted", "activeNull"); break;
      case 2:
        statusBar.setAttribute("encrypted", "activePlus"); break;
      }

      encryptedIcon.setAttribute("tooltiptext", EnigmailCommon.getString("encryptYes"));
    }
    else {
      switch (this.encryptRules) {
      case 0:
        statusBar.setAttribute("encrypted", "inactiveMinus"); break;
      case 1:
        statusBar.setAttribute("encrypted", "inactiveNull"); break;
      case 2:
        statusBar.setAttribute("encrypted", "inactivePlus"); break;
      }
      encryptedIcon.setAttribute("tooltiptext", EnigmailCommon.getString("encryptNo"));
    }
  },

  determineSendFlags: function ()
  {
    EnigmailCommon.DEBUG_LOG("enigmailMsgComposeOverlay.js: Enigmail.msg.focusChange: Enigmail.msg.determineSendFlags\n");
    if (this.getAccDefault("enabled")) {
      var compFields = Components.classes["@mozilla.org/messengercompose/composefields;1"].createInstance(Components.interfaces.nsIMsgCompFields);
      Recipients2CompFields(compFields);
      var arrLen = new Object();
      var matchedKeysObj = new Object();
      var flagsObj = new Object();
      var toAddrList = new Array();
      var recList;
      if (compFields.to.length > 0) {
        recList = compFields.splitRecipients(compFields.to, true, arrLen)
        this.addRecipients(toAddrList, recList);
      }

      if (compFields.cc.length > 0) {
        recList = compFields.splitRecipients(compFields.cc, true, arrLen)
        this.addRecipients(toAddrList, recList);
      }

      if (compFields.bcc.length > 0) {
        recList = compFields.splitRecipients(compFields.bcc, true, arrLen)
        this.addRecipients(toAddrList, recList);
      }

      this.signRules    = 1;
      this.encryptRules = 1;
      if (toAddrList.length > 0) {
        if (Enigmail.hlp.getRecipientsKeys(toAddrList.join(", "), false, false, matchedKeysObj, flagsObj)) {
          this.signRules    = flagsObj.sign;
          this.encryptRules = flagsObj.encrypt;
        }
      }
      this.updateStatusBar();
    }
    this.determineSendFlagId = null;
  },


  setMenuSettings: function (postfix)
  {
    EnigmailCommon.DEBUG_LOG("enigmailMsgComposeOverlay.js: Enigmail.msg.setMenuSettings: postfix="+postfix+"\n");

    const nsIEnigmail = Components.interfaces.nsIEnigmail;
    const SIGN    = nsIEnigmail.SEND_SIGNED;
    const ENCRYPT = nsIEnigmail.SEND_ENCRYPTED;

    document.getElementById("enigmail_encrypted_send"+postfix).setAttribute("checked", this.sendMode & ENCRYPT ? "true": "false");
    document.getElementById("enigmail_signed_send"+postfix).setAttribute("checked", this.sendMode & SIGN ? "true" : "false");

    var menuElement = document.getElementById("enigmail_sendPGPMime"+postfix);
    if (menuElement)
      menuElement.setAttribute("checked", this.sendPgpMime.toString());

    menuElement = document.getElementById("enigmail_disable_rules"+postfix);
    if (menuElement)
      menuElement.setAttribute("checked", (!this.enableRules).toString());

    menuElement = document.getElementById("enigmail_insert_own_key");
    if (menuElement) {
      if (this.identity.getIntAttribute("pgpKeyMode")>0) {
        menuElement.setAttribute("checked", this.attachOwnKeyObj.appendAttachment.toString());
        menuElement.removeAttribute("disabled");
      }
      else {
        menuElement.setAttribute("disabled", "true");
      }
    }
  },

  displaySecuritySettings: function ()
  {
    EnigmailCommon.DEBUG_LOG("enigmailMsgComposeOverlay.js: Enigmail.msg.displaySecuritySettings\n");
    var inputObj = { sendFlags: this.sendMode,
                     usePgpMime: this.sendPgpMime,
                     disableRules: !this.enableRules };
    window.openDialog("chrome://enigmail/content/enigmailEncryptionDlg.xul","", "dialog,modal,centerscreen", inputObj);
    if (this.sendMode != inputObj.sendFlags) {
      this.dirty = 2;
    }
    this.sendMode = inputObj.sendFlags;
    this.sendPgpMime = inputObj.usePgpMime;
    this.enableRules = !inputObj.disableRules;
    this.updateStatusBar();
  },

  displaySignClickWarn: function ()
  {
    EnigmailCommon.DEBUG_LOG("enigmailMsgComposeOverlay.js: Enigmail.msg.displaySignClickWarn\n");
    if ((this.sendModeDirty<2) &&
        (this.getAccDefault("signPlain") ||
         this.getAccDefault("signEnc"))) {
      EnigmailCommon.alertPref(window, EnigmailCommon.getString("signIconClicked"), "displaySignWarn");
    }
  },

  confirmBeforeSend: function (toAddr, gpgKeys, sendFlags, isOffline, msgSendType)
  {
    EnigmailCommon.DEBUG_LOG("enigmailMsgComposeOverlay.js: Enigmail.msg.confirmBeforeSend: sendFlags="+sendFlags+"\n");
    // get confirmation before sending message
    var msgStatus = "";

    const nsIEnigmail = Components.interfaces.nsIEnigmail;
    const SIGN    = nsIEnigmail.SEND_SIGNED;
    const ENCRYPT = nsIEnigmail.SEND_ENCRYPTED;

    if (sendFlags & (ENCRYPT | SIGN)) {
      if (sendFlags & nsIEnigmail.SEND_PGP_MIME)
        msgStatus += EnigmailCommon.getString("statPGPMIME")+" ";

      if (sendFlags & SIGN)
        msgStatus += EnigmailCommon.getString("statSigned")+" ";

      if (sendFlags & ENCRYPT)
        msgStatus += EnigmailCommon.getString("statEncrypted")+" ";

    } else {
      msgStatus += EnigmailCommon.getString("statPlain")+" ";
    }

    gpgKeys=gpgKeys.replace(/^, /, "").replace(/, $/,"");

    var msgConfirm = (isOffline || sendFlags & nsIEnigmail.SEND_LATER)
            ? EnigmailCommon.getString("offlineSave", [ msgStatus, EnigmailFuncs.stripEmail(toAddr).replace(/,/g, ", ") ])
            : EnigmailCommon.getString("onlineSend", [ msgStatus, EnigmailFuncs.stripEmail(toAddr).replace(/,/g, ", ") ]);
    if (sendFlags & ENCRYPT)
      msgConfirm += "\n\n"+EnigmailCommon.getString("encryptKeysNote", [ gpgKeys ]);

    return EnigmailCommon.confirmDlg(window, msgConfirm,
        EnigmailCommon.getString((isOffline || sendFlags & nsIEnigmail.SEND_LATER) ? "msgCompose.button.save" : "msgCompose.button.send"));
  },


  addRecipients: function (toAddrList, recList)
  {
    for (var i=0; i<recList.length; i++) {
      toAddrList.push(EnigmailFuncs.stripEmail(recList[i].replace(/[\",]/g, "")));
    }
  },

  setDraftStatus: function (sendFlags)
  {
    gMsgCompose.compFields.otherRandomHeaders += "X-Enigmail-Draft-Status: "+sendFlags+"\r\n";
  },


  encryptMsg: function (msgSendType)
  {
    EnigmailCommon.DEBUG_LOG("enigmailMsgComposeOverlay.js: Enigmail.msg.encryptMsg: msgType="+msgSendType+", Enigmail.msg.sendMode="+this.sendMode+"\n");

    const nsIEnigmail = Components.interfaces.nsIEnigmail;
    const SIGN    = nsIEnigmail.SEND_SIGNED;
    const ENCRYPT = nsIEnigmail.SEND_ENCRYPTED;
    var promptSvc = EnigmailCommon.getPromptSvc();

    var gotSendFlags = this.sendMode;
    var sendFlags=0;
    window.enigmailSendFlags=0;

    switch (msgSendType) {
    case nsIMsgCompDeliverMode.Later:
      sendFlags |= nsIEnigmail.SEND_LATER;
      break;
    case nsIMsgCompDeliverMode.SaveAsDraft:
    case nsIMsgCompDeliverMode.SaveAsTemplate:
    case nsIMsgCompDeliverMode.AutoSaveAsDraft:
      sendFlags |= nsIEnigmail.SAVE_MESSAGE;
      break;
    }

    var msgCompFields = gMsgCompose.compFields;
    var newsgroups = msgCompFields.newsgroups;  // Check if sending to any newsgroups

    if ((! (sendFlags & nsIEnigmail.SAVE_MESSAGE)) &&
        msgCompFields.to == "" &&
        msgCompFields.cc == "" &&
        msgCompFields.bcc == "" &&
        newsgroups == "") {
      // don't attempt to send message if no recipient specified
      var bundle = document.getElementById("bundle_composeMsgs");
      EnigmailCommon.alert(window, bundle.getString("12511"));
      return false;
    }

    if (gotSendFlags & SIGN)
        sendFlags |= SIGN;
    if (gotSendFlags & ENCRYPT) {
      sendFlags |= ENCRYPT;
    }
    var encryptIfPossible = false;
    if (sendFlags & nsIEnigmail.SAVE_MESSAGE) {
      if (!((sendFlags & ENCRYPT) && EnigmailCommon.confirmPref(window, EnigmailCommon.getString("savingMessage"), "saveEncrypted",
              EnigmailCommon.getString("msgCompose.button.encrypt"),
              EnigmailCommon.getString("msgCompose.button.dontEncrypt")))) {
        sendFlags &= ~ENCRYPT;

        if (this.attachOwnKeyObj.appendAttachment) this.attachOwnKey();

        if (sendFlags & SIGN) this.setDraftStatus(sendFlags);
        return true;
      }
    }

    if (gWindowLocked) {
      EnigmailCommon.alert(window, EnigmailCommon.getString("windowLocked"));
      return false;
    }

    if (this.dirty) {
      // make sure the sendFlags are reset before the message is processed
      // (it may have been set by a previously cancelled send operation!)
      try {
        if (gMsgCompose.compFields.securityInfo instanceof Components.interfaces.nsIEnigMsgCompFields) {
          gMsgCompose.compFields.securityInfo.sendFlags=0;
        }
        else if (gMsgCompose.compFields.securityInfo == null) {
          throw "dummy";
        }
      }
      catch (ex){
        try {
          var newSecurityInfo = Components.classes[this.compFieldsEnig_CID].createInstance(Components.interfaces.nsIEnigMsgCompFields);
          if (newSecurityInfo) {
            newSecurityInfo.sendFlags=0;
            gMsgCompose.compFields.securityInfo = newSecurityInfo;
          }
        }
        catch (ex) {
          EnigmailCommon.writeException("enigmailMsgComposeOverlay.js: Enigmail.msg.attachKey", ex);
        }
      }
    }
    this.dirty = true;

    var enigmailSvc = EnigmailCommon.getService(window);
    if (!enigmailSvc) {
       var msg=EnigmailCommon.getString("sendUnencrypted");
       if (EnigmailCommon.enigmailSvc && EnigmailCommon.enigmailSvc.initializationError) {
          msg = EnigmailCommon.enigmailSvc.initializationError +"\n\n"+msg;
       }

       return EnigmailCommon.confirmDlg(window, msg, EnigmailCommon.getString("msgCompose.button.send"));
    }


    try {

       var exitCodeObj    = new Object();
       var statusFlagsObj = new Object();
       var errorMsgObj    = new Object();
       this.modifiedAttach = null;

       EnigmailCommon.DEBUG_LOG("enigmailMsgComposeOverlay.js: Enigmail.msg.encryptMsg: currentId="+this.identity+
                ", "+this.identity.email+"\n");
       var fromAddr = this.identity.email;

       var pgpEnabled = this.getAccDefault("enabled");

       if (! pgpEnabled) {
          if ((sendFlags & (ENCRYPT | SIGN)) || this.attachOwnKeyObj.appendAttachment) {
            if (!EnigmailCommon.confirmDlg(window, EnigmailCommon.getString("acctNotConfigured"),
                  EnigmailCommon.getString("msgCompose.button.send")))
                return false;
          }
          return true;
       }

       var recipientsSelection = EnigmailCommon.getPref("recipientsSelection");

       var optSendFlags = 0;
       var inlineEncAttach=false;

       if (EnigmailCommon.getPref("alwaysTrustSend")) {
         optSendFlags |= nsIEnigmail.SEND_ALWAYS_TRUST;
       }

       if (EnigmailCommon.getPref("encryptToSelf") || (sendFlags & nsIEnigmail.SAVE_MESSAGE)) {
         optSendFlags |= nsIEnigmail.SEND_ENCRYPT_TO_SELF;
       }

       sendFlags |= optSendFlags;

       if (this.identity.getIntAttribute("pgpKeyMode")>0) {
         var userIdValue = this.identity.getCharAttribute("pgpkeyId");

         if (!userIdValue) {

           var mesg = EnigmailCommon.getString("composeSpecifyEmail");

           var valueObj = new Object();
           valueObj.value = userIdValue;

           if (EnigmailCommon.promptValue(window, mesg, valueObj)) {
             userIdValue = valueObj.value;
           }
         }

         if (userIdValue) {
           fromAddr = userIdValue;
           this.identity.setCharAttribute("pgpkeyId", userIdValue);

         } else {
           this.identity.setIntAttribute("pgpKeyMode", 0);
         }
       }

       if (typeof(userIdValue) != "string") {
         EnigmailCommon.DEBUG_LOG("enigmailMsgComposeOverlay.js: Enigmail.msg.encryptMsg: type of userIdValue="+typeof(userIdValue)+"\n");
         userIdValue = this.identity.email;
       }

       EnigmailCommon.DEBUG_LOG("enigmailMsgComposeOverlay.js: Enigmail.msg.encryptMsg:gMsgCompose="+gMsgCompose+"\n");

       var toAddrList = [];
       var bccAddrList = [];
       if (sendFlags & nsIEnigmail.SAVE_MESSAGE) {
          if (userIdValue.search(/@/) == -1 ) {
            toAddrList.push(userIdValue);
          }
          else {
            toAddrList.push(EnigmailFuncs.stripEmail(userIdValue.replace(/[\",]/g, "")));
          }
       }
       else {
         var splitRecipients;
         var arrLen =  new Object();
         splitRecipients = msgCompFields.splitRecipients;

         //EnigmailCommon.alert(window, typeof(msgCompFields.cc));
         if (msgCompFields.to.length > 0) {
           var recList = splitRecipients(msgCompFields.to, true, arrLen)
           this.addRecipients(toAddrList, recList);
         }

         if (msgCompFields.cc.length > 0) {
           recList = splitRecipients(msgCompFields.cc, true, arrLen)
           this.addRecipients(toAddrList, recList);
         }

         if (msgCompFields.bcc.length > 0) {
           recList = splitRecipients(msgCompFields.bcc, true, arrLen)

           var bccLC = EnigmailFuncs.stripEmail(msgCompFields.bcc).toLowerCase()
           EnigmailCommon.DEBUG_LOG("enigmailMsgComposeOverlay.js: Enigmail.msg.encryptMsg: BCC: "+bccLC+"\n");

           var selfBCC = this.identity.email && (this.identity.email.toLowerCase() == bccLC);

           if (selfBCC) {
             EnigmailCommon.DEBUG_LOG("enigmailMsgComposeOverlay.js: Enigmail.msg.encryptMsg: Self BCC\n");
             this.addRecipients(toAddrList, recList);

           } else if (sendFlags & ENCRYPT) {
             // BCC and encryption

             if (encryptIfPossible) {
               sendFlags &= ~ENCRYPT;
               EnigmailCommon.DEBUG_LOG("enigmailMsgComposeOverlay.js: Enigmail.msg.encryptMsg: No default encryption because of BCC\n");

             } else {
               var dummy={value: null};

               var hideBccUsers = promptSvc.confirmEx(window,
                          EnigmailCommon.getString("enigConfirm"),
                          EnigmailCommon.getString("sendingHiddenRcpt"),
                          (promptSvc.BUTTON_TITLE_IS_STRING * promptSvc.BUTTON_POS_0) +
                          (promptSvc. BUTTON_TITLE_CANCEL * promptSvc.BUTTON_POS_1) +
                          (promptSvc. BUTTON_TITLE_IS_STRING * promptSvc.BUTTON_POS_2),
                          EnigmailCommon.getString("sendWithShownBcc"),
                          null,
                          EnigmailCommon.getString("sendWithHiddenBcc"),
                          null,
                          dummy);
                switch (hideBccUsers) {
                case 2:
                  this.addRecipients(bccAddrList, recList);
                  // no break here on purpose!
                case 0:
                  this.addRecipients(toAddrList, recList);
                  break;
                case 1:
                 return false;
                }
             }
           }
         }

         if (newsgroups) {
           toAddrList.push(newsgroups);

           if (sendFlags & ENCRYPT) {

             if (!encryptIfPossible) {
               if (!EnigmailCommon.getPref("encryptToNews")) {
                 EnigmailCommon.alert(window, EnigmailCommon.getString("sendingNews"));
                 return false;
               }
               else if (!EnigmailCommon.confirmPref(window,
                            EnigmailCommon.getString("sendToNewsWarning"),
                            "warnOnSendingNewsgroups",
                            EnigmailCommon.getString("msgCompose.button.send"))) {
                 return false;
               }
             }
             else {
               sendFlags &= ~ENCRYPT;
               EnigmailCommon.DEBUG_LOG("enigmailMsgComposeOverlay.js: Enigmail.msg.encryptMsg: No default encryption because of newsgroups\n");
             }
           }
         }
       }

       var usePGPMimeOption = EnigmailCommon.getPref("usePGPMimeOption");

       if (this.sendPgpMime) {
         // Use PGP/MIME
         sendFlags |= nsIEnigmail.SEND_PGP_MIME;
       }

       var toAddr = toAddrList.join(", ");
       var bccAddr = bccAddrList.join(", ");
       var testCipher = null;

       var notSignedIfNotEnc= (this.sendModeDirty<2 && (! this.getAccDefault("signPlain")));

       if (toAddr.length>=1) {

          EnigmailCommon.DEBUG_LOG("enigmailMsgComposeOverlay.js: Enigmail.msg.encryptMsg: toAddr="+toAddr+"\n");
          var repeatSelection=0;
          while (repeatSelection<2) {
            if (recipientsSelection != 3 && recipientsSelection != 4
                && this.enableRules) {
              var matchedKeysObj = new Object;
              var flagsObj=new Object;
              if (!Enigmail.hlp.getRecipientsKeys(toAddr,
                                    (repeatSelection==1),
                                    true,
                                    matchedKeysObj,
                                    flagsObj)) {
                return false;
              }
              if (matchedKeysObj.value) toAddr=matchedKeysObj.value;

              if (flagsObj.value) {
                switch (flagsObj.sign) {
                 case 0:
                   sendFlags &= ~SIGN;
                   break;
                 case 2:
                   sendFlags |= SIGN;
                   break;
                }

                switch (flagsObj.encrypt) {
                 case 0:
                   sendFlags &= ~ENCRYPT;
                   break;
                 case 2:
                   sendFlags |= ENCRYPT;
                   break;
                }

                switch (flagsObj.pgpMime) {
                 case 0:
                   sendFlags &= ~nsIEnigmail.SEND_PGP_MIME;
                   break;
                 case 2:
                   sendFlags |= nsIEnigmail.SEND_PGP_MIME;
                   break;
                }
              }

              if (!Enigmail.hlp.getRecipientsKeys(bccAddr,
                                    (repeatSelection==1),
                                    true,
                                    matchedKeysObj,
                                    flagsObj)) {
                return false;
              }
              if (matchedKeysObj.value) bccAddr=matchedKeysObj.value;
              // bcc recipients are part of "normal" recipients as well; no need to do furter processing of flags etc.
            }
            repeatSelection++;

            if (sendFlags & ENCRYPT) {
              // Encrypt or sign test message for default encryption

              var testExitCodeObj    = new Object();
              var testStatusFlagsObj = new Object();
              var testErrorMsgObj    = new Object();

              var testPlain = "Test Message";
              var testUiFlags   = nsIEnigmail.UI_TEST;
              var testSendFlags = nsIEnigmail.SEND_TEST | ENCRYPT |
                                  optSendFlags ;

              // test recipients
              testCipher = enigmailSvc.encryptMessage(window, testUiFlags, null,
                                                      testPlain,
                                                      fromAddr, toAddr, bccAddr,
                                                      testSendFlags,
                                                      testExitCodeObj,
                                                      testStatusFlagsObj,
                                                      testErrorMsgObj);

              if (testStatusFlagsObj.value) {
                // check if own key is invalid
                let errLines = testErrorMsgObj.value.split(/\r?\n/);
                let s = new RegExp("INV_(RECP|SGNR) [0-9]+ \<?" + fromAddr + "\>?");
                for (let l=0; l < errLines.length; l++) {
                  if (errLines[l].search(s) == 0) {
                    EnigmailCommon.alert(window, EnigmailCommon.getString("errorKeyUnusable", [ fromAddr ]));
                    return false;
                  }
                }
              }


              if ((recipientsSelection==4) ||
                  ((testStatusFlagsObj.value & nsIEnigmail.INVALID_RECIPIENT) &&
                   (recipientsSelection==2 || recipientsSelection==3))) {
                // check for invalid recipient keys
                  var resultObj = new Object();
                  var inputObj = new Object();
                  inputObj.toAddr = toAddr;
                  inputObj.invalidAddr = Enigmail.hlp.getInvalidAddress(testErrorMsgObj.value);
                  inputObj.options = "multisel";
                  if (recipientsSelection==2)
                    inputObj.options += ",rulesOption"
                  if (notSignedIfNotEnc)
                    inputObj.options += ",notsigned";
                  if (recipientsSelection == 4)
                    inputObj.options += ",noforcedisp";
                  inputObj.dialogHeader = EnigmailCommon.getString("recipientsSelectionHdr");

                  window.openDialog("chrome://enigmail/content/enigmailUserSelection.xul","", "dialog,modal,centerscreen", inputObj, resultObj);
                  try {
                    if (resultObj.cancelled) {
                      return false;
                    }
                    if (resultObj.perRecipientRules && this.enableRules) {
                      // do an extra round because the user want to set a PGP rule
                      continue;
                    }
                    if (! resultObj.encrypt) {
                      // encryption explicitely turned off
                      sendFlags &= ~ENCRYPT;
                      if (notSignedIfNotEnc) sendFlags &= ~SIGN;
                    }
                    else {
                      if (bccAddrList.length > 0) {
                        bccAddr=resultObj.userList.join(", ");
                        toAddr="";
                      }
                      else {
                        toAddr = resultObj.userList.join(", ");
                        bccAddr="";
                      }
                    }
                    testCipher="ok";
                    testExitCodeObj.value = 0;
                  } catch (ex) {
                    // cancel pressed -> don't send mail
                    return false;
                  }
              }
              if ((!testCipher || (testExitCodeObj.value != 0)) && recipientsSelection==5) {
                  // Test encryption failed; turn off default encryption
                  sendFlags &= ~ENCRYPT;
                  EnigmailCommon.DEBUG_LOG("enigmailMsgComposeOverlay.js: Enigmail.msg.encryptMsg: No default encryption because test failed\n");
              }
            }
            repeatSelection=2;
          }

          if ((gotSendFlags & ENCRYPT) &&
              !(sendFlags & ENCRYPT)) {
            // Default encryption turned off; turn off signing as well
            if (this.sendModeDirty<2 && (! this.getAccDefault("signPlain"))) {
              sendFlags &= ~SIGN;
            }
          }
       }

       if (sendFlags & nsIEnigmail.SAVE_MESSAGE) {
         // always enable PGP/MIME if message is saved
         sendFlags |= nsIEnigmail.SEND_PGP_MIME;
       }

       if (this.attachOwnKeyObj.appendAttachment) this.attachOwnKey();

       var bucketList = document.getElementById("attachmentBucket");
       var hasAttachments = ((bucketList && bucketList.hasChildNodes()) || gMsgCompose.compFields.attachVCard);

       EnigmailCommon.DEBUG_LOG("enigmailMsgComposeOverlay.js: hasAttachments = "+hasAttachments+"\n");

       if ( hasAttachments &&
          (sendFlags & (ENCRYPT | SIGN)) &&
          !(sendFlags & nsIEnigmail.SEND_PGP_MIME) &&
          enigmailSvc.composeSecure) {

          inputObj = new Object();
          inputObj.pgpMimePossible = true;
          inputObj.inlinePossible = true;
          inputObj.restrictedScenario = false;

          // determine if attachments are all local files (currently the only
          // supported kind of attachments)
          var node = bucketList.firstChild;
          while (node) {
            if (node.attachment.url.substring(0,7) != "file://") {
               inputObj.inlinePossible = false;
            }
            node = node.nextSibling;
          }

          if (inputObj.pgpMimePossible || inputObj.inlinePossible) {
            resultObj = new Object();
            resultObj.selected = EnigmailCommon.getPref("encryptAttachments");

            //skip or not
            var skipCheck=EnigmailCommon.getPref("encryptAttachmentsSkipDlg");
            if (skipCheck == 1) {
              if ((resultObj.selected == 2 && inputObj.pgpMimePossible == false) || (resultObj.selected == 1 && inputObj.inlinePossible == false)) {
                //add var to disable remember box since we're dealing with restricted scenarios...
                inputObj.restrictedScenario = true;
                resultObj.selected = -1;
                window.openDialog("chrome://enigmail/content/enigmailAttachmentsDialog.xul","", "dialog,modal,centerscreen", inputObj, resultObj);
              }
            } else {
              resultObj.selected = -1;
              window.openDialog("chrome://enigmail/content/enigmailAttachmentsDialog.xul","", "dialog,modal,centerscreen", inputObj, resultObj);
            }
            if (resultObj.selected < 0) {
              // dialog cancelled
              return false;
            }
            else if (resultObj.selected == 1) {
              // encrypt attachments
              inlineEncAttach=true;
            }
            else if (resultObj.selected == 2) {
              // send as PGP/MIME
              sendFlags |= nsIEnigmail.SEND_PGP_MIME;
            }
          }
          else {
            if (sendFlags & ENCRYPT) {
              if (!EnigmailCommon.confirmDlg(window,
                    EnigmailCommon.getString("attachWarning"),
                    EnigmailCommon.getString("msgCompose.button.send")))
                return false;
            }
          }
       }

       var usingPGPMime = (sendFlags & nsIEnigmail.SEND_PGP_MIME) &&
                          (sendFlags & (ENCRYPT | SIGN));

       if (usingPGPMime && !enigmailSvc.composeSecure) {
         if (!EnigmailCommon.confirmDlg(window, EnigmailCommon.getString("noPGPMIME"),
                EnigmailCommon.getString("msgCompose.button.useInlinePGP"))) {
            throw Components.results.NS_ERROR_FAILURE;

         }

         usingPGPMime = false;
       }

       // Detect PGP/MIME and S/MIME
       if (usingPGPMime) {
          if (gMsgCompose.compFields.securityInfo instanceof Components.interfaces.nsIMsgSMIMECompFields) {

              if (gMsgCompose.compFields.securityInfo.requireEncryptMessage ||
                 gMsgCompose.compFields.securityInfo.signMessage) {
                 var prefAlgo = EnigmailCommon.getPref("mimePreferPgp");
                 if (prefAlgo == 1) {
                   var checkedObj={ value: null};
                   var prefAlgo = promptSvc.confirmEx(window,
                              EnigmailCommon.getString("enigConfirm"),
                              EnigmailCommon.getString("pgpMime_sMime.dlg.text"),
                              (promptSvc. BUTTON_TITLE_IS_STRING * promptSvc.BUTTON_POS_0) +
                              (promptSvc. BUTTON_TITLE_CANCEL * promptSvc.BUTTON_POS_1) +
                              (promptSvc. BUTTON_TITLE_IS_STRING * promptSvc.BUTTON_POS_2),
                              EnigmailCommon.getString("pgpMime_sMime.dlg.pgpMime.button"),
                              null,
                              EnigmailCommon.getString("pgpMime_sMime.dlg.sMime.button"),
                              EnigmailCommon.getString("dlgKeepSetting"),
                              checkedObj);
                   if (checkedObj.value && (prefAlgo==0 || prefAlgo==2)) EnigmailCommon.setPref("mimePreferPgp", prefAlgo);
                 }
                 switch (prefAlgo) {
                 case 0:
                    gMsgCompose.compFields.securityInfo.requireEncryptMessage = false;
                    gMsgCompose.compFields.securityInfo.signMessage = false;
                    break;
                 case 1:
                    return false;
                 case 2:
                    return true;
                    break;
                 default:
                   return false;
                 }
              }
          }
       }

       var uiFlags = nsIEnigmail.UI_INTERACTIVE;

       if (usingPGPMime)
         uiFlags |= nsIEnigmail.UI_PGP_MIME;

       if ((sendFlags & (ENCRYPT | SIGN)) && usingPGPMime) {
         // Use EnigMime
         EnigmailCommon.DEBUG_LOG("enigmailMsgComposeOverlay.js: Enigmail.msg.encryptMsg: Using EnigMime, flags="+sendFlags+"\n");

         var oldSecurityInfo = gMsgCompose.compFields.securityInfo;

         EnigmailCommon.DEBUG_LOG("enigmailMsgComposeOverlay.js: Enigmail.msg.encryptMsg: oldSecurityInfo = "+oldSecurityInfo+"\n");

         if (!oldSecurityInfo) {
           try {
             newSecurityInfo = oldSecurityInfo.QueryInterface(Components.interfaces.nsIEnigMsgCompFields);
           } catch (ex) {}
         }

         if (!newSecurityInfo) {
           newSecurityInfo = Components.classes[this.compFieldsEnig_CID].createInstance(Components.interfaces.nsIEnigMsgCompFields);

           if (!newSecurityInfo)
             throw Components.results.NS_ERROR_FAILURE;

           newSecurityInfo.init(oldSecurityInfo);
           gMsgCompose.compFields.securityInfo = newSecurityInfo;
         }

         if ((sendFlags & nsIEnigmail.SAVE_MESSAGE) && (sendFlags & SIGN)) {
            this.setDraftStatus(sendFlags);
            sendFlags &= ~SIGN;
         }

         newSecurityInfo.sendFlags = sendFlags;
         newSecurityInfo.UIFlags = uiFlags;
         newSecurityInfo.senderEmailAddr = fromAddr;
         newSecurityInfo.recipients = toAddr;
         newSecurityInfo.bccRecipients = bccAddr;
         newSecurityInfo.hashAlgorithm = this.mimeHashAlgo[EnigmailCommon.getPref("mimeHashAlgorithm")];

         EnigmailCommon.DEBUG_LOG("enigmailMsgComposeOverlay.js: Enigmail.msg.encryptMsg: securityInfo = "+newSecurityInfo+"\n");

       }
       else if (!this.processed && (sendFlags & (ENCRYPT | SIGN))) {
         // use inline PGP

         var sendInfo = {
           sendFlags: sendFlags,
           inlineEncAttach: inlineEncAttach,
           fromAddr: fromAddr,
           toAddr: toAddr,
           bccAddr: bccAddr,
           uiFlags: uiFlags,
           bucketList: bucketList
         };

         if (! this.encryptInline(sendInfo)) {
           return false;
         }
       }

       // EnigSend: Handle both plain and encrypted messages below
       var isOffline = (gIOService && gIOService.offline);
       window.enigmailSendFlags=sendFlags;

       // update the list of attachments
       Attachments2CompFields(msgCompFields);

       if ((!(sendFlags & nsIEnigmail.SAVE_MESSAGE)) && EnigmailCommon.getPref("confirmBeforeSend")) {
         if (!this.confirmBeforeSend(toAddrList.join(", "), toAddr+", "+bccAddr, sendFlags, isOffline)) {
           if (this.processed) {
             this.undoEncryption();
           }
           else {
             this.removeAttachedKey();
           }
           return false;
         }
       }
       else if ( (sendFlags & nsIEnigmail.SEND_WITH_CHECK) &&
                   !this.messageSendCheck() ) {
         // Abort send
         if (this.processed) {
            this.undoEncryption();
         }
         else {
            this.removeAttachedKey();
         }

         return false;
       }

       if (msgCompFields.characterSet != "ISO-2022-JP") {
         if ((usingPGPMime &&
             ((sendFlags & (ENCRYPT | SIGN)))) || ((! usingPGPMime) && (sendFlags & ENCRYPT))) {
           try {
              // make sure plaintext is not changed to 7bit
              if (typeof(msgCompFields.forceMsgEncoding) == "boolean") {
                msgCompFields.forceMsgEncoding = true;
                EnigmailCommon.DEBUG_LOG("enigmailMsgComposeOverlay.js: Enigmail.msg.encryptMsg: enabled forceMsgEncoding\n");
              }
           }
           catch (ex) {}
        }
      }
    } catch (ex) {
       EnigmailCommon.writeException("enigmailMsgComposeOverlay.js: Enigmail.msg.encryptMsg", ex);
       msg=EnigmailCommon.getString("signFailed");
       if (EnigmailCommon.enigmailSvc && EnigmailCommon.enigmailSvc.initializationError) {
          msg += "\n"+EnigmailCommon.enigmailSvc.initializationError;
       }
       return EnigmailCommon.confirmDlg(window, msg, EnigmailCommon.getString("msgCompose.button.sendUnencrypted"));
    }

    return true;
  },

  encryptInline: function (sendInfo)
  {
    // sign/encrpyt message using inline-PGP

    const dce = Components.interfaces.nsIDocumentEncoder
    const nsIEnigmail = Components.interfaces.nsIEnigmail;
    const SIGN    = nsIEnigmail.SEND_SIGNED;
    const ENCRYPT = nsIEnigmail.SEND_ENCRYPTED;

    var enigmailSvc = EnigmailCommon.getService(window);
    if (! enigmailSvc) return false;

    if (gMsgCompose.composeHTML) {
      var errMsg = EnigmailCommon.getString("hasHTML");
      EnigmailCommon.alertCount(window, "composeHtmlAlertCount", errMsg);
    }

    try {
      var convert = DetermineConvertibility();
      if (convert == nsIMsgCompConvertible.No) {
        if (!EnigmailCommon.confirmDlg(window, EnigmailCommon.getString("strippingHTML"),
              EnigmailCommon.getString("msgCompose.button.sendAnyway"))) {
          return false;
        }
      }
    } catch (ex) {
       EnigmailCommon.writeException("enigmailMsgComposeOverlay.js: Enigmail.msg.encryptInline", ex);
    }

    try {
      if (this.getMailPref("mail.strictly_mime")) {
        if (EnigmailCommon.confirmPref(window,
              EnigmailCommon.getString("quotedPrintableWarn"), "quotedPrintableWarn")) {
          EnigmailCommon.prefRoot.setBoolPref("mail.strictly_mime", false);
        }
      }
    } catch (ex) {}


    var sendFlowed;
    try {
      sendFlowed = this.getMailPref("mailnews.send_plaintext_flowed");
    } catch (ex) {
      sendFlowed = true;
    }
    var encoderFlags = dce.outputFormatted | dce.outputLFLineBreak;

    var wrapWidth=72;
    if (gMsgCompose.composeHTML) {
      // enforce line wrapping here
      // otherwise the message isn't signed correctly
      try {
        wrapWidth = this.getMailPref("editor.htmlWrapColumn");

        if (wrapWidth > 0 && wrapWidth < 68) {
          if (EnigmailCommon.confirmDlg(window, EnigmailCommon.getString("minimalLineWrapping", [ wrapWidth ] ))) {
            EnigmailCommon.prefRoot.setIntPref("editor.htmlWrapColumn", 68)
          }
        }
        if (!(sendInfo.sendFlags & ENCRYPT) && EnigmailCommon.getPref("wrapHtmlBeforeSend")) {
          if (wrapWidth > 0) {
            var editor = gMsgCompose.editor.QueryInterface(nsIPlaintextEditorMail);
            editor.wrapWidth=wrapWidth-2; // prepare for the worst case: a 72 char's long line starting with '-'
            editor.rewrap(false);
          }
        }
      }
      catch (ex) {}
    }
    else {
      try {
        wrapWidth = this.getMailPref("mailnews.wraplength");
        if (wrapWidth > 0 && wrapWidth < 68) {
          if (EnigmailCommon.confirmDlg(window, EnigmailCommon.getString("minimalLineWrapping", [ wrapWidth ] ))) {
            EnigmailCommon.prefRoot.setIntPref("mailnews.wraplength", 68)
          }
        }
      }
      catch (ex) {}
    }

    var exitCodeObj    = new Object();
    var statusFlagsObj = new Object();
    var errorMsgObj    = new Object();


    // Get plain text
    // (Do we need to set the nsIDocumentEncoder.* flags?)
    var origText = this.editorGetContentAs("text/plain",
                                           encoderFlags);

    if (origText.length > 0) {
      // Sign/encrypt body text

      var escText = origText; // Copy plain text for possible escaping

      if (sendFlowed && !(sendInfo.sendFlags & ENCRYPT)) {
        // Prevent space stuffing a la RFC 2646 (format=flowed).

        //EnigmailCommon.DEBUG_LOG("enigmailMsgComposeOverlay.js: escText["+encoderFlags+"] = '"+escText+"'\n");

        // MULTILINE MATCHING ON
        RegExp.multiline = true;

        escText = escText.replace(/^From /g, "~From ");
        escText = escText.replace(/^>/g, "|");
        escText = escText.replace(/^[ \t]+$/g, "");
        escText = escText.replace(/^ /g, "~ ");

        // MULTILINE MATCHING OFF
        RegExp.multiline = false;

        //EnigmailCommon.DEBUG_LOG("enigmailMsgComposeOverlay.js: escText = '"+escText+"'\n");
        // Replace plain text and get it again
        this.replaceEditorText(escText);

        escText = this.editorGetContentAs("text/plain", encoderFlags);
      }

      // Replace plain text and get it again (to avoid linewrapping problems)
      this.replaceEditorText(escText);

      escText = this.editorGetContentAs("text/plain", encoderFlags);

      //EnigmailCommon.DEBUG_LOG("enigmailMsgComposeOverlay.js: escText["+encoderFlags+"] = '"+escText+"'\n");

      // Encrypt plaintext
      var charset = this.editorGetCharset();
      EnigmailCommon.DEBUG_LOG("enigmailMsgComposeOverlay.js: Enigmail.msg.encryptMsg: charset="+charset+"\n");

      // Encode plaintext to charset from unicode
      var plainText = (sendInfo.sendFlags & ENCRYPT)
                     ? EnigmailCommon.convertFromUnicode(origText, charset)
                     : EnigmailCommon.convertFromUnicode(escText, charset);

      var cipherText = enigmailSvc.encryptMessage(window, sendInfo.uiFlags, null, plainText,
                                            sendInfo.fromAddr, sendInfo.toAddr, sendInfo.bccAddr,
                                            sendInfo.sendFlags,
                                            exitCodeObj, statusFlagsObj,
                                            errorMsgObj);

      var exitCode = exitCodeObj.value;

      //EnigmailCommon.DEBUG_LOG("enigmailMsgComposeOverlay.js: cipherText = '"+cipherText+"'\n");
      if (cipherText && (exitCode == 0)) {
        // Encryption/signing succeeded; overwrite plaintext

        if (gMsgCompose.composeHTML) {
          // workaround for Thunderbird bug (TB adds an extra space in front of the text)
          cipherText = "\n"+cipherText;
        }
        else
          cipherText = cipherText.replace(/\r\n/g, "\n");

        if ( (sendInfo.sendFlags & ENCRYPT) && charset &&
          (charset.search(/^us-ascii$/i) != 0) ) {
          // Add Charset armor header for encrypted blocks
          cipherText = cipherText.replace(/(-----BEGIN PGP MESSAGE----- *)(\r?\n)/, "$1$2Charset: "+charset+"$2");
        }

        // Decode ciphertext from charset to unicode and overwrite
        this.replaceEditorText( EnigmailCommon.convertToUnicode(cipherText, charset) );

        // Save original text (for undo)
        this.processed = {"origText":origText, "charset":charset};

      }
      else {
        // Restore original text
        this.replaceEditorText(origText);

        if (sendInfo.sendFlags & (ENCRYPT | SIGN)) {
          // Encryption/signing failed
          EnigmailCommon.alert(window, EnigmailCommon.getString("sendAborted")+errorMsgObj.value);
          return false;
        }
      }
    }

    if (sendInfo.inlineEncAttach) {
      // encrypt attachments
      this.modifiedAttach = new Array();
      exitCode = this.encryptAttachments(sendInfo.bucketList, this.modifiedAttach,
                              window, sendInfo.uiFlags, sendInfo.fromAddr, sendInfo.toAddr, sendInfo.bccAddr,
                              sendInfo.sendFlags, errorMsgObj);
      if (exitCode != 0) {
        this.modifiedAttach = null;
        if (errorMsgObj.value) {
          EnigmailCommon.alert(window, EnigmailCommon.getString("sendAborted")+errorMsgObj.value);
        }
        else {
          EnigmailCommon.alert(window, EnigmailCommon.getString("sendAborted")+"an internal error has occurred");
        }
        if (this.processed) {
          this.undoEncryption();
        }
        else {
          this.removeAttachedKey();
        }
        return false;
      }
    }
    return true;
  },

  getMailPref: function (prefName)
  {

     var prefValue = null;
     try {
        var prefType = EnigmailCommon.prefRoot.getPrefType(prefName);
        // Get pref value
        switch (prefType) {
        case EnigmailCommon.prefBranch.PREF_BOOL:
           prefValue = EnigmailCommon.prefRoot.getBoolPref(prefName);
           break;

        case EnigmailCommon.prefBranch.PREF_INT:
           prefValue = EnigmailCommon.prefRoot.getIntPref(prefName);
           break;

        case EnigmailCommon.prefBranch.PREF_STRING:
           prefValue = EnigmailCommon.prefRoot.getCharPref(prefName);
           break;

        default:
           prefValue = undefined;
           break;
       }

     } catch (ex) {
        // Failed to get pref value
        EnigmailCommon.ERROR_LOG("enigmailMsgComposeOverlay.js: Enigmail.msg.getMailPref: unknown prefName:"+prefName+" \n");
     }

     return prefValue;
  },

  messageSendCheck: function ()
  {
    EnigmailCommon.DEBUG_LOG("enigmailMsgComposeOverlay.js: Enigmail.msg.messageSendCheck\n");

    try {
      var warn = this.getMailPref("mail.warn_on_send_accel_key");

      if (warn) {
          var checkValue = {value:false};
          var bundle = document.getElementById("bundle_composeMsgs");
          var buttonPressed = EnigmailCommon.getPromptSvc().confirmEx(window,
                bundle.getString('sendMessageCheckWindowTitle'),
                bundle.getString('sendMessageCheckLabel'),
                (EnigmailCommon.getPromptSvc().BUTTON_TITLE_IS_STRING * EnigmailCommon.getPromptSvc().BUTTON_POS_0) +
                (EnigmailCommon.getPromptSvc().BUTTON_TITLE_CANCEL * EnigmailCommon.getPromptSvc().BUTTON_POS_1),
                bundle.getString('sendMessageCheckSendButtonLabel'),
                null, null,
                bundle.getString('CheckMsg'),
                checkValue);
          if (buttonPressed != 0) {
              return false;
          }
          if (checkValue.value) {
            EnigmailCommon.prefRoot.setBoolPref("mail.warn_on_send_accel_key", false);
          }
      }
    } catch (ex) {}

    return true;
  },

  modifyCompFields: function (msgCompFields)
  {

  const HEADERMODE_KEYID = 0x01;
  const HEADERMODE_URL   = 0x10;

    try {
      if (this.identity.getBoolAttribute("enablePgp")) {
        var enigmailHeaders = "";
        if (EnigmailCommon.getPref("addHeaders")) {
          enigmailHeaders += "X-Enigmail-Version: "+EnigmailCommon.getVersion()+"\r\n";
        }
        var pgpHeader="";
        var openPgpHeaderMode = this.identity.getIntAttribute("openPgpHeaderMode");

        if (openPgpHeaderMode > 0) pgpHeader = "OpenPGP: ";

        if (openPgpHeaderMode & HEADERMODE_KEYID) {
            var keyId = this.identity.getCharAttribute("pgpkeyId");
            if (keyId.substr(0,2).toLowerCase() == "0x") {
              pgpHeader += "id="+keyId.substr(2);
            }
        }
        if (openPgpHeaderMode & HEADERMODE_URL) {
          if (pgpHeader.indexOf("=") > 0) pgpHeader += ";\r\n\t";
          pgpHeader += "url="+this.identity.getCharAttribute("openPgpUrlName");
        }
        if (pgpHeader.length > 0) {
          enigmailHeaders += pgpHeader + "\r\n";
        }
        msgCompFields.otherRandomHeaders += enigmailHeaders;
      }
    }
    catch (ex) {
      EnigmailCommon.writeException("enigmailMsgComposeOverlay.js: Enigmail.msg.modifyCompFields", ex);
    }

    EnigmailCommon.DEBUG_LOG("enigmailMsgComposeOverlay.js: Enigmail.msg.modifyCompFields: otherRandomHeaders = "+
             msgCompFields.otherRandomHeaders+"\n");
  },

  sendMessageListener: function (event)
  {
    EnigmailCommon.DEBUG_LOG("enigmailMsgComposeOverlay.js: Enigmail.msg.sendMessageListener\n");
    try {
      var msgcomposeWindow = document.getElementById("msgcomposeWindow");
      this.modifyCompFields(gMsgCompose.compFields);
      if (! this.encryptMsg(Number(msgcomposeWindow.getAttribute("msgtype")))) {
        this.removeAttachedKey();
        event.preventDefault();
        event.stopPropagation();
      }
    }
    catch (ex) {}
  },

  // Replacement for wrong charset conversion detection of Thunderbird

  checkCharsetConversion: function (msgCompFields)
  {

    const dce = Components.interfaces.nsIDocumentEncoder;
    try {
      var encoderFlags = dce.outputFormatted | dce.outputLFLineBreak;
      var docText = this.editorGetContentAs("text/plain", encoderFlags);

      if (docText.length > 0) {
        var converter = Components.classes["@mozilla.org/intl/saveascharset;1"].
          createInstance(Components.interfaces.nsISaveAsCharset);

        converter.Init(msgCompFields.characterSet, 0, 1);

        return (converter.Convert(docText).length >= docText.length);
      }
    }
    catch (ex) {}

    return true;
  },



  // encrypt attachments when sending inline PGP mails
  // It's quite a hack: the attachments are stored locally
  // and the attachments list is modified to pick up the
  // encrypted file(s) instead of the original ones.
  encryptAttachments: function (bucketList, newAttachments, window, uiFlags,
                                  fromAddr, toAddr, bccAddr, sendFlags,
                                  errorMsgObj)
  {
    EnigmailCommon.DEBUG_LOG("enigmailMsgComposeOverlay.js: Enigmail.msg.encryptAttachments\n");

    const nsIEnigmail = Components.interfaces.nsIEnigmail;
    const SIGN    = nsIEnigmail.SEND_SIGNED;
    const ENCRYPT = nsIEnigmail.SEND_ENCRYPTED;

    var ioServ;
    var fileTemplate;
    errorMsgObj.value="";

    try {
      ioServ = Components.classes[EnigmailCommon.IOSERVICE_CONTRACTID].getService(Components.interfaces.nsIIOService);
      if (!ioServ)
          return -1;

    } catch (ex) {
      return -1;
    }

    var tmpDir=EnigmailCommon.getTempDir();
    var extAppLauncher = Components.classes["@mozilla.org/mime;1"].
      getService(Components.interfaces.nsPIExternalAppLauncher);

    try {
      fileTemplate = Components.classes[EnigmailCommon.LOCAL_FILE_CONTRACTID].createInstance(Components.interfaces.nsILocalFile);
      fileTemplate.initWithPath(tmpDir);
      if (!(fileTemplate.isDirectory() && fileTemplate.isWritable())) {
        errorMsgObj.value=EnigmailCommon.getString("noTempDir");
        return -1;
      }
      fileTemplate.append("encfile");
    }
    catch (ex) {
      errorMsgObj.value=EnigmailCommon.getString("noTempDir");
      return -1;
    }
    EnigmailCommon.DEBUG_LOG("enigmailMsgComposeOverlay.js: Enigmail.msg.encryptAttachments tmpDir=" + tmpDir+"\n");
    var enigmailSvc = EnigmailCommon.getService(window);
    if (!enigmailSvc)
      return null;

    var exitCodeObj = new Object();
    var statusFlagsObj = new Object();

    var node = bucketList.firstChild;
    while (node) {
      var origUrl = node.attachment.url;
      if (origUrl.substring(0,7) != "file://") {
        // this should actually never happen since it is pre-checked!
        errorMsgObj.value="The attachment '"+node.attachment.name+"' is not a local file";
        return -1;
      }

      // transform attachment URL to platform-specific file name
      var origUri = ioServ.newURI(origUrl, null, null);
      var origFile=origUri.QueryInterface(Components.interfaces.nsIFileURL);
      if (node.attachment.temporary) {
        try {
          var origLocalFile=Components.classes[EnigmailCommon.LOCAL_FILE_CONTRACTID].createInstance(Components.interfaces.nsILocalFile);
          origLocalFile.initWithPath(origFile.file.path);
          extAppLauncher.deleteTemporaryFileOnExit(origLocalFile);
        }
        catch (ex) {}
      }

      var newFile = fileTemplate.clone();
      var txtMessage;
      try {
        newFile.createUnique(Components.interfaces.nsIFile.NORMAL_FILE_TYPE, 0600);
        txtMessage = enigmailSvc.encryptAttachment(window, fromAddr, toAddr, bccAddr, sendFlags,
                                  origFile.file, newFile,
                                  exitCodeObj, statusFlagsObj,
                                  errorMsgObj);
      } catch (ex) {}

      if (exitCodeObj.value != 0) {
        return exitCodeObj.value;
      }

      var fileInfo = new Object();
      fileInfo.origFile  = origFile;
      fileInfo.origUrl   = node.attachment.url;
      fileInfo.origName  = node.attachment.name;
      fileInfo.origTemp  = node.attachment.temporary;
      fileInfo.origCType = node.attachment.contentType;

      // transform platform specific new file name to file:// URL
      var newUri = ioServ.newFileURI(newFile);
      fileInfo.newUrl  = newUri.asciiSpec;
      fileInfo.newFile = newFile;
      fileInfo.encrypted = (sendFlags & ENCRYPT);

      newAttachments.push(fileInfo);
      node = node.nextSibling;
    }

    var i=0;
    if (sendFlags & ENCRYPT) {
      // if we got here, all attachments were encrpted successfully,
      // so we replace their names & urls
      node = bucketList.firstChild;

      while (node) {
        node.attachment.url = newAttachments[i].newUrl;
        node.attachment.name += EnigmailCommon.getPref("inlineAttachExt");
        node.attachment.contentType="application/octet-stream";
        node.attachment.temporary=true;

        ++i; node = node.nextSibling;
      }
    }
    else {
      // for inline signing we need to add new attachments for every
      // signed file
      for (i=0; i<newAttachments.length; i++) {
        // create new attachment
        var fileAttachment = Components.classes["@mozilla.org/messengercompose/attachment;1"].createInstance(Components.interfaces.nsIMsgAttachment);
        fileAttachment.temporary = true;
        fileAttachment.url = newAttachments[i].newUrl;
        fileAttachment.name = newAttachments[i].origName + EnigmailCommon.getPref("inlineSigAttachExt");

        // add attachment to msg
        this.addAttachment(fileAttachment);
      }

    }
    return 0;
  },

  toggleAttribute: function (attrName)
  {
    EnigmailCommon.DEBUG_LOG("enigmailMsgComposeOverlay.js: Enigmail.msg.toggleAttribute('"+attrName+"')\n");

    var menuElement = document.getElementById("enigmail_"+attrName);

    var oldValue = EnigmailCommon.getPref(attrName);
    EnigmailCommon.setPref(attrName, !oldValue);
  },

  toggleAccountAttr: function (attrName)
  {
    EnigmailCommon.DEBUG_LOG("enigmailMsgComposeOverlay.js: Enigmail.msg.toggleAccountAttr('"+attrName+"')\n");

    var oldValue = this.identity.getBoolAttribute(attrName);
    this.identity.setBoolAttribute(attrName, !oldValue)

  },

  toggleRules: function ()
  {
    EnigmailCommon.DEBUG_LOG("enigmailMsgComposeOverlay.js: Enigmail.msg.toggleRules: Enigmail.msg.enableRules="+Enigmail.msg.enableRules+"\n");
    this.enableRules = !this.enableRules;
  },

  decryptQuote: function (interactive)
  {
    EnigmailCommon.DEBUG_LOG("enigmailMsgComposeOverlay.js: Enigmail.msg.decryptQuote: "+interactive+"\n");
    const nsIEnigmail = Components.interfaces.nsIEnigmail;

    if (gWindowLocked || this.processed)
      return;

    var enigmailSvc = EnigmailCommon.getService(window);
    if (!enigmailSvc)
      return;

    const dce = Components.interfaces.nsIDocumentEncoder;
    var encoderFlags = dce.outputFormatted | dce.outputLFLineBreak;

    var docText = this.editorGetContentAs("text/plain", encoderFlags);

    var blockBegin = docText.indexOf("-----BEGIN PGP ");
    if (blockBegin < 0)
      return;

    // Determine indentation string
    var indentBegin = docText.substr(0, blockBegin).lastIndexOf("\n");
    var indentStr = docText.substring(indentBegin+1, blockBegin);

    EnigmailCommon.DEBUG_LOG("enigmailMsgComposeOverlay.js: Enigmail.msg.decryptQuote: indentStr='"+indentStr+"'\n");

    var beginIndexObj = new Object();
    var endIndexObj = new Object();
    var indentStrObj = new Object();
    var blockType = enigmailSvc.locateArmoredBlock(docText, 0, indentStr,
                                            beginIndexObj, endIndexObj,
                                            indentStrObj);

    if ((blockType != "MESSAGE") && (blockType != "SIGNED MESSAGE"))
      return;

    var beginIndex = beginIndexObj.value;
    var endIndex   = endIndexObj.value;

    var head = docText.substr(0, beginIndex);
    var tail = docText.substr(endIndex+1);

    var pgpBlock = docText.substr(beginIndex, endIndex-beginIndex+1);
    var indentRegexp;

    if (indentStr) {
      // MULTILINE MATCHING ON
      RegExp.multiline = true;

      if (indentStr == "> ") {
        // replace ">> " with "> > " to allow correct quoting
        pgpBlock = pgpBlock.replace(/^>>/g, "> >");
      }

      // Delete indentation
      indentRegexp = new RegExp("^"+indentStr, "g");

      pgpBlock = pgpBlock.replace(indentRegexp, "");
      //tail     =     tail.replace(indentRegexp, "");

      if (indentStr.match(/[ \t]*$/)) {
        indentStr = indentStr.replace(/[ \t]*$/g, "");
        indentRegexp = new RegExp("^"+indentStr+"$", "g");

        pgpBlock = pgpBlock.replace(indentRegexp, "");
      }


      // Handle blank indented lines
      pgpBlock = pgpBlock.replace(/^[ \t]*>[ \t]*$/g, "");
      //tail     =     tail.replace(/^[ \t]*>[ \t]*$/g, "");

      // Trim leading space in tail
      tail = tail.replace(/^\s*\n/, "\n");

      // MULTILINE MATCHING OFF
      RegExp.multiline = false;
    }

    if (tail.search(/\S/) < 0) {
      // No non-space characters in tail; delete it
      tail = "";
    }

    //EnigmailCommon.DEBUG_LOG("enigmailMsgComposeOverlay.js: Enigmail.msg.decryptQuote: pgpBlock='"+pgpBlock+"'\n");

    var charset = this.editorGetCharset();
    EnigmailCommon.DEBUG_LOG("enigmailMsgComposeOverlay.js: Enigmail.msg.decryptQuote: charset="+charset+"\n");

    // Encode ciphertext from unicode to charset
    var cipherText = EnigmailCommon.convertFromUnicode(pgpBlock, charset);

    if ((! this.getMailPref("mailnews.reply_in_default_charset")) && (blockType == "MESSAGE")) {
      // set charset according to PGP block, if available (encrypted messages only)
      cipherText = cipherText.replace(/\r\n/g, "\n");
      cipherText = cipherText.replace(/\r/g,   "\n");
      var cPos = cipherText.search(/\nCharset: .+\n/i);
      if (cPos < cipherText.search(/\n\n/)) {
        var charMatch = cipherText.match(/\n(Charset: )(.+)\n/i);
        if (charMatch && charMatch.length > 2) {
          charset = charMatch[2];
          gMsgCompose.SetDocumentCharset(charset);
        }
      }
    }

    // Decrypt message
    var signatureObj   = new Object();
    signatureObj.value = "";
    var exitCodeObj    = new Object();
    var statusFlagsObj = new Object();
    var userIdObj      = new Object();
    var keyIdObj       = new Object();
    var sigDateObj     = new Object();
    var errorMsgObj    = new Object();
    var blockSeparationObj  = new Object();

    var uiFlags = nsIEnigmail.UI_UNVERIFIED_ENC_OK;

    var plainText = enigmailSvc.decryptMessage(window, uiFlags, cipherText,
                                   signatureObj, exitCodeObj, statusFlagsObj,
                                   keyIdObj, userIdObj, sigDateObj,
                                   errorMsgObj, blockSeparationObj);

    // Decode plaintext from charset to unicode
    plainText = EnigmailCommon.convertToUnicode(plainText, charset);
    if (EnigmailCommon.getPref("keepSettingsForReply")) {
      if (statusFlagsObj.value & nsIEnigmail.DECRYPTION_OKAY)
        this.setSendMode('encrypt');
    }

    var exitCode = exitCodeObj.value;

    if (exitCode != 0) {
      // Error processing
      var errorMsg = errorMsgObj.value;

      var statusLines = errorMsg.split(/\r?\n/);

      var displayMsg;
      if (statusLines && statusLines.length) {
        // Display only first ten lines of error message
        while (statusLines.length > 10)
          statusLines.pop();

        displayMsg = statusLines.join("\n");

        if (interactive)
          EnigmailCommon.alert(window, displayMsg);
      }
    }

    if (blockType == "MESSAGE" && exitCode == 0 && plainText.length==0) {
      plainText = " ";
    }

    if (!plainText) {
      if (blockType != "SIGNED MESSAGE")
        return;

      // Extract text portion of clearsign block
      plainText = enigmailSvc.extractSignaturePart(pgpBlock,
                                                    nsIEnigmail.SIGNATURE_TEXT);
    }

    var doubleDashSeparator = EnigmailCommon.getPref("doubleDashSeparator")
    if (gMsgCompose.type != nsIMsgCompType.Template &&
        gMsgCompose.type != nsIMsgCompType.Draft &&
        doubleDashSeparator) {
      var signOffset = plainText.search(/[\r\n]-- +[\r\n]/);

      if (signOffset < 0 && blockType == "SIGNED MESSAGE") {
        signOffset = plainText.search(/[\r\n]--[\r\n]/);
      }

      if (signOffset > 0) {
        // Strip signature portion of quoted message
        plainText = plainText.substr(0, signOffset+1);
      }
    }

    var clipBoard = Components.classes["@mozilla.org/widget/clipboard;1"].
                      getService(Components.interfaces.nsIClipboard);
    if (clipBoard.supportsSelectionClipboard()) {
      // get the clipboard contents for selected text (X11)
      try {
        var transferable = Components.classes["@mozilla.org/widget/transferable;1"].
                  createInstance(Components.interfaces.nsITransferable);
        transferable.addDataFlavor("text/unicode");
        clipBoard.getData(transferable, clipBoard.kSelectionClipboard);
        var flavour = {};
        var data = {};
        var length = {};
        transferable.getAnyTransferData(flavour, data, length);
      }
      catch(ex) {}
    }

    // Replace encrypted quote with decrypted quote (destroys selection clipboard on X11)
    this.editorSelectAll();

    //EnigmailCommon.DEBUG_LOG("enigmailMsgComposeOverlay.js: Enigmail.msg.decryptQuote: plainText='"+plainText+"'\n");

    if (head)
      this.editorInsertText(head);

    var quoteElement;

    if (indentStr) {
      quoteElement = this.editorInsertAsQuotation(plainText);

    } else {
      this.editorInsertText(plainText);
    }

    if (tail)
      this.editorInsertText(tail);

    if (clipBoard.supportsSelectionClipboard()) {
      try {
        // restore the clipboard contents for selected text (X11)
        var pasteClipboard = Components.classes["@mozilla.org/widget/clipboardhelper;1"].
                getService(Components.interfaces.nsIClipboardHelper);
        data = data.value.QueryInterface(Components.interfaces.nsISupportsString).data;
        pasteClipboard.copyStringToClipboard(data, clipBoard.kSelectionClipboard);
      }
      catch (ex) {}
    }

    if (interactive)
      return;

    // Position cursor
    var replyOnTop = 1;
    try {
      replyOnTop = this.identity.replyOnTop;
    } catch (ex) {}

    if (!indentStr || !quoteElement) replyOnTop = 1;

    EnigmailCommon.DEBUG_LOG("enigmailMsgComposeOverlay.js: Enigmail.msg.decryptQuote: replyOnTop="+replyOnTop+", quoteElement="+quoteElement+"\n");

    var nsISelectionController = Components.interfaces.nsISelectionController;

    if (this.editor.selectionController) {
      var selection = this.editor.selectionController;
      selection.completeMove(false, false); // go to start;

      switch (replyOnTop) {
      case 0:
        // Position after quote
        this.editor.endOfDocument();
        if (tail) {
          for (cPos = 0; cPos < tail.length; cPos++) {
            selection.characterMove(false, false); // move backwards
          }
        }
        break;

      case 2:
        // Select quote

        if (head) {
          for (cPos = 0; cPos < head.length; cPos++) {
            selection.characterMove(true, false);
          }
        }
        selection.completeMove(true, true);
        if (tail) {
          for (cPos = 0; cPos < tail.length; cPos++) {
            selection.characterMove(false, true); // move backwards
          }
        }
        break;

      default:
        // Position at beginning of document

        if (this.editor) {
          this.editor.beginningOfDocument();
        }
      }

      this.editor.selectionController.scrollSelectionIntoView(nsISelectionController.SELECTION_NORMAL,
                                     nsISelectionController.SELECTION_ANCHOR_REGION,
                                     true);
    }

  },

  editorInsertText: function (plainText)
  {
    EnigmailCommon.DEBUG_LOG("enigmailMsgComposeOverlay.js: Enigmail.msg.editorInsertText\n");
    if (this.editor) {
      var mailEditor;
      try {
        mailEditor = this.editor.QueryInterface(Components.interfaces.nsIEditorMailSupport);
        mailEditor.insertTextWithQuotations(plainText);
      } catch (ex) {
        EnigmailCommon.DEBUG_LOG("enigmailMsgComposeOverlay.js: Enigmail.msg.editorInsertText: no mail editor\n");
        this.editor.insertText(plainText);
      }
    }
  },

  editorInsertAsQuotation: function (plainText)
  {
    EnigmailCommon.DEBUG_LOG("enigmailMsgComposeOverlay.js: Enigmail.msg.editorInsertAsQuotation\n");
    if (this.editor) {
      var mailEditor;
      try {
        mailEditor = this.editor.QueryInterface(Components.interfaces.nsIEditorMailSupport);
      } catch (ex) {}

      if (!mailEditor)
        return 0;

      EnigmailCommon.DEBUG_LOG("enigmailMsgComposeOverlay.js: Enigmail.msg.editorInsertAsQuotation: mailEditor="+mailEditor+"\n");

      mailEditor.insertAsQuotation(plainText);

      return 1;
    }
    return 0;
  },


  editorSelectAll: function ()
  {
    if (this.editor) {
      this.editor.selectAll();
    }
  },

  editorGetCharset: function ()
  {
    EnigmailCommon.DEBUG_LOG("enigmailMsgComposeOverlay.js: Enigmail.msg.editorGetCharset\n");
    return this.editor.documentCharacterSet;
  },

  editorGetContentAs: function (mimeType, flags) {
    EnigmailCommon.DEBUG_LOG("enigmailMsgComposeOverlay.js: Enigmail.msg.editorGetContentAs\n");
    if (this.editor) {
      return this.editor.outputToString(mimeType, flags);
    }
  },

  focusChange: function ()
  {
    // call original TB function
    CommandUpdate_MsgCompose();

    var focusedWindow = top.document.commandDispatcher.focusedWindow;

    // we're just setting focus to where it was before
    if (focusedWindow == Enigmail.msg.lastFocusedWindow) {
      // skip
      return;
    }

    Enigmail.msg.lastFocusedWindow = focusedWindow;

    Enigmail.msg.fireSendFlags()
  },

  fireSendFlags: function ()
  {
    try {
      EnigmailCommon.DEBUG_LOG("enigmailMsgComposeOverlay.js: Enigmail.msg.fireSendFlags\n");
      if (! this.determineSendFlagId) {
        this.determineSendFlagId = window.setTimeout(
          function () {
            Enigmail.msg.determineSendFlags()
          },
          0);
      }
    }
    catch (ex) {}
  }
};


Enigmail.composeStateListener = {
  NotifyComposeFieldsReady: function() {
    // Note: NotifyComposeFieldsReady is only called when a new window is created (i.e. not in case a window object is reused).
    EnigmailCommon.DEBUG_LOG("enigmailMsgComposeOverlay.js: ECSL.NotifyComposeFieldsReady\n");

    try {
      Enigmail.msg.editor = gMsgCompose.editor.QueryInterface(Components.interfaces.nsIEditor);
    } catch (ex) {}

    if (!Enigmail.msg.editor)
      return;

    function enigDocStateListener () {}

    enigDocStateListener.prototype = {
      QueryInterface: function (iid)
      {
        if (!iid.equals(Components.interfaces.nsIDocumentStateListener) &&
            !iid.equals(Components.interfaces.nsISupports))
           throw Components.results.NS_ERROR_NO_INTERFACE;

        return this;
      },

      NotifyDocumentCreated: function ()
      {
        // EnigmailCommon.DEBUG_LOG("enigmailMsgComposeOverlay.js: EDSL.NotifyDocumentCreated\n");
      },

      NotifyDocumentWillBeDestroyed: function ()
      {
        // EnigmailCommon.DEBUG_LOG("enigmailMsgComposeOverlay.js: EDSL.enigDocStateListener.NotifyDocumentWillBeDestroyed\n");
      },

      NotifyDocumentStateChanged: function (nowDirty)
      {
        EnigmailCommon.DEBUG_LOG("enigmailMsgComposeOverlay.js: EDSL.NotifyDocumentStateChanged: "+nowDirty+"\n");

        var isEmpty, isEditable;

        isEmpty    = Enigmail.msg.editor.documentIsEmpty;
        isEditable = Enigmail.msg.editor.isDocumentEditable;


        EnigmailCommon.DEBUG_LOG("enigmailMsgComposeOverlay.js: EDSL.NotifyDocumentStateChanged: isEmpty="+isEmpty+", isEditable="+isEditable+"\n");

        if (!isEditable || isEmpty)
          return;

        if (!Enigmail.msg.timeoutId && !Enigmail.msg.dirty)
          Enigmail.msg.timeoutId = window.setTimeout(
            function (e) {
              Enigmail.msg.decryptQuote(e)
            },
            10,
            false);
      }
    }

    var docStateListener = new enigDocStateListener();

    Enigmail.msg.editor.addDocumentStateListener(docStateListener);
  },

  ComposeProcessDone: function(aResult)
  {
    // Note: called after a mail was sent (or saved)
    EnigmailCommon.DEBUG_LOG("enigmailMsgComposeOverlay.js: ECSL.ComposeProcessDone: "+aResult+"\n");

    if (aResult != Components.results.NS_OK) {
      if (Enigmail.msg.processed) Enigmail.msg.undoEncryption();
      Enigmail.msg.removeAttachedKey();
    }

  },

  NotifyComposeBodyReady: function()
  {
    //EnigmailCommon.DEBUG_LOG("enigmailMsgComposeOverlay.js: ECSL.ComposeBodyReady\n");
  },

  SaveInFolderDone: function(folderURI)
  {
    //EnigmailCommon.DEBUG_LOG("enigmailMsgComposeOverlay.js: ECSL.SaveInFolderDone\n");
  }
};


window.addEventListener("load",
  function _enigmail_composeStartup (event)
  {
    Enigmail.msg.composeStartup(event);
  },
  false);

window.addEventListener("unload",
  function _enigmail_composeUnload (event)
  {
    Enigmail.msg.composeUnload(event);
  },
  false);

// Handle recycled windows
window.addEventListener('compose-window-close',
  function _enigmail_msgComposeClose (event)
  {
    Enigmail.msg.msgComposeClose(event);
  },
  true);

window.addEventListener('compose-window-reopen',
  function _enigmial_msgComposeReopen (event)
  {
    Enigmail.msg.msgComposeReopen(event);
  },
  true);

// Listen to message sending event
window.addEventListener('compose-send-message',
  function _enigmial_sendMessageListener (event)
  {
    Enigmail.msg.sendMessageListener(event);
  },
  true);
