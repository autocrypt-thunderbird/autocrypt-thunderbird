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
 * Portions created by Patrick Brunschwig <patrick@mozilla-enigmail.org> are
 * Copyright (C) 2010 Patrick Brunschwig. All Rights Reserved.
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

var EnigmailColumnHandler = {
  nsIEnigmail: Components.interfaces.nsIEnigmail,
  getCellText:         function(row, col) {
    return null;
  },
  getSortStringForRow: function(hdr) { return "" },
  isString:            function() { return false; },
  getCellProperties:   function(row, col, props){
    let key = gDBView.getKeyAt(row);
    let hdr = gDBView.db.GetMsgHdrForKey(key);
    let statusFlags = hdr.getUint32Property("enigmail");
    let newProp = null;
    if ((statusFlags & this.nsIEnigmail.GOOD_SIGNATURE) &&
        (statusFlags & this.nsIEnigmail.DECRYPTION_OKAY))
      newProp = "enigSignedEncrypted";
    else if (statusFlags & this.nsIEnigmail.GOOD_SIGNATURE)
      newProp = "enigSigned";
    else if (statusFlags & this.nsIEnigmail.DECRYPTION_OKAY)
      newProp = "enigEncrypted";

    if (newProp) {
      let atomService = Components.classes["@mozilla.org/atom-service;1"].
        getService(Components.interfaces.nsIAtomService);
      var atom = atomService.getAtom(newProp);
      props.AppendElement(atom);
    }
  },
  getRowProperties:    function(row, props){},
  getImageSrc:         function(row, col) {},
  getSortLongForRow:   function(hdr) {
    var statusFlags = hdr.getUint32Property("enigmail");
    if ((statusFlags & this.nsIEnigmail.GOOD_SIGNATURE) &&
        (statusFlags & this.nsIEnigmail.DECRYPTION_OKAY))
      return 3;
    else if (statusFlags & this.nsIEnigmail.GOOD_SIGNATURE)
      return 2;
    else if (statusFlags & this.nsIEnigmail.DECRYPTION_OKAY)
      return 1;
    else
      return 0;

    return 0;
  },

  createDbObserver: {
    // Components.interfaces.nsIObserver
    observe: function(aMsgFolder, aTopic, aData)
    {
      gDBView.addColumnHandler("enigmailStatusCol", EnigmailColumnHandler);
    }
  }
};

window.addEventListener("load",
  function () {
    var ObserverService = Components.classes["@mozilla.org/observer-service;1"].
      getService(Components.interfaces.nsIObserverService);
    ObserverService.addObserver(EnigmailColumnHandler.createDbObserver, "MsgCreateDBView", false);
  },
  false
);