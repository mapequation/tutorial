# Performance Monitoring Quick Reference

## Quick Start

1. Open your site in a browser
2. Click the **📊 Perf** button in the bottom-right corner
3. Watch metrics update in real-time as you interact with the demo

## Key Metrics at a Glance

| Metric | What It Means | Good | Warning |
|--------|---------------|------|---------|
| **FPS** | Frames per second | 50-60 | <30 = laggy |
| **Avg Frame Time** | Time per frame in ms | 16-17ms | >33ms = slow |
| **Frame Drops %** | Percentage of slow frames | <5% | >10% = stuttering |
| **walker-step** | Walker computation time | <5ms | >10ms = slow |
| **Memory %** | Heap usage | <50% | >80% = risky |

## One-Liner Commands

Copy these into your browser console:

```javascript
// See everything
window.__PERFORMANCE_MONITOR__.logReport()

// Get current FPS
window.__PERFORMANCE_MONITOR__.getFrameMetrics().currentFps

// Get walker step times
window.__PERFORMANCE_MONITOR__.getMetricStats('walker-step')

// Get all metrics as JSON
JSON.stringify(window.__PERFORMANCE_MONITOR__.getReport())

// Clear and start fresh
window.__PERFORMANCE_MONITOR__.clearMetrics()
```

## Dashboard Controls

| Button | Action |
|--------|--------|
| **Log Report** | Print detailed metrics to console |
| **Clear** | Reset all metrics, start fresh |
| **✕** | Close the dashboard |
| **📊 Perf** | Reopen the dashboard |

## What Gets Measured

✅ **Already Tracked**:
- Frame rate and frame time
- Memory usage (Chrome/Edge)
- Walker step computation
- Network rendering time

## Performance Baseline

Expected performance for typical usage:
- **Idle**: 60 FPS, <20MB heap
- **Walking**: 50-60 FPS, stable
- **Interacting**: 40-60 FPS (depends on interaction type)
- **Resizing**: 30-60 FPS during resize

## Quick Diagnosis

**"FPS is low"** →
1. Check if Frame Drop % is high
2. Look at Frame Time - is it >33ms?
3. Check memory - is it >80%?

**"Memory is rising"** →
1. Keep dashboard open while interacting
2. Click "Clear" to see if it stabilizes
3. Check browser console for warnings

**"Something is slow"** →
1. Click "Log Report" to see all timing data
2. Look for any metric >20ms
3. Try "Clear" and repeat to identify patterns

## Developer Console Integration

The performance monitor is globally exposed as:

```javascript
// In browser console:
window.__PERFORMANCE_MONITOR__

// Or import in code:
import { performanceMonitor } from './utils/performance';
```

## Real-World Examples

### Checking if the site is performing well
```javascript
const report = window.__PERFORMANCE_MONITOR__.getReport();
console.log(`Performance: ${report.frameMetrics.currentFps}FPS, ${Math.round(report.memory.usagePercent)}% memory`);
```

### Getting average walker step time over last 30 measurements
```javascript
window.__PERFORMANCE_MONITOR__.getMetricStats('walker-step')?.avg.toFixed(2) + 'ms'
```

### Exporting metrics for sharing
```javascript
copy(JSON.stringify(window.__PERFORMANCE_MONITOR__.getReport(), null, 2))
```

## Browser Support

| Browser | Support | Notes |
|---------|---------|-------|
| Chrome | ✅ Full | Including memory metrics |
| Firefox | ✅ Full | Without memory metrics |
| Safari | ✅ Full | Without memory metrics |
| Edge | ✅ Full | Including memory metrics |

---

**Full Documentation**: See [PERFORMANCE_MONITORING.md](./PERFORMANCE_MONITORING.md)
