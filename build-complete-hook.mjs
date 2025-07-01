// Simple build completion hook that uses process exit detection
import { NextBuildContext } from 'next/dist/build/build-context.js';

export class BuildCompleteHook {
  constructor() {
    this.callbacks = [];
    this.hookInstalled = false;
  }

  onBuildComplete(callback) {
    this.callbacks.push(callback);
    this.installHook();
  }

  installHook() {
    if (this.hookInstalled) return;
    this.hookInstalled = true;
console.log(NextBuildContext);
    // Hook into process exit events
    const exitHandler = (code) => {
      // Only run on successful exit
      if (code === 0 || code === undefined) {
        console.log('\n' + '='.repeat(60));
        console.log('BUILD PROCESS COMPLETE - All steps finished!');
        console.log('='.repeat(60));
        
        // Log final build state
        console.log('Final Build Context:');
        console.log('  Build ID:', NextBuildContext.buildId);
        console.log('  Directory:', NextBuildContext.dir);
        console.log('  Dist Directory:', NextBuildContext.distDir || '.next');
        
        // Call all registered callbacks
        this.callbacks.forEach(cb => {
          try {
            cb();
          } catch (e) {
            console.error('Error in build complete callback:', e);
          }
        });
      }
    };

    // Listen for various exit events
    process.once('exit', exitHandler);
    process.once('SIGINT', () => process.exit(0));
    process.once('SIGTERM', () => process.exit(0));
    
    // Also hook into beforeExit which fires when event loop is empty
    process.once('beforeExit', (code) => {
      console.log('Build process finishing - beforeExit triggered');
    });
  }
}

export const buildCompleteHook = new BuildCompleteHook();