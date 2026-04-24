import { useEffect, useMemo, useState } from "react";
import { observer } from "mobx-react";
import type { Network as NetworkModel } from "../model";
import { Network } from "../model";
import type { TreeNode } from "../model/algorithms/Tree";
import type { WalkerCodeSegment } from "../model/algorithms/RandomWalker";
import Button from "./Button";
import HelpTooltip from "./HelpTooltip";
import {
  darkenHexColor,
  neutralLinkColor,
  scheme,
  schemeAlt,
} from "./scheme";
import {
  hierarchical_paper_toy,
  PAPER_REFERENCE_CODELENGTHS,
  paperToyDefaultCoarseByFine,
  paperToyFineModules,
} from "../networks";

type ComparisonMode = "two-level" | "hierarchical";

type CoarseByFine = Record<number, number>;

interface FineModuleStat {
  id: number;
  coarseId: number;
  label: string;
  localIndex: number;
  nodeIds: number[];
  flow: number;
  x: number;
  y: number;
  radius: number;
}

interface CoarseModuleStat {
  id: number;
  flow: number;
  x: number;
  y: number;
  radius: number;
  fineModules: FineModuleStat[];
}

interface CodebookEntry {
  key: string;
  kind: "enter" | "exit" | "visit";
  label: string;
  code: string;
  flow: number;
  active: boolean;
}

interface BreakdownRow {
  label: string;
  value: number;
  color: string;
}

const paperToyFineByNodeId = new Map<number, number>();
const paperToyFineById = new Map(paperToyFineModules.map((module_) => [module_.id, module_]));
const defaultCoarseByFine: CoarseByFine = {};

paperToyFineModules.forEach((module_) => {
  defaultCoarseByFine[module_.id] =
    paperToyDefaultCoarseByFine.get(module_.id) ?? module_.coarseId;

  module_.nodeIds.forEach((nodeId) => {
    paperToyFineByNodeId.set(nodeId, module_.id);
  });
});

const VIEWBOX = {
  width: 800,
  height: 560,
} as const;

const DEFAULT_SPEED = 2;

function cloneCoarseByFine(source: CoarseByFine): CoarseByFine {
  return { ...source };
}

function createDemoNetwork(): NetworkModel {
  const network = Network.parse(hierarchical_paper_toy).setNodeExtents(
    [90, 710],
    [80, 500],
  );

  network.walker.setSpeed(DEFAULT_SPEED);
  network.walker.setTeleportRate(0);

  return network;
}

function getFinePath(
  comparisonMode: ComparisonMode,
  fineId: number,
  coarseByFine: CoarseByFine,
) {
  if (comparisonMode === "two-level") {
    return [fineId];
  }

  return [coarseByFine[fineId], fineId];
}

function applyComparisonMode(
  network: NetworkModel,
  comparisonMode: ComparisonMode,
  coarseByFine: CoarseByFine,
) {
  network.walker.reset();

  paperToyFineModules.forEach((module_) => {
    const nextPath = getFinePath(comparisonMode, module_.id, coarseByFine);

    module_.nodeIds.forEach((nodeId) => {
      network.getNode(nodeId)?.setPath(nextPath);
    });
  });

  network.finalize();
}

function getFineIdsForCoarse(coarseId: number, coarseByFine: CoarseByFine) {
  return Object.entries(coarseByFine)
    .filter(([, currentCoarseId]) => currentCoarseId === coarseId)
    .map(([fineId]) => Number(fineId))
    .sort((a, b) => a - b);
}

function getFineLabel(fineId: number, coarseByFine: CoarseByFine) {
  const coarseId = coarseByFine[fineId];
  const fineIds = getFineIdsForCoarse(coarseId, coarseByFine);
  const localIndex = Math.max(1, fineIds.indexOf(fineId) + 1);

  return `${coarseId}.${localIndex}`;
}

function getFineModuleStat(
  network: NetworkModel,
  fineId: number,
  coarseByFine: CoarseByFine,
): FineModuleStat {
  const module_ = paperToyFineById.get(fineId)!;
  const nodes = module_.nodeIds
    .map((nodeId) => network.getNode(nodeId))
    .filter((node): node is NonNullable<typeof node> => node !== null);
  const flow =
    nodes.length > 0
      ? nodes.reduce((total, node) => total + node.flow, 0)
      : 0;
  const x =
    nodes.length > 0
      ? nodes.reduce((total, node) => total + node.x, 0) / nodes.length
      : 0;
  const y =
    nodes.length > 0
      ? nodes.reduce((total, node) => total + node.y, 0) / nodes.length
      : 0;
  const radius =
    nodes.length > 0
      ? Math.max(...nodes.map((node) => Math.hypot(node.x - x, node.y - y))) + 34
      : 40;

  return {
    ...module_,
    coarseId: coarseByFine[fineId],
    flow,
    x,
    y,
    radius,
    label: getFineLabel(fineId, coarseByFine),
  };
}

function buildFineModuleStats(
  network: NetworkModel,
  coarseByFine: CoarseByFine,
) {
  return paperToyFineModules
    .map((module_) => getFineModuleStat(network, module_.id, coarseByFine))
    .sort((a, b) => a.id - b.id);
}

function buildCoarseModuleStats(fineModules: FineModuleStat[]) {
  const grouped = new Map<number, FineModuleStat[]>();

  fineModules.forEach((module_) => {
    if (!grouped.has(module_.coarseId)) {
      grouped.set(module_.coarseId, []);
    }

    grouped.get(module_.coarseId)!.push(module_);
  });

  return Array.from(grouped.entries())
    .map(([id, modules]) => {
      const totalFlow = modules.reduce((sum, module_) => sum + module_.flow, 0);
      const x =
        totalFlow > 0
          ? modules.reduce((sum, module_) => sum + module_.x * module_.flow, 0) /
            totalFlow
          : modules.reduce((sum, module_) => sum + module_.x, 0) / modules.length;
      const y =
        totalFlow > 0
          ? modules.reduce((sum, module_) => sum + module_.y * module_.flow, 0) /
            totalFlow
          : modules.reduce((sum, module_) => sum + module_.y, 0) / modules.length;
      const radius =
        Math.max(
          ...modules.map(
            (module_) =>
              Math.hypot(module_.x - x, module_.y - y) + module_.radius,
          ),
        ) + 36;

      return {
        id,
        flow: totalFlow,
        x,
        y,
        radius,
        fineModules: modules.sort((a, b) => a.id - b.id),
      };
    })
    .sort((a, b) => a.id - b.id);
}

function formatModuleName(
  modulePath: number[],
  comparisonMode: ComparisonMode,
  coarseByFine: CoarseByFine,
) {
  if (modulePath.length === 0) {
    return "Network";
  }

  if (comparisonMode === "two-level" || modulePath.length === 1) {
    return `Module ${modulePath[modulePath.length - 1]}`;
  }

  return `Submodule ${getFineLabel(modulePath[modulePath.length - 1], coarseByFine)}`;
}

function segmentKey(kind: CodebookEntry["kind"], modulePath: number[], nodeId?: number) {
  return `${kind}:${modulePath.join(":")}:${nodeId ?? ""}`;
}

function buildActiveSegmentKeys(segments: WalkerCodeSegment[]) {
  return new Set(
    segments.map((segment) =>
      segmentKey(segment.kind, segment.modulePath, segment.nodeId),
    ),
  );
}

function buildIndexEntries(
  module_: TreeNode | null,
  comparisonMode: ComparisonMode,
  coarseByFine: CoarseByFine,
  activeKeys: Set<string>,
): CodebookEntry[] {
  if (!module_ || module_.isLeafModule) {
    return [];
  }

  const entries: CodebookEntry[] = [];

  if (!module_.isRoot && module_.exitCode) {
    const key = segmentKey("exit", module_.path);
    entries.push({
      key,
      kind: "exit",
      label:
        module_.depth === 1
          ? "Exit to top level"
          : `Exit ${formatModuleName(module_.path.slice(0, -1), comparisonMode, coarseByFine)}`,
      code: module_.exitCode,
      flow: module_.exitFlow,
      active: activeKeys.has(key),
    });
  }

  module_
    .sort((a, b) => b.enterFlow - a.enterFlow)
    .forEach((child) => {
      const key = segmentKey("enter", child.path);
      entries.push({
        key,
        kind: "enter",
        label: `Enter ${formatModuleName(child.path, comparisonMode, coarseByFine)}`,
        code: child.enterCode,
        flow: child.enterFlow,
        active: activeKeys.has(key),
      });
    });

  return entries;
}

function buildLeafEntries(
  module_: TreeNode | null,
  activeKeys: Set<string>,
): CodebookEntry[] {
  if (!module_ || !module_.isLeafModule) {
    return [];
  }

  const entries: CodebookEntry[] = [];
  const exitKey = segmentKey("exit", module_.path);

  entries.push({
    key: exitKey,
    kind: "exit",
    label: "Exit to higher level",
    code: module_.exitCode,
    flow: module_.exitFlow,
    active: activeKeys.has(exitKey),
  });

  module_
    .sort((a, b) => b.flow - a.flow)
    .forEach((node) => {
      const key = segmentKey("visit", module_.path, node.id);
      entries.push({
        key,
        kind: "visit",
        label: `Visit node ${node.id}`,
        code: node.code,
        flow: node.flow,
        active: activeKeys.has(key),
      });
    });

  return entries;
}

function buildBreakdownRows(network: NetworkModel): BreakdownRow[] {
  const indexByDepth = new Map<number, number>();
  let leafTotal = 0;

  for (const module_ of network.tree.depthFirstModules()) {
    if (module_.isLeafModule) {
      leafTotal += module_.codelength;
      continue;
    }

    indexByDepth.set(
      module_.depth,
      (indexByDepth.get(module_.depth) ?? 0) + module_.codelength,
    );
  }

  const rows: BreakdownRow[] = [];

  if ((indexByDepth.get(0) ?? 0) > 0) {
    rows.push({
      label: "Top-level index",
      value: indexByDepth.get(0) ?? 0,
      color: darkenHexColor(scheme[0], 0.12),
    });
  }

  [...indexByDepth.entries()]
    .filter(([depth]) => depth > 0)
    .sort(([left], [right]) => left - right)
    .forEach(([depth, value], index) => {
      rows.push({
        label: `Subindex level ${depth + 1}`,
        value,
        color: darkenHexColor(scheme[(index + 1) % scheme.length], 0.12),
      });
    });

  rows.push({
    label: "Leaf codebooks",
    value: leafTotal,
    color: darkenHexColor("#8aa29e", 0.08),
  });

  return rows.filter((row) => row.value > 1e-9);
}

function getCurrentFineId(network: NetworkModel) {
  if (!network.walker.current) {
    return null;
  }

  return paperToyFineByNodeId.get(network.walker.current.id) ?? null;
}

function getCurrentCoarseId(
  network: NetworkModel,
  coarseByFine: CoarseByFine,
) {
  const fineId = getCurrentFineId(network);

  return fineId ? coarseByFine[fineId] : null;
}

function OverviewStrip({
  coarseModules,
  coarseByFine,
  comparisonMode,
  onZoom,
}: {
  coarseModules: CoarseModuleStat[];
  coarseByFine: CoarseByFine;
  comparisonMode: ComparisonMode;
  onZoom: (path: number[]) => void;
}) {
  return (
    <div className="rounded-3xl border border-gray-200 bg-white px-5 py-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="m-0 text-lg font-bold text-gray-900">Mini overview strip</h3>
        <div className="text-xs text-gray-500">
          Widths follow flow. The braces show how many fine modules live inside each larger region.
        </div>
      </div>
      <div className="flex flex-col gap-3 lg:flex-row">
        {coarseModules.map((coarse) => (
          <div
            key={coarse.id}
            className="min-w-0 flex-1 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4"
            style={{
              flexGrow: coarse.flow,
            }}
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <button
                type="button"
                className="text-left text-sm font-semibold tracking-wide text-gray-900"
                onClick={() =>
                  onZoom(comparisonMode === "hierarchical" ? [coarse.id] : [])
                }
              >
                Module {coarse.id}
              </button>
              <span className="text-xs text-gray-500">
                {coarse.fineModules.length} submodules
              </span>
            </div>
            <div className="flex h-16 gap-1">
              {coarse.fineModules.map((module_) => (
                <button
                  key={module_.id}
                  type="button"
                  className="group relative min-w-[2.5rem] flex-1 rounded-xl border border-white/70 px-2 py-2 text-left text-white transition-transform hover:-translate-y-0.5"
                  style={{
                    flexGrow: module_.flow,
                    backgroundColor: scheme[(module_.coarseId - 1) % scheme.length],
                  }}
                  onClick={() =>
                    onZoom(
                      comparisonMode === "hierarchical"
                        ? [coarseByFine[module_.id], module_.id]
                        : [module_.id],
                    )
                  }
                >
                  <div className="text-xs font-semibold opacity-90">
                    {module_.label}
                  </div>
                  <div className="mt-1 text-[11px] opacity-80">
                    {module_.flow.toFixed(3)} flow
                  </div>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function HierarchyMap({
  network,
  comparisonMode,
  coarseByFine,
  zoomPath,
  fineModules,
  coarseModules,
  onZoomPathChange,
}: {
  network: NetworkModel;
  comparisonMode: ComparisonMode;
  coarseByFine: CoarseByFine;
  zoomPath: number[];
  fineModules: FineModuleStat[];
  coarseModules: CoarseModuleStat[];
  onZoomPathChange: (path: number[]) => void;
}) {
  const currentFineId = getCurrentFineId(network);
  const currentCoarseId = getCurrentCoarseId(network, coarseByFine);
  const zoomedFineId =
    comparisonMode === "two-level" ? zoomPath[0] ?? null : zoomPath[1] ?? null;
  const zoomedCoarseId =
    comparisonMode === "hierarchical" ? zoomPath[0] ?? null : null;
  const highlightedFineId = zoomedFineId ?? currentFineId;
  const highlightedCoarseId =
    comparisonMode === "hierarchical"
      ? zoomedCoarseId ?? currentCoarseId
      : highlightedFineId
        ? coarseByFine[highlightedFineId]
        : currentCoarseId;

  const getNodeOpacity = (nodeId: number) => {
    const fineId = paperToyFineByNodeId.get(nodeId);

    if (!fineId) {
      return 0.08;
    }

    if (highlightedFineId) {
      if (fineId === highlightedFineId) {
        return 0.95;
      }

      return coarseByFine[fineId] === coarseByFine[highlightedFineId]
        ? 0.32
        : 0.08;
    }

    if (highlightedCoarseId) {
      return coarseByFine[fineId] === highlightedCoarseId ? 0.36 : 0.1;
    }

    return comparisonMode === "hierarchical" ? 0.14 : 0.18;
  };

  const getLinkOpacity = (sourceId: number, targetId: number) => {
    return Math.max(getNodeOpacity(sourceId), getNodeOpacity(targetId)) * 0.55;
  };

  const selectedFine = zoomedFineId
    ? fineModules.find((module_) => module_.id === zoomedFineId) ?? null
    : null;

  const selectedCoarse = zoomedCoarseId
    ? coarseModules.find((module_) => module_.id === zoomedCoarseId) ?? null
    : null;

  return (
    <div className="rounded-3xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h3 className="m-0 text-lg font-bold text-gray-900">Zoomable hierarchy map</h3>
          <p className="m-0 mt-1 text-sm text-gray-600">
            Click modules to dive in. At the finest level, the walker moves on the actual toy network.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            className="button text-sm"
            onClick={() =>
              onZoomPathChange(
                comparisonMode === "hierarchical" && zoomPath.length === 2
                  ? [zoomPath[0]]
                  : [],
              )
            }
          >
            Zoom out
          </Button>
          <Button className="button text-sm" onClick={() => onZoomPathChange([])}>
            Home
          </Button>
        </div>
      </div>
      <svg
        viewBox={`0 0 ${VIEWBOX.width} ${VIEWBOX.height}`}
        className="w-full rounded-2xl bg-[radial-gradient(circle_at_top,_rgba(117,150,162,0.18),_transparent_55%),linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)]"
      >
        {network.links.map((link, index) => (
          <line
            key={`${link.source.id}-${link.target.id}-${index}`}
            x1={link.source.x}
            y1={link.source.y}
            x2={link.target.x}
            y2={link.target.y}
            stroke={neutralLinkColor}
            strokeWidth={2}
            opacity={getLinkOpacity(link.source.id, link.target.id)}
          />
        ))}
        {network.nodes.map((node) => {
          const fineId = paperToyFineByNodeId.get(node.id);
          const coarseId = fineId ? coarseByFine[fineId] : 1;
          const fill = scheme[(coarseId - 1) % scheme.length];

          return (
            <circle
              key={node.id}
              cx={node.x}
              cy={node.y}
              r={8}
              fill={fill}
              stroke={schemeAlt[(coarseId - 1) % schemeAlt.length]}
              strokeWidth={2}
              opacity={getNodeOpacity(node.id)}
            />
          );
        })}
        {!zoomedCoarseId &&
          comparisonMode === "hierarchical" &&
          coarseModules.map((module_) => (
            <g key={`coarse-${module_.id}`}>
              <circle
                cx={module_.x}
                cy={module_.y}
                r={module_.radius}
                fill={scheme[(module_.id - 1) % scheme.length]}
                fillOpacity={0.12}
                stroke={schemeAlt[(module_.id - 1) % schemeAlt.length]}
                strokeWidth={3}
                className="cursor-pointer transition-opacity hover:opacity-95"
                onClick={() => onZoomPathChange([module_.id])}
              />
              {module_.fineModules.map((fine) => (
                <circle
                  key={`fine-preview-${fine.id}`}
                  cx={fine.x}
                  cy={fine.y}
                  r={18}
                  fill={scheme[(module_.id - 1) % scheme.length]}
                  fillOpacity={0.45}
                  stroke="white"
                  strokeWidth={2}
                />
              ))}
              <text
                x={module_.x}
                y={module_.y}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={24}
                fontWeight={700}
                fill="#1f2937"
              >
                {module_.id}
              </text>
            </g>
          ))}
        {comparisonMode === "two-level" &&
          !zoomedFineId &&
          fineModules.map((module_) => (
            <g key={`two-level-${module_.id}`}>
              <circle
                cx={module_.x}
                cy={module_.y}
                r={Math.max(26, module_.radius)}
                fill={scheme[(module_.coarseId - 1) % scheme.length]}
                fillOpacity={0.15}
                stroke={schemeAlt[(module_.coarseId - 1) % schemeAlt.length]}
                strokeWidth={3}
                className="cursor-pointer transition-opacity hover:opacity-95"
                onClick={() => onZoomPathChange([module_.id])}
              />
              <text
                x={module_.x}
                y={module_.y}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={18}
                fontWeight={700}
                fill="#1f2937"
              >
                {module_.id}
              </text>
            </g>
          ))}
        {selectedCoarse &&
          comparisonMode === "hierarchical" &&
          zoomPath.length === 1 && (
            <>
              <circle
                cx={selectedCoarse.x}
                cy={selectedCoarse.y}
                r={selectedCoarse.radius + 18}
                fill="none"
                stroke={schemeAlt[(selectedCoarse.id - 1) % schemeAlt.length]}
                strokeWidth={4}
                strokeDasharray="10 8"
              />
              {selectedCoarse.fineModules.map((module_) => (
                <g key={`coarse-detail-${module_.id}`}>
                  <circle
                    cx={module_.x}
                    cy={module_.y}
                    r={Math.max(34, module_.radius + 12)}
                    fill={scheme[(selectedCoarse.id - 1) % scheme.length]}
                    fillOpacity={0.18}
                    stroke={schemeAlt[(selectedCoarse.id - 1) % schemeAlt.length]}
                    strokeWidth={3}
                    className="cursor-pointer transition-opacity hover:opacity-95"
                    onClick={() =>
                      onZoomPathChange([selectedCoarse.id, module_.id])
                    }
                  />
                  <text
                    x={module_.x}
                    y={module_.y}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize={16}
                    fontWeight={700}
                    fill="#1f2937"
                  >
                    {module_.label}
                  </text>
                </g>
              ))}
            </>
          )}
        {selectedFine && (
          <circle
            cx={selectedFine.x}
            cy={selectedFine.y}
            r={selectedFine.radius + 22}
            fill="none"
            stroke={schemeAlt[(selectedFine.coarseId - 1) % schemeAlt.length]}
            strokeWidth={4}
            strokeDasharray="11 8"
          />
        )}
        {network.walker.current && (
          <>
            <circle
              cx={network.walker.current.x}
              cy={network.walker.current.y}
              r={14}
              fill="#111827"
              opacity={0.92}
            />
            <text
              x={network.walker.current.x}
              y={network.walker.current.y - 24}
              textAnchor="middle"
              fontSize={13}
              fontWeight={700}
              fill="#111827"
            >
              walker
            </text>
          </>
        )}
      </svg>
    </div>
  );
}

function CodebookCard({
  title,
  subtitle,
  entries,
  accent,
}: {
  title: string;
  subtitle: string;
  entries: CodebookEntry[];
  accent: string;
}) {
  return (
    <div className="rounded-3xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-3">
        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">
          {subtitle}
        </div>
        <h4 className="m-0 mt-1 text-base font-bold text-gray-900">{title}</h4>
      </div>
      <div className="space-y-2">
        {entries.map((entry) => (
          <div
            key={entry.key}
            className={`rounded-2xl border px-3 py-2 transition-colors ${
              entry.active
                ? "border-gray-900 bg-gray-900 text-white"
                : "border-gray-200 bg-gray-50 text-gray-800"
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-semibold">{entry.label}</span>
              <span
                className="rounded-full px-2 py-1 text-xs font-bold"
                style={{
                  backgroundColor: entry.active ? "rgba(255,255,255,0.16)" : accent,
                  color: entry.active ? "#fff" : "#111827",
                }}
              >
                {entry.code || "—"}
              </span>
            </div>
            <div className="mt-1 text-xs opacity-80">
              {entry.flow.toFixed(3)} flow
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PlaybackStream({
  network,
  coarseByFine,
}: {
  network: NetworkModel;
  coarseByFine: CoarseByFine;
}) {
  const step = network.walker.latestEncodedStep;

  return (
    <div className="rounded-3xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h3 className="m-0 text-lg font-bold text-gray-900">Random-walker playback</h3>
          <p className="m-0 mt-1 text-sm text-gray-600">
            The chips below show the exact emitted codeword stream for the latest move.
          </p>
        </div>
      </div>
      {step ? (
        <>
          <div className="mb-3 flex flex-wrap gap-2">
            {step.hierarchicalSegments.map((segment, index) => {
              const coarseId =
                segment.kind === "visit"
                  ? coarseByFine[paperToyFineByNodeId.get(segment.nodeId ?? -1) ?? 1]
                  : segment.modulePath[0] ?? 1;
              const color = scheme[(coarseId - 1) % scheme.length];
              const label =
                segment.kind === "visit"
                  ? `Node ${segment.nodeId}`
                  : formatModuleName(
                      segment.modulePath,
                      segment.modulePath.length > 1 ? "hierarchical" : "two-level",
                      coarseByFine,
                    );

              return (
                <div
                  key={`${segment.code}-${index}`}
                  className="rounded-full border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-900"
                  style={{
                    backgroundColor: `${color}22`,
                  }}
                >
                  <span className="mr-2 uppercase tracking-wide text-xs text-gray-500">
                    {segment.kind}
                  </span>
                  {segment.code} {label}
                </div>
              );
            })}
          </div>
          <div className="grid gap-3 text-sm text-gray-600 md:grid-cols-2">
            <div>
              One-level code for this visit:{" "}
              <strong className="text-gray-900">{step.oneLevelCode}</strong>
            </div>
            <div>
              Hierarchical bits on this move:{" "}
              <strong className="text-gray-900">{step.hierarchicalBits}</strong>
            </div>
          </div>
        </>
      ) : (
        <p className="m-0 text-sm text-gray-600">
          Start or step the walker to print the current codeword stream.
        </p>
      )}
    </div>
  );
}

function CodelengthMeter({
  activeLabel,
  activeNetwork,
  comparisonNetwork,
}: {
  activeLabel: string;
  activeNetwork: NetworkModel;
  comparisonNetwork: NetworkModel;
}) {
  const breakdown = buildBreakdownRows(activeNetwork);
  const activeTotal = activeNetwork.mapequation.codelength;
  const comparisonTotal = comparisonNetwork.mapequation.codelength;
  const delta = activeTotal - comparisonTotal;

  return (
    <div className="rounded-3xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="m-0 text-lg font-bold text-gray-900">Codelength meter</h3>
          <p className="m-0 mt-1 text-sm text-gray-600">
            Exact Map Equation codelength, broken down by codebook level.
          </p>
        </div>
        <HelpTooltip
          content={
            <>
              <div>
                Paper reference: two-level {PAPER_REFERENCE_CODELENGTHS.twoLevel} bits,
                hierarchical {PAPER_REFERENCE_CODELENGTHS.hierarchical} bits.
              </div>
              <div className="mt-2">
                The live values below come from this interactive reconstruction, so they may not match the paper exactly.
              </div>
            </>
          }
        />
      </div>
      <div className="mb-4 rounded-2xl bg-gray-900 px-4 py-4 text-white">
        <div className="text-xs uppercase tracking-[0.2em] text-gray-300">
          {activeLabel}
        </div>
        <div className="mt-2 text-3xl font-bold">{activeTotal.toFixed(3)} bits</div>
        <div className="mt-2 text-sm text-gray-300">
          {delta <= 0 ? "Better" : "Longer"} than the alternate view by{" "}
          {Math.abs(delta).toFixed(3)} bits
        </div>
      </div>
      <div className="space-y-3">
        {breakdown.map((row) => (
          <div key={row.label}>
            <div className="mb-1 flex items-center justify-between text-sm font-semibold text-gray-800">
              <span>{row.label}</span>
              <span>{row.value.toFixed(3)} bits</span>
            </div>
            <div className="h-3 rounded-full bg-gray-100">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${(row.value / activeTotal) * 100}%`,
                  backgroundColor: row.color,
                }}
              />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
        Alternate view: <strong className="text-gray-900">{comparisonTotal.toFixed(3)} bits</strong>
      </div>
    </div>
  );
}

function Breadcrumbs({
  comparisonMode,
  zoomPath,
  coarseByFine,
  onZoomPathChange,
}: {
  comparisonMode: ComparisonMode;
  zoomPath: number[];
  coarseByFine: CoarseByFine;
  onZoomPathChange: (path: number[]) => void;
}) {
  const items: Array<{ label: string; path: number[] }> = [
    { label: "Network", path: [] },
  ];

  if (comparisonMode === "hierarchical" && zoomPath[0]) {
    items.push({ label: `Module ${zoomPath[0]}`, path: [zoomPath[0]] });
  }

  if (comparisonMode === "hierarchical" && zoomPath[1]) {
    items.push({
      label: `Submodule ${getFineLabel(zoomPath[1], coarseByFine)}`,
      path: [zoomPath[0], zoomPath[1]],
    });
  }

  if (comparisonMode === "two-level" && zoomPath[0]) {
    items.push({ label: `Module ${zoomPath[0]}`, path: [zoomPath[0]] });
  }

  return (
    <div className="rounded-3xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
      <div className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">
        Drill-down breadcrumbs
      </div>
      <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-gray-700">
        {items.map((item, index) => (
          <div key={`${item.label}-${index}`} className="flex items-center gap-2">
            {index > 0 && <span className="text-gray-400">&gt;</span>}
            <button type="button" onClick={() => onZoomPathChange(item.path)}>
              {item.label}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function Editor({
  coarseByFine,
  selectedFineModules,
  onToggleSelection,
  onAssignToCoarse,
  onSpreadCoarse,
  onReset,
}: {
  coarseByFine: CoarseByFine;
  selectedFineModules: number[];
  onToggleSelection: (fineId: number) => void;
  onAssignToCoarse: (coarseId: number) => void;
  onSpreadCoarse: (coarseId: number) => void;
  onReset: () => void;
}) {
  return (
    <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h3 className="m-0 text-lg font-bold text-gray-900">Editable toy example</h3>
          <p className="m-0 mt-1 text-sm text-gray-600">
            Select fine modules, regroup them into a larger region, and watch the hierarchy and codelength update instantly.
          </p>
        </div>
        <Button className="button text-sm" onClick={onReset}>
          Reset paper grouping
        </Button>
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        {paperToyFineModules.map((module_) => {
          const coarseId = coarseByFine[module_.id];
          const selected = selectedFineModules.includes(module_.id);

          return (
            <button
              key={module_.id}
              type="button"
              className={`rounded-full border px-3 py-2 text-sm font-semibold transition-colors ${
                selected
                  ? "border-gray-900 bg-gray-900 text-white"
                  : "border-gray-200 bg-gray-50 text-gray-800"
              }`}
              style={{
                boxShadow: selected ? "none" : `inset 0 0 0 999px ${scheme[(coarseId - 1) % scheme.length]}18`,
              }}
              onClick={() => onToggleSelection(module_.id)}
            >
              Fine {module_.id} in Module {coarseId}
            </button>
          );
        })}
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
          <div className="mb-3 text-sm font-semibold text-gray-900">
            Merge selected fine modules into:
          </div>
          <div className="flex flex-wrap gap-2">
            {[1, 2, 3].map((coarseId) => (
              <Button
                key={coarseId}
                className="button text-sm"
                onClick={() => onAssignToCoarse(coarseId)}
              >
                Module {coarseId}
              </Button>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
          <div className="mb-3 text-sm font-semibold text-gray-900">
            Guided split action:
          </div>
          <div className="flex flex-wrap gap-2">
            {[1, 2, 3].map((coarseId) => (
              <Button
                key={coarseId}
                className="button text-sm"
                onClick={() => onSpreadCoarse(coarseId)}
              >
                Spread Module {coarseId}
              </Button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const HierarchicalCodebooks = observer(function HierarchicalCodebooks() {
  const [comparisonMode, setComparisonMode] =
    useState<ComparisonMode>("hierarchical");
  const [zoomPath, setZoomPath] = useState<number[]>([]);
  const [selectedFineModules, setSelectedFineModules] = useState<number[]>([]);
  const [speed, setSpeed] = useState(DEFAULT_SPEED);
  const [coarseByFine, setCoarseByFine] = useState<CoarseByFine>(() =>
    cloneCoarseByFine(defaultCoarseByFine),
  );
  const [twoLevelNetwork] = useState(() => createDemoNetwork());
  const [hierarchicalNetwork] = useState(() => createDemoNetwork());

  useEffect(() => {
    applyComparisonMode(twoLevelNetwork, "two-level", coarseByFine);
    applyComparisonMode(hierarchicalNetwork, "hierarchical", coarseByFine);
  }, [coarseByFine, hierarchicalNetwork, twoLevelNetwork]);

  useEffect(() => {
    twoLevelNetwork.walker.setSpeed(speed);
    hierarchicalNetwork.walker.setSpeed(speed);
  }, [hierarchicalNetwork, speed, twoLevelNetwork]);

  useEffect(
    () => () => {
      twoLevelNetwork.walker.stop();
      hierarchicalNetwork.walker.stop();
    },
    [hierarchicalNetwork, twoLevelNetwork],
  );

  useEffect(() => {
    twoLevelNetwork.walker.stop();
    hierarchicalNetwork.walker.stop();
    setZoomPath([]);
  }, [comparisonMode, hierarchicalNetwork, twoLevelNetwork]);

  const activeNetwork =
    comparisonMode === "hierarchical" ? hierarchicalNetwork : twoLevelNetwork;
  const comparisonNetwork =
    comparisonMode === "hierarchical" ? twoLevelNetwork : hierarchicalNetwork;
  const activeTreeVersion = activeNetwork.treeUpdateCounter;
  const comparisonTreeVersion = comparisonNetwork.treeUpdateCounter;
  const fineModules = buildFineModuleStats(activeNetwork, coarseByFine);
  const coarseModules = buildCoarseModuleStats(fineModules);
  const activeSegments =
    activeNetwork.walker.latestEncodedStep?.hierarchicalSegments ?? [];
  const activeSegmentKeys = buildActiveSegmentKeys(activeSegments);
  const focusedFineId =
    comparisonMode === "two-level"
      ? zoomPath[0] ?? getCurrentFineId(activeNetwork) ?? 1
      : zoomPath[1] ?? getCurrentFineId(activeNetwork) ?? 1;
  const focusedCoarseId =
    comparisonMode === "hierarchical"
      ? zoomPath[0] ?? coarseByFine[focusedFineId]
      : coarseByFine[focusedFineId];
  const rootEntries = buildIndexEntries(
    activeNetwork.tree.root,
    comparisonMode,
    coarseByFine,
    activeSegmentKeys,
  );
  const subindexEntries =
    comparisonMode === "hierarchical"
      ? buildIndexEntries(
          activeNetwork.tree.getModule([focusedCoarseId]),
          comparisonMode,
          coarseByFine,
          activeSegmentKeys,
        )
      : [];
  const leafEntries = buildLeafEntries(
    activeNetwork.tree.getModule(
      getFinePath(comparisonMode, focusedFineId, coarseByFine),
    ),
    activeSegmentKeys,
  );

  void activeTreeVersion;
  void comparisonTreeVersion;

  return (
    <section id="hierarchical-codebooks" className="col-span-4 mb-48">
      <div className="mb-8 max-w-4xl">
        <h2>Hierarchical codebooks</h2>
        <p>
          The paper&apos;s key idea is that hierarchy matters when fine modules are
          themselves grouped into larger regions. Then the walker can spend a long
          time inside one large region, and the extra index level pays off because
          we do not need to repeatedly identify the active fine-level codebook from
          scratch.
        </p>
        <p>
          In Rosvall and Bergstrom&apos;s toy example, the hierarchical description is
          shorter than the two-level one, reducing codelength from{" "}
          <strong>{PAPER_REFERENCE_CODELENGTHS.twoLevel.toFixed(2)}</strong> to{" "}
          <strong>{PAPER_REFERENCE_CODELENGTHS.hierarchical.toFixed(2)}</strong>{" "}
          bits. This section keeps that paper-first framing, but turns it into a
          live explorer so you can zoom, regroup modules, and watch the codebooks
          update in real time.
        </p>
      </div>

      <div className="mb-6 flex flex-col gap-3 rounded-3xl border border-gray-200 bg-white px-5 py-4 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">
            Comparison mode
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button
              className={`button text-sm ${comparisonMode === "two-level" ? "button--primary" : ""}`}
              onClick={() => setComparisonMode("two-level")}
            >
              Two-level
            </Button>
            <Button
              className={`button text-sm ${comparisonMode === "hierarchical" ? "button--primary" : ""}`}
              onClick={() => setComparisonMode("hierarchical")}
            >
              Hierarchical
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button className="button text-sm" onClick={() => activeNetwork.walker.reset()}>
            Reset walk
          </Button>
          <Button className="button text-sm" onClick={() => activeNetwork.walker.step()}>
            Step
          </Button>
          <Button
            className="button text-sm"
            onClick={() =>
              activeNetwork.walker.isStarted
                ? activeNetwork.walker.stop()
                : activeNetwork.walker.start()
            }
          >
            {activeNetwork.walker.isStarted ? "Stop walk" : "Start walk"}
          </Button>
          <Button
            className={`button text-sm ${activeNetwork.walker.teleportationEnabled ? "button--primary" : ""}`}
            onClick={() => {
              twoLevelNetwork.walker.toggleRandomTeleportation();
              hierarchicalNetwork.walker.toggleRandomTeleportation();
            }}
          >
            {activeNetwork.walker.teleportationEnabled
              ? "Teleportation on"
              : "Teleportation off"}
          </Button>
          <label className="flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
            <span>Speed</span>
            <input
              type="range"
              min={1}
              max={6}
              step={1}
              value={speed}
              onChange={(event) => setSpeed(Number(event.target.value))}
            />
            <span>{speed}x</span>
          </label>
        </div>
      </div>

      <OverviewStrip
        coarseModules={coarseModules}
        coarseByFine={coarseByFine}
        comparisonMode={comparisonMode}
        onZoom={setZoomPath}
      />

      <div className="mt-8 grid gap-6 xl:grid-cols-[1.3fr_1fr]">
        <div className="space-y-6">
          <HierarchyMap
            network={activeNetwork}
            comparisonMode={comparisonMode}
            coarseByFine={coarseByFine}
            zoomPath={zoomPath}
            fineModules={fineModules}
            coarseModules={coarseModules}
            onZoomPathChange={setZoomPath}
          />
          <Editor
            coarseByFine={coarseByFine}
            selectedFineModules={selectedFineModules}
            onToggleSelection={(fineId) =>
              setSelectedFineModules((current) =>
                current.includes(fineId)
                  ? current.filter((id) => id !== fineId)
                  : [...current, fineId].sort((left, right) => left - right),
              )
            }
            onAssignToCoarse={(coarseId) => {
              if (selectedFineModules.length === 0) {
                return;
              }

              setCoarseByFine((current) => {
                const next = cloneCoarseByFine(current);
                selectedFineModules.forEach((fineId) => {
                  next[fineId] = coarseId;
                });
                return next;
              });
            }}
            onSpreadCoarse={(coarseId) =>
              setCoarseByFine((current) => {
                const next = cloneCoarseByFine(current);
                const fineIds = getFineIdsForCoarse(coarseId, current);

                fineIds.forEach((fineId, index) => {
                  next[fineId] = (index % 3) + 1;
                });

                return next;
              })
            }
            onReset={() => {
              setCoarseByFine(cloneCoarseByFine(defaultCoarseByFine));
              setSelectedFineModules([]);
            }}
          />
        </div>
        <div className="space-y-6">
          <Breadcrumbs
            comparisonMode={comparisonMode}
            zoomPath={zoomPath}
            coarseByFine={coarseByFine}
            onZoomPathChange={setZoomPath}
          />
          <PlaybackStream network={activeNetwork} coarseByFine={coarseByFine} />
          <div className="grid gap-4">
            <CodebookCard
              title={
                comparisonMode === "hierarchical"
                  ? "Top-level index codebook"
                  : "Index codebook"
              }
              subtitle="Live codebook panel"
              entries={rootEntries}
              accent={`${scheme[0]}22`}
            />
            {comparisonMode === "hierarchical" && (
              <CodebookCard
                title={`Module ${focusedCoarseId} subindex`}
                subtitle="Active subindex"
                entries={subindexEntries}
                accent={`${scheme[(focusedCoarseId - 1) % scheme.length]}22`}
              />
            )}
            <CodebookCard
              title={
                comparisonMode === "hierarchical"
                  ? `Submodule ${getFineLabel(focusedFineId, coarseByFine)} codebook`
                  : `Module ${focusedFineId} codebook`
              }
              subtitle="Active leaf codebook"
              entries={leafEntries}
              accent={`${scheme[(coarseByFine[focusedFineId] - 1) % scheme.length]}22`}
            />
          </div>
          <CodelengthMeter
            activeLabel={
              comparisonMode === "hierarchical"
                ? "Hierarchical view"
                : "Two-level view"
            }
            activeNetwork={activeNetwork}
            comparisonNetwork={comparisonNetwork}
          />
        </div>
      </div>
    </section>
  );
});

export default HierarchicalCodebooks;
