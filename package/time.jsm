/*global Components: false, EnigmailLocale: false */
/*jshint -W097 */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

"use strict";

var EXPORTED_SYMBOLS = ["EnigmailTime"];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import("resource://enigmail/locale.jsm");

const DATE_FORMAT_CONTRACTID = "@mozilla.org/intl/scriptabledateformat;1";

const EnigmailTime = {
  /**
   * Transform a Unix-Timestamp to a human-readable date/time string
   *
   * @dateNum:  Number  - Unix timestamp
   * @withDate: Boolean - if true, include the date in the output
   * @withTime: Boolean - if true, include the time in the output
   *
   * @return: String - formatted date/time string
   */
  getDateTime: function(dateNum, withDate, withTime) {
    if (dateNum && dateNum !== 0) {
      let dat = new Date(dateNum * 1000);
      let appLocale = EnigmailLocale.get();
      let dateTimeFormat = Cc[DATE_FORMAT_CONTRACTID].getService(Ci.nsIScriptableDateFormat);

      let dateFormat = (withDate ? dateTimeFormat.dateFormatShort : dateTimeFormat.dateFormatNone);
      let timeFormat = (withTime ? dateTimeFormat.timeFormatNoSeconds : dateTimeFormat.timeFormatNone);
      return dateTimeFormat.FormatDateTime(appLocale.getCategory("NSILOCALE_TIME"),
        dateFormat,
        timeFormat,
        dat.getFullYear(), dat.getMonth() + 1, dat.getDate(),
        dat.getHours(), dat.getMinutes(), 0);
    }
    else {
      return "";
    }
  }
};
