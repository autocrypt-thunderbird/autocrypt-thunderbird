/*global Components: false */
/*jshint -W097 */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

"use strict";

var EXPORTED_SYMBOLS = ["EnigmailStreams"];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import("resource://gre/modules/XPCOMUtils.jsm"); /*global XPCOMUtils: false */
Cu.import("resource://enigmail/log.jsm"); /*global EnigmailLog: false */
Cu.import("resource://enigmail/timer.jsm"); /*global EnigmailTimer: false */

const NS_STRING_INPUT_STREAM_CONTRACTID = "@mozilla.org/io/string-input-stream;1";
const NS_INPUT_STREAM_CHNL_CONTRACTID = "@mozilla.org/network/input-stream-channel;1";

const EnigmailStreams = {
  /**
   * create an nsIStreamListener object to read String data from an nsIInputStream
   *
   * @onStopCallback: Function - function(data) that is called when the stream has stopped
   *                             string data is passed as |data|
   *
   * @return: the nsIStreamListener to pass to the stream
   */
  newStringStreamListener: function(onStopCallback) {
    EnigmailLog.DEBUG("enigmailCommon.jsm: newStreamListener\n");

    return {
      data: "",
      inStream: Cc["@mozilla.org/binaryinputstream;1"].createInstance(Ci.nsIBinaryInputStream),
      _onStopCallback: onStopCallback,
      QueryInterface: XPCOMUtils.generateQI([Ci.nsIStreamListener, Ci.nsIRequestObserver]),

      onStartRequest: function(channel, ctxt) {
        // EnigmailLog.DEBUG("enigmailCommon.jsm: stringListener.onStartRequest\n");
      },

      onStopRequest: function(channel, ctxt, status) {
        // EnigmailLog.DEBUG("enigmailCommon.jsm: stringListener.onStopRequest: "+ctxt+"\n");
        this.inStream = null;
        var cbFunc = this._onStopCallback;
        var cbData = this.data;

        EnigmailTimer.setTimeout(function _cb() {
          cbFunc(cbData);
        });
      },

      onDataAvailable: function(req, sup, stream, offset, count) {
        // get data from stream
        // EnigmailLog.DEBUG("enigmailCommon.jsm: stringListener.onDataAvailable: "+count+"\n");
        this.inStream.setInputStream(stream);
        this.data += this.inStream.readBytes(count);
      }
    };
  },

  /**
   * create a nsIInputStream object that is fed with string data
   *
   * @uri:            nsIURI - object representing the URI that will deliver the data
   * @contentType:    String - the content type as specified in nsIChannel
   * @contentCharset: String - the character set; automatically determined if null
   * @data:           String - the data to feed to the stream
   *
   * @return nsIChannel object
   */
  newStringChannel: function(uri, contentType, contentCharset, data) {
    EnigmailLog.DEBUG("enigmailCommon.jsm: newStringChannel\n");

    const inputStream = Cc[NS_STRING_INPUT_STREAM_CONTRACTID].createInstance(Ci.nsIStringInputStream);
    inputStream.setData(data, -1);

    if (!contentCharset || contentCharset.length === 0) {
      const ioServ = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);
      const netUtil = ioServ.QueryInterface(Ci.nsINetUtil);
      const newCharset = {};
      const hadCharset = {};
      let mimeType;
      try {
        // Gecko >= 43
        mimeType = netUtil.parseResponseContentType(contentType, newCharset, hadCharset);
      }
      catch (ex) {
        // Gecko < 43
        mimeType = netUtil.parseContentType(contentType, newCharset, hadCharset);
      }
      contentCharset = newCharset.value;
    }

    const isc = Cc[NS_INPUT_STREAM_CHNL_CONTRACTID].createInstance(Ci.nsIInputStreamChannel);
    isc.setURI(uri);
    isc.contentStream = inputStream;

    const chan = isc.QueryInterface(Ci.nsIChannel);
    if (contentType && contentType.length) chan.contentType = contentType;
    if (contentCharset && contentCharset.length) chan.contentCharset = contentCharset;

    EnigmailLog.DEBUG("enigmailCommon.jsm: newStringChannel - done\n");

    return chan;
  },

  newFileChannel: function(uri, file, contentType, deleteOnClose) {
    EnigmailLog.DEBUG("enigmailCommon.jsm: newFileChannel for '" + file.path + "'\n");


    let inputStream = Cc["@mozilla.org/network/file-input-stream;1"].createInstance(Ci.nsIFileInputStream);
    let behaviorFlags = Ci.nsIFileInputStream.CLOSE_ON_EOF;
    if (deleteOnClose) {
      behaviorFlags |= Ci.nsIFileInputStream.DELETE_ON_CLOSE;
    }
    const ioFlags = 0x01; // readonly
    const perm = 0;
    inputStream.init(file, ioFlags, perm, behaviorFlags);

    const isc = Cc[NS_INPUT_STREAM_CHNL_CONTRACTID].createInstance(Ci.nsIInputStreamChannel);

    isc.setURI(uri);
    isc.contentStream = inputStream;

    const chan = isc.QueryInterface(Ci.nsIChannel);
    if (contentType && contentType.length) chan.contentType = contentType;

    EnigmailLog.DEBUG("enigmailCommon.jsm: newStringChannel - done\n");

    return chan;
  }

};
