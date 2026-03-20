import { useEffect, useState } from "react";
import { observer } from "mobx-react";
import type { Network } from "../../model";

interface Props {
  network: Network;
}

function linePath(points: Array<[number, number]>) {
  if (points.length === 0) return "";

  return points
    .map(([x, y], index) => `${index === 0 ? "M" : "L"} ${x} ${y}`)
    .join(" ");
}

function nextScaleCeiling(bits: number) {
  if (bits <= 0) return 10;

  const magnitude = 10 ** Math.floor(Math.log10(bits));
  const normalized = bits / magnitude;

  if (normalized <= 1) return magnitude;
  if (normalized <= 2) return 2 * magnitude;
  if (normalized <= 5) return 5 * magnitude;
  return 10 * magnitude;
}

export default observer(function CodelengthChart({ network }: Props) {
  const { walker } = network;
  const history = walker.codelengthHistory.slice();
  const latest = history[history.length - 1];
  const historyMaxBits = history.length
    ? Math.max(
        ...history.map((point) => point.oneLevelBits),
        ...history.map((point) => point.twoLevelBits),
      )
    : 0;
  const [scaleMaxBits, setScaleMaxBits] = useState(() =>
    nextScaleCeiling(historyMaxBits),
  );
  const displayScaleMaxBits =
    history.length === 0
      ? nextScaleCeiling(0)
      : historyMaxBits > scaleMaxBits
        ? nextScaleCeiling(historyMaxBits)
        : scaleMaxBits;

  useEffect(() => {
    if (history.length === 0) {
      setScaleMaxBits(nextScaleCeiling(0));
      return;
    }

    setScaleMaxBits((currentScaleMaxBits) =>
      historyMaxBits > currentScaleMaxBits
        ? nextScaleCeiling(historyMaxBits)
        : currentScaleMaxBits,
    );
  }, [history.length, historyMaxBits]);

  const [viewBoxWidth, viewBoxHeight] = [1000, 280];
  const leftPadding = 72;
  const rightPadding = 24;
  const topPadding = 52;
  const bottomPadding = 42;
  const chartWidth = viewBoxWidth - leftPadding - rightPadding;
  const chartHeight = viewBoxHeight - topPadding - bottomPadding;

  const chartData = (() => {
    if (history.length === 0) {
      return {
        oneLevelPath: "",
        twoLevelPath: "",
        areaPath: "",
        maxBits: displayScaleMaxBits,
        minStep: 0,
        maxStep: 1,
      };
    }

    const minStep = history[0].step;
    const maxStep = history[history.length - 1].step;
    const x = (step: number) =>
      maxStep === minStep
        ? leftPadding + chartWidth / 2
        : leftPadding + ((step - minStep) / (maxStep - minStep)) * chartWidth;
    const y = (bits: number) =>
      topPadding + chartHeight - (bits / displayScaleMaxBits) * chartHeight;

    const oneLevelPoints = history.map(
      (point) => [x(point.step), y(point.oneLevelBits)] as [number, number],
    );
    const twoLevelPoints = history.map(
      (point) => [x(point.step), y(point.twoLevelBits)] as [number, number],
    );

    return {
      oneLevelPath: linePath(oneLevelPoints),
      twoLevelPath: linePath(twoLevelPoints),
      areaPath:
        oneLevelPoints.length > 1
          ? `${linePath(oneLevelPoints)} ${linePath([...twoLevelPoints].reverse()).replace(/^M /, "L ")} Z`
          : "",
      maxBits: displayScaleMaxBits,
      minStep,
      maxStep,
    };
  })();

  const bitsSaved = latest ? latest.oneLevelBits - latest.twoLevelBits : 0;
  const savingsPct =
    latest && latest.oneLevelBits > 0 ? bitsSaved / latest.oneLevelBits : 0;

  return (
    <section className="mt-6">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h4 className="text-lg font-bold text-gray-900">
            Accumulated codelength
          </h4>
          <p className="text-sm leading-relaxed text-gray-600">
            The lines add up emitted bits over time. A good two-level partition
            grows more slowly, so the gap between the lines widens as bits are
            saved. The y-axis stays fixed until a line reaches the current
            ceiling.
          </p>
        </div>
        <div className="grid gap-2 text-sm sm:grid-cols-3">
          <div className="px-3 py-2">
            <div className="font-semibold text-gray-500">One-level</div>
            <div className="text-lg font-bold text-gray-900">
              {latest?.oneLevelBits ?? 0} bits
            </div>
          </div>
          <div className="px-3 py-2">
            <div className="font-semibold text-gray-500">Two-level</div>
            <div className="text-lg font-bold text-teal-700">
              {latest?.twoLevelBits ?? 0} bits
            </div>
          </div>
          <div className="px-3 py-2">
            <div className="font-semibold text-gray-500">Saved</div>
            <div className="text-lg font-bold text-emerald-700">
              {bitsSaved.toFixed(0)} bits
              {latest ? ` (${(savingsPct * 100).toFixed(1)}%)` : ""}
            </div>
          </div>
        </div>
      </div>

      <svg viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`} className="w-full">
        <g stroke="#d1d5db" strokeDasharray="4 6">
          {[0, 0.25, 0.5, 0.75, 1].map((fraction) => {
            const y = topPadding + chartHeight - fraction * chartHeight;
            return (
              <line
                key={fraction}
                x1={leftPadding}
                x2={viewBoxWidth - rightPadding}
                y1={y}
                y2={y}
              />
            );
          })}
        </g>
        <g stroke="#9ca3af" fill="#6b7280">
          <line
            x1={leftPadding}
            x2={leftPadding}
            y1={topPadding}
            y2={topPadding + chartHeight}
          />
          <line
            x1={leftPadding}
            x2={viewBoxWidth - rightPadding}
            y1={topPadding + chartHeight}
            y2={topPadding + chartHeight}
          />
          {[0, 0.5, 1].map((fraction) => {
            const y = topPadding + chartHeight - fraction * chartHeight;
            return (
              <g key={`y-${fraction}`}>
                <line x1={leftPadding - 8} x2={leftPadding} y1={y} y2={y} />
                <text
                  x={leftPadding - 12}
                  y={y}
                  textAnchor="end"
                  dominantBaseline="middle"
                  fontSize={12}
                >
                  {(chartData.maxBits * fraction).toFixed(0)}
                </text>
              </g>
            );
          })}
          <text
            x={18}
            y={topPadding + chartHeight / 2}
            textAnchor="middle"
            fontSize={12}
            fill="#4b5563"
            transform={`rotate(-90 18 ${topPadding + chartHeight / 2})`}
          >
            Total bits emitted
          </text>
          <text
            x={(leftPadding + viewBoxWidth - rightPadding) / 2}
            y={viewBoxHeight - 8}
            textAnchor="middle"
            fontSize={12}
            fill="#4b5563"
          >
            Walk step
          </text>
          {history.length > 0 && (
            <>
              <text
                x={leftPadding}
                y={topPadding + chartHeight + 18}
                textAnchor="start"
                fontSize={12}
              >
                {chartData.minStep}
              </text>
              <text
                x={viewBoxWidth - rightPadding}
                y={topPadding + chartHeight + 18}
                textAnchor="end"
                fontSize={12}
              >
                {chartData.maxStep}
              </text>
            </>
          )}
        </g>

        {chartData.areaPath && (
          <path d={chartData.areaPath} fill="rgba(16, 185, 129, 0.12)" />
        )}
        {chartData.oneLevelPath && (
          <path
            d={chartData.oneLevelPath}
            fill="none"
            stroke="#6b7280"
            strokeWidth={3}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}
        {chartData.twoLevelPath && (
          <path
            d={chartData.twoLevelPath}
            fill="none"
            stroke="#0f766e"
            strokeWidth={3}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}

        <g fontSize={12} fontWeight={600}>
          <text x={leftPadding} y={24} fill="#6b7280">
            One-level
          </text>
          <text x={leftPadding + 90} y={24} fill="#0f766e">
            Two-level
          </text>
          <text x={leftPadding + 188} y={24} fill="#10b981">
            Saved bits
          </text>
          <line
            x1={leftPadding - 24}
            x2={leftPadding - 6}
            y1={20}
            y2={20}
            stroke="#6b7280"
            strokeWidth={3}
          />
          <line
            x1={leftPadding + 62}
            x2={leftPadding + 80}
            y1={20}
            y2={20}
            stroke="#0f766e"
            strokeWidth={3}
          />
          <line
            x1={leftPadding + 158}
            x2={leftPadding + 176}
            y1={20}
            y2={20}
            stroke="#10b981"
            strokeWidth={3}
          />
        </g>

        {history.length === 0 && (
          <text
            x={viewBoxWidth / 2}
            y={topPadding + chartHeight / 2}
            textAnchor="middle"
            fontSize={14}
            fill="#6b7280"
          >
            Start the walker to accumulate emitted bits.
          </text>
        )}
      </svg>
    </section>
  );
});
