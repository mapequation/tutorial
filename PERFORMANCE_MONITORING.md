# Performance Monitoring Guide

## Overview

The performance monitoring system provides objective measurements of your site's performance including:

- **Frame Metrics**: FPS, frame time, and frame drops detection
- **Timing Metrics**: Component render times, walker computation, etc.
- **Memory Usage**: Heap size and memory pressure
- **Real-time Dashboard**: Live monitoring interface

## Using the Dashboard

A small **"📊 Perf"** button appears in the bottom-right corner of the page. Click it to open the performance dashboard.

### Dashboard Features

**Frame Metrics** (updated every 2 seconds):
- **Current FPS**: Frames per second
- **Avg Frame Time**: Average milliseconds per frame
- **Frame Drops**: Count and percentage of frames taking >50ms (60fps baseline)

**Timing Metrics**:
- Shows average, min, and max execution times for tracked operations
- Key metrics:
  - `walker-step`: Time for each walker step (random walk computation)
  - `network-render`: Time to render the network visualization

**Memory Usage** (Chrome only):
- Heap size and usage percentage
- Visual progress bar (green if <80%, red if >80%)

**Controls**:
- **Log Report**: Prints detailed performance data to browser console
- **Clear**: Resets all metrics and starts fresh

## Programmatic Access

Use the performance monitor directly in your code:

```typescript
import { performanceMonitor } from '../utils/performance';

// Mark start of operation
performanceMonitor.mark('my-operation');

// ... do something ...

// Measure and record the time
const duration = performanceMonitor.measure('my-operation');
console.log(`Operation took ${duration}ms`);
```

### Getting Statistics

```typescript
// Get stats for a specific metric
const stats = performanceMonitor.getMetricStats('walker-step');
if (stats) {
  console.log(`Average: ${stats.avg}ms`);
  console.log(`Min: ${stats.min}ms, Max: ${stats.max}ms`);
  console.log(`Samples: ${stats.count}`);
}

// Get all metrics at once
const summary = performanceMonitor.getMetricsSummary();

// Get frame metrics
const frameMetrics = performanceMonitor.getFrameMetrics();
console.log(`Current FPS: ${frameMetrics.currentFps}`);
console.log(`Frame drops: ${frameMetrics.frameDrops}`);

// Get memory usage (Chrome/Edge only)
const memory = performanceMonitor.getMemoryUsage();
if (memory) {
  console.log(`Heap: ${memory.usedJsHeapSize / 1024 / 1024}MB`);
}

// Get comprehensive report
const report = performanceMonitor.getReport();

// Log nicely formatted report to console
performanceMonitor.logReport();
```

## Interpreting Results

### Good Performance Targets

- **FPS**: 50-60 (smooth animation)
- **Frame Time**: 16-17ms (at 60fps)
- **Frame Drops**: <5% over time
- **Walker Step**: <5ms (computation is very fast)
- **Memory**: <50% heap usage

### Performance Issues to Watch

| Metric | Issue | Solution |
|--------|-------|----------|
| Low FPS | Rendering bottleneck | Check network component complexity |
| High walker-step time | Computation bottleneck | Reduce network size or optimize algorithms |
| Rising memory | Memory leak | Check for unreleased event listeners or observers |
| Many frame drops | Jank/stuttering | Split heavy computation into smaller chunks |

## Current Instrumentation

The following operations are currently tracked:

1. **walker-step** - RandomWalker computation each step
2. **network-render** - Network SVG component rendering

## Adding More Metrics

To track additional operations:

```typescript
import { performanceMonitor } from '../utils/performance';

function MyComponent() {
  return (
    <div
      onMouseDown={() => performanceMonitor.mark('lasso-draw')}
      onMouseUp={() => performanceMonitor.measure('lasso-draw')}
    >
      {/* component content */}
    </div>
  );
}
```

Or in expensive functions:

```typescript
function expensiveOperation() {
  performanceMonitor.mark('operation');
  
  // ... expensive work ...
  
  performanceMonitor.measure('operation');
}
```

## Exporting Data

To export performance data for analysis:

```typescript
// Get report and convert to JSON
const report = performanceMonitor.getReport();
const json = JSON.stringify(report, null, 2);

// Copy to clipboard
navigator.clipboard.writeText(json);

// Or create download link
const blob = new Blob([json], { type: 'application/json' });
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = `performance-${Date.now()}.json`;
a.click();
```

## Browser Compatibility

- **Frame Rate**: All browsers
- **Timing Metrics**: All browsers
- **Memory Usage**: Chrome, Edge (requires `performance.memory` API)
- **Frame Drop Detection**: All modern browsers

## Tips for Best Results

1. **Run multiple times**: Performance varies due to garbage collection and system load
2. **Use consistent conditions**: Test at similar times of day/week for comparability
3. **Check browser tab activity**: Other tabs affect measurements
4. **Disable extensions**: Browser extensions can impact performance
5. **Monitor over time**: Collect metrics during normal usage to catch trends
6. **Clear metrics before tests**: Use "Clear" button between test runs

## Next Steps

- Watch the dashboard while using the demo
- Look for performance regressions after code changes
- Use "Log Report" to share performance data with team
- Add custom metrics for specific features you're optimizing
