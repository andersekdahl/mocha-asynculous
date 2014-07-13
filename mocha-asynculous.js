(function() {
    'use strict';
    var isPatched = false;  
    var outstandingOps = 0;

    window.__asynculousOriginals = {};

    var origIt = window.it;
    var _done;
    window.it = function(description, test) {
      origIt(description, function(done) {
        _done = done;
        patchAsyncs();
        outstandingOps = 0;

        var result;
        var error;
        try {
          result = test();
        } catch(e) {
          error = e;
        }
        
        if (outstandingOps === 0) {
          restoreAsyncs();
        }

        if (error) {
          _done(error);
        } else if(outstandingOps === 0) {
          _done();
        }
        
        return result;
      });
    };

    var timers = [];

    function wrapCallback(callback, name) {
      return function() {
        // setIntervals outstanding operations
        // is cleared by clearInterval, and not
        // by calling the callback
        if (name !== 'setInterval') {
          outstandingOps--;
        }
        try {
          var result = callback();
          callIfDone();
          return result;
        } catch(e) {
          _done(e);
        }
      };
    }

    function patchAsyncs() {
      if (isPatched) {
        debugger;
      }
      isPatched = true;
      
      patchSetClearAsyncs();      
    }

    function patchSetClearAsyncs() {
      ['Timeout', 'Interval', 'Immediate', 
       'requestAnimationFrame', 'mozRequestAnimationFrame',
       'webkitRequestAnimationFrame'].forEach(function(name) {
        var timers = [];

        var setName = 'set' + name;
        var clearName = 'clear' + name;

        if (!window[setName] && !window[clearName] && window[name]) {
          setName = name;
        }

        var origSet = window[setName];
        var origClear = window[clearName];

        if (origSet) {
          window[setName] = function() {
            var args = [].slice.call(arguments, 0);
            var callback = args[0];
            var wrappedCallback = wrapCallback(callback, setName);
            args[0] = wrappedCallback;
            outstandingOps++;
            var timer = origSet.apply(window, args);
            timers.push(timer);
            return timer;
          };

          window.__asynculousOriginals[setName] = origSet;
        }

        if (origClear) {
          window[clearName] = function(timer) {
            var index = timers.indexOf(timer);
            if (index !== -1) {
              timers.splice(index, 1);
              outstandingOps--;
            }
            return origClear(timer);
          };

          window.__asynculousOriginals[clearName] = origClear;
        }
      });
    }

    function restoreAsyncs() {
      isPatched = false;
      for (var key in window.__asynculousOriginals) {
        window[key] = window.__asynculousOriginals[key];
      }
    } 

    function callIfDone() {
      if (outstandingOps === 0) {
        _done();
        restoreAsyncs();
      }
    }
  }());