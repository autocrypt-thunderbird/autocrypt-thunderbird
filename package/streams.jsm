/*global Components: false */
/*jshint -W097 */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

"use strict";

var EXPORTED_SYMBOLS = ["EnigmailStreams"];

const EnigmailTb60Compat = ChromeUtils.import("chrome://enigmail/content/modules/tb60compat.jsm").EnigmailTb60Compat;
const EnigmailLog = ChromeUtils.import("chrome://enigmail/content/modules/log.jsm").EnigmailLog;
const EnigmailTimer = ChromeUtils.import("chrome://enigmail/content/modules/timer.jsm").EnigmailTimer;
const Services = ChromeUtils.import("resource://gre/modules/Services.jsm").Services;
const NetUtil = ChromeUtils.import("resource://gre/modules/NetUtil.jsm").NetUtil;

const NS_STRING_INPUT_STREAM_CONTRACTID = "@mozilla.org/io/string-input-stream;1";
const NS_INPUT_STREAM_CHNL_CONTRACTID = "@mozilla.org/network/input-stream-channel;1";
const IOSERVICE_CONTRACTID = "@mozilla.org/network/io-service;1";

var EnigmailStreams = {

  /**
   * Create a new channel from a URL.
   *
   * @param url: String - URL specification
   *
   * @return: channel
   */
  createChannel: function(url) {
    let ioServ = Cc[IOSERVICE_CONTRACTID].getService(Ci.nsIIOService);

    let loadingPrincipal = Services.scriptSecurityManager.getSystemPrincipal();
    let channel = ioServ.newChannel(url, null, null, null, loadingPrincipal, null, 0, Ci.nsIContentPolicy.TYPE_DOCUMENT);

    return channel;
  },

  /**
   * Create a new channel from a URI.
   *
   * @param uri: Object - nsIURI
   *
   * @return: channel
   */
  createChannelFromURI: function(uri) {
    let ioServ = Cc[IOSERVICE_CONTRACTID].getService(Ci.nsIIOService);

    let channel;
    let loadingPrincipal = Services.scriptSecurityManager.getSystemPrincipal();
    channel = ioServ.newChannelFromURI(uri, null, loadingPrincipal, null, 0, Ci.nsIContentPolicy.TYPE_DOCUMENT);

    return channel;
  },
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

    let listener = {
      data: "",
      inStream: Cc["@mozilla.org/binaryinputstream;1"].createInstance(Ci.nsIBinaryInputStream),
      _onStopCallback: onStopCallback,
      QueryInterface: EnigmailTb60Compat.generateQI([Ci.nsIStreamListener, Ci.nsIRequestObserver]),

      onStartRequest: function(channel) {
        // EnigmailLog.DEBUG("enigmailCommon.jsm: stringListener.onStartRequest\n");
      },

      onStopRequest: function(channel, status) {
        // EnigmailLog.DEBUG("enigmailCommon.jsm: stringListener.onStopRequest: "+ctxt+"\n");
        this.inStream = null;
        var cbFunc = this._onStopCallback;
        var cbData = this.data;

        EnigmailTimer.setTimeout(function _cb() {
          cbFunc(cbData);
        });
      }
    };

    if (EnigmailTb60Compat.isMessageUriInPgpMime()) {
      // TB >= 67
      listener.onDataAvailable = function(req, stream, offset, count) {
        // EnigmailLog.DEBUG("enigmailCommon.jsm: stringListener.onDataAvailable: "+count+"\n");
        this.inStream.setInputStream(stream);
        this.data += this.inStream.readBytes(count);
      };
    } else {
      listener.onDataAvailable = function(req, ctxt, stream, offset, count) {
        // EnigmailLog.DEBUG("enigmailCommon.jsm: stringListener.onDataAvailable: "+count+"\n");
        this.inStream.setInputStream(stream);
        this.data += this.inStream.readBytes(count);
      };
    }

    return listener;
  },

  /**
   * create a nsIInputStream object that is fed with string data
   *
   * @uri:            nsIURI - object representing the URI that will deliver the data
   * @contentType:    String - the content type as specified in nsIChannel
   * @contentCharset: String - the character set; automatically determined if null
   * @data:           String - the data to feed to the stream
   * @loadInfo        nsILoadInfo - loadInfo (optional)
   *
   * @return nsIChannel object
   */
  newStringChannel: function(uri, contentType, contentCharset, data, loadInfo) {
    EnigmailLog.DEBUG("enigmailCommon.jsm: newStringChannel\n");

    if (!loadInfo) {
      let c = NetUtil.newChannel({
        uri: "chrome://enigmail/content/",
        loadUsingSystemPrincipal: true
      });
      loadInfo = c.loadInfo;
    }

    const inputStream = Cc[NS_STRING_INPUT_STREAM_CONTRACTID].createInstance(Ci.nsIStringInputStream);
    inputStream.setData(data, -1);

    if (!contentCharset || contentCharset.length === 0) {
      const ioServ = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);
      const netUtil = ioServ.QueryInterface(Ci.nsINetUtil);
      const newCharset = {};
      const hadCharset = {};
      let mimeType;
      mimeType = netUtil.parseResponseContentType(contentType, newCharset, hadCharset);
      contentCharset = newCharset.value;
    }

    let isc = Cc[NS_INPUT_STREAM_CHNL_CONTRACTID].createInstance(Ci.nsIInputStreamChannel);
    isc.QueryInterface(Ci.nsIChannel);
    isc.setURI(uri);
    isc.loadInfo = loadInfo;
    isc.contentStream = inputStream;

    if (contentType && contentType.length) isc.contentType = contentType;
    if (contentCharset && contentCharset.length) isc.contentCharset = contentCharset;

    EnigmailLog.DEBUG("enigmailCommon.jsm: newStringChannel - done\n");

    return isc;
  },

  newFileChannel: function(uri, file, contentType, deleteOnClose) {
    EnigmailLog.DEBUG("enigmailCommon.jsm: newFileChannel for '" + file.path + "'\n");

    let c = NetUtil.newChannel({
      uri: "chrome://enigmail/content/",
      loadUsingSystemPrincipal: true
    });

    let inputStream = Cc["@mozilla.org/network/file-input-stream;1"].createInstance(Ci.nsIFileInputStream);
    let behaviorFlags = Ci.nsIFileInputStream.CLOSE_ON_EOF;
    if (deleteOnClose) {
      behaviorFlags |= Ci.nsIFileInputStream.DELETE_ON_CLOSE;
    }
    const ioFlags = 0x01; // readonly
    const perm = 0;
    inputStream.init(file, ioFlags, perm, behaviorFlags);

    let isc = Cc[NS_INPUT_STREAM_CHNL_CONTRACTID].createInstance(Ci.nsIInputStreamChannel);
    isc.QueryInterface(Ci.nsIChannel);
    isc.contentDisposition = Ci.nsIChannel.DISPOSITION_ATTACHMENT;
    isc.loadInfo = c.loadInfo;
    isc.setURI(uri);
    isc.contentStream = inputStream;

    if (contentType && contentType.length) isc.contentType = contentType;

    EnigmailLog.DEBUG("enigmailCommon.jsm: newStringChannel - done\n");

    return isc;
  }

};