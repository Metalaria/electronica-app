// --pre-js of the WebAssembly ngspice (compilar.sh). Same hooks as eecircuit-engine's Docker/pre.js, so the
// app's driver (web/src/simulador/motor/nucleo.ts) works with either engine:
//   setGetInput(f)      ngspice's interactive front end reads each command line through window.prompt → f()
//   setHandleThings(f)  called before each command line is read (see the Asyncify hook in parches.py)
//   runThings(...args)  runs main() (again) with these arguments
if (typeof globalThis !== 'undefined') {
  if (!globalThis.window) {
    globalThis.window = {};
  }
  globalThis.window.prompt = function (msg) {
    if (Module['getInput']) {
      return Module['getInput']();
    }
    return null;
  };
}

Module['setGetInput'] = function (f) {
  Module['getInput'] = f;
};

Module['setHandleThings'] = function (f) {
  Module['handleThings'] = f;
};

Module['runThings'] = function () {
  Module['calledRun'] = false;
  if (Module['callMain']) {
    Module['callMain'](Array.prototype.slice.call(arguments));
  } else if (typeof callMain !== 'undefined') {
    callMain(Array.prototype.slice.call(arguments));
  }
};
