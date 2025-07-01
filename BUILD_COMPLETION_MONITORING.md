# Next.js Build Completion Monitoring

This document details the comprehensive system for monitoring Next.js build completion, including webpack compilation, static generation (SSG), and post-compile steps.

## Overview

The solution provides multiple hooks to detect different stages of the Next.js build process, from webpack compilation through final static generation and cleanup.

## Architecture

```mermaid
graph TB
    A[Next.js Build Start] --> B[Webpack Plugin Applied]
    B --> C[3 Compilers: Client, Server, Edge-Server]
    C --> D[Webpack Compilation Complete]
    D --> E[Static Generation Begins]
    E --> F[Type Checking]
    F --> G[Page Data Collection]
    G --> H[Static Page Generation]
    H --> I[Build Optimization]
    I --> J[Trace Collection]
    J --> K[Build Process Exit]
    
    subgraph "Our Monitoring Hooks"
        D --> M1[Compiler Tracking Hook]
        H --> M2[Build Completion Monitor]
        K --> M3[Process Exit Hook]
    end
    
    M1 --> L1[Certificate Capture Ready]
    M2 --> L2[SSG Complete Detection]
    M3 --> L3[Final Build Complete]
```

## Component Architecture

```mermaid
graph LR
    subgraph "Webpack Plugin System"
        A[CertificateCapturePlugin] --> B[Compiler Tracking State]
        A --> C[Build Completion Monitor]
        A --> D[Build Complete Hook]
    end
    
    subgraph "Next.js Internal"
        E[NextBuildContext] --> F[Build Span]
        E --> G[Telemetry State]
        E --> H[Plugin State]
    end
    
    B --> I[Proxied State Management]
    C --> J[File System Monitoring]
    D --> K[Process Event Hooks]
    
    F --> C
    G --> A
    H --> B
```

## Detailed Flow Diagrams

### 1. Compiler Tracking Flow

```mermaid
sequenceDiagram
    participant NextJS as Next.js Build
    participant Plugin as CertificateCapturePlugin
    participant State as CompilerTrackingState
    participant Monitor as BuildCompletionMonitor
    
    NextJS->>Plugin: Apply to Server Compiler
    Plugin->>State: Initialize server: false
    Plugin->>NextJS: Hook afterDone
    
    NextJS->>Plugin: Apply to Edge-Server Compiler
    Plugin->>State: Initialize edge-server: false
    
    NextJS->>Plugin: Apply to Client Compiler
    Plugin->>State: Initialize client: false
    
    NextJS->>Plugin: Server Compilation Done
    Plugin->>State: Mark server: true
    Plugin->>Plugin: Check if all done
    
    NextJS->>Plugin: Edge-Server Compilation Done
    Plugin->>State: Mark edge-server: true
    Plugin->>Plugin: Check if all done
    
    NextJS->>Plugin: Client Compilation Done
    Plugin->>State: Mark client: true
    Plugin->>Plugin: Check if all done
    Plugin->>Monitor: Start monitoring (All compilers done)
    Plugin->>Plugin: Log compilation report
```

### 2. Build Completion Detection Flow

```mermaid
flowchart TD
    A[All Compilers Done] --> B[Start Build Completion Monitor]
    B --> C[Monitor NextBuildContext Span]
    C --> D[Override span.stop method]
    D --> E[Span Stops - Webpack Done]
    E --> F[Start Completion Checks]
    
    F --> G[Check Build Indicators]
    G --> H{All Indicators Complete?}
    
    subgraph "Build Indicators"
        I[Span Stopped: true/false]
        J[Export Marker Exists: true/false]
        K[Traces Written: true/false]
        L[Build Manifest Recent: true/false]
    end
    
    G --> I
    G --> J
    G --> K
    G --> L
    
    H -->|No| M[Wait 500ms]
    M --> G
    H -->|Yes| N[Handle Build Complete]
    H -->|Timeout| O[Log Timeout Warning]
    
    N --> P[Execute Callbacks]
    P --> Q[Log Final Report]
```

### 3. Process Exit Hook Flow

```mermaid
sequenceDiagram
    participant Build as Next.js Build Process
    participant Hook as BuildCompleteHook
    participant Process as Node.js Process
    participant Callbacks as User Callbacks
    
    Build->>Hook: Register onBuildComplete callback
    Hook->>Process: Install exit handlers
    Hook->>Process: Listen for 'exit' event
    Hook->>Process: Listen for 'beforeExit' event
    Hook->>Process: Listen for SIGINT/SIGTERM
    
    Build->>Build: Complete all build steps
    Build->>Process: Exit with code 0
    Process->>Hook: Trigger exit handler
    Hook->>Hook: Log build completion
    Hook->>Callbacks: Execute all registered callbacks
    Hook->>Hook: Log final build context
```

## File Structure and Responsibilities

```mermaid
graph TB
    subgraph "Core Files"
        A[next.config.mjs]
        B[compiler-tracking-state.mjs]
        C[build-completion-monitor.mjs]
        D[build-complete-hook.mjs]
    end
    
    subgraph "Responsibilities"
        A --> A1[Webpack Plugin Configuration]
        A --> A2[Compiler Name Detection]
        A --> A3[Plugin Registration]
        
        B --> B1[Proxied State Management]
        B --> B2[Compiler Status Tracking]
        B --> B3[Completion Reports]
        
        C --> C1[Span Monitoring]
        C --> C2[File System Checks]
        C --> C3[Build Indicator Logic]
        
        D --> D1[Process Event Handling]
        D --> D2[Exit Code Detection]
        D --> D3[Final Callback Execution]
    end
```

## State Management Flow

```mermaid
stateDiagram-v2
    [*] --> Initializing
    Initializing --> CompilersPending: Plugin applied to first compiler
    
    state CompilersPending {
        [*] --> ServerPending
        ServerPending --> ServerDone: Server compiler finishes
        ServerDone --> EdgeServerDone: Edge-server compiler finishes
        EdgeServerDone --> AllCompilersDone: Client compiler finishes
    }
    
    AllCompilersDone --> MonitoringSpan: Start span monitoring
    MonitoringSpan --> SpanStopped: Build span stops
    SpanStopped --> CheckingIndicators: Begin indicator polling
    
    state CheckingIndicators {
        [*] --> Polling
        Polling --> Polling: Check every 500ms
        Polling --> Complete: All indicators true
        Polling --> Timeout: Max checks reached
    }
    
    Complete --> BuildComplete: Execute callbacks
    Timeout --> BuildComplete: Log timeout warning
    BuildComplete --> ProcessExit: Process exits
    ProcessExit --> [*]
```

## Detection Strategies Comparison

| Strategy | Timing | Reliability | Use Case |
|----------|---------|-------------|----------|
| **Compiler Tracking** | After webpack compilation | High | Certificate capture from webpack assets |
| **Span Monitoring** | During/after static generation | Medium | Detect SSG completion |
| **File System Checks** | Real-time during build | Medium | Verify build artifacts |
| **Process Exit Hook** | After entire build | High | Final cleanup and reporting |

## Build Indicators Explained

```mermaid
graph LR
    subgraph "Build Completion Indicators"
        A[Span Stopped] --> E{All Complete?}
        B[Export Marker Exists] --> E
        C[Traces Written] --> E
        D[Build Manifest Recent] --> E
    end
    
    E -->|Yes| F[Execute Completion Callbacks]
    E -->|No| G[Continue Polling]
    
    subgraph "File System Checks"
        H[.next/export-marker.json]
        I[.next/trace/*.json]
        J[.next/build-manifest.json]
    end
    
    B --> H
    C --> I
    D --> J
```

## Timeline Example

```mermaid
gantt
    title Next.js Build Timeline with Monitoring Hooks
    dateFormat X
    axisFormat %s
    
    section Webpack
    Server Compiler    :active, server, 0, 2000
    Edge-Server Compiler :active, edge, 500, 2500
    Client Compiler    :active, client, 1000, 3000
    
    section Our Hooks
    Compiler Tracking  :crit, track, 2000, 3000
    Span Monitoring    :monitor, 3000, 5000
    
    section Next.js Post-Compile
    Type Checking      :type, 3000, 3500
    Page Collection    :pages, 3500, 4000
    Static Generation  :ssg, 4000, 4500
    Optimization       :opt, 4500, 5000
    Trace Collection   :trace, 5000, 5200
    
    section Final Hook
    Process Exit Hook  :crit, exit, 5200, 5300
```

## Usage Examples

### Basic Certificate Capture

```javascript
// In your webpack plugin callback
buildCompleteHook.onBuildComplete(() => {
  console.log('Build complete - capturing certificates...');
  
  // Access build context
  const buildId = NextBuildContext.buildId;
  const distDir = NextBuildContext.distDir || '.next';
  
  // Capture certificates from build output
  captureCertificates(distDir);
});
```

### Advanced Build Monitoring

```javascript
// Monitor different stages
const trackingState = getSharedTrackingState();

// After webpack compilation
if (trackingState.areAllCompilersDone()) {
  const report = trackingState.getCompletionReport();
  console.log(`Webpack done in ${report.totalTime}ms`);
}

// After static generation
buildCompletionMonitor.onBuildComplete(() => {
  console.log('Static generation complete');
  processStaticAssets();
});

// After entire build
buildCompleteHook.onBuildComplete(() => {
  console.log('Entire build process complete');
  finalizeArtifacts();
});
```

## Key Benefits

1. **Multiple Hook Points**: Capture artifacts at different stages of the build
2. **Reliable Detection**: Uses multiple strategies to ensure accurate completion detection
3. **Next.js Integration**: Leverages internal Next.js systems (BuildContext, spans, telemetry)
4. **Minimal Overhead**: Efficient polling and event-based detection
5. **Error Resilient**: Graceful handling of timeouts and edge cases

## Troubleshooting

### Common Issues

1. **Span not detected**: Check if `NextBuildContext.nextBuildSpan` is available
2. **Timeout warnings**: Increase `maxChecks` in build completion monitor
3. **Process exit not firing**: Ensure hooks are registered before build starts
4. **File system checks failing**: Verify build directory permissions

### Debug Logging

Enable detailed logging by modifying the console.log statements in each module to include timestamps and more context.