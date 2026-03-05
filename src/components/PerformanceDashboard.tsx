import React, { useState, useEffect } from 'react';
import { performanceMonitor } from '../utils/performance';

/**
 * Real-time performance dashboard showing key metrics
 */
export default function PerformanceDashboard() {
  const [isOpen, setIsOpen] = useState(false);
  const [metrics, setMetrics] = useState(performanceMonitor.getReport());
  const [history, setHistory] = useState<typeof metrics[]>([]);

  // Update metrics every 2 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      const report = performanceMonitor.getReport();
      setMetrics(report);
      setHistory(prev => [...prev.slice(-29), report]); // Keep last 30 measurements
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  const avgMetricValue = (key: string): string => {
    const values = history
      .map(r => r.metrics[key]?.avg || 0)
      .filter(v => v > 0);
    
    if (values.length === 0) return 'N/A';
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    return avg.toFixed(2);
  };

  const handleClear = () => {
    performanceMonitor.clearMetrics();
    setHistory([]);
    setMetrics(performanceMonitor.getReport());
  };

  const handleLogReport = () => {
    performanceMonitor.logReport();
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 bg-gray-800 text-white px-4 py-2 rounded-lg text-sm font-mono hover:bg-gray-700 transition-colors z-50"
        title="Open performance dashboard"
      >
        📊 Perf
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 w-96 bg-gray-900 text-white rounded-lg shadow-2xl p-4 font-mono text-xs z-50 max-h-96 overflow-y-auto">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-sm font-bold">Performance Monitor</h3>
        <button
          onClick={() => setIsOpen(false)}
          className="text-gray-400 hover:text-white"
        >
          ✕
        </button>
      </div>

      {/* Frame Metrics */}
      <div className="mb-4 pb-4 border-b border-gray-700">
        <h4 className="text-yellow-400 font-bold mb-2">🎬 Frame Metrics</h4>
        <div className="space-y-1">
          <div className="flex justify-between">
            <span>Current FPS:</span>
            <span className="text-green-400">{metrics.frameMetrics.currentFps}</span>
          </div>
          <div className="flex justify-between">
            <span>Avg Frame Time:</span>
            <span className="text-green-400">{metrics.frameMetrics.avgFrameTime.toFixed(2)}ms</span>
          </div>
          <div className="flex justify-between">
            <span>Frame Drops:</span>
            <span className={metrics.frameMetrics.dropPercentage > 5 ? 'text-red-400' : 'text-green-400'}>
              {metrics.frameMetrics.frameDrops} ({metrics.frameMetrics.dropPercentage.toFixed(1)}%)
            </span>
          </div>
        </div>
      </div>

      {/* Timing Metrics */}
      <div className="mb-4 pb-4 border-b border-gray-700">
        <h4 className="text-blue-400 font-bold mb-2">⏱️ Timing Metrics (ms)</h4>
        <div className="space-y-1">
          {Object.entries(metrics.metrics).map(([label, stats]) => {
            if (!stats || label === 'fps') return null;
            return (
              <div key={label} className="flex justify-between text-xs">
                <span>{label}:</span>
                <span className="text-cyan-400">
                  {stats.avg.toFixed(2)} (min: {stats.min.toFixed(2)}, max: {stats.max.toFixed(2)})
                </span>
              </div>
            );
          })}
          {Object.keys(metrics.metrics).filter(k => k !== 'fps').length === 0 && (
            <div className="text-gray-500">No timing data yet</div>
          )}
        </div>
      </div>

      {/* Memory Metrics */}
      {metrics.memory ? (
        <div className="mb-4 pb-4 border-b border-gray-700">
          <h4 className="text-purple-400 font-bold mb-2">💾 Memory Usage</h4>
          <div className="space-y-1">
            <div className="flex justify-between">
              <span>Heap:</span>
              <span className={metrics.memory.usagePercent > 80 ? 'text-red-400' : 'text-green-400'}>
                {(metrics.memory.usedJsHeapSize / 1024 / 1024).toFixed(2)}MB / {(metrics.memory.jsHeapSizeLimit / 1024 / 1024).toFixed(2)}MB
              </span>
            </div>
            <div className="flex justify-between">
              <span>Usage:</span>
              <span className={metrics.memory.usagePercent > 80 ? 'text-red-400' : 'text-green-400'}>
                {metrics.memory.usagePercent.toFixed(1)}%
              </span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2 mt-2">
              <div
                className={`h-2 rounded-full transition-all ${
                  metrics.memory.usagePercent > 80 ? 'bg-red-500' : 'bg-green-500'
                }`}
                style={{ width: `${metrics.memory.usagePercent}%` }}
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="mb-4 pb-4 border-b border-gray-700">
          <h4 className="text-purple-400 font-bold mb-2">💾 Memory Usage</h4>
          <div className="text-gray-500 text-xs">
            Not available in {typeof navigator !== 'undefined' ? 'Firefox/Safari' : 'this browser'}. Use Chrome or Edge for memory metrics.
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="flex gap-2">
        <button
          onClick={handleLogReport}
          className="flex-1 bg-blue-600 hover:bg-blue-700 px-2 py-1 rounded text-xs font-bold transition-colors"
        >
          Log Report
        </button>
        <button
          onClick={handleClear}
          className="flex-1 bg-red-600 hover:bg-red-700 px-2 py-1 rounded text-xs font-bold transition-colors"
        >
          Clear
        </button>
      </div>

      <div className="text-gray-500 text-xs mt-2">
        Last update: {new Date(metrics.timestamp).toLocaleTimeString()}
      </div>
    </div>
  );
}
