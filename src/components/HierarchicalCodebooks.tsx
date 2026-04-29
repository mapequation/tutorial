import { useEffect, useMemo, useRef, useState } from "react";
import type { Network as NetworkModel } from "../model";
import type { TreeNode } from "../model/algorithms/Tree";
import { Network } from "../model";
import { EnterFlow, ExitFlow } from "./CodeBooks";
import Flow from "./CodeBooks/Flow";
import { darkenHexColor, scheme, schemeAlt } from "./scheme";
import {
  hierarchical_paper_toy,
  paperToyDefaultCoarseByFine,
  paperToyFineModules,
} from "../networks";

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

interface SvgViewBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface CodelengthRow {
  group: "Multilevel" | "Two-level";
  label: string;
  value: number;
  color: string;
  muted?: boolean;
}

interface CodebookEntry {
  key: string;
  kind: "enter" | "exit" | "visit";
  label: string;
  code: string;
  flow: number;
  color: string;
}

interface CodebookSection {
  key: string;
  title: string;
  entries: CodebookEntry[];
}

interface CodebookPanelData {
  title: string;
  indexOneSections: CodebookSection[];
  indexTwoSections: CodebookSection[];
  moduleSections: CodebookSection[];
}

const paperToyFineByNodeId = new Map<number, number>();
const paperToyFineById = new Map(
  paperToyFineModules.map((module_) => [module_.id, module_]),
);
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

const ROOT_MODULE_RADIUS = 78;
const FINE_MODULE_RADIUS = 18;
const LEAF_MODULE_RADIUS = 5.2;
const TOP_VIEW_FINE_RADIUS = 12;
const TOP_VIEW_LEAF_RADIUS = 2.4;
const COARSE_VIEW_LEAF_RADIUS = 3.2;
const LINK_STROKE_WIDTH = 1.15;
const ZOOM_VIEWBOX_PADDING = 2.35;
const ZOOM_DURATION_MS = 1450;
const VIEWBOX_ASPECT = VIEWBOX.width / VIEWBOX.height;

const ROOT_VIEWBOX: SvgViewBox = {
  x: 0,
  y: 0,
  width: VIEWBOX.width,
  height: VIEWBOX.height,
};

const rootModuleCenters: Record<number, { x: number; y: number }> = {
  1: { x: 96, y: 90 },
  2: { x: 704, y: 90 },
  3: { x: 400, y: 470 },
};

const TWO_LEVEL_INTER_LINK_COLOR = "#9ca3af";

const fineModuleOffsets = [
  { x: -30, y: -18 },
  { x: 30, y: -16 },
  { x: 0, y: 34 },
] as const;

const leafModuleOffsets = [
  { x: -8.5, y: 6.2 },
  { x: 8.5, y: 6.2 },
  { x: 0, y: -9.3 },
] as const;

function cloneCoarseByFine(source: CoarseByFine): CoarseByFine {
  return { ...source };
}

function createDemoNetwork(): NetworkModel {
  return Network.parse(hierarchical_paper_toy).setNodeExtents(
    [90, 710],
    [80, 500],
  );
}

function createTwoLevelNetwork(): NetworkModel {
  const network = Network.parse(hierarchical_paper_toy);

  paperToyFineModules.forEach((module_) => {
    module_.nodeIds.forEach((nodeId) => {
      network.getNode(nodeId)?.setPath([module_.id]);
    });
  });

  network.finalize();

  return network.setNodeExtents([90, 710], [80, 500]);
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
    nodes.length > 0 ? nodes.reduce((total, node) => total + node.flow, 0) : 0;
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
      ? Math.max(...nodes.map((node) => Math.hypot(node.x - x, node.y - y))) +
        34
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
          ? modules.reduce(
              (sum, module_) => sum + module_.x * module_.flow,
              0,
            ) / totalFlow
          : modules.reduce((sum, module_) => sum + module_.x, 0) /
            modules.length;
      const y =
        totalFlow > 0
          ? modules.reduce(
              (sum, module_) => sum + module_.y * module_.flow,
              0,
            ) / totalFlow
          : modules.reduce((sum, module_) => sum + module_.y, 0) /
            modules.length;
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

function getRadialOffset(index: number, total: number, radius: number) {
  const angle = -Math.PI / 2 + (index / Math.max(1, total)) * Math.PI * 2;

  return {
    x: Math.cos(angle) * radius,
    y: Math.sin(angle) * radius,
  };
}

function getCoarseDisplayCenter(coarseId: number) {
  return (
    rootModuleCenters[coarseId] ?? {
      x: VIEWBOX.width / 2,
      y: VIEWBOX.height / 2,
    }
  );
}

function getFineDisplayCenter(
  module_: FineModuleStat,
  coarseByFine: CoarseByFine,
) {
  const coarseCenter = getCoarseDisplayCenter(module_.coarseId);
  const fineIds = getFineIdsForCoarse(module_.coarseId, coarseByFine);
  const index = Math.max(0, fineIds.indexOf(module_.id));
  const offset =
    fineModuleOffsets[index] ??
    getRadialOffset(index, fineIds.length, ROOT_MODULE_RADIUS * 0.48);

  return {
    x: coarseCenter.x + offset.x,
    y: coarseCenter.y + offset.y,
  };
}

function getLeafDisplayCenter(
  module_: FineModuleStat,
  nodeId: number,
  coarseByFine: CoarseByFine,
) {
  const fineCenter = getFineDisplayCenter(module_, coarseByFine);
  const index = Math.max(0, module_.nodeIds.indexOf(nodeId));
  const offset =
    leafModuleOffsets[index] ??
    getRadialOffset(index, module_.nodeIds.length, FINE_MODULE_RADIUS * 0.52);

  return {
    x: fineCenter.x + offset.x,
    y: fineCenter.y + offset.y,
  };
}

function getTwoLevelFineDisplayCenter(module_: FineModuleStat) {
  return getFineDisplayCenter(module_, defaultCoarseByFine);
}

function getTwoLevelLeafDisplayCenter(module_: FineModuleStat, nodeId: number) {
  return getLeafDisplayCenter(module_, nodeId, defaultCoarseByFine);
}

function hexToRgb(hexColor: string) {
  const parsed = Number.parseInt(hexColor.replace("#", ""), 16);

  return {
    r: (parsed >> 16) & 255,
    g: (parsed >> 8) & 255,
    b: parsed & 255,
  };
}

function rgbToHex({ r, g, b }: { r: number; g: number; b: number }) {
  return `#${[r, g, b]
    .map((value) =>
      Math.max(0, Math.min(255, Math.round(value)))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

function mixHexColor(color: string, target: string, amount: number) {
  const from = hexToRgb(color);
  const to = hexToRgb(target);
  const clampedAmount = Math.max(0, Math.min(1, amount));

  return rgbToHex({
    r: from.r + (to.r - from.r) * clampedAmount,
    g: from.g + (to.g - from.g) * clampedAmount,
    b: from.b + (to.b - from.b) * clampedAmount,
  });
}

function getModuleBaseColor(moduleId: number) {
  return scheme[moduleId % scheme.length] ?? scheme[0];
}

function getLevelColor(moduleId: number, level: 1 | 2 | 3) {
  const base = getModuleBaseColor(moduleId);

  if (level === 1) {
    return base;
  }

  if (level === 2) {
    return mixHexColor(base, "#ffffff", 0.24);
  }

  return darkenHexColor(base, 0.14);
}

function getLevelStrokeColor(moduleId: number, level: 1 | 2 | 3) {
  const base = schemeAlt[moduleId % schemeAlt.length] ?? schemeAlt[0];

  return level === 3 ? darkenHexColor(base, 0.08) : base;
}

function edgePoint(
  from: { x: number; y: number },
  to: { x: number; y: number },
  radius: number,
) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const distance = Math.hypot(dx, dy) || 1;

  return {
    x: from.x + (dx / distance) * radius,
    y: from.y + (dy / distance) * radius,
  };
}

function getFocusViewBox(
  center: { x: number; y: number },
  radius: number,
): SvgViewBox {
  const height = radius * ZOOM_VIEWBOX_PADDING;
  const width = height * VIEWBOX_ASPECT;

  return {
    x: center.x - width / 2,
    y: center.y - height / 2,
    width,
    height,
  };
}

function formatViewBox(viewBox: SvgViewBox) {
  return `${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`;
}

function easeInOutCubic(value: number) {
  return value < 0.5
    ? 4 * value * value * value
    : 1 - Math.pow(-2 * value + 2, 3) / 2;
}

function interpolateViewBox(
  start: SvgViewBox,
  end: SvgViewBox,
  progress: number,
): SvgViewBox {
  return {
    x: start.x + (end.x - start.x) * progress,
    y: start.y + (end.y - start.y) * progress,
    width: start.width + (end.width - start.width) * progress,
    height: start.height + (end.height - start.height) * progress,
  };
}

function useAnimatedViewBox(target: SvgViewBox) {
  const [animatedViewBox, setAnimatedViewBox] = useState(target);
  const currentViewBox = useRef(target);
  const frame = useRef<number | null>(null);

  useEffect(() => {
    if (frame.current !== null) {
      window.cancelAnimationFrame(frame.current);
    }

    const start = currentViewBox.current;
    const startTime = window.performance.now();

    const animate = (time: number) => {
      const elapsed = time - startTime;
      const progress = Math.min(1, elapsed / ZOOM_DURATION_MS);
      const easedProgress = easeInOutCubic(progress);
      const nextViewBox = interpolateViewBox(start, target, easedProgress);

      currentViewBox.current = nextViewBox;
      setAnimatedViewBox(nextViewBox);

      if (progress < 1) {
        frame.current = window.requestAnimationFrame(animate);
        return;
      }

      currentViewBox.current = target;
      setAnimatedViewBox(target);
      frame.current = null;
    };

    frame.current = window.requestAnimationFrame(animate);

    return () => {
      if (frame.current !== null) {
        window.cancelAnimationFrame(frame.current);
      }
    };
  }, [target.x, target.y, target.width, target.height]);

  return animatedViewBox;
}

function buildCodelengthRows(
  hierarchicalNetwork: NetworkModel,
  twoLevelNetwork: NetworkModel,
): CodelengthRow[] {
  let topIndex = 0;
  let subIndex = 0;
  let leafCodebooks = 0;

  for (const module_ of hierarchicalNetwork.tree.depthFirstModules()) {
    if (module_.isLeafModule) {
      leafCodebooks += module_.codelength;
      continue;
    }

    if (module_.depth === 0) {
      topIndex += module_.codelength;
      continue;
    }

    subIndex += module_.codelength;
  }

  return [
    {
      group: "Multilevel",
      label: "Index codebook 1",
      value: topIndex,
      color: getLevelColor(1, 1),
    },
    {
      group: "Multilevel",
      label: "Index codebook 2",
      value: subIndex,
      color: getLevelColor(2, 2),
    },
    {
      group: "Multilevel",
      label: "Module codebook",
      value: leafCodebooks,
      color: getLevelColor(3, 3),
    },
    {
      group: "Multilevel",
      label: "Multilevel total",
      value: hierarchicalNetwork.mapequation.codelength,
      color: "#1f2937",
    },
    {
      group: "Two-level",
      label: "Index codebook 1",
      value: twoLevelNetwork.mapequation.indexCodelength,
      color: TWO_LEVEL_INTER_LINK_COLOR,
      muted: true,
    },
    {
      group: "Two-level",
      label: "Index codebook 2",
      value: 0,
      color: getLevelColor(4, 2),
      muted: true,
    },
    {
      group: "Two-level",
      label: "Module codebook",
      value: twoLevelNetwork.mapequation.moduleCodelength,
      color: getLevelColor(4, 3),
      muted: true,
    },
    {
      group: "Two-level",
      label: "Two-level total",
      value: twoLevelNetwork.mapequation.codelength,
      color: getLevelColor(4, 1),
      muted: true,
    },
  ];
}

function CodelengthOverview({ rows }: { rows: CodelengthRow[] }) {
  const maxValue = Math.max(...rows.map((row) => row.value), 1);

  return (
    <div className="space-y-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="m-0 text-lg font-bold text-gray-900">
          Mini overview strip
        </h3>
        <div className="text-xs text-gray-500">
          Codelength contribution by hierarchy level, with the flat two-level
          alternative for comparison.
        </div>
      </div>
      <div className="grid gap-3 lg:grid-cols-4 xl:grid-cols-8">
        {rows.map((row) => (
          <div key={row.label} className="min-w-0 py-2">
            <div className="mb-2 flex items-baseline justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-gray-900">
                  {row.label}
                </div>
                <div className="text-[11px] font-semibold text-gray-500">
                  {row.group}
                </div>
              </div>
              <div className="text-xs font-semibold text-gray-600">
                {row.value.toFixed(3)} bits
              </div>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-gray-200">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.max(2, (row.value / maxValue) * 100)}%`,
                  backgroundColor: row.color,
                  opacity: row.muted ? 0.72 : 1,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function getCurrentLevelLabel(
  selectedCoarse: CoarseModuleStat | null,
  selectedFine: FineModuleStat | null,
) {
  if (selectedFine) {
    return `Current level: level 3 nodes in submodule ${selectedFine.label}`;
  }

  if (selectedCoarse) {
    return `Current level: level 2 modules inside module ${selectedCoarse.id}`;
  }

  return "Current level: level 1 top modules";
}

function HierarchyMap({
  network,
  coarseByFine,
  zoomPath,
  fineModules,
  coarseModules,
  onZoomPathChange,
}: {
  network: NetworkModel;
  coarseByFine: CoarseByFine;
  zoomPath: number[];
  fineModules: FineModuleStat[];
  coarseModules: CoarseModuleStat[];
  onZoomPathChange: (path: number[]) => void;
}) {
  const zoomedCoarseId = zoomPath[0] ?? null;
  const zoomedFineId = zoomPath[1] ?? null;
  const selectedFine = zoomedFineId
    ? (fineModules.find((module_) => module_.id === zoomedFineId) ?? null)
    : null;
  const selectedCoarse = zoomedCoarseId
    ? (coarseModules.find((module_) => module_.id === zoomedCoarseId) ?? null)
    : null;
  const targetViewBox = selectedFine
    ? getFocusViewBox(
        getFineDisplayCenter(selectedFine, coarseByFine),
        FINE_MODULE_RADIUS,
      )
    : selectedCoarse
      ? getFocusViewBox(
          getCoarseDisplayCenter(selectedCoarse.id),
          ROOT_MODULE_RADIUS,
        )
      : ROOT_VIEWBOX;
  const viewBox = useAnimatedViewBox(targetViewBox);
  const fineModuleById = useMemo(
    () => new Map(fineModules.map((module_) => [module_.id, module_])),
    [fineModules],
  );
  const visibleFineModules = selectedCoarse
    ? selectedCoarse.fineModules
    : fineModules;
  const getFineRadius = () =>
    selectedCoarse ? FINE_MODULE_RADIUS : TOP_VIEW_FINE_RADIUS;
  const getLeafRadius = (module_: FineModuleStat) =>
    selectedFine?.id === module_.id
      ? LEAF_MODULE_RADIUS
      : selectedCoarse
        ? COARSE_VIEW_LEAF_RADIUS
        : TOP_VIEW_LEAF_RADIUS;

  return (
    <div className="space-y-3">
      <div className="mb-3 flex flex-col gap-2">
        <div>
          <h3 className="m-0 text-base font-bold text-gray-900">
            Multilevel network view
          </h3>
          <p className="m-0 mt-1 text-sm text-gray-600">
            Three levels of nested modules.
          </p>
        </div>
        <div>
          <div className="flex gap-2">
            <button
              type="button"
              className="rounded-md px-2 py-1 text-sm font-semibold text-gray-800 underline-offset-4 hover:underline disabled:cursor-default disabled:text-gray-400 disabled:no-underline"
              disabled={zoomPath.length === 0}
              onClick={() =>
                onZoomPathChange(zoomPath.length === 2 ? [zoomPath[0]] : [])
              }
            >
              Zoom out
            </button>
            <button
              type="button"
              className="rounded-md px-2 py-1 text-sm font-semibold text-gray-800 underline-offset-4 hover:underline disabled:cursor-default disabled:text-gray-400 disabled:no-underline"
              disabled={zoomPath.length === 0}
              onClick={() => onZoomPathChange([])}
            >
              Home
            </button>
          </div>
          <div className="mt-1 text-xs font-semibold text-gray-500">
            {getCurrentLevelLabel(selectedCoarse, selectedFine)}
          </div>
        </div>
      </div>
      <svg
        viewBox={formatViewBox(viewBox)}
        className="block w-full overflow-hidden"
        style={{ aspectRatio: `${VIEWBOX.width} / ${VIEWBOX.height}` }}
      >
        {network.links.map((link, index) => {
          const sourceFineId = paperToyFineByNodeId.get(link.source.id);
          const targetFineId = paperToyFineByNodeId.get(link.target.id);

          if (!sourceFineId || !targetFineId) {
            return null;
          }

          const sourceModule = fineModuleById.get(sourceFineId);
          const targetModule = fineModuleById.get(targetFineId);

          if (!sourceModule || !targetModule) {
            return null;
          }

          const sourceCoarseId = coarseByFine[sourceFineId];
          const targetCoarseId = coarseByFine[targetFineId];
          const linkLevel = selectedFine ? 3 : selectedCoarse ? 2 : 1;
          const visible =
            linkLevel === 1
              ? sourceCoarseId !== targetCoarseId
              : linkLevel === 2
                ? sourceFineId !== targetFineId &&
                  (sourceCoarseId === selectedCoarse?.id ||
                    targetCoarseId === selectedCoarse?.id)
                : sourceFineId === selectedFine?.id ||
                  targetFineId === selectedFine?.id;

          if (!visible) {
            return null;
          }

          const sourceCenter =
            linkLevel === 1
              ? getCoarseDisplayCenter(sourceCoarseId)
              : linkLevel === 2
                ? getFineDisplayCenter(sourceModule, coarseByFine)
                : getLeafDisplayCenter(
                    sourceModule,
                    link.source.id,
                    coarseByFine,
                  );
          const targetCenter =
            linkLevel === 1
              ? getCoarseDisplayCenter(targetCoarseId)
              : linkLevel === 2
                ? getFineDisplayCenter(targetModule, coarseByFine)
                : getLeafDisplayCenter(
                    targetModule,
                    link.target.id,
                    coarseByFine,
                  );
          const sourceRadius =
            linkLevel === 1
              ? ROOT_MODULE_RADIUS
              : linkLevel === 2
                ? FINE_MODULE_RADIUS
                : getLeafRadius(sourceModule);
          const targetRadius =
            linkLevel === 1
              ? ROOT_MODULE_RADIUS
              : linkLevel === 2
                ? FINE_MODULE_RADIUS
                : getLeafRadius(targetModule);
          const source = edgePoint(sourceCenter, targetCenter, sourceRadius);
          const target = edgePoint(targetCenter, sourceCenter, targetRadius);
          const sourceColorId = linkLevel === 1 ? sourceCoarseId : sourceFineId;
          const targetColorId = linkLevel === 1 ? targetCoarseId : targetFineId;
          const stroke =
            sourceColorId === targetColorId
              ? getLevelColor(sourceColorId, linkLevel)
              : TWO_LEVEL_INTER_LINK_COLOR;

          return (
            <line
              key={`hierarchy-link-${link.source.id}-${link.target.id}-${index}`}
              x1={source.x}
              y1={source.y}
              x2={target.x}
              y2={target.y}
              stroke={stroke}
              strokeLinecap="round"
              strokeWidth={LINK_STROKE_WIDTH}
              vectorEffect="non-scaling-stroke"
              opacity={0.68}
            />
          );
        })}
        {coarseModules.map((module_) => {
          const center = getCoarseDisplayCenter(module_.id);
          const visible = !selectedCoarse || selectedCoarse.id === module_.id;

          if (!visible) {
            return null;
          }

          return (
            <g
              key={`coarse-${module_.id}`}
              className="cursor-pointer transition-opacity hover:opacity-95"
              onClick={() => onZoomPathChange([module_.id])}
            >
              <circle
                cx={center.x}
                cy={center.y}
                r={ROOT_MODULE_RADIUS}
                fill={getLevelColor(module_.id, 1)}
                fillOpacity={selectedCoarse ? 0.1 : 0.18}
                stroke={getLevelStrokeColor(module_.id, 1)}
                strokeWidth={1.4}
                vectorEffect="non-scaling-stroke"
              />
              {!selectedCoarse && (
                <text
                  x={center.x}
                  y={center.y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={16}
                  fontWeight={700}
                  fill="#1f2937"
                  pointerEvents="none"
                >
                  {module_.id}
                </text>
              )}
            </g>
          );
        })}
        {visibleFineModules.map((module_) => {
          const center = getFineDisplayCenter(module_, coarseByFine);
          const selected = selectedFine?.id === module_.id;
          const fineRadius = getFineRadius();

          return (
            <g
              key={`fine-${module_.id}`}
              className="cursor-pointer transition-opacity hover:opacity-95"
              onClick={() => onZoomPathChange([module_.coarseId, module_.id])}
            >
              <circle
                cx={center.x}
                cy={center.y}
                r={fineRadius}
                fill={getLevelColor(module_.id, 2)}
                fillOpacity={selected ? 0.42 : selectedCoarse ? 0.34 : 0.28}
                stroke={getLevelStrokeColor(module_.id, 2)}
                strokeWidth={selectedCoarse ? 1.2 : 0.9}
                vectorEffect="non-scaling-stroke"
              />
              {selectedCoarse && !selectedFine && (
                <text
                  x={center.x}
                  y={center.y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={5}
                  fontWeight={700}
                  fill="#1f2937"
                  pointerEvents="none"
                >
                  {module_.label}
                </text>
              )}
            </g>
          );
        })}
        {visibleFineModules.flatMap((module_) =>
          module_.nodeIds.map((nodeId, index) => {
            const node = network.getNode(nodeId);
            const leafCenter = getLeafDisplayCenter(
              module_,
              nodeId,
              coarseByFine,
            );
            const isSelectedFine = selectedFine?.id === module_.id;
            const leafRadius = getLeafRadius(module_);

            return (
              <g key={`leaf-${nodeId}`}>
                <circle
                  cx={leafCenter.x}
                  cy={leafCenter.y}
                  r={leafRadius}
                  fill={getLevelColor(module_.id, 3)}
                  fillOpacity={isSelectedFine ? 0.82 : 0.74}
                  stroke={getLevelStrokeColor(module_.id, 3)}
                  strokeWidth={0.8}
                  vectorEffect="non-scaling-stroke"
                />
                {isSelectedFine && (
                  <text
                    x={leafCenter.x}
                    y={leafCenter.y}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize={1.9}
                    fontWeight={700}
                    fill="#1f2937"
                    pointerEvents="none"
                  >
                    {node?.name ?? `${module_.label}.${index + 1}`}
                  </text>
                )}
              </g>
            );
          }),
        )}
        {selectedFine && (
          <text
            x={getFineDisplayCenter(selectedFine, coarseByFine).x}
            y={getFineDisplayCenter(selectedFine, coarseByFine).y + 8.8}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={2.4}
            fontWeight={700}
            fill="#1f2937"
            pointerEvents="none"
          >
            {selectedFine.label}
          </text>
        )}
        {selectedCoarse && !selectedFine && (
          <text
            x={getCoarseDisplayCenter(selectedCoarse.id).x}
            y={getCoarseDisplayCenter(selectedCoarse.id).y + 30}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={6}
            fontWeight={700}
            fill="#1f2937"
            pointerEvents="none"
          >
            Module {selectedCoarse.id}
          </text>
        )}
      </svg>
    </div>
  );
}

function TwoLevelNetworkView({
  network,
  fineModules,
  zoomPath,
  onZoomPathChange,
}: {
  network: NetworkModel;
  fineModules: FineModuleStat[];
  zoomPath: number[];
  onZoomPathChange: (path: number[]) => void;
}) {
  const fineModuleById = useMemo(
    () => new Map(fineModules.map((module_) => [module_.id, module_])),
    [fineModules],
  );
  const zoomedFineId = zoomPath[0] ?? null;
  const selectedFine = zoomedFineId
    ? (fineModules.find((module_) => module_.id === zoomedFineId) ?? null)
    : null;
  const targetViewBox = selectedFine
    ? getFocusViewBox(
        getTwoLevelFineDisplayCenter(selectedFine),
        FINE_MODULE_RADIUS,
      )
    : ROOT_VIEWBOX;
  const viewBox = useAnimatedViewBox(targetViewBox);

  return (
    <div className="space-y-3">
      <div className="mb-3 flex flex-col gap-2">
        <div>
          <h3 className="m-0 text-base font-bold text-gray-900">
            Two-level network view
          </h3>
          <p className="m-0 mt-1 text-sm text-gray-600">
            The same node positions without the intermediate top modules.
          </p>
        </div>
        <div>
          <div className="flex gap-2">
            <button
              type="button"
              className="rounded-md px-2 py-1 text-sm font-semibold text-gray-800 underline-offset-4 hover:underline disabled:cursor-default disabled:text-gray-400 disabled:no-underline"
              disabled={zoomPath.length === 0}
              onClick={() => onZoomPathChange([])}
            >
              Zoom out
            </button>
            <button
              type="button"
              className="rounded-md px-2 py-1 text-sm font-semibold text-gray-800 underline-offset-4 hover:underline disabled:cursor-default disabled:text-gray-400 disabled:no-underline"
              disabled={zoomPath.length === 0}
              onClick={() => onZoomPathChange([])}
            >
              Home
            </button>
          </div>
          <div className="mt-1 text-xs font-semibold text-gray-500">
            {selectedFine
              ? `Current level: nodes in module ${selectedFine.label}`
              : "Current level: fine modules"}
          </div>
        </div>
      </div>
      <svg
        viewBox={formatViewBox(viewBox)}
        className="block w-full overflow-hidden"
        style={{ aspectRatio: `${VIEWBOX.width} / ${VIEWBOX.height}` }}
        role="img"
        aria-label="Two-level network comparison"
      >
        {network.links.map((link, index) => {
          const sourceFineId = paperToyFineByNodeId.get(link.source.id);
          const targetFineId = paperToyFineByNodeId.get(link.target.id);

          if (!sourceFineId || !targetFineId) {
            return null;
          }

          const sourceModule = fineModuleById.get(sourceFineId);
          const targetModule = fineModuleById.get(targetFineId);

          if (!sourceModule || !targetModule) {
            return null;
          }

          const visible =
            !selectedFine ||
            sourceFineId === selectedFine.id ||
            targetFineId === selectedFine.id;

          if (!visible) {
            return null;
          }

          const linkLevel = selectedFine
            ? 3
            : sourceFineId === targetFineId
              ? 3
              : 2;
          const sourceCenter =
            linkLevel === 3
              ? getTwoLevelLeafDisplayCenter(sourceModule, link.source.id)
              : getTwoLevelFineDisplayCenter(sourceModule);
          const targetCenter =
            linkLevel === 3
              ? getTwoLevelLeafDisplayCenter(targetModule, link.target.id)
              : getTwoLevelFineDisplayCenter(targetModule);
          const sourceRadius =
            linkLevel === 3 ? TOP_VIEW_LEAF_RADIUS : TOP_VIEW_FINE_RADIUS;
          const targetRadius =
            linkLevel === 3 ? TOP_VIEW_LEAF_RADIUS : TOP_VIEW_FINE_RADIUS;
          const source = edgePoint(sourceCenter, targetCenter, sourceRadius);
          const target = edgePoint(targetCenter, sourceCenter, targetRadius);
          const stroke =
            sourceFineId === targetFineId
              ? getLevelColor(sourceFineId, linkLevel)
              : TWO_LEVEL_INTER_LINK_COLOR;

          return (
            <line
              key={`two-level-link-${link.source.id}-${link.target.id}-${index}`}
              x1={source.x}
              y1={source.y}
              x2={target.x}
              y2={target.y}
              stroke={stroke}
              strokeLinecap="round"
              strokeWidth={LINK_STROKE_WIDTH}
              vectorEffect="non-scaling-stroke"
              opacity={sourceFineId === targetFineId ? 0.58 : 0.68}
            />
          );
        })}
        {fineModules.map((module_) => {
          const center = getTwoLevelFineDisplayCenter(module_);
          const visible = !selectedFine || selectedFine.id === module_.id;

          if (!visible) {
            return null;
          }

          return (
            <g
              key={`two-level-module-${module_.id}`}
              className="cursor-pointer transition-opacity hover:opacity-95"
              onClick={() => onZoomPathChange([module_.id])}
            >
              <circle
                cx={center.x}
                cy={center.y}
                r={TOP_VIEW_FINE_RADIUS}
                fill={getLevelColor(module_.id, 1)}
                fillOpacity={0.24}
                stroke={getLevelStrokeColor(module_.id, 1)}
                strokeWidth={0.9}
                vectorEffect="non-scaling-stroke"
              />
              <text
                x={center.x}
                y={center.y + TOP_VIEW_FINE_RADIUS + 8}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={6}
                fontWeight={700}
                fill="#1f2937"
                pointerEvents="none"
              >
                {module_.label}
              </text>
            </g>
          );
        })}
        {fineModules.flatMap((module_) =>
          module_.nodeIds.map((nodeId) => {
            if (selectedFine && selectedFine.id !== module_.id) {
              return null;
            }

            const center = getTwoLevelLeafDisplayCenter(module_, nodeId);

            return (
              <g key={`two-level-node-${nodeId}`}>
                <circle
                  cx={center.x}
                  cy={center.y}
                  r={TOP_VIEW_LEAF_RADIUS}
                  fill={getLevelColor(module_.id, 3)}
                  fillOpacity={0.78}
                  stroke={getLevelStrokeColor(module_.id, 3)}
                  strokeWidth={0.8}
                  vectorEffect="non-scaling-stroke"
                />
              </g>
            );
          }),
        )}
      </svg>
    </div>
  );
}

function createCodebookEntry({
  key,
  kind,
  label,
  code,
  flow,
  color,
}: CodebookEntry) {
  return {
    key,
    kind,
    label,
    code: code || "-",
    flow: Math.max(flow, 0),
    color,
  };
}

function getCodebookModuleLabel(moduleId: number) {
  return getFineLabel(moduleId, defaultCoarseByFine);
}

function buildLeafCodebookSection(
  network: NetworkModel,
  module_: TreeNode,
  mode: "hierarchical" | "two-level",
): CodebookSection {
  const fineId = module_.id;
  const colorId = mode === "hierarchical" ? module_.path[0] : fineId;
  const title =
    mode === "hierarchical"
      ? `Module codebook - ${getCodebookModuleLabel(fineId)}`
      : `Module codebook - ${getCodebookModuleLabel(fineId)}`;
  const entries: CodebookEntry[] = [];

  if (module_.exitCode) {
    entries.push(
      createCodebookEntry({
        key: `${mode}-${module_.pathKey}-exit`,
        kind: "exit",
        label: "Exit",
        code: module_.exitCode,
        flow: module_.exitFlow,
        color: getLevelColor(colorId, 3),
      }),
    );
  }

  module_
    .sort((left, right) => left.id - right.id)
    .forEach((node) => {
      const networkNode = network.getNode(node.id);

      entries.push(
        createCodebookEntry({
          key: `${mode}-${module_.pathKey}-node-${node.id}`,
          kind: "visit",
          label: networkNode?.name ?? `Node ${node.id}`,
          code: node.code,
          flow: node.flow,
          color: getLevelColor(colorId, 3),
        }),
      );
    });

  return {
    key: `${mode}-${module_.pathKey}-leaf`,
    title,
    entries,
  };
}

function buildCodebookPanelData(
  network: NetworkModel,
  mode: "hierarchical" | "two-level",
): CodebookPanelData {
  const topModules = network.tree.root.sort(
    (left, right) => left.id - right.id,
  );
  const indexOneSections: CodebookSection[] = [];
  const indexTwoSections: CodebookSection[] = [];

  if (mode === "hierarchical") {
    indexOneSections.push({
      key: "hierarchical-top-index",
      title: "Index codebook 1",
      entries: topModules.map((module_) =>
        createCodebookEntry({
          key: `hierarchical-enter-${module_.id}`,
          kind: "enter",
          label: `Enter module ${module_.id}`,
          code: module_.enterCode,
          flow: module_.enterFlow,
          color: getLevelColor(module_.id, 1),
        }),
      ),
    });

    topModules.forEach((coarseModule) => {
      const entries: CodebookEntry[] = [];

      if (coarseModule.exitCode) {
        entries.push(
          createCodebookEntry({
            key: `hierarchical-exit-${coarseModule.id}`,
            kind: "exit",
            label: `Exit module ${coarseModule.id}`,
            code: coarseModule.exitCode,
            flow: coarseModule.exitFlow,
            color: getLevelColor(coarseModule.id, 2),
          }),
        );
      }

      coarseModule
        .sort((left, right) => left.id - right.id)
        .filter((module_) => !module_.isLeafNode)
        .forEach((fineModule) => {
          entries.push(
            createCodebookEntry({
              key: `hierarchical-enter-${coarseModule.id}-${fineModule.id}`,
              kind: "enter",
              label: `Enter ${getCodebookModuleLabel(fineModule.id)}`,
              code: fineModule.enterCode,
              flow: fineModule.enterFlow,
              color: getLevelColor(coarseModule.id, 2),
            }),
          );
        });

      indexTwoSections.push({
        key: `hierarchical-subindex-${coarseModule.id}`,
        title: `Index codebook 2 - module ${coarseModule.id}`,
        entries,
      });
    });
  } else {
    indexOneSections.push({
      key: "two-level-index",
      title: "Index codebook 1",
      entries: topModules.map((module_) =>
        createCodebookEntry({
          key: `two-level-enter-${module_.id}`,
          kind: "enter",
          label: `Enter ${getCodebookModuleLabel(module_.id)}`,
          code: module_.enterCode,
          flow: module_.enterFlow,
          color: getLevelColor(module_.id, 1),
        }),
      ),
    });
  }

  const moduleSections = Array.from(network.tree.depthFirstModules())
    .filter((module_) => module_.isLeafModule)
    .sort((left, right) => left.pathKey.localeCompare(right.pathKey))
    .map((module_) => buildLeafCodebookSection(network, module_, mode));

  return {
    title:
      mode === "hierarchical" ? "Multilevel codebooks" : "Two-level codebooks",
    indexOneSections,
    indexTwoSections,
    moduleSections,
  };
}

function CodebookEntryRow({
  entry,
  maxFlow,
}: {
  entry: CodebookEntry;
  maxFlow: number;
}) {
  const width = Math.max(28, 18 + (entry.flow / maxFlow) * 72);
  const shapeProps = {
    x: 3,
    y: 22,
    width,
    height: 16,
    fill: entry.color,
    stroke: darkenHexColor(entry.color, 0.18),
    strokeWidth: 1.2,
  };
  const shape =
    entry.kind === "enter" ? (
      <EnterFlow {...shapeProps} />
    ) : entry.kind === "exit" ? (
      <ExitFlow {...shapeProps} />
    ) : (
      <Flow {...shapeProps} />
    );

  return (
    <div className="grid grid-cols-[minmax(4.5rem,7rem)_6rem_minmax(2.5rem,auto)] items-center gap-2 text-xs">
      <div className="truncate text-gray-600">{entry.label}</div>
      <svg viewBox="0 0 96 26" className="h-6 w-24 overflow-visible">
        {shape}
      </svg>
      <code className="text-right font-mono text-[11px] font-semibold text-gray-900">
        {entry.code}
      </code>
    </div>
  );
}

function CodebookSectionView({ section }: { section: CodebookSection }) {
  const maxFlow = Math.max(...section.entries.map((entry) => entry.flow), 1);

  return (
    <div className="space-y-1.5">
      <div className="text-xs font-bold uppercase text-gray-500">
        {section.title}
      </div>
      <div className="space-y-1">
        {section.entries.map((entry) => (
          <CodebookEntryRow key={entry.key} entry={entry} maxFlow={maxFlow} />
        ))}
      </div>
    </div>
  );
}

function CodebookPanel({ data }: { data: CodebookPanelData }) {
  return (
    <div className="space-y-3">
      <h3 className="m-0 text-base font-bold text-gray-900">{data.title}</h3>
      <div className="grid gap-4 xl:grid-cols-3">
        <div className="space-y-3">
          <div className="text-sm font-semibold text-gray-900">
            Index codebook 1
          </div>
          {data.indexOneSections.map((section) => (
            <CodebookSectionView key={section.key} section={section} />
          ))}
        </div>
        <div className="space-y-3">
          <div className="text-sm font-semibold text-gray-900">
            Index codebook 2
          </div>
          {data.indexTwoSections.map((section) => (
            <CodebookSectionView key={section.key} section={section} />
          ))}
        </div>
        <div className="space-y-3">
          <div className="text-sm font-semibold text-gray-900">
            Module codebook
          </div>
          <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-1">
            {data.moduleSections.map((section) => (
              <CodebookSectionView key={section.key} section={section} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function CodebookComparison({
  hierarchicalNetwork,
  twoLevelNetwork,
}: {
  hierarchicalNetwork: NetworkModel;
  twoLevelNetwork: NetworkModel;
}) {
  const hierarchicalCodebooks = useMemo(
    () => buildCodebookPanelData(hierarchicalNetwork, "hierarchical"),
    [hierarchicalNetwork],
  );
  const twoLevelCodebooks = useMemo(
    () => buildCodebookPanelData(twoLevelNetwork, "two-level"),
    [twoLevelNetwork],
  );

  return (
    <div className="space-y-3">
      <div className="mb-3">
        <h3 className="m-0 text-lg font-bold text-gray-900">
          Codebook comparison
        </h3>
        <p className="m-0 mt-1 text-sm text-gray-600">
          Hierarchical coding splits the index across levels; two-level coding
          keeps one index over all fine modules.
        </p>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <CodebookPanel data={hierarchicalCodebooks} />
        <CodebookPanel data={twoLevelCodebooks} />
      </div>
    </div>
  );
}

function HierarchicalCodebooks() {
  const [zoomPath, setZoomPath] = useState<number[]>([]);
  const [twoLevelZoomPath, setTwoLevelZoomPath] = useState<number[]>([]);
  const [network] = useState(() => createDemoNetwork());
  const [twoLevelNetwork] = useState(() => createTwoLevelNetwork());
  const coarseByFine = useMemo(
    () => cloneCoarseByFine(defaultCoarseByFine),
    [],
  );
  const fineModules = useMemo(
    () => buildFineModuleStats(network, coarseByFine),
    [coarseByFine, network],
  );
  const coarseModules = useMemo(
    () => buildCoarseModuleStats(fineModules),
    [fineModules],
  );
  const codelengthRows = useMemo(
    () => buildCodelengthRows(network, twoLevelNetwork),
    [network, twoLevelNetwork],
  );

  return (
    <section id="hierarchical-codebooks" className="col-span-4 mb-48">
      <div className="mb-8 max-w-4xl">
        <h2>Hierarchical codebooks</h2>
        <p>
          Hierarchical codebooks are the multilevel version of the map equation
          idea. Instead of naming every part of a network from one flat list,
          the description can first name a broad region, then a smaller module,
          and finally the node inside it.
        </p>
        <p>
          This can compress movement when the network has nested structure. If a
          path tends to remain inside the same region, local codewords can be
          reused there; the description only pays the extra cost of changing
          levels when the path leaves one region for another.
        </p>
      </div>

      <div className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-2">
          <HierarchyMap
            network={network}
            coarseByFine={coarseByFine}
            zoomPath={zoomPath}
            fineModules={fineModules}
            coarseModules={coarseModules}
            onZoomPathChange={setZoomPath}
          />
          <TwoLevelNetworkView
            network={twoLevelNetwork}
            fineModules={fineModules}
            zoomPath={twoLevelZoomPath}
            onZoomPathChange={setTwoLevelZoomPath}
          />
        </div>
        <CodelengthOverview rows={codelengthRows} />
        <CodebookComparison
          hierarchicalNetwork={network}
          twoLevelNetwork={twoLevelNetwork}
        />
      </div>
    </section>
  );
}

export default HierarchicalCodebooks;
