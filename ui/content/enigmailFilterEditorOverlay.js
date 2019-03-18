/*global Components: false, EnigmailTimer: false */
/*  * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

/* global Components: false */

"use strict";

/* global Services: false */
/* global gActionListOrdered: false, checkActionsReorder: true, nsMsgFilterType: false   */
/* global  gFilterActionList: true, gCustomActions: false, gFilterList: false */
/* global gFilterType: false, gFilterBundle: false, gFilterActionStrings: false */

var EnigmailTb60Compat = ChromeUtils.import("chrome://enigmail/content/modules/tb60compat.jsm").EnigmailTb60Compat;
var EnigmailTimer = ChromeUtils.import("chrome://enigmail/content/modules/timer.jsm").EnigmailTimer;


var EnigmailFilterEditor = {
  onLoad: function() {
    let self = this;
    let platformTb66 = EnigmailTb60Compat.isPlatformNewerThan("66");

    if ("arguments" in window && window.arguments[0]) {
      let args = window.arguments[0];

      if ("filter" in args) {
        // editing a filter
        if (platformTb66) {
          this.overwriteActionTypes(false);
        } else {
          this.reInitialize(args.filter);
        }
      }
    }


    // Overwrite the original checkActionsReorder function
    this.enigmail_origCheckActionsReorder = checkActionsReorder;

    checkActionsReorder = function() {
      let r = self.enigmail_origCheckActionsReorder();
      EnigmailTimer.setTimeout(function() {
        EnigmailFilterEditor.checkMoveAction(platformTb66);
      }, 0);
      return r;
    };
  },

  onUnload: function() {
    window.removeEventListener("load-enigmail", EnigmailFilterEditor.onLoad, false);
    window.removeEventListener("unload-enigmail", EnigmailFilterEditor.onUnload, false);
    checkActionsReorder = this.enigmail_origCheckActionsReorder;
    EnigmailFilterEditor = undefined;
  },

  overwriteAction: function(element, resetValues) {
    let targetType = "";

    switch (element.value) {
      case "enigmail@enigmail.net#filterActionCopyDecrypt":
        targetType = "copymessage";
        break;
      case "enigmail@enigmail.net#filterActionMoveDecrypt":
        targetType = "movemessage";
        break;
      case "enigmail@enigmail.net#filterActionEncrypt":
        targetType = "forwardmessage";
        break;
    }

    if (targetType.length > 0) {
      let currType = element.mRuleActionType.nextSibling.getAttribute("type");
      if (currType != targetType) {
        element.mRuleActionType.nextSibling.setAttribute("type", targetType);
        element.mRuleActionType.menulist.value = element.value;
      }
    }

    element.validateAction = this.validateAction;
  },

  overwriteActionTypes: function(resetValues) {
    let count = gFilterActionList.itemCount;

    for (let i = 0; i < count; i++) {
      let e = gFilterActionList.getItemAtIndex(i);
      this.overwriteAction(e, resetValues);
    }
  },

  reInitialize: function(filter) {
    while (gFilterActionList.firstChild) {
      gFilterActionList.removeChild(gFilterActionList.firstChild);
    }

    let numActions = filter.actionCount;
    for (let actionIndex = 0; actionIndex < numActions; actionIndex++) {
      let filterAction = filter.getActionAt(actionIndex);

      var newActionRow = document.createElement('listitem');
      newActionRow.setAttribute('initialActionIndex', actionIndex);
      newActionRow.className = 'ruleaction';
      gFilterActionList.appendChild(newActionRow);
      newActionRow.setAttribute('value',
        filterAction.type == Ci.nsMsgFilterAction.Custom ?
        filterAction.customId : gFilterActionStrings[filterAction.type]);
      newActionRow.setAttribute('onfocus', 'this.storeFocus();');
    }
  },

  checkMoveAction: function(doOverwriteActionTypes) {
    let dlg = document.getElementById("FilterEditor");
    let acceptButton = dlg.getButton("accept");
    let forbidden = -1;
    let hasCopyAction = -1;
    let hasMoveAction = -1;

    if (doOverwriteActionTypes) this.overwriteActionTypes(true);

    for (let i = 0; i < gActionListOrdered.length; i++) {
      let action = gActionListOrdered.queryElementAt(i, Components.interfaces.nsIMsgRuleAction);
      if (action.customId == "enigmail@enigmail.net#filterActionCopyDecrypt") {
        hasCopyAction = i;
        break;
      }

      if (action.customId == "enigmail@enigmail.net#filterActionMoveDecrypt") {
        hasMoveAction = i;
        if (i < gActionListOrdered.length - 1) {
          forbidden = i;
        }
      }

      if (action.type == Ci.nsMsgFilterAction.StopExecution &&
        i == gActionListOrdered.length - 1 &&
        forbidden == i - 1) {
        // allow "stop execution" if it's the only action after move
        forbidden = -1;
      }
    }

    if (forbidden >= 0 || (hasMoveAction >= 0 && hasCopyAction > hasMoveAction)) {
      document.getElementById("enigmailInfobar").removeAttribute("hidden");
      acceptButton.setAttribute("disabled", "true");
    } else {
      document.getElementById("enigmailInfobar").setAttribute("hidden", "true");
      acceptButton.setAttribute("disabled", "false");
    }
  },

  /**
   * Taken from FilterEditor.js; adjusted for Enigmail custom actions  
   */
  validateAction: function() {
    // returns true if this row represents a valid filter action and false otherwise.
    // This routine also prompts the user.
    ChromeUtils.import("resource:///modules/MailUtils.jsm", this);
    let filterActionString = this.getAttribute('value');
    let actionTarget = document.getAnonymousNodes(this)[1];
    let actionTargetLabel = actionTarget.ruleactiontargetElement &&
      actionTarget.ruleactiontargetElement.childNodes[0].value;
    let errorString, customError, msgFolder, actionItem;

    switch (filterActionString) {
      case "movemessage":
      case "copymessage":
        msgFolder = actionTargetLabel ?
          this.MailUtils.getOrCreateFolder(actionTargetLabel) : null;
        if (!msgFolder || !msgFolder.canFileMessages)
          errorString = "mustSelectFolder";
        break;
      case "forwardmessage":
        if (actionTargetLabel.length < 3 ||
          actionTargetLabel.indexOf('@') < 1)
          errorString = "enterValidEmailAddress";
        break;
      case "replytomessage":
        if (!actionTarget.ruleactiontargetElement.childNodes[0].selectedItem)
          errorString = "pickTemplateToReplyWith";
        break;
      case "enigmail@enigmail.net#filterActionEncrypt":
        actionTarget.ruleactiontargetElement.childNodes[0].value = actionTarget.childNodes[0].childNodes[0].inputField.value;
        actionTargetLabel = actionTarget.ruleactiontargetElement.childNodes[0].value;
        /* eslint no-fallthrough: 0 */
        // no break here
      case "enigmail@enigmail.net#filterActionCopyDecrypt":
      case "enigmail@enigmail.net#filterActionMoveDecrypt":
        for (let i = 0; i < gCustomActions.length; i++)
          if (gCustomActions[i].id == filterActionString) {
            customError =
              gCustomActions[i].validateActionValue(
                actionTargetLabel,
                gFilterList.folder, gFilterType);
            break;
          }
        break;
      default:
        // some custom actions have no action value node
        if (!document.getAnonymousNodes(actionTarget))
          return true;
        // locate the correct custom action, and check validity
        for (let i = 0; i < gCustomActions.length; i++)
          if (gCustomActions[i].id == filterActionString) {
            customError =
              gCustomActions[i].validateActionValue(
                actionTargetLabel,
                gFilterList.folder, gFilterType);
            break;
          }
        break;
    }

    errorString = errorString ?
      gFilterBundle.getString(errorString) :
      customError;
    if (errorString)
      Services.prompt.alert(window, null, errorString);

    return !errorString;
  }
};

window.addEventListener("load-enigmail", EnigmailFilterEditor.onLoad.bind(EnigmailFilterEditor), false);
window.addEventListener("unload-enigmail", EnigmailFilterEditor.onUnload.bind(EnigmailFilterEditor), false);