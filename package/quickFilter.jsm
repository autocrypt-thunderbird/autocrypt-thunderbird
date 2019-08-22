"use strict";

/* global QuickFilterBarMuxer: false */

var EXPORTED_SYMBOLS = ['AutocryptQuickFilter'];

const Ci = Components.interfaces;

var MailServices = ChromeUtils.import("resource:///modules/MailServices.jsm").MailServices;
var QuickFilterManager = ChromeUtils.import("resource:///modules/QuickFilterManager.jsm").QuickFilterManager;
var AutocryptLog = ChromeUtils.import("chrome://autocrypt/content/modules/log.jsm").AutocryptLog;
var COLUMN_STATUS = ChromeUtils.import("chrome://autocrypt/content/modules/verifyStatus.jsm").COLUMN_STATUS;

const termId = 'qfb-autocrypt-encrypted';
const buttonId = 'qfb-autocrypt-encrypted';
const filterId = 'qfb-autocrypt-encrypted';

const nsMsgSearchOp = Ci.nsMsgSearchOp;
const nsMsgSearchAttrib = Ci.nsMsgSearchAttrib;

var QuickFilterTerm = {
  name: 'Encrypted',
  id: termId,
  needsBody: false,
  getEnabled: function (scope, op) { return true; },
  getAvailable: function (scope, op) { return true; },
  getAvailableOperators: function (scope, length) {
    length.value = 2;
    return [nsMsgSearchOp.Is, nsMsgSearchOp.Isnt];
  },
  match: function (aMsgHdr, aSearchValue, aSearchOp) {
    try {
      return aMsgHdr.getUint32Property("autocrypt-status") == 1;
    } catch (ex) {
      return false;
    }
  }
};

var AutocryptQuickFilter = {
  quickFilterRegistered: false,

  quickFilter: {
    name: filterId,
    domId: buttonId,
    appendTerms: function (aTermCreator, aTerms, aFilterValue) {
      let term = aTermCreator.createTerm();
      let value = term.value;
      term.attrib = nsMsgSearchAttrib.Custom;
      value.attrib = term.attrib;
      term.value = value;
      term.customId = termId;
      term.booleanAnd = true;
      term.op = aFilterValue ? nsMsgSearchOp.Is : nsMsgSearchOp.Isnt;
      aTerms.push(term);
    }
  },

  addFilterTermIfNotExists: function() {
    let foundFilter = null;
    try {
      foundFilter = MailServices.filters.getCustomTerm(QuickFilterTerm.id);
    } catch (ex) {}

    if (!foundFilter) {
      AutocryptLog.DEBUG("quickFilter.jsm: addFilterTermIfNotExists: " + QuickFilterTerm.id + "\n");
      // filterService.addCustomAction(filterObj);
      MailServices.filters.addCustomTerm(QuickFilterTerm);
    }
  },

  onStartup: function(document) {
    AutocryptLog.DEBUG("quickFilter.jsm: onStartup()\n");
    if (!this.quickFilterRegistered) {
      AutocryptLog.DEBUG("quickFilter.jsm: onStartup(): registering quickfilter\n");
      QuickFilterManager.defineFilter(this.quickFilter);
      this.quickFilterRegistered = true;
    }
    this.addFilterTermIfNotExists(QuickFilterTerm);
    this.registerButtonHandler(document);
  },

  onShutdown: function() {
    AutocryptLog.DEBUG("quickFilter.jsm: onShutdown()\n");
    QuickFilterManager.killFilter(filterId);
    this.quickFilterRegistered = false;
  },

  // unfortunately, QuickFilterBarMuxer._bindUI is only called once on startup,
  // so we have to patch in this handler ourselves
  // see https://dxr.mozilla.org/comm-beta/source/mail/base/content/quickFilterBar.js#189
  registerButtonHandler: function(document) {
    const button = document.getElementById(buttonId);
    const self = this;
    button.addEventListener("command", function() {
      try {
        let window = button.ownerDocument.defaultView;
        let postValue = button.checked ? true : null;
        window.QuickFilterBarMuxer.activeFilterer.setFilterValue(self.quickFilter.name, postValue);
        window.QuickFilterBarMuxer.deferredUpdateSearch();
      } catch (ex) {
        AutocryptLog.DEBUG(`quickFilter.jsm: registerButtonHandler(): error ${ex}\n`);
      }
    });
  }
};
