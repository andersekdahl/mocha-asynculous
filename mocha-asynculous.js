(function() {
    'use strict';
    var isPatched = false;  
    var outstandingOps = 0;

    window.__asynculousOriginals = {};

    var origIt = window.it;
    var _done;

    function asynculousIt(test) {
      return function(done) {
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
      }
    }

    window.it = function(description, test) {
      var wrappedTest = asynculousIt(test);
      wrappedTest.toString = test.toString.bind(test);
      origIt(description, wrappedTest);
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
      patchEventHandlers();   
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
            var callback = arguments[0];
            var wrappedCallback = wrapCallback(callback, setName);
            arguments[0] = wrappedCallback;
            outstandingOps++;
            var timer = origSet.apply(window, arguments);
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

    function catchAllEventHandler(event) {
      var element = event.target;
      var onproperty = 'on' + event.type;
      do {
        if (typeof element[onproperty] == 'function') {
          var origEventHandler = element[onproperty];
          element[onproperty] = function() {
            try {
              return origEventHandler.call(this, arguments);
            } catch(e) {
              _done(e);
              throw e;
            }
          }
        }
      } while((element = element.parentElement) !== null);
    }

    var events = 'copy cut paste abort blur focus canplay canplaythrough change click contextmenu dblclick drag dragend dragenter dragleave dragover dragstart drop durationchange emptied ended input invalid keydown keypress keyup load loadeddata loadedmetadata loadstart mousedown mouseenter mouseleave mousemove mouseout mouseover mouseup pause play playing progress ratechange reset scroll seeked seeking select show stalled submit suspend timeupdate volumechange waiting mozfullscreenchange mozfullscreenerror mozpointerlockchange mozpointerlockerror error webglcontextrestored webglcontextlost webglcontextcreationerror'.split(' ');
    function patchEventHandlers() {
      events.forEach(function(property) {
        document.addEventListener(property, catchAllEventHandler, true);
      });
    }

    function restoreAsyncs() {
      isPatched = false;
      for (var key in window.__asynculousOriginals) {
        window[key] = window.__asynculousOriginals[key];
      }

      events.forEach(function(property) {
        document.removeEventListener(property, catchAllEventHandler);
      });
    } 

    function callIfDone() {
      if (outstandingOps === 0) {
        _done();
        restoreAsyncs();
      }
    }
  }());