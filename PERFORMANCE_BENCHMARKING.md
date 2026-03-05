# Performance Benchmarking Guide

This guide shows how to use the performance monitoring system to measure and compare the site's performance objectively.

## Basic Benchmarking Workflow

### 1. Setup
- Open the site in a fresh browser tab
- Open DevTools (F12)
- Click **📊 Perf** button to open dashboard

### 2. Clear Baseline
Click **Clear** to start fresh metrics

### 3. Run Test Scenario
- Interact with the demo (e.g., run random walk for 30 seconds)
- Click nodes, interact with visualizations
- Let network render and update

### 4. Collect Results
- Click **Log Report** in dashboard
- Copy console output
- Take screenshots of dashboard metrics

### 5. Document
Save results with:
- Date/time
- Browser and version
- System info (CPU, RAM, OS)
- Scenario description
- Screenshot of metrics

## Scenario: Random Walk Performance

**Goal**: Measure performance while random walker is running

```javascript
// 1. Start clean
window.__PERFORMANCE_MONITOR__.clearMetrics()

// 2. Wait 5 seconds for walker to run
// (watch dashboard update)

// 3. Get frame metrics
const frames = window.__PERFORMANCE_MONITOR__.getFrameMetrics()
console.log(`FPS: ${frames.currentFps}, Drops: ${frames.frameDrops}`)

// 4. Get walker performance
const walkerStats = window.__PERFORMANCE_MONITOR__.getMetricStats('walker-step')
console.log(`Walker avg: ${walkerStats.avg.toFixed(2)}ms`)

// 5. Get memory
const memory = window.__PERFORMANCE_MONITOR__.getMemoryUsage()
console.log(`Memory: ${memory.usagePercent.toFixed(1)}%`)
```

## Scenario: Network Rendering Performance

**Goal**: Measure how fast the network visualization renders

```javascript
// 1. Clear metrics
window.__PERFORMANCE_MONITOR__.clearMetrics()

// 2. Resize window (triggers re-render)
// Manually drag window edge or use DevTools device emulation

// 3. Check render time
const renderStats = window.__PERFORMANCE_MONITOR__.getMetricStats('network-render')
console.log(`Network render avg: ${renderStats.avg.toFixed(2)}ms`)
console.log(`Slowest: ${renderStats.max.toFixed(2)}ms`)
```

## Comparison Testing

**Before/After Optimization**

```javascript
// Run scenario, collect report
function captureReport(label) {
  const report = window.__PERFORMANCE_MONITOR__.getReport()
  console.log(`=== ${label} ===`)
  console.log(JSON.stringify({
    fps: report.frameMetrics.currentFps,
    frameDrops: report.frameMetrics.frameDrops,
    avgFrameTime: report.frameMetrics.avgFrameTime.toFixed(2),
    memory: report.memory?.usagePercent.toFixed(1),
    walkerStep: report.metrics['walker-step']?.avg.toFixed(2)
  }, null, 2))
}

// Test 1: Original version
window.__PERFORMANCE_MONITOR__.clearMetrics()
// ... run scenario ...
captureReport('BEFORE Optimization')

// Then make optimization...

// Test 2: Optimized version
window.__PERFORMANCE_MONITOR__.clearMetrics()
// ... run same scenario ...
captureReport('AFTER Optimization')
```

## Automated Benchmarking

**Run a 60-second performance test**

```javascript
async function benchmark(durationSeconds = 60) {
  const startTime = Date.now()
  const metrics = []
  
  window.__PERFORMANCE_MONITOR__.clearMetrics()
  
  // Collect metrics every 5 seconds
  const interval = setInterval(() => {
    const elapsed = (Date.now() - startTime) / 1000
    const report = window.__PERFORMANCE_MONITOR__.getReport()
    
    metrics.push({
      elapsed: elapsed.toFixed(1),
      fps: report.frameMetrics.currentFps,
      frameTime: report.frameMetrics.avgFrameTime.toFixed(2),
      memory: report.memory?.usagePercent.toFixed(1)
    })
    
    console.table(metrics)
  }, 5000)
  
  // Stop after duration
  await new Promise(resolve => setTimeout(resolve, durationSeconds * 1000))
  clearInterval(interval)
  
  // Final report
  console.log('\n=== FINAL REPORT ===')
  window.__PERFORMANCE_MONITOR__.logReport()
  
  return metrics
}

// Run it
benchmark(60)
```

## Performance Regression Detection

**Track performance over time**

```javascript
// Save baseline
const baseline = {
  fps: window.__PERFORMANCE_MONITOR__.getFrameMetrics().currentFps,
  walkerStep: window.__PERFORMANCE_MONITOR__.getMetricStats('walker-step')?.avg,
  memory: window.__PERFORMANCE_MONITOR__.getMemoryUsage()?.usagePercent
}

localStorage.setItem('performance-baseline', JSON.stringify(baseline))
console.log('✅ Baseline saved')

// Later, compare against baseline
function checkRegression() {
  const current = {
    fps: window.__PERFORMANCE_MONITOR__.getFrameMetrics().currentFps,
    walkerStep: window.__PERFORMANCE_MONITOR__.getMetricStats('walker-step')?.avg,
    memory: window.__PERFORMANCE_MONITOR__.getMemoryUsage()?.usagePercent
  }
  
  const saved = JSON.parse(localStorage.getItem('performance-baseline'))
  
  console.log('Regression Check:')
  console.log(`FPS: ${current.fps} (was ${saved.fps}) ${current.fps < saved.fps ? '❌' : '✅'}`)
  console.log(`Walker: ${current.walkerStep.toFixed(2)}ms (was ${saved.walkerStep.toFixed(2)}ms) ${current.walkerStep > saved.walkerStep * 1.1 ? '❌' : '✅'}`)
  console.log(`Memory: ${current.memory.toFixed(1)}% (was ${saved.memory.toFixed(1)}%) ${current.memory > saved.memory * 1.1 ? '❌' : '✅'}`)
}

// Check it
checkRegression()
```

## Key Metrics to Track

| Metric | Target | Warning |
|--------|--------|---------|
| FPS | 50-60 | < 30 |
| Frame Time | 16-17ms | > 33ms |
| Frame Drops | < 5% | > 10% |
| Walker Step | < 5ms | > 10ms |
| Memory | < 50% | > 80% |

## Recording Session Data

**Export full session for analysis**

```javascript
// Collect metrics over time
const sessionData = []

const interval = setInterval(() => {
  sessionData.push({
    timestamp: new Date().toISOString(),
    ...window.__PERFORMANCE_MONITOR__.getReport()
  })
}, 1000) // Every second

// After 5 minutes, export
setTimeout(() => {
  clearInterval(interval)
  const json = JSON.stringify(sessionData, null, 2)
  
  // Copy to clipboard
  navigator.clipboard.writeText(json)
  console.log('✅ Copied to clipboard!')
  
  // Or download
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `performance-${Date.now()}.json`
  a.click()
}, 5 * 60 * 1000)
```

## Analyzing Results

**Statistics helper**

```javascript
function analyzeMetric(label) {
  const stats = window.__PERFORMANCE_MONITOR__.getMetricStats(label)
  if (!stats) return console.log(`No data for ${label}`)
  
  const stdDev = Math.sqrt(
    [...Array(stats.count)].reduce((sum) => {
      return sum + Math.pow(stats.avg, 2)
    }, 0) / stats.count
  )
  
  console.log(`
=== ${label} ===
Count:     ${stats.count}
Average:   ${stats.avg.toFixed(2)}ms
Min:       ${stats.min.toFixed(2)}ms
Max:       ${stats.max.toFixed(2)}ms
Median:    ${stats.median.toFixed(2)}ms
Range:     ${(stats.max - stats.min).toFixed(2)}ms
`)
}

analyzeMetric('walker-step')
analyzeMetric('network-render')
```

## Browser DevTools Integration

### Chrome DevTools
1. Open Performance tab
2. While recording, interact with demo
3. Stop recording
4. Compare with our metrics
5. Use for detailed analysis (function calls, etc.)

### Firefox DevTools
1. Open Performance tab
2. Click "Capture" button
3. Interact with demo
4. Review timeline
5. Our metrics provide higher-level summary

## Reporting Results

**Example report format**

```markdown
# Performance Report
- **Date**: 2026-02-19 10:30 AM
- **Browser**: Chrome 126 (Windows 11)
- **Hardware**: Intel i7-12700K, 32GB RAM
- **Test Duration**: 5 minutes

## Results
- **Average FPS**: 58.2
- **Frame Drops**: 12 (0.4%)
- **Walker Step Time**: 2.1ms ± 0.8ms
- **Memory Usage**: 45.2%
- **Network Renders**: 15 (avg 3.2ms)

## Conclusion
Performance is excellent. No regressions detected.
```

## Best Practices

✅ **Do**:
- Run tests on same hardware/browser for consistency
- Clear metrics before each test run
- Run multiple iterations to catch outliers
- Document all test parameters
- Share comparison reports with team

❌ **Don't**:
- Compare across different browsers without noting it
- Include browser extension interference
- Test with developer tools open (affects performance)
- Run tests during system backups or updates
- Compare old vs new results without controlling variables

---

See also:
- [PERFORMANCE_MONITORING.md](./PERFORMANCE_MONITORING.md) - Full documentation
- [PERFORMANCE_QUICK_REF.md](./PERFORMANCE_QUICK_REF.md) - Quick reference
