(function() {
    'use strict';
    var origIt = window.it;
    var _done;
    window.it = function(description, test) {
      origIt(description, function(done) {
        _done = done;
        patchAsyncs();
        test();
      });
    };

    var outstandingOps = 0;
    var timers = [];

    function patchAsyncs() {
      var origSetTimeout = window.setTimeout;
      var origClearTimeout = window.clearTimeout;

      window.setTimeout = function setTimeout(callback, ms) {
        outstandingOps++;
        var timer = origSetTimeout(function() {
          outstandingOps--;
          try {
            callback();
            callIfDone();
          } catch(e) {
            _done(e);
          }
        }, ms);
        timers.push(timer);
        return timer;
      };

      window.clearTimeout = function clearTimeout(timer) {
        var index = timers.indexOf(timer);
        if (index !== -1) {
          timers.splice(index, 1);
          outstandingOps--;
        }
        return origClearTimeout(timer);
      };

      window.__asynculous = {
        setTimeout: origSetTimeout,
        clearTimeout: origClearTimeout
      };
    }

    function resetAsyncs() {
      for (var key in window.__asynculous) {
        window[key] = window.__asynculous[key];
      }
    } 

    function callIfDone() {
      if (outstandingOps === 0) {
        _done();
        resetAsyncs();
      }
    }
  }());