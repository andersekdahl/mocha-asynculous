(function() {
    'use strict';
    var isPatched = false;

    window.__asynculous = {};

    var origIt = window.it;
    var _done;
    window.it = function(description, test) {
      origIt(description, function(done) {
        _done = done;
        patchAsyncs();

        var result;
        var error;
        try {
          result = test();
        } catch(e) {
          error = e;
        }
        if (outstandingOps === 0) {
          resetAsyncs();
        }
        if (error) {
          _done(error);
        }
        return result;
      });
    };

    var outstandingOps = 0;
    var timers = [];

    function patchAsyncs() {
      if (isPatched) {
        debugger;
      }
      isPatched = true;
      
      patchSetClearAsyncs();      
    }

    function patchSetClearAsyncs() {
      ['Timeout', 'Interval', 'Immediate'].forEach(function(name) {
        var timers = [];

        var setName = 'set' + name;
        var clearName = 'clear' + name;

        var origSet = window[setName];
        var origClear = window[clearName];

        if (!origSet) {
          // setImmediate is not implemented everywhere
          return;
        }

        window[setName] = function() {
          var args = [].slice.call(arguments, 0);
          var callback = args[0];
          var wrappedCallback = function() {
            outstandingOps--;
            try {
              callback();
              callIfDone();
            } catch(e) {
              _done(e);
            }
          };
          args[0] = wrappedCallback;
          outstandingOps++;
          var timer = origSet.apply(window, args);
          timers.push(timer);
          return timer;
        };

        window[clearName] = function(timer) {
          var index = timers.indexOf(timer);
          if (index !== -1) {
            timers.splice(index, 1);
            outstandingOps--;
          }
          return origClear(timer);
        };

        window.__asynculous[setName] = origSet;
        window.__asynculous[clearName] = origClear;
      });
    }

    function resetAsyncs() {
      isPatched = false;
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