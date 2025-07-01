/** @type {import('next').NextConfig} */
import { getSharedTrackingState } from './compiler-tracking-state.mjs';
import { NextBuildContext } from 'next/dist/build/build-context.js';
import { buildCompletionMonitor } from './build-completion-monitor.mjs';
import { buildCompleteHook } from './build-complete-hook.mjs';

class CertificateCapturePlugin {
  constructor() {
    this.trackingState = getSharedTrackingState();
  }

  apply(compiler) {
    // Get compiler name - it might be set after plugin is applied
    const getCompilerName = () => compiler.name || compiler.options.name || 'unknown';
    
    // Log initial compiler info
    console.log(`Plugin applied to compiler: ${getCompilerName()}, target: ${compiler.options.target}, mode: ${compiler.options.mode}`);
    
    // Initialize compiler state
    this.trackingState.state.compilersDone[getCompilerName()] = false;
    
    // Hook into afterDone to track when compilation is complete
    compiler.hooks.afterDone.tap('CertificateCapturePlugin', () => {
      const compilerName = getCompilerName();
      console.log(`Compiler ${compilerName} finished`);
      this.trackingState.markCompilerDone(compilerName);
      
      // Log current state
      console.log('Current compiler states:', this.trackingState.state.compilersDone);
      
      // Log NextBuildContext
      console.log('NextBuildContext:', NextBuildContext);
      
      // Check if all compilers are done
      if (this.trackingState.areAllCompilersDone() && !this.trackingState.state.allDone) {
        this.trackingState.state.allDone = true;
        console.log('All compilers done!');
        
        // Get and log the completion report
        const report = this.trackingState.getCompletionReport();
        console.log('Compilation Report:');
        console.log(`  Total time: ${report.totalTime}ms`);
        console.log('  Compiler times:');
        Object.entries(report.compilerTimes).forEach(([compiler, time]) => {
          console.log(`    ${compiler}: ${time}ms`);
        });
        console.log(`  Certificates captured: ${report.certificateCount}`);
        
        // Log NextBuildContext details
        console.log('\nNextBuildContext details:');
        console.log('  buildId:', NextBuildContext.buildId);
        console.log('  distDir:', NextBuildContext.distDir);
        console.log('  dir:', NextBuildContext.dir);
        console.log('  config:', NextBuildContext.config?.experimental);
        console.log('  telemetryState:', NextBuildContext.telemetryState);
        
        // Start monitoring for true build completion (including SSG)
        buildCompletionMonitor.startMonitoring();
        
        // Also use the simpler process exit hook
        buildCompleteHook.onBuildComplete(() => {
          console.log('\nCertificate capture summary:');
          const finalReport = this.trackingState.getCompletionReport();
          console.log('  Total certificates:', finalReport.certificateCount);
          console.log('  Build duration:', finalReport.totalTime + 'ms');
          
          // Here you would capture any certificates or artifacts
          // after the entire build process is complete
        });
        
        // Register callback for when build is truly complete
        buildCompletionMonitor.onBuildComplete(() => {
          console.log('\n' + '='.repeat(60));
          console.log('FINAL BUILD COMPLETE - All static generation finished!');
          console.log('='.repeat(60));
          
          // Here you can capture certificates after everything is done
          const finalReport = this.trackingState.getCompletionReport();
          console.log('Final certificates captured:', finalReport.certificateCount);
          
          // Access any final build artifacts here
          console.log('Build artifacts are ready in:', NextBuildContext.distDir || '.next');
        });
        
        console.log('Ready to capture certificates from all compilations');
      }
    });
    
    // You can add more hooks here to capture certificate data during compilation
    compiler.hooks.emit.tapAsync('CertificateCapturePlugin', (compilation, callback) => {
      // Example: capture any certificate-related assets
      const assets = compilation.assets;
      Object.keys(assets).forEach(assetName => {
        if (assetName.includes('.cert') || assetName.includes('.pem')) {
          this.trackingState.addCertificateData({
            compiler: getCompilerName(),
            asset: assetName,
            size: assets[assetName].size(),
          });
        }
      });
      callback();
    });
  }
}

const nextConfig = {
  webpack: (config, { isServer, nextRuntime, dev }) => {
    // Determine compiler name based on context
    let compilerName = 'client';
    if (isServer) {
      compilerName = nextRuntime === 'edge' ? 'edge-server' : 'server';
    }
    
    // Set the compiler name if not already set
    if (!config.name) {
      config.name = compilerName;
    }
    
    // Add our plugin to track compilation completion
    config.plugins.push(new CertificateCapturePlugin());
    
    return config;
  },
};

export default nextConfig;
