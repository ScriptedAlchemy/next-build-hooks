// Build completion monitor that hooks into Next.js trace system
import { NextBuildContext } from 'next/dist/build/build-context.js';

export class BuildCompletionMonitor {
  constructor() {
    this.buildCompleteCallbacks = [];
    this.isMonitoring = false;
    this.checkInterval = null;
    this.lastTraceActivity = Date.now();
  }

  // Register a callback to be called when build is complete
  onBuildComplete(callback) {
    this.buildCompleteCallbacks.push(callback);
  }

  // Start monitoring the build process
  startMonitoring() {
    if (this.isMonitoring) return;
    
    this.isMonitoring = true;
    console.log('Starting build completion monitoring...');
    
    // Get the build span from NextBuildContext
    const buildSpan = NextBuildContext.nextBuildSpan;
    console.log(buildSpan,' build span');
    if (!buildSpan) {
      console.warn('NextBuildContext.nextBuildSpan not available');
      return;
    }

    // Monitor the span status
    this.monitorSpan(buildSpan);
  }

  monitorSpan(span) {
    // Check if span has a way to detect completion
    console.log('Monitoring build span:', {
      name: span.name,
      id: span.id,
      status: span.status,
      hasStop: typeof span.stop === 'function'
    });

    // Override the stop method to detect when build completes
    const originalStop = span.stop.bind(span);
    let stopCalled = false;
    
    span.stop = (stopTime) => {
      if (!stopCalled) {
        stopCalled = true;
        console.log('Build span stopping, but static generation may still be running...');
        
        // Call original stop
        const result = originalStop(stopTime);
        
        // Start checking for true build completion
        this.startCompletionCheck();
        
        return result;
      }
      return originalStop(stopTime);
    };

    // Also monitor trace activity
    this.startTraceActivityMonitor();
  }

  startTraceActivityMonitor() {
    // Monitor for trace activity to detect when build is truly done
    if (this.checkInterval) return;

    this.checkInterval = setInterval(() => {
      // Check various indicators of build completion
      const indicators = this.checkBuildCompletionIndicators();
      
      if (indicators.allComplete) {
        console.log('Build completion detected!', indicators);
        this.handleBuildComplete();
      }
    }, 500);
  }

  checkBuildCompletionIndicators() {
    const indicators = {
      spanStopped: false,
      staticGenerationComplete: false,
      exportComplete: false,
      tracesWritten: false,
      allComplete: false
    };

    // Check if main build span is stopped
    const buildSpan = NextBuildContext.nextBuildSpan;
    if (buildSpan && buildSpan.status === 'stopped') {
      indicators.spanStopped = true;
    }

    // Check for static generation completion by looking at build context
    if (NextBuildContext.dir) {
      const distDir = NextBuildContext.distDir || '.next';
      
      try {
        const fs = require('fs');
        const path = require('path');
        
        // Check if export marker exists (indicates export phase complete)
        const exportMarkerPath = path.join(
          NextBuildContext.dir,
          distDir,
          'export-marker.json'
        );
        
        if (fs.existsSync(exportMarkerPath)) {
          indicators.exportComplete = true;
          const stats = fs.statSync(exportMarkerPath);
          // If file was modified recently, build just completed
          if (Date.now() - stats.mtimeMs < 10000) {
            indicators.staticGenerationComplete = true;
          }
        }
        
        // Check for trace file which is written at the very end
        const traceDir = path.join(NextBuildContext.dir, distDir, 'trace');
        if (fs.existsSync(traceDir)) {
          const traceFiles = fs.readdirSync(traceDir);
          if (traceFiles.some(f => f.endsWith('.json'))) {
            indicators.tracesWritten = true;
          }
        }
        
        // Check for build manifest - updated after static generation
        const buildManifestPath = path.join(
          NextBuildContext.dir,
          distDir,
          'build-manifest.json'
        );
        
        if (fs.existsSync(buildManifestPath)) {
          const stats = fs.statSync(buildManifestPath);
          // Check if recently modified (within last 10 seconds)
          if (Date.now() - stats.mtimeMs < 10000) {
            indicators.staticGenerationComplete = true;
          }
        }
      } catch (e) {
        // Ignore errors
      }
    }

    // All indicators must be true - span stopped and either traces written or export complete
    indicators.allComplete = indicators.spanStopped && 
                           (indicators.tracesWritten || (indicators.exportComplete && indicators.staticGenerationComplete));

    return indicators;
  }

  startCompletionCheck() {
    // Give static generation time to start
    setTimeout(() => {
      console.log('Checking for static generation completion...');
      
      // Poll for completion indicators
      let checkCount = 0;
      const maxChecks = 120; // 60 seconds max
      let lastLogTime = 0;
      
      const checkInterval = setInterval(() => {
        checkCount++;
        
        const indicators = this.checkBuildCompletionIndicators();
        
        // Log every 2 seconds instead of every check
        if (Date.now() - lastLogTime > 2000) {
          console.log(`Completion check ${checkCount}:`, indicators);
          lastLogTime = Date.now();
        }
        
        if (indicators.allComplete || checkCount >= maxChecks) {
          clearInterval(checkInterval);
          
          if (indicators.allComplete) {
            this.handleBuildComplete();
          } else {
            console.warn('Build completion check timed out');
          }
        }
      }, 500);
    }, 2000); // Wait 2 seconds before starting checks
  }

  handleBuildComplete() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }

    console.log('='.repeat(50));
    console.log('BUILD FULLY COMPLETE - Including Static Generation!');
    console.log('='.repeat(50));
    
    // Call all registered callbacks
    this.buildCompleteCallbacks.forEach(callback => {
      try {
        callback();
      } catch (e) {
        console.error('Error in build complete callback:', e);
      }
    });
    
    this.isMonitoring = false;
  }

  stop() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    this.isMonitoring = false;
  }
}

// Create singleton instance
export const buildCompletionMonitor = new BuildCompletionMonitor();