import { observer } from "mobx-react";
import { useMemo } from "react";
import type { Network, Node } from "../../model";
import { getRate, Rate } from "../../model";
import Bar from "./Bar";
import OverflowMask from "./OverflowMask";
import { scheme, schemeAlt } from "../scheme";

interface Props {
  network: Network;
  rate: Rate;
  showModules?: boolean;
  duration?: number;
  width?: number | string;
  height?: number | string;
  monochrome?: boolean;
  rateScale?: number;
  rateBaseline?: number;
  getRateOverride?: (node: Node) => number;
  referenceRateOverride?: (node: Node) => number;
  maxScaleValue?: number;
  yAxisLabel?: string;
}

function Rates({
  network,
  rate,
  showModules = true,
  duration = 100,
  monochrome = false,
  rateScale = 1,
  rateBaseline,
  getRateOverride,
  referenceRateOverride,
  maxScaleValue = 0.1,
  yAxisLabel = "Node visit rate",
}: Props) {
  const { nodes } = network;

  const getNodeRate = getRate(rate);

  const [viewBoxWidth, viewBoxHeight] = [1000, 800];
  const viewBox = `0 0 ${viewBoxWidth} ${viewBoxHeight}`;

  const leftPadding = 90;
  const rightPadding = 20;
  const topPadding = 30;
  const bottomPadding = 96;
  const chartWidth = viewBoxWidth - leftPadding - rightPadding;
  const chartHeight = viewBoxHeight - topPadding - bottomPadding;
  const barWidth = chartWidth / nodes.length;
  const x = (i: number): number => leftPadding + barWidth * i;

  const minHeight = 1;
  const maxHeight = chartHeight;

  const barHeight = (scale: number): number =>
    minHeight + ((maxHeight - minHeight) * scale) / maxScaleValue;
  const y = (scale: number): number =>
    viewBoxHeight - bottomPadding - barHeight(scale);

  const barProps = (i: number, scale: number) => ({
    x: x(i),
    y: y(scale),
    width: barWidth,
    height: barHeight(scale),
    strokeWidth: 2,
    mask: "url(#bar-overflow)",
  });

  const barFillStroke = (node: Node) => {
    if (monochrome) {
      return {
        fill: "#9ca3af",
        stroke: "#6b7280",
      };
    }

    return {
      fill: showModules ? scheme[node.topModule] : scheme[0],
      stroke: showModules ? schemeAlt[node.topModule] : schemeAlt[0],
    };
  };

  const displayRate = (node: Node) => {
    const targetRate = getRateOverride?.(node) ?? getNodeRate(node);

    return rateBaseline === undefined
      ? targetRate * rateScale
      : rateBaseline + (targetRate - rateBaseline) * rateScale;
  };

  const referenceRate = (node: Node) =>
    referenceRateOverride?.(node) ?? getRateOverride?.(node) ?? node.flow;

  // Memoize sorted nodes to avoid re-sorting on every render
  const nodesByFlow = useMemo(
    () =>
      [...nodes].sort((a: Node, b: Node): number => {
        if (a.topModule !== b.topModule) return b.moduleFlow - a.moduleFlow;
        return b.flow - a.flow;
      }),
    [nodes],
  );

  const axisTicks = Array.from({ length: 6 }, (_, index) => {
    const value = (maxScaleValue * index) / 5;

    return {
      label: value.toFixed(2),
      y: viewBoxHeight - bottomPadding - (value / maxScaleValue) * maxHeight,
    };
  });
  const axisX = leftPadding - 20;
  const axisCenterY = topPadding + chartHeight / 2;
  const xAxisY = viewBoxHeight - bottomPadding;
  const xAxisLabelY = viewBoxHeight - 18;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="rateView"
      viewBox={viewBox}
    >
      <defs>
        <OverflowMask
          id="bar-overflow"
          numPoints={3 * nodes.length}
          width={viewBoxWidth}
          height={topPadding} // Jagged clip line at the top of the fixed rate scale
        />
      </defs>
      <g id="rate-axis" stroke="#9ca3af" fill="#6b7280">
        <line
          x1={axisX}
          x2={axisX}
          y1={topPadding}
          y2={viewBoxHeight - bottomPadding}
        />
        {axisTicks.map((tick) => (
          <g key={`${tick.label}-${tick.y}`}>
            <line x1={axisX} x2={axisX + 8} y1={tick.y} y2={tick.y} />
            <text
              x={axisX - 6}
              y={tick.y}
              textAnchor="end"
              dominantBaseline="middle"
              fontSize={12}
              fill="#6b7280"
            >
              {tick.label}
            </text>
          </g>
        ))}
        <text
          x={20}
          y={axisCenterY}
          textAnchor="middle"
          fontSize={22}
          fontWeight={600}
          fill="#4b5563"
          transform={`rotate(-90 20 ${axisCenterY})`}
        >
          {yAxisLabel}
        </text>
      </g>
      {nodesByFlow.map((node, i) => (
        <Bar
          key={i}
          fill="transparent"
          stroke="#ccc"
          {...barProps(i, referenceRate(node))}
        />
      ))}
      {rate !== Rate.Uniform &&
        nodesByFlow.map((node, i) => (
          <Bar
            key={i}
            animate
            duration={duration}
            opacity={0.6}
            {...barFillStroke(node)}
            {...barProps(i, displayRate(node))}
          />
        ))}
      <g id="node-axis" stroke="#9ca3af" fill="#6b7280">
        <line
          x1={leftPadding}
          x2={viewBoxWidth - rightPadding}
          y1={xAxisY}
          y2={xAxisY}
        />
        {nodesByFlow.map((node, i) => {
          const tickX = x(i) + barWidth / 2;
          return (
            <g key={`node-axis-${node.id}`}>
              <line x1={tickX} x2={tickX} y1={xAxisY} y2={xAxisY + 8} />
              <text
                x={tickX}
                y={xAxisY + 14}
                textAnchor="middle"
                dominantBaseline="hanging"
                fontSize={11}
                fill="#6b7280"
              >
                {node.id}
              </text>
            </g>
          );
        })}
        <text
          x={(leftPadding + viewBoxWidth - rightPadding) / 2}
          y={xAxisLabelY}
          textAnchor="middle"
          fontSize={16}
          fontWeight={600}
          fill="#4b5563"
        >
          Node ID
        </text>
      </g>
    </svg>
  );
}

export default observer(Rates);
