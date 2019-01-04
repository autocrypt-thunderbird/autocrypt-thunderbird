/*
  The MIT License (MIT)

  Copyright (c) 2018 Mattias Buelens
  Copyright (c) 2016 Diwank Singh Tomer

  Permission is hereby granted, free of charge, to any person obtaining a copy
  of this software and associated documentation files (the "Software"), to deal
  in the Software without restriction, including without limitation the rights
  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
  copies of the Software, and to permit persons to whom the Software is
  furnished to do so, subject to the following conditions:

  The above copyright notice and this permission notice shall be included in all
  copies or substantial portions of the Software.

  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
  SOFTWARE.
*/

/*
 * This is a polyfill for web-streams, taken from
 * https://github.com/MattiasBuelens/web-streams-polyfill
 *
 */


var EXPORTED_SYMBOLS = ["TransformStream", "ReadableStream", "WritableStream"];


let window = {};

(function(global) {
  ! function(e, r) {
    "object" == typeof exports && "undefined" != typeof module ? r(exports) : "function" == typeof define && define.amd ? define(["exports"], r) : r(e.WebStreamsPolyfill = {})
  }(this, function(e) {
    "use strict";

    function r(e, r) {
      for (var t = 0; t < r.length; t++) {
        var o = r[t];
        o.enumerable = o.enumerable || !1, o.configurable = !0, "value" in o && (o.writable = !0), Object.defineProperty(e, o.key, o)
      }
    }

    function t(e, t, o) {
      return t && r(e.prototype, t), o && r(e, o), e
    }

    function o() {
      return (o = Object.assign || function(e) {
        for (var r = 1; r < arguments.length; r++) {
          var t = arguments[r];
          for (var o in t) Object.prototype.hasOwnProperty.call(t, o) && (e[o] = t[o])
        }
        return e
      }).apply(this, arguments)
    }
    var n = Number.isInteger || function(e) {
        return "number" == typeof e && isFinite(e) && Math.floor(e) === e
      },
      i = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? Symbol : function(e) {
        return "Symbol(" + e + ")"
      };

    function a() {}
    var s = "undefined" != typeof self ? self : "undefined" != typeof window ? window : "undefined" != typeof global ? global : void 0,
      l = Number.isNaN || function(e) {
        return e != e
      };
    var u = function(e, r) {
        return e(r = {
          exports: {}
        }, r.exports), r.exports
      }(function(e, r) {
        var t = i('is "detached" for our purposes');

        function o(e, r, t) {
          if ("function" != typeof e) throw new TypeError("Argument is not a function");
          return Function.prototype.apply.call(e, r, t)
        }

        function n(e, r, t) {
          try {
            return Promise.resolve(o(e, r, t))
          }
          catch (e) {
            return Promise.reject(e)
          }
        }
        r.typeIsObject = function(e) {
          return "object" == typeof e && null !== e || "function" == typeof e
        }, r.createDataProperty = function(e, r, t) {
          Object.defineProperty(e, r, {
            value: t,
            writable: !0,
            enumerable: !0,
            configurable: !0
          })
        }, r.createArrayFromList = function(e) {
          return e.slice()
        }, r.ArrayBufferCopy = function(e, r, t, o, n) {
          new Uint8Array(e).set(new Uint8Array(t, o, n), r)
        }, r.CreateIterResultObject = function(e, r) {
          var t = {};
          return Object.defineProperty(t, "value", {
            value: e,
            enumerable: !0,
            writable: !0,
            configurable: !0
          }), Object.defineProperty(t, "done", {
            value: r,
            enumerable: !0,
            writable: !0,
            configurable: !0
          }), t
        }, r.IsFiniteNonNegativeNumber = function(e) {
          return !1 !== r.IsNonNegativeNumber(e) && e !== 1 / 0
        }, r.IsNonNegativeNumber = function(e) {
          return "number" == typeof e && (!l(e) && !(e < 0))
        }, r.Call = o, r.CreateAlgorithmFromUnderlyingMethod = function(e, r, t, o) {
          var i = e[r];
          if (void 0 !== i) {
            if ("function" != typeof i) throw new TypeError(i + " is not a method");
            switch (t) {
              case 0:
                return function() {
                  return n(i, e, o)
                };
              case 1:
                return function(r) {
                  var t = [r].concat(o);
                  return n(i, e, t)
                }
            }
          }
          return function() {
            return Promise.resolve()
          }
        }, r.InvokeOrNoop = function(e, r, t) {
          var n = e[r];
          if (void 0 !== n) return o(n, e, t)
        }, r.PromiseCall = n, r.TransferArrayBuffer = function(e) {
          var r = e.slice();
          return Object.defineProperty(e, "byteLength", {
            get: function() {
              return 0
            }
          }), e[t] = !0, r
        }, r.IsDetachedBuffer = function(e) {
          return t in e
        }, r.ValidateAndNormalizeHighWaterMark = function(e) {
          if (e = Number(e), l(e) || e < 0) throw new RangeError("highWaterMark property of a queuing strategy must be non-negative and non-NaN");
          return e
        }, r.MakeSizeAlgorithmFromSizeFunction = function(e) {
          if (void 0 === e) return function() {
            return 1
          };
          if ("function" != typeof e) throw new TypeError("size property of a queuing strategy must be a function");
          return function(r) {
            return e(r)
          }
        }
      }),
      c = {
        default: u,
        __moduleExports: u,
        typeIsObject: u.typeIsObject,
        createDataProperty: u.createDataProperty,
        createArrayFromList: u.createArrayFromList,
        ArrayBufferCopy: u.ArrayBufferCopy,
        CreateIterResultObject: u.CreateIterResultObject,
        IsFiniteNonNegativeNumber: u.IsFiniteNonNegativeNumber,
        IsNonNegativeNumber: u.IsNonNegativeNumber,
        Call: u.Call,
        CreateAlgorithmFromUnderlyingMethod: u.CreateAlgorithmFromUnderlyingMethod,
        InvokeOrNoop: u.InvokeOrNoop,
        PromiseCall: u.PromiseCall,
        TransferArrayBuffer: u.TransferArrayBuffer,
        IsDetachedBuffer: u.IsDetachedBuffer,
        ValidateAndNormalizeHighWaterMark: u.ValidateAndNormalizeHighWaterMark,
        MakeSizeAlgorithmFromSizeFunction: u.MakeSizeAlgorithmFromSizeFunction
      };

    function d() {}
    d.AssertionError = a;
    var f = {
        default: d
      },
      _ = f && d || f,
      m = function(e) {
        e && e instanceof _.AssertionError && setTimeout(function() {
          throw e
        }, 0)
      },
      h = {
        rethrowAssertionErrorRejection: m
      },
      b = {
        default: h,
        __moduleExports: h,
        rethrowAssertionErrorRejection: m
      },
      v = c && u || c,
      y = v.IsFiniteNonNegativeNumber,
      p = function(e) {
        var r = e._queue.shift();
        return e._queueTotalSize -= r.size, e._queueTotalSize < 0 && (e._queueTotalSize = 0), r.value
      },
      w = function(e, r, t) {
        if (t = Number(t), !y(t)) throw new RangeError("Size must be a finite, non-NaN, non-negative number.");
        e._queue.push({
          value: r,
          size: t
        }), e._queueTotalSize += t
      },
      g = function(e) {
        return e._queue[0].value
      },
      S = function(e) {
        e._queue = [], e._queueTotalSize = 0
      },
      P = {
        DequeueValue: p,
        EnqueueValueWithSize: w,
        PeekQueueValue: g,
        ResetQueue: S
      },
      R = {
        default: P,
        __moduleExports: P,
        DequeueValue: p,
        EnqueueValueWithSize: w,
        PeekQueueValue: g,
        ResetQueue: S
      },
      q = {
        default: a
      },
      T = q && a || q,
      j = b && h || b,
      C = R && P || R,
      E = (T("streams:writable-stream:verbose"), v.CreateAlgorithmFromUnderlyingMethod),
      W = v.InvokeOrNoop,
      A = v.ValidateAndNormalizeHighWaterMark,
      k = (v.IsNonNegativeNumber, v.MakeSizeAlgorithmFromSizeFunction),
      O = v.typeIsObject,
      z = j.rethrowAssertionErrorRejection,
      B = C.DequeueValue,
      I = C.EnqueueValueWithSize,
      F = C.PeekQueueValue,
      N = C.ResetQueue,
      D = i("[[AbortSteps]]"),
      M = i("[[ErrorSteps]]"),
      L = function() {
        function e(e, r) {
          void 0 === e && (e = {});
          var t = void 0 === r ? {} : r,
            o = t.size,
            n = t.highWaterMark,
            i = void 0 === n ? 1 : n;
          if (x(this), void 0 !== e.type) throw new RangeError("Invalid type is specified");
          var a = k(o);
          ! function(e, r, t, o) {
            var n = Object.create(le.prototype);
            var i = E(r, "write", 1, [n]),
              a = E(r, "close", 0, []),
              s = E(r, "abort", 1, []);
            ue(e, n, function() {
              return W(r, "start", [n])
            }, i, a, s, t, o)
          }(this, e, i = A(i), a)
        }
        var r = e.prototype;
        return r.abort = function(e) {
          return !1 === Q(this) ? Promise.reject(he("abort")) : !0 === Y(this) ? Promise.reject(new TypeError("Cannot abort a stream that already has a writer")) : U(this, e)
        }, r.getWriter = function() {
          if (!1 === Q(this)) throw he("getWriter");
          return H(this)
        }, t(e, [{
          key: "locked",
          get: function() {
            if (!1 === Q(this)) throw he("locked");
            return Y(this)
          }
        }]), e
      }(),
      V = {
        AcquireWritableStreamDefaultWriter: H,
        CreateWritableStream: function(e, r, t, o, n, i) {
          void 0 === n && (n = 1);
          void 0 === i && (i = function() {
            return 1
          });
          var a = Object.create(L.prototype);
          x(a);
          var s = Object.create(le.prototype);
          return ue(a, s, e, r, t, o, n, i), a
        },
        IsWritableStream: Q,
        IsWritableStreamLocked: Y,
        WritableStream: L,
        WritableStreamAbort: U,
        WritableStreamDefaultControllerErrorIfNeeded: fe,
        WritableStreamDefaultWriterCloseWithErrorPropagation: function(e) {
          var r = e._ownerWritableStream,
            t = r._state;
          if (!0 === Z(r) || "closed" === t) return Promise.resolve();
          if ("errored" === t) return Promise.reject(r._storedError);
          return oe(e)
        },
        WritableStreamDefaultWriterRelease: ae,
        WritableStreamDefaultWriterWrite: se,
        WritableStreamCloseQueuedOrInFlight: Z
      };

    function H(e) {
      return new re(e)
    }

    function x(e) {
      e._state = "writable", e._storedError = void 0, e._writer = void 0, e._writableStreamController = void 0, e._writeRequests = [], e._inFlightWriteRequest = void 0, e._closeRequest = void 0, e._inFlightCloseRequest = void 0, e._pendingAbortRequest = void 0, e._backpressure = !1
    }

    function Q(e) {
      return !!O(e) && !!Object.prototype.hasOwnProperty.call(e, "_writableStreamController")
    }

    function Y(e) {
      return void 0 !== e._writer
    }

    function U(e, r) {
      var t = e._state;
      if ("closed" === t || "errored" === t) return Promise.resolve(void 0);
      if (void 0 !== e._pendingAbortRequest) return e._pendingAbortRequest._promise;
      var o = !1;
      "erroring" === t && (o = !0, r = void 0);
      var n = new Promise(function(t, n) {
        e._pendingAbortRequest = {
          _resolve: t,
          _reject: n,
          _reason: r,
          _wasAlreadyErroring: o
        }
      });
      return e._pendingAbortRequest._promise = n, !1 === o && J(e, r), n
    }

    function G(e, r) {
      "writable" !== e._state ? K(e) : J(e, r)
    }

    function J(e, r) {
      var t = e._writableStreamController;
      e._state = "erroring", e._storedError = r;
      var o = e._writer;
      void 0 !== o && ie(o, r), !1 === function(e) {
        if (void 0 === e._inFlightWriteRequest && void 0 === e._inFlightCloseRequest) return !1;
        return !0
      }(e) && !0 === t._started && K(e)
    }

    function K(e) {
      e._state = "errored", e._writableStreamController[M]();
      for (var r = e._storedError, t = 0, o = e._writeRequests; t < o.length; t++) {
        o[t]._reject(r)
      }
      if (e._writeRequests = [], void 0 !== e._pendingAbortRequest) {
        var n = e._pendingAbortRequest;
        if (e._pendingAbortRequest = void 0, !0 === n._wasAlreadyErroring) return n._reject(r), void $(e);
        e._writableStreamController[D](n._reason).then(function() {
          n._resolve(), $(e)
        }, function(r) {
          n._reject(r), $(e)
        })
      }
      else $(e)
    }

    function X(e) {
      e._inFlightCloseRequest._resolve(void 0), e._inFlightCloseRequest = void 0, "erroring" === e._state && (e._storedError = void 0, void 0 !== e._pendingAbortRequest && (e._pendingAbortRequest._resolve(), e._pendingAbortRequest = void 0)), e._state = "closed";
      var r = e._writer;
      void 0 !== r && function(e) {
        e._closedPromise_resolve(void 0), e._closedPromise_resolve = void 0, e._closedPromise_reject = void 0, e._closedPromiseState = "resolved"
      }(r)
    }

    function Z(e) {
      return void 0 !== e._closeRequest || void 0 !== e._inFlightCloseRequest
    }

    function $(e) {
      void 0 !== e._closeRequest && (e._closeRequest._reject(e._storedError), e._closeRequest = void 0);
      var r = e._writer;
      void 0 !== r && (pe(r, e._storedError), r._closedPromise.catch(function() {}))
    }

    function ee(e, r) {
      var t = e._writer;
      void 0 !== t && r !== e._backpressure && (!0 === r ? function(e) {
        e._readyPromise = new Promise(function(r, t) {
          e._readyPromise_resolve = r, e._readyPromise_reject = t
        }), e._readyPromiseState = "pending"
      }(t) : Se(t)), e._backpressure = r
    }
    var re = function() {
      function e(e) {
        if (!1 === Q(e)) throw new TypeError("WritableStreamDefaultWriter can only be constructed with a WritableStream instance");
        if (!0 === Y(e)) throw new TypeError("This stream has already been locked for exclusive writing by another writer");
        this._ownerWritableStream = e, e._writer = this;
        var r = e._state;
        if ("writable" === r) !1 === Z(e) && !0 === e._backpressure ? function(e) {
          e._readyPromise = new Promise(function(r, t) {
            e._readyPromise_resolve = r, e._readyPromise_reject = t
          }), e._readyPromiseState = "pending"
        }(this) : ge(this), ye(this);
        else if ("erroring" === r) we(this, e._storedError), this._readyPromise.catch(function() {}), ye(this);
        else if ("closed" === r) ge(this),
          function(e) {
            e._closedPromise = Promise.resolve(void 0), e._closedPromise_resolve = void 0, e._closedPromise_reject = void 0, e._closedPromiseState = "resolved"
          }(this);
        else {
          var t = e._storedError;
          we(this, t), this._readyPromise.catch(function() {}),
            function(e, r) {
              e._closedPromise = Promise.reject(r), e._closedPromise_resolve = void 0, e._closedPromise_reject = void 0, e._closedPromiseState = "rejected"
            }(this, t), this._closedPromise.catch(function() {})
        }
      }
      var r = e.prototype;
      return r.abort = function(e) {
        return !1 === te(this) ? Promise.reject(be("abort")) : void 0 === this._ownerWritableStream ? Promise.reject(ve("abort")) : function(e, r) {
          return U(e._ownerWritableStream, r)
        }(this, e)
      }, r.close = function() {
        if (!1 === te(this)) return Promise.reject(be("close"));
        var e = this._ownerWritableStream;
        return void 0 === e ? Promise.reject(ve("close")) : !0 === Z(e) ? Promise.reject(new TypeError("cannot close an already-closing stream")) : oe(this)
      }, r.releaseLock = function() {
        if (!1 === te(this)) throw be("releaseLock");
        void 0 !== this._ownerWritableStream && ae(this)
      }, r.write = function(e) {
        return !1 === te(this) ? Promise.reject(be("write")) : void 0 === this._ownerWritableStream ? Promise.reject(ve("write to")) : se(this, e)
      }, t(e, [{
        key: "closed",
        get: function() {
          return !1 === te(this) ? Promise.reject(be("closed")) : this._closedPromise
        }
      }, {
        key: "desiredSize",
        get: function() {
          if (!1 === te(this)) throw be("desiredSize");
          if (void 0 === this._ownerWritableStream) throw ve("desiredSize");
          return function(e) {
            var r = e._ownerWritableStream,
              t = r._state;
            if ("errored" === t || "erroring" === t) return null;
            if ("closed" === t) return 0;
            return ce(r._writableStreamController)
          }(this)
        }
      }, {
        key: "ready",
        get: function() {
          return !1 === te(this) ? Promise.reject(be("ready")) : this._readyPromise
        }
      }]), e
    }();

    function te(e) {
      return !!O(e) && !!Object.prototype.hasOwnProperty.call(e, "_ownerWritableStream")
    }

    function oe(e) {
      var r = e._ownerWritableStream,
        t = r._state;
      if ("closed" === t || "errored" === t) return Promise.reject(new TypeError("The stream (in " + t + " state) is not in the writable state and cannot be closed"));
      var o = new Promise(function(e, t) {
        var o = {
          _resolve: e,
          _reject: t
        };
        r._closeRequest = o
      });
      return !0 === r._backpressure && "writable" === t && Se(e),
        function(e) {
          I(e, "close", 0), de(e)
        }(r._writableStreamController), o
    }

    function ne(e, r) {
      "pending" === e._closedPromiseState ? pe(e, r) : function(e, r) {
        e._closedPromise = Promise.reject(r), e._closedPromiseState = "rejected"
      }(e, r), e._closedPromise.catch(function() {})
    }

    function ie(e, r) {
      "pending" === e._readyPromiseState ? function(e, r) {
        e._readyPromise_reject(r), e._readyPromise_resolve = void 0, e._readyPromise_reject = void 0, e._readyPromiseState = "rejected"
      }(e, r) : function(e, r) {
        e._readyPromise = Promise.reject(r), e._readyPromiseState = "rejected"
      }(e, r), e._readyPromise.catch(function() {})
    }

    function ae(e) {
      var r = e._ownerWritableStream,
        t = new TypeError("Writer was released and can no longer be used to monitor the stream's closedness");
      ie(e, t), ne(e, t), r._writer = void 0, e._ownerWritableStream = void 0
    }

    function se(e, r) {
      var t = e._ownerWritableStream,
        o = t._writableStreamController,
        n = function(e, r) {
          try {
            return e._strategySizeAlgorithm(r)
          }
          catch (r) {
            return fe(e, r), 1
          }
        }(o, r);
      if (t !== e._ownerWritableStream) return Promise.reject(ve("write to"));
      var i = t._state;
      if ("errored" === i) return Promise.reject(t._storedError);
      if (!0 === Z(t) || "closed" === i) return Promise.reject(new TypeError("The stream is closing or closed and cannot be written to"));
      if ("erroring" === i) return Promise.reject(t._storedError);
      var a = function(e) {
        return new Promise(function(r, t) {
          var o = {
            _resolve: r,
            _reject: t
          };
          e._writeRequests.push(o)
        })
      }(t);
      return function(e, r, t) {
        var o = {
          chunk: r
        };
        try {
          I(e, o, t)
        }
        catch (r) {
          return void fe(e, r)
        }
        var n = e._controlledWritableStream;
        if (!1 === Z(n) && "writable" === n._state) {
          var i = _e(e);
          ee(n, i)
        }
        de(e)
      }(o, r, n), a
    }
    var le = function() {
      function e() {
        throw new TypeError("WritableStreamDefaultController cannot be constructed explicitly")
      }
      var r = e.prototype;
      return r.error = function(e) {
        if (!1 === function(e) {
            if (!O(e)) return !1;
            if (!Object.prototype.hasOwnProperty.call(e, "_controlledWritableStream")) return !1;
            return !0
          }(this)) throw new TypeError("WritableStreamDefaultController.prototype.error can only be used on a WritableStreamDefaultController");
        "writable" === this._controlledWritableStream._state && me(this, e)
      }, r[D] = function(e) {
        return this._abortAlgorithm(e)
      }, r[M] = function() {
        N(this)
      }, e
    }();

    function ue(e, r, t, o, n, i, a, s) {
      r._controlledWritableStream = e, e._writableStreamController = r, r._queue = void 0, r._queueTotalSize = void 0, N(r), r._started = !1, r._strategySizeAlgorithm = s, r._strategyHWM = a, r._writeAlgorithm = o, r._closeAlgorithm = n, r._abortAlgorithm = i;
      var l = _e(r);
      ee(e, l);
      var u = t();
      Promise.resolve(u).then(function() {
        r._started = !0, de(r)
      }, function(t) {
        r._started = !0, G(e, t)
      }).catch(z)
    }

    function ce(e) {
      return e._strategyHWM - e._queueTotalSize
    }

    function de(e) {
      var r = e._controlledWritableStream;
      if (!1 !== e._started && void 0 === r._inFlightWriteRequest) {
        var t = r._state;
        if ("closed" !== t && "errored" !== t)
          if ("erroring" !== t) {
            if (0 !== e._queue.length) {
              var o = F(e);
              "close" === o ? function(e) {
                var r = e._controlledWritableStream;
                (function(e) {
                  e._inFlightCloseRequest = e._closeRequest, e._closeRequest = void 0
                })(r), B(e), e._closeAlgorithm().then(function() {
                  X(r)
                }, function(e) {
                  ! function(e, r) {
                    e._inFlightCloseRequest._reject(r), e._inFlightCloseRequest = void 0, void 0 !== e._pendingAbortRequest && (e._pendingAbortRequest._reject(r), e._pendingAbortRequest = void 0), G(e, r)
                  }(r, e)
                }).catch(z)
              }(e) : function(e, r) {
                var t = e._controlledWritableStream;
                (function(e) {
                  e._inFlightWriteRequest = e._writeRequests.shift()
                })(t), e._writeAlgorithm(r).then(function() {
                  ! function(e) {
                    e._inFlightWriteRequest._resolve(void 0), e._inFlightWriteRequest = void 0
                  }(t);
                  var r = t._state;
                  if (B(e), !1 === Z(t) && "writable" === r) {
                    var o = _e(e);
                    ee(t, o)
                  }
                  de(e)
                }, function(e) {
                  ! function(e, r) {
                    e._inFlightWriteRequest._reject(r), e._inFlightWriteRequest = void 0, G(e, r)
                  }(t, e)
                }).catch(z)
              }(e, o.chunk)
            }
          }
        else K(r)
      }
    }

    function fe(e, r) {
      "writable" === e._controlledWritableStream._state && me(e, r)
    }

    function _e(e) {
      return ce(e) <= 0
    }

    function me(e, r) {
      J(e._controlledWritableStream, r)
    }

    function he(e) {
      return new TypeError("WritableStream.prototype." + e + " can only be used on a WritableStream")
    }

    function be(e) {
      return new TypeError("WritableStreamDefaultWriter.prototype." + e + " can only be used on a WritableStreamDefaultWriter")
    }

    function ve(e) {
      return new TypeError("Cannot " + e + " a stream using a released writer")
    }

    function ye(e) {
      e._closedPromise = new Promise(function(r, t) {
        e._closedPromise_resolve = r, e._closedPromise_reject = t, e._closedPromiseState = "pending"
      })
    }

    function pe(e, r) {
      e._closedPromise_reject(r), e._closedPromise_resolve = void 0, e._closedPromise_reject = void 0, e._closedPromiseState = "rejected"
    }

    function we(e, r) {
      e._readyPromise = Promise.reject(r), e._readyPromise_resolve = void 0, e._readyPromise_reject = void 0, e._readyPromiseState = "rejected"
    }

    function ge(e) {
      e._readyPromise = Promise.resolve(void 0), e._readyPromise_resolve = void 0, e._readyPromise_reject = void 0, e._readyPromiseState = "fulfilled"
    }

    function Se(e) {
      e._readyPromise_resolve(void 0), e._readyPromise_resolve = void 0, e._readyPromise_reject = void 0, e._readyPromiseState = "fulfilled"
    }
    var Pe = V.WritableStream,
      Re = v.ArrayBufferCopy,
      qe = v.CreateAlgorithmFromUnderlyingMethod,
      Te = v.CreateIterResultObject,
      je = v.IsFiniteNonNegativeNumber,
      Ce = v.InvokeOrNoop,
      Ee = v.IsDetachedBuffer,
      We = v.TransferArrayBuffer,
      Ae = v.ValidateAndNormalizeHighWaterMark,
      ke = (v.IsNonNegativeNumber, v.MakeSizeAlgorithmFromSizeFunction),
      Oe = v.createArrayFromList,
      ze = v.typeIsObject,
      Be = j.rethrowAssertionErrorRejection,
      Ie = C.DequeueValue,
      Fe = C.EnqueueValueWithSize,
      Ne = C.ResetQueue,
      De = V.AcquireWritableStreamDefaultWriter,
      Me = V.IsWritableStream,
      Le = V.IsWritableStreamLocked,
      Ve = V.WritableStreamAbort,
      He = V.WritableStreamDefaultWriterCloseWithErrorPropagation,
      xe = V.WritableStreamDefaultWriterRelease,
      Qe = V.WritableStreamDefaultWriterWrite,
      Ye = V.WritableStreamCloseQueuedOrInFlight,
      Ue = i("[[CancelSteps]]"),
      Ge = i("[[PullSteps]]"),
      Je = function() {
        function e(e, r) {
          void 0 === e && (e = {});
          var t = void 0 === r ? {} : r,
            o = t.size,
            i = t.highWaterMark;
          $e(this);
          var a = e.type;
          if ("bytes" === String(a)) {
            if (void 0 === i && (i = 0), i = Ae(i), void 0 !== o) throw new RangeError("The strategy for a byte stream cannot have a size function");
            ! function(e, r, t) {
              var o = Object.create(Ar.prototype);
              var i = qe(r, "pull", 0, [o]),
                a = qe(r, "cancel", 1, []),
                s = r.autoAllocateChunkSize;
              if (void 0 !== s && (!1 === n(s) || s <= 0)) throw new RangeError("autoAllocateChunkSize must be a positive integer");
              Gr(e, o, function() {
                return Ce(r, "start", [o])
              }, i, a, t, s)
            }(this, e, i)
          }
          else {
            if (void 0 !== a) throw new RangeError("Invalid type is specified");
            void 0 === i && (i = 1),
              function(e, r, t, o) {
                var n = Object.create(wr.prototype);
                var i = qe(r, "pull", 0, [n]),
                  a = qe(r, "cancel", 1, []);
                Er(e, n, function() {
                  return Ce(r, "start", [n])
                }, i, a, t, o)
              }(this, e, i = Ae(i), ke(o))
          }
        }
        var r = e.prototype;
        return r.cancel = function(e) {
          return !1 === er(this) ? Promise.reject(Jr("cancel")) : !0 === rr(this) ? Promise.reject(new TypeError("Cannot cancel a stream that already has a reader")) : nr(this, e)
        }, r.getReader = function(e) {
          var r = (void 0 === e ? {} : e).mode;
          if (!1 === er(this)) throw Jr("getReader");
          if (void 0 === r) return Xe(this);
          if ("byob" === (r = String(r))) return function(e) {
            return new _r(e)
          }(this);
          throw new RangeError("Invalid mode is specified")
        }, r.pipeThrough = function(e, r) {
          var t = e.writable,
            o = e.readable;
          if (void 0 === t || void 0 === o) throw new TypeError("readable and writable arguments must be defined");
          return function(e) {
            try {
              Promise.prototype.then.call(e, void 0, function() {})
            }
            catch (e) {}
          }(this.pipeTo(t, r)), o
        }, r.pipeTo = function(e, r) {
          var t = this,
            o = void 0 === r ? {} : r,
            n = o.preventClose,
            i = o.preventAbort,
            a = o.preventCancel;
          if (!1 === er(this)) return Promise.reject(Jr("pipeTo"));
          if (!1 === Me(e)) return Promise.reject(new TypeError("ReadableStream.prototype.pipeTo's first argument must be a WritableStream"));
          if (n = Boolean(n), i = Boolean(i), a = Boolean(a), !0 === rr(this)) return Promise.reject(new TypeError("ReadableStream.prototype.pipeTo cannot be used on a locked ReadableStream"));
          if (!0 === Le(e)) return Promise.reject(new TypeError("ReadableStream.prototype.pipeTo cannot be used on a locked WritableStream"));
          var s = Xe(this),
            l = De(e),
            u = !1,
            c = Promise.resolve();
          return new Promise(function(r, o) {
            if (_(t, s._closedPromise, function(r) {
                !1 === i ? m(function() {
                  return Ve(e, r)
                }, !0, r) : h(!0, r)
              }), _(e, l._closedPromise, function(e) {
                !1 === a ? m(function() {
                  return nr(t, e)
                }, !0, e) : h(!0, e)
              }), function(e, r, t) {
                "closed" === e._state ? t() : r.then(t).catch(Be)
              }(t, s._closedPromise, function() {
                !1 === n ? m(function() {
                  return He(l)
                }) : h()
              }), !0 === Ye(e) || "closed" === e._state) {
              var d = new TypeError("the destination writable stream closed before all data could be piped to it");
              !1 === a ? m(function() {
                return nr(t, d)
              }, !0, d) : h(!0, d)
            }

            function f() {
              var e = c;
              return c.then(function() {
                return e !== c ? f() : void 0
              })
            }

            function _(e, r, t) {
              "errored" === e._state ? t(e._storedError) : r.catch(t).catch(Be)
            }

            function m(r, t, o) {
              function n() {
                r().then(function() {
                  return b(t, o)
                }, function(e) {
                  return b(!0, e)
                }).catch(Be)
              }!0 !== u && (u = !0, "writable" === e._state && !1 === Ye(e) ? f().then(n) : n())
            }

            function h(r, t) {
              !0 !== u && (u = !0, "writable" === e._state && !1 === Ye(e) ? f().then(function() {
                return b(r, t)
              }).catch(Be) : b(r, t))
            }

            function b(e, t) {
              xe(l), yr(s), e ? o(t) : r(void 0)
            }(function e() {
              return !0 === u ? Promise.resolve() : l._readyPromise.then(function() {
                return pr(s).then(function(e) {
                  var r = e.value;
                  !0 !== e.done && (c = Qe(l, r).catch(function() {}))
                })
              }).then(e)
            })().catch(function(e) {
              c = Promise.resolve(), Be(e)
            })
          })
        }, r.tee = function() {
          if (!1 === er(this)) throw Jr("tee");
          var e = function(e, r) {
            var t, o, n, i, a, s = Xe(e),
              l = !1,
              u = !1,
              c = !1,
              d = new Promise(function(e) {
                a = e
              });

            function f() {
              return pr(s).then(function(e) {
                var r = e.value,
                  t = e.done;
                if (!0 === t && !1 === l && (!1 === u && Rr(n._readableStreamController), !1 === c && Rr(i._readableStreamController), l = !0), !0 !== l) {
                  var o = r,
                    a = r;
                  !1 === u && qr(n._readableStreamController, o), !1 === c && qr(i._readableStreamController, a)
                }
              })
            }

            function _() {}
            return n = Ze(_, f, function(r) {
              if (u = !0, t = r, !0 === c) {
                var n = Oe([t, o]),
                  i = nr(e, n);
                a(i)
              }
              return d
            }), i = Ze(_, f, function(r) {
              if (c = !0, o = r, !0 === u) {
                var n = Oe([t, o]),
                  i = nr(e, n);
                a(i)
              }
              return d
            }), s._closedPromise.catch(function(e) {
              !0 !== l && (Tr(n._readableStreamController, e), Tr(i._readableStreamController, e), l = !0)
            }), [n, i]
          }(this);
          return Oe(e)
        }, t(e, [{
          key: "locked",
          get: function() {
            if (!1 === er(this)) throw Jr("locked");
            return rr(this)
          }
        }]), e
      }(),
      Ke = {
        CreateReadableByteStream: function(e, r, t, o, n) {
          void 0 === o && (o = 0);
          void 0 === n && (n = void 0);
          var i = Object.create(Je.prototype);
          $e(i);
          var a = Object.create(Ar.prototype);
          return Gr(i, a, e, r, t, o, n), i
        },
        CreateReadableStream: Ze,
        ReadableStream: Je,
        IsReadableStreamDisturbed: function(e) {
          return e._disturbed
        },
        ReadableStreamDefaultControllerClose: Rr,
        ReadableStreamDefaultControllerEnqueue: qr,
        ReadableStreamDefaultControllerError: Tr,
        ReadableStreamDefaultControllerGetDesiredSize: jr,
        ReadableStreamDefaultControllerHasBackpressure: function(e) {
          if (!0 === Pr(e)) return !1;
          return !0
        },
        ReadableStreamDefaultControllerCanCloseOrEnqueue: Cr
      };

    function Xe(e) {
      return new fr(e)
    }

    function Ze(e, r, t, o, n) {
      void 0 === o && (o = 1), void 0 === n && (n = function() {
        return 1
      });
      var i = Object.create(Je.prototype);
      return $e(i), Er(i, Object.create(wr.prototype), e, r, t, o, n), i
    }

    function $e(e) {
      e._state = "readable", e._reader = void 0, e._storedError = void 0, e._disturbed = !1
    }

    function er(e) {
      return !!ze(e) && !!Object.prototype.hasOwnProperty.call(e, "_readableStreamController")
    }

    function rr(e) {
      return void 0 !== e._reader
    }

    function tr(e) {
      return new Promise(function(r, t) {
        var o = {
          _resolve: r,
          _reject: t
        };
        e._reader._readIntoRequests.push(o)
      })
    }

    function or(e) {
      return new Promise(function(r, t) {
        var o = {
          _resolve: r,
          _reject: t
        };
        e._reader._readRequests.push(o)
      })
    }

    function nr(e, r) {
      return e._disturbed = !0, "closed" === e._state ? Promise.resolve(void 0) : "errored" === e._state ? Promise.reject(e._storedError) : (ir(e), e._readableStreamController[Ue](r).then(function() {}))
    }

    function ir(e) {
      e._state = "closed";
      var r = e._reader;
      if (void 0 !== r) {
        if (!0 === hr(r)) {
          for (var t = 0, o = r._readRequests; t < o.length; t++) {
            (0, o[t]._resolve)(Te(void 0, !0))
          }
          r._readRequests = []
        }! function(e) {
          e._closedPromise_resolve(void 0), e._closedPromise_resolve = void 0, e._closedPromise_reject = void 0
        }(r)
      }
    }

    function ar(e, r) {
      e._state = "errored", e._storedError = r;
      var t = e._reader;
      if (void 0 !== t) {
        if (!0 === hr(t)) {
          for (var o = 0, n = t._readRequests; o < n.length; o++) {
            n[o]._reject(r)
          }
          t._readRequests = []
        }
        else {
          for (var i = 0, a = t._readIntoRequests; i < a.length; i++) {
            a[i]._reject(r)
          }
          t._readIntoRequests = []
        }
        Zr(t, r), t._closedPromise.catch(function() {})
      }
    }

    function sr(e, r, t) {
      e._reader._readRequests.shift()._resolve(Te(r, t))
    }

    function lr(e) {
      return e._reader._readIntoRequests.length
    }

    function ur(e) {
      return e._reader._readRequests.length
    }

    function cr(e) {
      var r = e._reader;
      return void 0 !== r && !1 !== mr(r)
    }

    function dr(e) {
      var r = e._reader;
      return void 0 !== r && !1 !== hr(r)
    }
    var fr = function() {
        function e(e) {
          if (!1 === er(e)) throw new TypeError("ReadableStreamDefaultReader can only be constructed with a ReadableStream instance");
          if (!0 === rr(e)) throw new TypeError("This stream has already been locked for exclusive reading by another reader");
          br(this, e), this._readRequests = []
        }
        var r = e.prototype;
        return r.cancel = function(e) {
          return !1 === hr(this) ? Promise.reject(Xr("cancel")) : void 0 === this._ownerReadableStream ? Promise.reject(Kr("cancel")) : vr(this, e)
        }, r.read = function() {
          return !1 === hr(this) ? Promise.reject(Xr("read")) : void 0 === this._ownerReadableStream ? Promise.reject(Kr("read from")) : pr(this)
        }, r.releaseLock = function() {
          if (!1 === hr(this)) throw Xr("releaseLock");
          if (void 0 !== this._ownerReadableStream) {
            if (this._readRequests.length > 0) throw new TypeError("Tried to release a reader lock when that reader has pending read() calls un-settled");
            yr(this)
          }
        }, t(e, [{
          key: "closed",
          get: function() {
            return !1 === hr(this) ? Promise.reject(Xr("closed")) : this._closedPromise
          }
        }]), e
      }(),
      _r = function() {
        function e(e) {
          if (!er(e)) throw new TypeError("ReadableStreamBYOBReader can only be constructed with a ReadableStream instance given a byte source");
          if (!1 === kr(e._readableStreamController)) throw new TypeError("Cannot construct a ReadableStreamBYOBReader for a stream not constructed with a byte source");
          if (rr(e)) throw new TypeError("This stream has already been locked for exclusive reading by another reader");
          br(this, e), this._readIntoRequests = []
        }
        var r = e.prototype;
        return r.cancel = function(e) {
          return mr(this) ? void 0 === this._ownerReadableStream ? Promise.reject(Kr("cancel")) : vr(this, e) : Promise.reject($r("cancel"))
        }, r.read = function(e) {
          return mr(this) ? void 0 === this._ownerReadableStream ? Promise.reject(Kr("read from")) : ArrayBuffer.isView(e) ? !0 === Ee(e.buffer) ? Promise.reject(new TypeError("Cannot read into a view onto a detached ArrayBuffer")) : 0 === e.byteLength ? Promise.reject(new TypeError("view must have non-zero byteLength")) : function(e, r) {
            var t = e._ownerReadableStream;
            if (t._disturbed = !0, "errored" === t._state) return Promise.reject(t._storedError);
            return function(e, r) {
              var t = e._controlledReadableByteStream,
                o = 1;
              r.constructor !== DataView && (o = r.constructor.BYTES_PER_ELEMENT);
              var n = r.constructor,
                i = {
                  buffer: We(r.buffer),
                  byteOffset: r.byteOffset,
                  byteLength: r.byteLength,
                  bytesFilled: 0,
                  elementSize: o,
                  ctor: n,
                  readerType: "byob"
                };
              if (e._pendingPullIntos.length > 0) return e._pendingPullIntos.push(i), tr(t);
              if ("closed" === t._state) {
                var a = new r.constructor(i.buffer, i.byteOffset, 0);
                return Promise.resolve(Te(a, !0))
              }
              if (e._queueTotalSize > 0) {
                if (!0 === Dr(e, i)) {
                  var s = Fr(i);
                  return Lr(e), Promise.resolve(Te(s, !1))
                }
                if (!0 === e._closeRequested) {
                  var l = new TypeError("Insufficient bytes to fill elements in the given buffer");
                  return Yr(e, l), Promise.reject(l)
                }
              }
              e._pendingPullIntos.push(i);
              var u = tr(t);
              return zr(e), u
            }(t._readableStreamController, r)
          }(this, e) : Promise.reject(new TypeError("view must be an array buffer view")) : Promise.reject($r("read"))
        }, r.releaseLock = function() {
          if (!mr(this)) throw $r("releaseLock");
          if (void 0 !== this._ownerReadableStream) {
            if (this._readIntoRequests.length > 0) throw new TypeError("Tried to release a reader lock when that reader has pending read() calls un-settled");
            yr(this)
          }
        }, t(e, [{
          key: "closed",
          get: function() {
            return mr(this) ? this._closedPromise : Promise.reject($r("closed"))
          }
        }]), e
      }();

    function mr(e) {
      return !!ze(e) && !!Object.prototype.hasOwnProperty.call(e, "_readIntoRequests")
    }

    function hr(e) {
      return !!ze(e) && !!Object.prototype.hasOwnProperty.call(e, "_readRequests")
    }

    function br(e, r) {
      e._ownerReadableStream = r, r._reader = e, "readable" === r._state ? function(e) {
        e._closedPromise = new Promise(function(r, t) {
          e._closedPromise_resolve = r, e._closedPromise_reject = t
        })
      }(e) : "closed" === r._state ? function(e) {
        e._closedPromise = Promise.resolve(void 0), e._closedPromise_resolve = void 0, e._closedPromise_reject = void 0
      }(e) : (! function(e, r) {
        e._closedPromise = Promise.reject(r), e._closedPromise_resolve = void 0, e._closedPromise_reject = void 0
      }(e, r._storedError), e._closedPromise.catch(function() {}))
    }

    function vr(e, r) {
      return nr(e._ownerReadableStream, r)
    }

    function yr(e) {
      "readable" === e._ownerReadableStream._state ? Zr(e, new TypeError("Reader was released and can no longer be used to monitor the stream's closedness")) : function(e, r) {
        e._closedPromise = Promise.reject(r)
      }(e, new TypeError("Reader was released and can no longer be used to monitor the stream's closedness")), e._closedPromise.catch(function() {}), e._ownerReadableStream._reader = void 0, e._ownerReadableStream = void 0
    }

    function pr(e) {
      var r = e._ownerReadableStream;
      return r._disturbed = !0, "closed" === r._state ? Promise.resolve(Te(void 0, !0)) : "errored" === r._state ? Promise.reject(r._storedError) : r._readableStreamController[Ge]()
    }
    var wr = function() {
      function e() {
        throw new TypeError
      }
      var r = e.prototype;
      return r.close = function() {
        if (!1 === gr(this)) throw et("close");
        if (!1 === Cr(this)) throw new TypeError("The stream is not in a state that permits close");
        Rr(this)
      }, r.enqueue = function(e) {
        if (!1 === gr(this)) throw et("enqueue");
        if (!1 === Cr(this)) throw new TypeError("The stream is not in a state that permits enqueue");
        return qr(this, e)
      }, r.error = function(e) {
        if (!1 === gr(this)) throw et("error");
        Tr(this, e)
      }, r[Ue] = function(e) {
        return Ne(this), this._cancelAlgorithm(e)
      }, r[Ge] = function() {
        var e = this._controlledReadableStream;
        if (this._queue.length > 0) {
          var r = Ie(this);
          return !0 === this._closeRequested && 0 === this._queue.length ? ir(e) : Sr(this), Promise.resolve(Te(r, !1))
        }
        var t = or(e);
        return Sr(this), t
      }, t(e, [{
        key: "desiredSize",
        get: function() {
          if (!1 === gr(this)) throw et("desiredSize");
          return jr(this)
        }
      }]), e
    }();

    function gr(e) {
      return !!ze(e) && !!Object.prototype.hasOwnProperty.call(e, "_controlledReadableStream")
    }

    function Sr(e) {
      !1 !== Pr(e) && (!0 !== e._pulling ? (e._pulling = !0, e._pullAlgorithm().then(function() {
        if (e._pulling = !1, !0 === e._pullAgain) return e._pullAgain = !1, Sr(e)
      }, function(r) {
        Tr(e, r)
      }).catch(Be)) : e._pullAgain = !0)
    }

    function Pr(e) {
      var r = e._controlledReadableStream;
      return !1 !== Cr(e) && (!1 !== e._started && (!0 === rr(r) && ur(r) > 0 || jr(e) > 0))
    }

    function Rr(e) {
      var r = e._controlledReadableStream;
      e._closeRequested = !0, 0 === e._queue.length && ir(r)
    }

    function qr(e, r) {
      var t = e._controlledReadableStream;
      if (!0 === rr(t) && ur(t) > 0) sr(t, r, !1);
      else {
        var o;
        try {
          o = e._strategySizeAlgorithm(r)
        }
        catch (r) {
          throw Tr(e, r), r
        }
        try {
          Fe(e, r, o)
        }
        catch (r) {
          throw Tr(e, r), r
        }
      }
      Sr(e)
    }

    function Tr(e, r) {
      var t = e._controlledReadableStream;
      "readable" === t._state && (Ne(e), ar(t, r))
    }

    function jr(e) {
      var r = e._controlledReadableStream._state;
      return "errored" === r ? null : "closed" === r ? 0 : e._strategyHWM - e._queueTotalSize
    }

    function Cr(e) {
      var r = e._controlledReadableStream._state;
      return !1 === e._closeRequested && "readable" === r
    }

    function Er(e, r, t, o, n, i, a) {
      r._controlledReadableStream = e, r._queue = void 0, r._queueTotalSize = void 0, Ne(r), r._started = !1, r._closeRequested = !1, r._pullAgain = !1, r._pulling = !1, r._strategySizeAlgorithm = a, r._strategyHWM = i, r._pullAlgorithm = o, r._cancelAlgorithm = n, e._readableStreamController = r;
      var s = t();
      Promise.resolve(s).then(function() {
        r._started = !0, Sr(r)
      }, function(e) {
        Tr(r, e)
      }).catch(Be)
    }
    var Wr = function() {
        function e() {
          throw new TypeError("ReadableStreamBYOBRequest cannot be used directly")
        }
        var r = e.prototype;
        return r.respond = function(e) {
          if (!1 === Or(this)) throw rt("respond");
          if (void 0 === this._associatedReadableByteStreamController) throw new TypeError("This BYOB request has been invalidated");
          if (!0 === Ee(this._view.buffer)) throw new TypeError("The BYOB request's buffer has been detached and so cannot be used as a response");
          ! function(e, r) {
            if (r = Number(r), !1 === je(r)) throw new RangeError("bytesWritten must be a finite");
            xr(e, r)
          }(this._associatedReadableByteStreamController, e)
        }, r.respondWithNewView = function(e) {
          if (!1 === Or(this)) throw rt("respond");
          if (void 0 === this._associatedReadableByteStreamController) throw new TypeError("This BYOB request has been invalidated");
          if (!ArrayBuffer.isView(e)) throw new TypeError("You can only respond with array buffer views");
          if (!0 === Ee(e.buffer)) throw new TypeError("The supplied view's buffer has been detached and so cannot be used as a response");
          ! function(e, r) {
            var t = e._pendingPullIntos[0];
            if (t.byteOffset + t.bytesFilled !== r.byteOffset) throw new RangeError("The region specified by view does not match byobRequest");
            if (t.byteLength !== r.byteLength) throw new RangeError("The buffer of view has different capacity than byobRequest");
            t.buffer = r.buffer, xr(e, r.byteLength)
          }(this._associatedReadableByteStreamController, e)
        }, t(e, [{
          key: "view",
          get: function() {
            if (!1 === Or(this)) throw rt("view");
            return this._view
          }
        }]), e
      }(),
      Ar = function() {
        function e() {
          throw new TypeError("ReadableByteStreamController constructor cannot be used directly")
        }
        var r = e.prototype;
        return r.close = function() {
          if (!1 === kr(this)) throw tt("close");
          if (!0 === this._closeRequested) throw new TypeError("The stream has already been closed; do not close it again!");
          var e = this._controlledReadableByteStream._state;
          if ("readable" !== e) throw new TypeError("The stream (in " + e + " state) is not in the readable state and cannot be closed");
          ! function(e) {
            var r = e._controlledReadableByteStream;
            if (e._queueTotalSize > 0) return void(e._closeRequested = !0);
            if (e._pendingPullIntos.length > 0) {
              var t = e._pendingPullIntos[0];
              if (t.bytesFilled > 0) {
                var o = new TypeError("Insufficient bytes to fill elements in the given buffer");
                throw Yr(e, o), o
              }
            }
            ir(r)
          }(this)
        }, r.enqueue = function(e) {
          if (!1 === kr(this)) throw tt("enqueue");
          if (!0 === this._closeRequested) throw new TypeError("stream is closed or draining");
          var r = this._controlledReadableByteStream._state;
          if ("readable" !== r) throw new TypeError("The stream (in " + r + " state) is not in the readable state and cannot be enqueued to");
          if (!ArrayBuffer.isView(e)) throw new TypeError("You can only enqueue array buffer views when using a ReadableByteStreamController");
          if (!0 === Ee(e.buffer)) throw new TypeError("Cannot enqueue a view onto a detached ArrayBuffer");
          ! function(e, r) {
            var t = e._controlledReadableByteStream,
              o = r.buffer,
              n = r.byteOffset,
              i = r.byteLength,
              a = We(o);
            if (!0 === dr(t))
              if (0 === ur(t)) Nr(e, a, n, i);
              else {
                var s = new Uint8Array(a, n, i);
                sr(t, s, !1)
              }
            else !0 === cr(t) ? (Nr(e, a, n, i), Hr(e)) : Nr(e, a, n, i);
            zr(e)
          }(this, e)
        }, r.error = function(e) {
          if (!1 === kr(this)) throw tt("error");
          Yr(this, e)
        }, r[Ue] = function(e) {
          this._pendingPullIntos.length > 0 && (this._pendingPullIntos[0].bytesFilled = 0);
          return Ne(this), this._cancelAlgorithm(e)
        }, r[Ge] = function() {
          var e = this._controlledReadableByteStream;
          if (this._queueTotalSize > 0) {
            var r, t = this._queue.shift();
            this._queueTotalSize -= t.byteLength, Lr(this);
            try {
              r = new Uint8Array(t.buffer, t.byteOffset, t.byteLength)
            }
            catch (e) {
              return Promise.reject(e)
            }
            return Promise.resolve(Te(r, !1))
          }
          var o = this._autoAllocateChunkSize;
          if (void 0 !== o) {
            var n;
            try {
              n = new ArrayBuffer(o)
            }
            catch (e) {
              return Promise.reject(e)
            }
            var i = {
              buffer: n,
              byteOffset: 0,
              byteLength: o,
              bytesFilled: 0,
              elementSize: 1,
              ctor: Uint8Array,
              readerType: "default"
            };
            this._pendingPullIntos.push(i)
          }
          var a = or(e);
          return zr(this), a
        }, t(e, [{
          key: "byobRequest",
          get: function() {
            if (!1 === kr(this)) throw tt("byobRequest");
            if (void 0 === this._byobRequest && this._pendingPullIntos.length > 0) {
              var e = this._pendingPullIntos[0],
                r = new Uint8Array(e.buffer, e.byteOffset + e.bytesFilled, e.byteLength - e.bytesFilled),
                t = Object.create(Wr.prototype);
              ! function(e, r, t) {
                e._associatedReadableByteStreamController = r, e._view = t
              }(t, this, r), this._byobRequest = t
            }
            return this._byobRequest
          }
        }, {
          key: "desiredSize",
          get: function() {
            if (!1 === kr(this)) throw tt("desiredSize");
            return Ur(this)
          }
        }]), e
      }();

    function kr(e) {
      return !!ze(e) && !!Object.prototype.hasOwnProperty.call(e, "_controlledReadableByteStream")
    }

    function Or(e) {
      return !!ze(e) && !!Object.prototype.hasOwnProperty.call(e, "_associatedReadableByteStreamController")
    }

    function zr(e) {
      !1 !== function(e) {
        var r = e._controlledReadableByteStream;
        if ("readable" !== r._state) return !1;
        if (!0 === e._closeRequested) return !1;
        if (!1 === e._started) return !1;
        if (!0 === dr(r) && ur(r) > 0) return !0;
        if (!0 === cr(r) && lr(r) > 0) return !0;
        if (Ur(e) > 0) return !0;
        return !1
      }(e) && (!0 !== e._pulling ? (e._pulling = !0, e._pullAlgorithm().then(function() {
        e._pulling = !1, !0 === e._pullAgain && (e._pullAgain = !1, zr(e))
      }, function(r) {
        Yr(e, r)
      }).catch(Be)) : e._pullAgain = !0)
    }

    function Br(e) {
      Vr(e), e._pendingPullIntos = []
    }

    function Ir(e, r) {
      var t = !1;
      "closed" === e._state && (t = !0);
      var o = Fr(r);
      "default" === r.readerType ? sr(e, o, t) : function(e, r, t) {
        e._reader._readIntoRequests.shift()._resolve(Te(r, t))
      }(e, o, t)
    }

    function Fr(e) {
      var r = e.bytesFilled,
        t = e.elementSize;
      return new e.ctor(e.buffer, e.byteOffset, r / t)
    }

    function Nr(e, r, t, o) {
      e._queue.push({
        buffer: r,
        byteOffset: t,
        byteLength: o
      }), e._queueTotalSize += o
    }

    function Dr(e, r) {
      var t = r.elementSize,
        o = r.bytesFilled - r.bytesFilled % t,
        n = Math.min(e._queueTotalSize, r.byteLength - r.bytesFilled),
        i = r.bytesFilled + n,
        a = i - i % t,
        s = n,
        l = !1;
      a > o && (s = a - r.bytesFilled, l = !0);
      for (var u = e._queue; s > 0;) {
        var c = u[0],
          d = Math.min(s, c.byteLength),
          f = r.byteOffset + r.bytesFilled;
        Re(r.buffer, f, c.buffer, c.byteOffset, d), c.byteLength === d ? u.shift() : (c.byteOffset += d, c.byteLength -= d), e._queueTotalSize -= d, Mr(e, d, r), s -= d
      }
      return l
    }

    function Mr(e, r, t) {
      Vr(e), t.bytesFilled += r
    }

    function Lr(e) {
      0 === e._queueTotalSize && !0 === e._closeRequested ? ir(e._controlledReadableByteStream) : zr(e)
    }

    function Vr(e) {
      void 0 !== e._byobRequest && (e._byobRequest._associatedReadableByteStreamController = void 0, e._byobRequest._view = void 0, e._byobRequest = void 0)
    }

    function Hr(e) {
      for (; e._pendingPullIntos.length > 0;) {
        if (0 === e._queueTotalSize) return;
        var r = e._pendingPullIntos[0];
        !0 === Dr(e, r) && (Qr(e), Ir(e._controlledReadableByteStream, r))
      }
    }

    function xr(e, r) {
      var t = e._pendingPullIntos[0];
      if ("closed" === e._controlledReadableByteStream._state) {
        if (0 !== r) throw new TypeError("bytesWritten must be 0 when calling respond() on a closed stream");
        ! function(e, r) {
          r.buffer = We(r.buffer);
          var t = e._controlledReadableByteStream;
          if (!0 === cr(t))
            for (; lr(t) > 0;) Ir(t, Qr(e))
        }(e, t)
      }
      else ! function(e, r, t) {
        if (t.bytesFilled + r > t.byteLength) throw new RangeError("bytesWritten out of range");
        if (Mr(e, r, t), !(t.bytesFilled < t.elementSize)) {
          Qr(e);
          var o = t.bytesFilled % t.elementSize;
          if (o > 0) {
            var n = t.byteOffset + t.bytesFilled,
              i = t.buffer.slice(n - o, n);
            Nr(e, i, 0, i.byteLength)
          }
          t.buffer = We(t.buffer), t.bytesFilled -= o, Ir(e._controlledReadableByteStream, t), Hr(e)
        }
      }(e, r, t);
      zr(e)
    }

    function Qr(e) {
      var r = e._pendingPullIntos.shift();
      return Vr(e), r
    }

    function Yr(e, r) {
      var t = e._controlledReadableByteStream;
      "readable" === t._state && (Br(e), Ne(e), ar(t, r))
    }

    function Ur(e) {
      var r = e._controlledReadableByteStream._state;
      return "errored" === r ? null : "closed" === r ? 0 : e._strategyHWM - e._queueTotalSize
    }

    function Gr(e, r, t, o, n, i, a) {
      r._controlledReadableByteStream = e, r._pullAgain = !1, r._pulling = !1, Br(r), r._queue = r._queueTotalSize = void 0, Ne(r), r._closeRequested = !1, r._started = !1, r._strategyHWM = Ae(i), r._pullAlgorithm = o, r._cancelAlgorithm = n, r._autoAllocateChunkSize = a, r._pendingPullIntos = [], e._readableStreamController = r;
      var s = t();
      Promise.resolve(s).then(function() {
        r._started = !0, zr(r)
      }, function(e) {
        Yr(r, e)
      }).catch(Be)
    }

    function Jr(e) {
      return new TypeError("ReadableStream.prototype." + e + " can only be used on a ReadableStream")
    }

    function Kr(e) {
      return new TypeError("Cannot " + e + " a stream using a released reader")
    }

    function Xr(e) {
      return new TypeError("ReadableStreamDefaultReader.prototype." + e + " can only be used on a ReadableStreamDefaultReader")
    }

    function Zr(e, r) {
      e._closedPromise_reject(r), e._closedPromise_resolve = void 0, e._closedPromise_reject = void 0
    }

    function $r(e) {
      return new TypeError("ReadableStreamBYOBReader.prototype." + e + " can only be used on a ReadableStreamBYOBReader")
    }

    function et(e) {
      return new TypeError("ReadableStreamDefaultController.prototype." + e + " can only be used on a ReadableStreamDefaultController")
    }

    function rt(e) {
      return new TypeError("ReadableStreamBYOBRequest.prototype." + e + " can only be used on a ReadableStreamBYOBRequest")
    }

    function tt(e) {
      return new TypeError("ReadableByteStreamController.prototype." + e + " can only be used on a ReadableByteStreamController")
    }
    var ot = Ke.ReadableStream,
      nt = v.createDataProperty,
      it = function() {
        function e(e) {
          var r = e.highWaterMark;
          nt(this, "highWaterMark", r)
        }
        return e.prototype.size = function(e) {
          return e.byteLength
        }, e
      }(),
      at = v.createDataProperty,
      st = function() {
        function e(e) {
          var r = e.highWaterMark;
          at(this, "highWaterMark", r)
        }
        return e.prototype.size = function() {
          return 1
        }, e
      }(),
      lt = (T("streams:transform-stream:verbose"), v.InvokeOrNoop),
      ut = v.CreateAlgorithmFromUnderlyingMethod,
      ct = v.PromiseCall,
      dt = v.typeIsObject,
      ft = v.ValidateAndNormalizeHighWaterMark,
      _t = (v.IsNonNegativeNumber, v.MakeSizeAlgorithmFromSizeFunction),
      mt = Ke.CreateReadableStream,
      ht = Ke.ReadableStreamDefaultControllerClose,
      bt = Ke.ReadableStreamDefaultControllerEnqueue,
      vt = Ke.ReadableStreamDefaultControllerError,
      yt = Ke.ReadableStreamDefaultControllerGetDesiredSize,
      pt = Ke.ReadableStreamDefaultControllerHasBackpressure,
      wt = Ke.ReadableStreamDefaultControllerCanCloseOrEnqueue,
      gt = V.CreateWritableStream,
      St = V.WritableStreamDefaultControllerErrorIfNeeded,
      Pt = function() {
        function e(e, r, t) {
          if (void 0 === e && (e = {}), void 0 === r && (r = {}), void 0 === t && (t = {}), void 0 !== e.readableType) throw new RangeError("Invalid readable type specified");
          if (void 0 !== e.writableType) throw new RangeError("Invalid writable type specified");
          var o = r.size,
            n = _t(o),
            i = r.highWaterMark;
          void 0 === i && (i = 1), i = ft(i);
          var a, s = t.size,
            l = _t(s),
            u = t.highWaterMark;
          void 0 === u && (u = 0), u = ft(u), Rt(this, new Promise(function(e) {
              a = e
            }), i, n, u, l),
            function(e, r) {
              var t = Object.create(Et.prototype),
                o = function(e) {
                  try {
                    return kt(t, e), Promise.resolve()
                  }
                  catch (e) {
                    return Promise.reject(e)
                  }
                },
                n = r.transform;
              if (void 0 !== n) {
                if ("function" != typeof n) throw new TypeError("transform is not a method");
                o = function(o) {
                  var i = ct(n, r, [o, t]);
                  return i.catch(function(r) {
                    throw Tt(e, r), r
                  })
                }
              }
              var i = ut(r, "flush", 0, [t]);
              At(e, t, o, i)
            }(this, e);
          var c = lt(e, "start", [this._transformStreamController]);
          a(c)
        }
        return t(e, [{
          key: "readable",
          get: function() {
            if (!1 === qt(this)) throw zt("readable");
            return this._readable
          }
        }, {
          key: "writable",
          get: function() {
            if (!1 === qt(this)) throw zt("writable");
            return this._writable
          }
        }]), e
      }();

    function Rt(e, r, t, o, n, i) {
      function a() {
        return r
      }
      e._writable = gt(a, function(r) {
        return function(e, r) {
          var t = e._transformStreamController;
          if (!0 === e._backpressure) {
            var o = e._backpressureChangePromise;
            return o.then(function() {
              var o = e._writable,
                n = o._state;
              if ("erroring" === n) throw o._storedError;
              return t._transformAlgorithm(r)
            })
          }
          return t._transformAlgorithm(r)
        }(e, r)
      }, function() {
        return function(e) {
          var r = e._readable;
          return e._transformStreamController._flushAlgorithm().then(function() {
            if ("errored" === r._state) throw r._storedError;
            var e = r._readableStreamController;
            !0 === wt(e) && ht(e)
          }).catch(function(t) {
            throw Tt(e, t), r._storedError
          })
        }(e)
      }, function(r) {
        return function(e, r) {
          return Tt(e, r), Promise.resolve()
        }(e, r)
      }, t, o), e._readable = mt(a, function() {
        return function(e) {
          return Ct(e, !1), e._backpressureChangePromise
        }(e)
      }, function(r) {
        return jt(e, r), Promise.resolve()
      }, n, i), e._backpressure = void 0, e._backpressureChangePromise = void 0, e._backpressureChangePromise_resolve = void 0, Ct(e, !0), e._transformStreamController = void 0
    }

    function qt(e) {
      return !!dt(e) && !!Object.prototype.hasOwnProperty.call(e, "_transformStreamController")
    }

    function Tt(e, r) {
      vt(e._readable._readableStreamController, r), jt(e, r)
    }

    function jt(e, r) {
      St(e._writable._writableStreamController, r), !0 === e._backpressure && Ct(e, !1)
    }

    function Ct(e, r) {
      void 0 !== e._backpressureChangePromise && e._backpressureChangePromise_resolve(), e._backpressureChangePromise = new Promise(function(r) {
        e._backpressureChangePromise_resolve = r
      }), e._backpressure = r
    }
    var Et = function() {
      function e() {
        throw new TypeError("TransformStreamDefaultController instances cannot be created directly")
      }
      var r = e.prototype;
      return r.enqueue = function(e) {
        if (!1 === Wt(this)) throw Ot("enqueue");
        kt(this, e)
      }, r.error = function(e) {
        if (!1 === Wt(this)) throw Ot("error");
        ! function(e, r) {
          Tt(e._controlledTransformStream, r)
        }(this, e)
      }, r.terminate = function() {
        if (!1 === Wt(this)) throw Ot("terminate");
        ! function(e) {
          var r = e._controlledTransformStream,
            t = r._readable._readableStreamController;
          !0 === wt(t) && ht(t);
          var o = new TypeError("TransformStream terminated");
          jt(r, o)
        }(this)
      }, t(e, [{
        key: "desiredSize",
        get: function() {
          if (!1 === Wt(this)) throw Ot("desiredSize");
          var e = this._controlledTransformStream._readable._readableStreamController;
          return yt(e)
        }
      }]), e
    }();

    function Wt(e) {
      return !!dt(e) && !!Object.prototype.hasOwnProperty.call(e, "_controlledTransformStream")
    }

    function At(e, r, t, o) {
      r._controlledTransformStream = e, e._transformStreamController = r, r._transformAlgorithm = t, r._flushAlgorithm = o
    }

    function kt(e, r) {
      var t = e._controlledTransformStream,
        o = t._readable._readableStreamController;
      if (!1 === wt(o)) throw new TypeError("Readable side is not in a state that permits enqueue");
      try {
        bt(o, r)
      }
      catch (e) {
        throw jt(t, e), t._readable._storedError
      }
      pt(o) !== t._backpressure && Ct(t, !0)
    }

    function Ot(e) {
      return new TypeError("TransformStreamDefaultController.prototype." + e + " can only be used on a TransformStreamDefaultController")
    }

    function zt(e) {
      return new TypeError("TransformStream.prototype." + e + " can only be used on a TransformStream")
    }
    var Bt = {
      CreateTransformStream: function(e, r, t, o, n, i, a) {
        void 0 === o && (o = 1), void 0 === n && (n = function() {
          return 1
        }), void 0 === i && (i = 0), void 0 === a && (a = function() {
          return 1
        });
        var s, l = Object.create(Pt.prototype);
        Rt(l, new Promise(function(e) {
          s = e
        }), o, n, i, a), At(l, Object.create(Et.prototype), r, t);
        var u = e();
        return s(u), l
      },
      TransformStream: Pt
    }.TransformStream;
    void 0 !== s && o(s, {
      ReadableStream: ot,
      WritableStream: Pe,
      ByteLengthQueuingStrategy: it,
      CountQueuingStrategy: st,
      TransformStream: Bt
    }), e.ReadableStream = ot, e.WritableStream = Pe, e.ByteLengthQueuingStrategy = it, e.CountQueuingStrategy = st, e.TransformStream = Bt, Object.defineProperty(e, "__esModule", {
      value: !0
    })
  });
}).call(this, typeof global !== "undefined" ? global : typeof w !== "undefined" ? w : {})

var TransformStream = window.TransformStream;
var ReadableStream = window.ReadableStream;
var WritableStream = window.WritableStream;
