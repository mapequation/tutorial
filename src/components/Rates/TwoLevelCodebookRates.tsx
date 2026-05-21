import { observer } from "mobx-react";
import type { Network } from "../../model";
import { scheme, schemeAlt } from "../scheme";

interface Props {
  network: Network;
}

interface CodebookItem {
  key: string;
  label: string;
  probability: number;
  rawRate: number;
  fill: string;
  stroke: string;
  kind: "entry" | "node" | "exit";
}

interface CodebookRow {
  key: string;
  label: string;
  useRate: number;
  items: CodebookItem[];
}

const EXIT_FILL = "#9ca3af";
const EXIT_STROKE = "#4b5563";

function formatRate(value: number) {
  return value.toFixed(3);
}

function TwoLevelCodebookRates({ network }: Props) {
  network.treeUpdateCounter;

  const modules = Array.from(network.tree.root.children.values()).sort(
    (a, b) => a.id - b.id,
  );
  const indexUseRate = modules.reduce(
    (total, module) => total + module.enterFlow,
    0,
  );

  const rows: CodebookRow[] = [
    {
      key: "index",
      label: "Index Q",
      useRate: indexUseRate,
      items: modules.map((module) => ({
        key: `entry-${module.id}`,
        label: `M${module.id + 1}`,
        probability:
          indexUseRate > 0 ? module.enterFlow / indexUseRate : 0,
        rawRate: module.enterFlow,
        fill: scheme[module.id] ?? scheme[0],
        stroke: schemeAlt[module.id] ?? schemeAlt[0],
        kind: "entry",
      })),
    },
    ...modules.map((module) => {
      const nodes = module.sort((a, b) => b.flow - a.flow);
      const nodeFlow = nodes.reduce((total, node) => total + node.flow, 0);
      const useRate = module.exitFlow + nodeFlow;
      const moduleColor = scheme[module.id] ?? scheme[0];
      const moduleStroke = schemeAlt[module.id] ?? schemeAlt[0];

      return {
        key: `module-${module.id}`,
        label: `Module P${module.id + 1}`,
        useRate,
        items: [
          {
            key: `exit-${module.id}`,
            label: "exit",
            probability: useRate > 0 ? module.exitFlow / useRate : 0,
            rawRate: module.exitFlow,
            fill: EXIT_FILL,
            stroke: EXIT_STROKE,
            kind: "exit" as const,
          },
          ...nodes.map((node) => ({
            key: `node-${module.id}-${node.id}`,
            label: String(node.id),
            probability: useRate > 0 ? node.flow / useRate : 0,
            rawRate: node.flow,
            fill: moduleColor,
            stroke: moduleStroke,
            kind: "node" as const,
          })),
        ],
      };
    }),
  ];

  const viewBoxWidth = 1000;
  const viewBoxHeight = 720;
  const leftPadding = 150;
  const rightPadding = 30;
  const topPadding = 56;
  const bottomPadding = 72;
  const rowGap = 18;
  const chartWidth = viewBoxWidth - leftPadding - rightPadding;
  const rowHeight =
    (viewBoxHeight - topPadding - bottomPadding - rowGap * (rows.length - 1)) /
    rows.length;
  const maxItems = Math.max(...rows.map((row) => row.items.length), 1);
  const slotWidth = chartWidth / maxItems;
  const barWidth = Math.min(44, slotWidth * 0.62);
  const maxBarHeight = rowHeight - 28;
  const scaleY = (probability: number) => probability * maxBarHeight;
  const rowTop = (index: number) => topPadding + index * (rowHeight + rowGap);

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="rateView"
      viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
    >
      <g fill="#4b5563">
        <text x={leftPadding} y={24} fontSize={18} fontWeight={700}>
          Normalized codebook distributions
        </text>
        <text x={leftPadding} y={46} fontSize={13} fill="#6b7280">
          Each row sums to 1 before entropy is calculated.
        </text>
      </g>

      {rows.map((row, rowIndex) => {
        const top = rowTop(rowIndex);
        const baseline = top + rowHeight;
        const halfLine = baseline - scaleY(0.5);
        const fullLine = baseline - scaleY(1);

        return (
          <g key={row.key}>
            <text
              x={leftPadding - 12}
              y={top + rowHeight / 2 - 8}
              textAnchor="end"
              fontSize={16}
              fontWeight={700}
              fill="#374151"
            >
              {row.label}
            </text>
            <text
              x={leftPadding - 12}
              y={top + rowHeight / 2 + 12}
              textAnchor="end"
              fontSize={12}
              fill="#6b7280"
            >
              use {formatRate(row.useRate)}
            </text>
            <line
              x1={leftPadding}
              x2={viewBoxWidth - rightPadding}
              y1={baseline}
              y2={baseline}
              stroke="#d1d5db"
            />
            <line
              x1={leftPadding}
              x2={viewBoxWidth - rightPadding}
              y1={halfLine}
              y2={halfLine}
              stroke="#e5e7eb"
              strokeDasharray="4 6"
            />
            <line
              x1={leftPadding}
              x2={viewBoxWidth - rightPadding}
              y1={fullLine}
              y2={fullLine}
              stroke="#e5e7eb"
              strokeDasharray="4 6"
            />
            <text
              x={leftPadding - 4}
              y={halfLine}
              textAnchor="end"
              dominantBaseline="middle"
              fontSize={10}
              fill="#9ca3af"
            >
              0.5
            </text>
            <text
              x={leftPadding - 4}
              y={fullLine}
              textAnchor="end"
              dominantBaseline="middle"
              fontSize={10}
              fill="#9ca3af"
            >
              1
            </text>

            {row.items.map((item, itemIndex) => {
              const centerX = leftPadding + slotWidth * itemIndex + slotWidth / 2;
              const height = Math.max(1, scaleY(item.probability));
              const y = baseline - height;

              return (
                <g key={item.key}>
                  <rect
                    x={centerX - barWidth / 2}
                    y={y}
                    width={barWidth}
                    height={height}
                    rx={4}
                    fill={item.fill}
                    stroke={item.stroke}
                    strokeWidth={item.kind === "exit" ? 2.5 : 2}
                    opacity={item.kind === "exit" ? 0.85 : 0.72}
                  >
                    <title>
                      {`${item.label}: normalized ${formatRate(
                        item.probability,
                      )}, raw rate ${formatRate(item.rawRate)}`}
                    </title>
                  </rect>
                  <text
                    x={centerX}
                    y={baseline + 9}
                    textAnchor="middle"
                    dominantBaseline="hanging"
                    fontSize={item.label === "exit" ? 10 : 11}
                    fill={item.kind === "exit" ? EXIT_STROKE : "#6b7280"}
                    fontWeight={item.kind === "exit" ? 700 : 500}
                  >
                    {item.label}
                  </text>
                </g>
              );
            })}
          </g>
        );
      })}
      <g transform={`translate(${leftPadding} ${viewBoxHeight - 28})`}>
        <rect width={14} height={14} rx={3} fill={scheme[0]} opacity={0.72} />
        <text x={22} y={11} fontSize={12} fill="#6b7280">
          module entry or node symbol
        </text>
        <rect x={230} width={14} height={14} rx={3} fill={EXIT_FILL} />
        <text x={252} y={11} fontSize={12} fill="#6b7280">
          module exit symbol
        </text>
      </g>
    </svg>
  );
}

export default observer(TwoLevelCodebookRates);
