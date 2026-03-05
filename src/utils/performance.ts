/**
 * Performance monitoring utilities for the map-demo application.
 * Tracks rendering, computation, and interaction metrics.
 */

export interface PerformanceMetrics {
  // Timing metrics (milliseconds)
  componentRenderTime: number;
  networkLayoutTime: number;
  huffmanComputationTime: number;
  lassoSelectionTime: number;
  walkerStepTime: number;
  
  // Frame rate metrics
  fps: number;
  frameDrops: number;
  avgFrameTime: number;
  
  // Memory metrics (bytes)
  usedJsHeapSize: number;
  jsHeapSizeLimit: number;
  jsHeapSizePercent: number;
  
  // Interaction metrics
  lassoDrawTime: number;
  nodeSelectionCount: number;
}

class PerformanceMonitor {
  private metrics: Map<string, number[]> = new Map();
  private marks: Map<string, number> = new Map();
  private frameTimestamps: number[] = [];
  private observer: PerformanceObserver | null = null;
  private lastFrameTime: number = 0;
  private frameDropCount: number = 0;
  private frameMonitoringInitialized = false;

  constructor() {
    // Frame rate monitoring is initialized on first use in browser
    this.ensureFrameMonitoringStarted();
  }

  /**
   * Ensure frame monitoring is initialized (lazy initialization for SSR compatibility)
   */
  private ensureFrameMonitoringStarted(): void {
    if (this.frameMonitoringInitialized || typeof window === 'undefined') {
      return;
    }
    this.frameMonitoringInitialized = true;
    this.initFrameRateMonitoring();
  }

  /**
   * Mark the start of a performance measurement
   */
  mark(label: string): void {
    this.ensureFrameMonitoringStarted();
    this.marks.set(label, performance.now());
  }

  /**
   * Measure time since a mark and record the metric
   */
  measure(label: string, markLabel?: string): number {
    this.ensureFrameMonitoringStarted();
    const markKey = markLabel || label;
    const startTime = this.marks.get(markKey);
    
    if (!startTime) {
      console.warn(`Mark "${markKey}" not found`);
      return 0;
    }

    const duration = performance.now() - startTime;
    
    // Record metric
    if (!this.metrics.has(label)) {
      this.metrics.set(label, []);
    }
    this.metrics.get(label)!.push(duration);
    
    // Clean up old marks
    this.marks.delete(markKey);
    
    return duration;
  }

  /**
   * Get statistics for a metric
   */
  getMetricStats(label: string): {
    min: number;
    max: number;
    avg: number;
    median: number;
    count: number;
  } | null {
    const values = this.metrics.get(label);
    
    if (!values || values.length === 0) {
      return null;
    }

    const sorted = [...values].sort((a, b) => a - b);
    const sum = sorted.reduce((a, b) => a + b, 0);
    const avg = sum / sorted.length;
    const median = sorted[Math.floor(sorted.length / 2)];

    return {
      min: sorted[0],
      max: sorted[sorted.length - 1],
      avg,
      median,
      count: sorted.length,
    };
  }

  /**
   * Clear all metrics
   */
  clearMetrics(): void {
    this.metrics.clear();
    this.marks.clear();
    this.frameTimestamps = [];
  }

  /**
   * Get all current metrics as a summary
   */
  getMetricsSummary(): Record<string, ReturnType<typeof this.getMetricStats>> {
    const summary: Record<string, ReturnType<typeof this.getMetricStats>> = {};
    
    for (const [label] of this.metrics) {
      summary[label] = this.getMetricStats(label);
    }
    
    return summary;
  }

  /**
   * Initialize frame rate monitoring
   */
  private initFrameRateMonitoring(): void {
    let frameCount = 0;
    let lastTime = performance.now();

    const measureFrames = () => {
      const currentTime = performance.now();
      const deltaTime = currentTime - lastTime;
      
      // Track frame time
      if (this.lastFrameTime > 0) {
        const frameTime = currentTime - this.lastFrameTime;
        this.frameTimestamps.push(frameTime);
        
        // Keep only last 300 frames (~5 seconds at 60fps)
        if (this.frameTimestamps.length > 300) {
          this.frameTimestamps.shift();
        }
      }
      
      this.lastFrameTime = currentTime;
      frameCount++;

      if (deltaTime >= 1000) {
        // Update FPS every second
        if (!this.metrics.has('fps')) {
          this.metrics.set('fps', []);
        }
        this.metrics.get('fps')!.push(frameCount);
        
        frameCount = 0;
        lastTime = currentTime;
      }

      requestAnimationFrame(measureFrames);
    };

    requestAnimationFrame(measureFrames);
  }

  /**
   * Get current FPS and frame metrics
   */
  getFrameMetrics(): {
    currentFps: number;
    avgFrameTime: number;
    frameDrops: number;
    dropPercentage: number;
  } {
    const fpsMetrics = this.metrics.get('fps');
    const currentFps = fpsMetrics ? fpsMetrics[fpsMetrics.length - 1] : 0;
    
    const avgFrameTime = this.frameTimestamps.length > 0
      ? this.frameTimestamps.reduce((a, b) => a + b, 0) / this.frameTimestamps.length
      : 0;

    // Calculate frame drops from current window (>50ms frames)
    const frameDropCount = this.frameTimestamps.filter(time => time > 50).length;
    const dropPercentage = this.frameTimestamps.length > 0
      ? (frameDropCount / this.frameTimestamps.length) * 100
      : 0;

    return {
      currentFps,
      avgFrameTime,
      frameDrops: frameDropCount,
      dropPercentage: Math.min(dropPercentage, 100), // Cap at 100%
    };
  }

  /**
   * Get memory usage (if available)
   */
  getMemoryUsage(): {
    usedJsHeapSize: number;
    jsHeapSizeLimit: number;
    usagePercent: number;
  } | null {
    // Check if memory API is available (Chrome, Edge)
    if (typeof window === 'undefined' || !('memory' in performance)) {
      return null;
    }

    try {
      const memory = (performance as any).memory;
      if (!memory || !memory.usedJSHeapSize || !memory.jsHeapSizeLimit) {
        return null;
      }
      return {
        usedJsHeapSize: memory.usedJSHeapSize,
        jsHeapSizeLimit: memory.jsHeapSizeLimit,
        usagePercent: (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100,
      };
    } catch (e) {
      // Silently fail if memory API throws
      return null;
    }
  }

  /**
   * Get comprehensive performance report
   */
  getReport(): PerformanceReport {
    return {
      metrics: this.getMetricsSummary(),
      frameMetrics: this.getFrameMetrics(),
      memory: this.getMemoryUsage(),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Log performance report to console
   */
  logReport(): void {
    const report = this.getReport();
    
    console.group('📊 Performance Report');
    console.log('Timestamp:', report.timestamp);
    
    console.group('⏱️ Timing Metrics (ms)');
    for (const [label, stats] of Object.entries(report.metrics)) {
      if (stats) {
        console.log(
          `${label}: avg=${stats.avg.toFixed(2)}, min=${stats.min.toFixed(2)}, max=${stats.max.toFixed(2)}, count=${stats.count}`
        );
      }
    }
    console.groupEnd();
    
    console.group('🎬 Frame Metrics');
    console.log(`FPS: ${report.frameMetrics.currentFps}`);
    console.log(`Avg Frame Time: ${report.frameMetrics.avgFrameTime.toFixed(2)}ms`);
    console.log(`Frame Drops: ${report.frameMetrics.frameDrops} (${report.frameMetrics.dropPercentage.toFixed(1)}%)`);
    console.groupEnd();
    
    if (report.memory) {
      console.group('💾 Memory Usage');
      console.log(`Heap: ${(report.memory.usedJsHeapSize / 1024 / 1024).toFixed(2)}MB / ${(report.memory.jsHeapSizeLimit / 1024 / 1024).toFixed(2)}MB`);
      console.log(`Usage: ${report.memory.usagePercent.toFixed(1)}%`);
      console.groupEnd();
    }
    
    console.groupEnd();
  }
}

export interface PerformanceReport {
  metrics: Record<string, ReturnType<PerformanceMonitor['getMetricStats']>>;
  frameMetrics: ReturnType<PerformanceMonitor['getFrameMetrics']>;
  memory: ReturnType<PerformanceMonitor['getMemoryUsage']>;
  timestamp: string;
}

// Export singleton instance
export const performanceMonitor = new PerformanceMonitor();
