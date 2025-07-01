// Compiler tracking state implementation inspired by Next.js build-context
// This module tracks the compilation state of all Next.js compilers

export const createCompilerTrackingState = () => {
  const pluginState = {};
  
  const initialState = {
    compilersDone: {},
    allDone: false,
    certificateData: [],
    startTime: Date.now(),
    completionTimes: {},
  };
  
  // Create a proxied state that lazily initializes values
  const proxiedState = new Proxy(pluginState, {
    get(target, key) {
      if (typeof target[key] === 'undefined') {
        return (target[key] = initialState[key]);
      }
      return target[key];
    },
    set(target, key, value) {
      target[key] = value;
      return true;
    },
  });
  
  return {
    state: proxiedState,
    
    // Mark a compiler as done
    markCompilerDone(compilerName) {
      proxiedState.compilersDone[compilerName] = true;
      proxiedState.completionTimes[compilerName] = Date.now();
    },
    
    // Check if all expected compilers are done
    areAllCompilersDone() {
      const expectedCompilers = ['client', 'server', 'edge-server'];
      const hasAllExpectedCompilers = expectedCompilers.every(name => 
        name in proxiedState.compilersDone
      );
      
      if (!hasAllExpectedCompilers) {
        return false;
      }
      
      return Object.values(proxiedState.compilersDone).every(done => done);
    },
    
    // Add certificate data
    addCertificateData(data) {
      proxiedState.certificateData.push(data);
    },
    
    // Get completion report
    getCompletionReport() {
      const totalTime = Date.now() - proxiedState.startTime;
      const compilerTimes = {};
      
      Object.entries(proxiedState.completionTimes).forEach(([compiler, endTime]) => {
        compilerTimes[compiler] = endTime - proxiedState.startTime;
      });
      
      return {
        totalTime,
        compilerTimes,
        certificateCount: proxiedState.certificateData.length,
        certificates: proxiedState.certificateData,
      };
    },
    
    // Reset state for new compilation
    reset() {
      Object.keys(pluginState).forEach(key => {
        delete pluginState[key];
      });
    },
  };
};

// Singleton instance for shared state across plugin instances
let sharedTrackingState;

export const getSharedTrackingState = () => {
  if (!sharedTrackingState) {
    sharedTrackingState = createCompilerTrackingState();
  }
  return sharedTrackingState;
};