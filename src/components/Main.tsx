import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import TeX from "@matejmazur/react-katex";
import { observer } from "mobx-react";
import {
  Network as NetworkModel,
  Node as NodeModel,
  Rate,
} from "../model";
import { hierarchicalPaperToyTopology, modular_w_json } from "../networks";
import { getAssetPath } from "../lib/basePath";
import {
  neutralLinkColor,
  neutralNodeColor,
  neutralNodeColorAlt,
  scheme,
  schemeAlt,
  darkenHexColor,
} from "./scheme";
import HelpTooltip from "./HelpTooltip";
import { CodelengthChart, InlineTrace } from "./Trace";
import CodeBooks from "./CodeBooks";
import CodeBookLegend from "./CodeBooks/CodeBookLegend";
import Network from "./Network/Network";
import InteractiveNetwork from "./InteractiveNetwork";
import WalkerControls from "./WalkerControls";
import RegularizedInfomap from "./RegularizedInfomap";
import HierarchicalCodebooks from "./HierarchicalCodebooks";
import Walker from "./Network/Walker";
import WalkTrace from "./Network/WalkTrace";
import EnterExitCodes from "./Network/EnterExitCodes";
import { performanceMonitor } from "../utils/performance";

// Create a shared `Network` model instance for the main demo. The
// `setNodeExtents` call maps logical node coordinates to the SVG viewbox
// coordinate system used by the visualization.
const network = NetworkModel.parse(modular_w_json).setNodeExtents(
  [50, 650],
  [50, 700],
);
network.walker.setTeleportRate(0);

function applyBadSolution(targetNetwork: NetworkModel) {
  targetNetwork.getNode(2)?.setTopModule(4);
  targetNetwork.getNode(4)?.setTopModule(4);
  targetNetwork.getNode(8)?.setTopModule(0);
  targetNetwork.getNode(9)?.setTopModule(0);
  targetNetwork.getNode(11)?.setTopModule(0);
  targetNetwork.getNode(13)?.setTopModule(4);
  targetNetwork.getNode(14)?.setTopModule(4);
  targetNetwork.getNode(17)?.setTopModule(3);
  targetNetwork.getNode(20)?.setTopModule(3);
  targetNetwork.getNode(21)?.setTopModule(3);
}

applyBadSolution(network);
network.finalize();

function formatRelativeCodelength(
  oneLevelCodelength: number,
  totalCodelength: number,
) {
  if (oneLevelCodelength <= 0) {
    return "Relative codelength unavailable";
  }

  const relativeChange =
    ((totalCodelength - oneLevelCodelength) / oneLevelCodelength) * 100;

  if (Math.abs(relativeChange) < 0.05) {
    return "Two-level is about the same length";
  }

  return relativeChange < 0
    ? `Two-level is ${Math.abs(relativeChange).toFixed(1)}% shorter`
    : `Two-level is ${relativeChange.toFixed(1)}% longer`;
}

const NUM_COMMUNITIES = 8;
const NODE_ID_DARKEN_AMOUNT = 0.42;
const CODEBOOK_HELP =
  "A codebook is the list of symbols the walker can print and the binary code assigned to each symbol. Short codes are used for common events, and longer codes are used for rarer events.";
const INDEX_CODELENGTH_HELP =
  "Index codelength is the cost of telling the walker which module it enters next when it moves between modules.";
const MODULE_CODELENGTH_HELP =
  "Module codelength is the cost of encoding what happens inside modules: node visits within a module plus the exit symbol when the walker leaves it.";

function getDarkerNodeIdFill(_node: NodeModel, fill: string) {
  return darkenHexColor(fill, NODE_ID_DARKEN_AMOUNT);
}

function getModuleTraceColor(moduleId: number) {
  return scheme[moduleId] ?? neutralLinkColor;
}

function getModuleTraceStroke(source: NodeModel, target: NodeModel) {
  return {
    from: getModuleTraceColor(source.topModule),
    to: getModuleTraceColor(target.topModule),
  };
}

const OneLevelCodelengthSummary = observer(function OneLevelCodelengthSummary({
  network,
}: {
  network: NetworkModel;
}) {
  // Read the update counter so this summary refreshes after partition edits
  // trigger `network.finalize()`, even though `Main` itself is not observed.
  network.treeUpdateCounter;
  const relativeCodelength = formatRelativeCodelength(
    network.mapequation.oneLevelCodelength,
    network.mapequation.codelength,
  );

  return (
    <div className="space-y-1 text-sm leading-6 text-gray-900">
      <div className="font-semibold">
        One-level codelength{" "}
        {network.mapequation.oneLevelCodelength.toFixed(3)} bits
      </div>
      <div>{relativeCodelength}</div>
    </div>
  );
});

const TwoLevelCodelengthSummary = observer(function TwoLevelCodelengthSummary({
  network,
}: {
  network: NetworkModel;
}) {
  // Read the update counter so this summary refreshes after partition edits
  // trigger `network.finalize()`, even though `Main` itself is not observed.
  network.treeUpdateCounter;
  const indexCodelength = network.mapequation.indexCodelength.toFixed(3);
  const moduleCodelength = network.mapequation.moduleCodelength.toFixed(3);
  const totalCodelength = network.mapequation.codelength.toFixed(3);

  return (
    <div className="inline-grid grid-cols-[auto_auto_auto_auto_auto_auto] items-end gap-x-2 text-sm leading-6 text-gray-900">
      <div />
      <div className="text-center text-xs font-semibold uppercase tracking-[0.08em] text-gray-600">
        Index <HelpTooltip content={INDEX_CODELENGTH_HELP} />
      </div>
      <div />
      <div className="text-center text-xs font-semibold uppercase tracking-[0.08em] text-gray-600">
        Module <HelpTooltip content={MODULE_CODELENGTH_HELP} />
      </div>
      <div />
      <div className="text-center text-xs font-semibold uppercase tracking-[0.08em] text-gray-600">
        Total
      </div>

      <div className="font-semibold">Codelength =</div>
      <div className="text-center font-mono font-bold">{indexCodelength}</div>
      <div className="font-semibold">+</div>
      <div className="text-center font-mono font-bold">{moduleCodelength}</div>
      <div className="font-semibold">=</div>
      <div className="text-center font-mono font-bold">
        {totalCodelength} bits
      </div>
    </div>
  );
});

function ArticleSection({
  id,
  eyebrow,
  title,
  children,
  className = "",
  titleClassName = "",
}: {
  id?: string;
  eyebrow?: string;
  title?: string;
  children: ReactNode;
  className?: string;
  titleClassName?: string;
}) {
  return (
    <section
      id={id}
      className={`col-span-4 mb-40 scroll-mt-16 ${className}`.trim()}
    >
      {(eyebrow || title) && (
        <div className="mb-8 max-w-3xl">
          {eyebrow && (
            <p className="mb-2 text-sm font-black uppercase tracking-[0.22em] text-[#b22222]">
              {eyebrow}
            </p>
          )}
          {title && (
            <h2 className={`mb-4 mt-0 ${titleClassName}`.trim()}>{title}</h2>
          )}
        </div>
      )}
      {children}
    </section>
  );
}

function ArticleStep({
  label,
  title,
  children,
}: {
  label: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="py-5">
      <div className="mb-2 flex items-center gap-3">
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#b22222] text-xs font-black text-white">
          {label}
        </span>
        <h3 className="m-0 text-base font-bold">{title}</h3>
      </div>
      <div className="text-sm leading-relaxed text-gray-600">{children}</div>
    </div>
  );
}

type TwoTriangleTerm =
  | "one-level"
  | "q-total"
  | "exit-a"
  | "exit-b"
  | "enter-a"
  | "enter-b"
  | "module-a"
  | "module-b"
  | "h-q"
  | "h-pa"
  | "h-pb"
  | "node-1"
  | "node-2"
  | "node-3"
  | "node-4"
  | "node-5"
  | "node-6";

type TwoTriangleLevel = "one-level" | "two-level";
type TwoTriangleHoverScope =
  `${TwoTriangleLevel}-${"network" | "area" | "calculation"}`;

interface TwoTriangleHoverState {
  term: TwoTriangleTerm;
  scope: TwoTriangleHoverScope;
}

const EQUATION_TOOLTIP_CLASS =
  "pointer-events-none absolute left-1/2 bottom-full z-50 mb-2 hidden w-72 -translate-x-1/2 rounded-md border border-gray-300 bg-white px-3 py-2 text-left text-xs font-normal leading-relaxed text-gray-700 shadow-lg group-hover:block";

function MapEquationTerm({
  math,
  tooltip,
}: {
  math: string;
  tooltip: ReactNode;
}) {
  return (
    <span className="group relative inline-flex cursor-help items-baseline rounded px-0.5 underline decoration-[#b22222]/30 decoration-dotted underline-offset-4">
      <TeX math={math} />
      <span className={EQUATION_TOOLTIP_CLASS}>{tooltip}</span>
    </span>
  );
}

const TWO_TRIANGLE_NODE_POSITIONS = {
  1: { x: 230, y: 145, module: "a" },
  2: { x: 95, y: 65, module: "a" },
  3: { x: 95, y: 225, module: "a" },
  4: { x: 330, y: 145, module: "b" },
  5: { x: 465, y: 65, module: "b" },
  6: { x: 465, y: 225, module: "b" },
} as const;
const TWO_TRIANGLE_INTERNAL_EDGES = [
  [1, 2],
  [1, 3],
  [2, 3],
  [4, 5],
  [4, 6],
  [5, 6],
] as const;
const TWO_TRIANGLE_EDGES = [
  ...TWO_TRIANGLE_INTERNAL_EDGES,
  [1, 4],
] as const;

function serializeModelNetworkToPajek(targetNetwork: NetworkModel) {
  const vertices = targetNetwork.nodes
    .slice()
    .sort((left, right) => left.id - right.id)
    .map((node) => `${node.id} "${node.name || node.id}"`);
  const edges = targetNetwork.links
    .slice()
    .sort((left, right) =>
      left.source.id === right.source.id
        ? left.target.id - right.target.id
        : left.source.id - right.source.id,
    )
    .map((link) => `${link.source.id} ${link.target.id} ${link.weight}`);

  return [
    `*Vertices ${targetNetwork.numNodes}`,
    ...vertices,
    targetNetwork.directed ? "*Arcs" : "*Edges",
    ...edges,
  ].join("\n");
}

function serializeHierarchicalToyToPajek() {
  const vertices = hierarchicalPaperToyTopology.nodes
    .slice()
    .sort((left, right) => left.id - right.id)
    .map((node) => `${node.id} "${node.name ?? node.id}"`);
  const edges = hierarchicalPaperToyTopology.links
    .slice()
    .sort((left, right) =>
      left.source === right.source
        ? left.target - right.target
        : left.source - right.source,
    )
    .map((link) => `${link.source} ${link.target} ${link.weight}`);

  return [
    `*Vertices ${hierarchicalPaperToyTopology.nodes.length}`,
    ...vertices,
    "*Edges",
    ...edges,
  ].join("\n");
}

function serializeTwoTriangleNetworkToPajek() {
  const vertices = Object.keys(TWO_TRIANGLE_NODE_POSITIONS)
    .map(Number)
    .sort((left, right) => left - right)
    .map((id) => `${id} "${id}"`);
  const edges = TWO_TRIANGLE_EDGES.map(
    ([source, target]) => `${source} ${target} 1`,
  );

  return [`*Vertices ${vertices.length}`, ...vertices, "*Edges", ...edges].join(
    "\n",
  );
}

const DEGREE_HELP =
  "The degree of a node is the number of links attached to it. In this undirected example, each link can be counted in both directions, so a node's degree is also the number of directed link directions that arrive at it.";
const TWO_TRIANGLE_AREA_BLOCKS = [
  {
    id: "q-total",
    label: "Index",
    formula: "q_{\\curvearrowleft}H(\\mathcal{Q})",
    useRateNumerator: "2",
    useRateDenominator: "14",
    entropy: "1.000",
    entropyInline: "1",
    contribution: "0.143 bits",
    x: 38,
    width: 60,
    height: 64,
    fill: "#b22222",
  },
  {
    id: "module-a",
    label: "Module A",
    formula: "p_{\\circlearrowright}^{A}H(\\mathcal{P}^{A})",
    useRateNumerator: "8",
    useRateDenominator: "14",
    entropy: "1.906",
    entropyInline: "1.906",
    contribution: "1.089 bits",
    x: 158,
    width: 235,
    height: 122,
    fill: scheme[0],
  },
  {
    id: "module-b",
    label: "Module B",
    formula: "p_{\\circlearrowright}^{B}H(\\mathcal{P}^{B})",
    useRateNumerator: "8",
    useRateDenominator: "14",
    entropy: "1.906",
    entropyInline: "1.906",
    contribution: "1.089 bits",
    x: 480,
    width: 235,
    height: 122,
    fill: scheme[1],
  },
] as const;
const ONE_LEVEL_TRIANGLE_AREA_BLOCKS = [
  {
    id: "one-level",
    label: "One-level codebook",
    formula: "H(\\mathcal{P})",
    useRateNumerator: "1",
    useRateDenominator: "1",
    entropy: "2.557",
    entropyInline: "2.557",
    contribution: "2.557 bits",
    x: 78,
    width: 605,
    height: 145,
    fill: neutralNodeColor,
  },
] as const;
const TWO_TRIANGLE_AREA_SLICES = {
  "q-total": [
    {
      id: "enter-a",
      label: "A",
      axisMain: "q",
      axisSub: "A",
      widthFraction: 1 / 2,
    },
    {
      id: "enter-b",
      label: "B",
      axisMain: "q",
      axisSub: "B",
      widthFraction: 1 / 2,
    },
  ],
  "module-a": [
    {
      id: "exit-a",
      label: "exit",
      axisMain: "q",
      axisSub: "A",
      widthFraction: 1 / 8,
    },
    {
      id: "node-1",
      label: "node 1",
      axisMain: "p",
      axisSub: "1",
      widthFraction: 3 / 8,
    },
    {
      id: "node-2",
      label: "node 2",
      axisMain: "p",
      axisSub: "2",
      widthFraction: 2 / 8,
    },
    {
      id: "node-3",
      label: "node 3",
      axisMain: "p",
      axisSub: "3",
      widthFraction: 2 / 8,
    },
  ],
  "module-b": [
    {
      id: "exit-b",
      label: "exit",
      axisMain: "q",
      axisSub: "B",
      widthFraction: 1 / 8,
    },
    {
      id: "node-4",
      label: "node 4",
      axisMain: "p",
      axisSub: "4",
      widthFraction: 3 / 8,
    },
    {
      id: "node-5",
      label: "node 5",
      axisMain: "p",
      axisSub: "5",
      widthFraction: 2 / 8,
    },
    {
      id: "node-6",
      label: "node 6",
      axisMain: "p",
      axisSub: "6",
      widthFraction: 2 / 8,
    },
  ],
} as const;
const ONE_LEVEL_TRIANGLE_AREA_SLICES = {
  "one-level": [
    {
      id: "node-1",
      label: "node 1",
      axisMain: "p",
      axisSub: "1",
      widthFraction: 3 / 14,
    },
    {
      id: "node-2",
      label: "node 2",
      axisMain: "p",
      axisSub: "2",
      widthFraction: 2 / 14,
    },
    {
      id: "node-3",
      label: "node 3",
      axisMain: "p",
      axisSub: "3",
      widthFraction: 2 / 14,
    },
    {
      id: "node-4",
      label: "node 4",
      axisMain: "p",
      axisSub: "4",
      widthFraction: 3 / 14,
    },
    {
      id: "node-5",
      label: "node 5",
      axisMain: "p",
      axisSub: "5",
      widthFraction: 2 / 14,
    },
    {
      id: "node-6",
      label: "node 6",
      axisMain: "p",
      axisSub: "6",
      widthFraction: 2 / 14,
    },
  ],
} as const;

function termIsActive(
  activeTerm: TwoTriangleTerm | null,
  ...terms: TwoTriangleTerm[]
) {
  return activeTerm !== null && terms.includes(activeTerm);
}

function getTwoTriangleNodeTerm(nodeId: number): TwoTriangleTerm {
  return `node-${nodeId}` as TwoTriangleTerm;
}

function getNodeIdFromTwoTriangleTerm(term: TwoTriangleTerm | null) {
  if (!term?.startsWith("node-")) {
    return null;
  }

  const nodeId = Number(term.slice(5));

  return Number.isInteger(nodeId) ? nodeId : null;
}

function getTwoTriangleTermExplanation(term: TwoTriangleTerm) {
  const nodeId = getNodeIdFromTwoTriangleTerm(term);

  if (nodeId !== null) {
    const degree = nodeId === 1 || nodeId === 4 ? 3 : 2;
    const moduleLabel = nodeId <= 3 ? "A" : "B";
    const localDistribution = moduleLabel === "A" ? "Pᴬ" : "Pᴮ";
    const localRate = degree === 3 ? "3/8" : "2/8";

    return `Inside module ${moduleLabel}, node ${nodeId}'s full-network rate ${degree}/14 is divided by that module codebook's use rate 8/14 and becomes ${localRate}. ${localDistribution} describes the choices after module ${moduleLabel}'s codebook is already active, so its exit and node probabilities must add up to one.`;
  }

  switch (term) {
    case "one-level":
      return "The one-level codebook names every node from one shared list. This gives the baseline codelength before using module structure.";
    case "q-total":
      return "q↶ is the use rate of the index codebook, here 2/14. Every inter-module move uses the index codebook to name the module entered next.";
    case "exit-a":
      return "The exit rate from module A is 1/14. Module A's local codebook needs an exit symbol so the code can say that the walker leaves A.";
    case "exit-b":
      return "The exit rate from module B is 1/14. Module B's local codebook needs an exit symbol so the code can say that the walker leaves B.";
    case "enter-a":
      return "This is the probability of entering module A within the index codebook: (1/14)/(2/14)=1/2. Once the index codebook is used, it only chooses among entered modules.";
    case "enter-b":
      return "This is the probability of entering module B within the index codebook. It is also 1/2 by symmetry. The index entropy depends on this distribution of module entries.";
    case "module-a":
      return "p⟳ᴬ is the use rate of module A's codebook: node visits in A plus the exit from A, here 8/14. It is also the denominator used to normalize Pᴬ, because Pᴬ describes probabilities conditional on using module A's codebook.";
    case "module-b":
      return "p⟳ᴮ is the use rate of module B's codebook, here 8/14. It weights module B's local average code length and normalizes Pᴮ into probabilities that sum to one.";
    case "h-q":
      return "H(Q) is the entropy of the index codebook. We calculate it with the entropy formula -∑p log₂p, using the entry probabilities Q=(1/2,1/2). It is the average number of bits needed to name the entered module whenever the index codebook is used.";
    case "h-pa":
      return "Pᴬ is the local distribution after module A's codebook has been selected. Since we are already inside A for this codebook, its exit and node rates are divided by p⟳ᴬ=8/14 so the probabilities sum to one. H(Pᴬ) uses the same entropy formula -∑p log₂p to get the average bits needed inside A.";
    case "h-pb":
      return "Pᴮ is the local distribution after module B's codebook has been selected. Its exit and node rates are divided by p⟳ᴮ=8/14 so the probabilities sum to one. H(Pᴮ) uses the same entropy formula -∑p log₂p to get the average bits needed inside B; here it equals H(Pᴬ) because the modules are symmetric.";
    default:
      return null;
  }
}

function getOneLevelNodeExplanation(nodeId: number) {
  const degree = nodeId === 1 || nodeId === 4 ? 3 : 2;

  return `Node ${nodeId} has ${degree} links attached to it. Because the toy network is unweighted and undirected, every link direction carries 1/14 of the flow. In the one-level calculation, this node's probability is therefore ${degree}/14: count the link directions arriving at the node and divide by 14 total directions.`;
}

function getNormalizedExitExplanation(moduleLabel: "A" | "B") {
  return `This is the normalized exit probability inside module ${moduleLabel}'s codebook. The full-network exit rate is 1/14, but this local codebook is used at rate 8/14, so the exit symbol gets probability (1/14)/(8/14)=1/8.`;
}

function getAreaBlockIdForTerm(term: TwoTriangleTerm | null) {
  if (!term) {
    return null;
  }

  if (term === "one-level") {
    return "one-level";
  }

  if (
    term === "q-total" ||
    term === "h-q"
  ) {
    return "q-total";
  }

  if (
    term === "module-a" ||
    term === "h-pa"
  ) {
    return "module-a";
  }

  if (
    term === "module-b" ||
    term === "h-pb"
  ) {
    return "module-b";
  }

  return null;
}

function termHighlightsWidth(
  term: TwoTriangleTerm | null,
  blockId: TwoTriangleAreaBlockId,
) {
  return (
    (blockId === "one-level" && term === "one-level") ||
    (blockId === "q-total" && term === "q-total") ||
    (blockId === "module-a" && term === "module-a") ||
    (blockId === "module-b" && term === "module-b")
  );
}

function termHighlightsHeight(
  term: TwoTriangleTerm | null,
  blockId: TwoTriangleAreaBlockId,
) {
  return (
    (blockId === "one-level" && term === "one-level") ||
    (blockId === "q-total" && term === "h-q") ||
    (blockId === "module-a" && term === "h-pa") ||
    (blockId === "module-b" && term === "h-pb")
  );
}

function SvgFraction({
  numerator,
  denominator,
  x,
  y,
  fill = "#111827",
  fontSize = 11,
  fontWeight = 800,
}: {
  numerator: string;
  denominator: string;
  x: number;
  y: number;
  fill?: string;
  fontSize?: number;
  fontWeight?: number;
}) {
  return (
    <g fill={fill} fontSize={fontSize} fontWeight={fontWeight} textAnchor="middle">
      <text x={x} y={y - 5} pointerEvents="none">
        {numerator}
      </text>
      <line
        x1={x - 8}
        x2={x + 8}
        y1={y - 1}
        y2={y - 1}
        stroke={fill}
        strokeWidth={1.1}
        pointerEvents="none"
      />
      <text x={x} y={y + 11} pointerEvents="none">
        {denominator}
      </text>
    </g>
  );
}

function SvgSubscriptLabel({
  main,
  sub,
  x,
  y,
  fill = "#4b5563",
  fontSize = 10,
  fontWeight = 800,
}: {
  main: string;
  sub: string;
  x: number;
  y: number;
  fill?: string;
  fontSize?: number;
  fontWeight?: number;
}) {
  return (
    <text
      x={x}
      y={y}
      textAnchor="middle"
      fontSize={fontSize}
      fontWeight={fontWeight}
      fill={fill}
      pointerEvents="none"
    >
      <tspan>{main}</tspan>
      <tspan baselineShift="sub" fontSize={fontSize * 0.72}>
        {sub}
      </tspan>
    </text>
  );
}

type TwoTriangleAreaBlockId =
  | (typeof ONE_LEVEL_TRIANGLE_AREA_BLOCKS)[number]["id"]
  | (typeof TWO_TRIANGLE_AREA_BLOCKS)[number]["id"];

function getTwoTriangleAreaSlices(blockId: TwoTriangleAreaBlockId) {
  if (blockId === "one-level") {
    return ONE_LEVEL_TRIANGLE_AREA_SLICES["one-level"];
  }

  return TWO_TRIANGLE_AREA_SLICES[blockId];
}

function getAreaWidthTerm(blockId: TwoTriangleAreaBlockId): TwoTriangleTerm {
  if (blockId === "one-level") {
    return "one-level";
  }

  if (blockId === "q-total") {
    return "q-total";
  }

  return blockId;
}

function getAreaHeightTerm(blockId: TwoTriangleAreaBlockId): TwoTriangleTerm {
  if (blockId === "one-level") {
    return "one-level";
  }

  if (blockId === "q-total") {
    return "h-q";
  }

  return blockId === "module-a" ? "h-pa" : "h-pb";
}

function SvgUseRateLabel({
  blockId,
  x,
  y,
  fill,
  fontSize = 10,
  fontWeight = 800,
}: {
  blockId: TwoTriangleAreaBlockId;
  x: number;
  y: number;
  fill: string;
  fontSize?: number;
  fontWeight?: number;
}) {
  if (blockId === "one-level") {
    return (
      <text
        x={x}
        y={y}
        textAnchor="middle"
        fontSize={fontSize}
        fontWeight={fontWeight}
        fill={fill}
        pointerEvents="none"
      >
        use rate
      </text>
    );
  }

  const moduleLabel =
    blockId === "module-a" ? "A" : blockId === "module-b" ? "B" : null;

  return (
    <text
      x={x}
      y={y}
      textAnchor="middle"
      fontSize={fontSize}
      fontWeight={fontWeight}
      fill={fill}
      pointerEvents="none"
    >
      {moduleLabel === null ? (
        <>
          <tspan>q</tspan>
          <tspan baselineShift="sub" fontSize={fontSize * 0.72}>
            ↶
          </tspan>
        </>
      ) : (
        <>
          <tspan>p</tspan>
          <tspan baselineShift="sub" fontSize={fontSize * 0.72}>
            ⟳
          </tspan>
          <tspan baselineShift="super" fontSize={fontSize * 0.72}>
            {moduleLabel}
          </tspan>
        </>
      )}
    </text>
  );
}

function SvgEntropyLabel({
  blockId,
  x,
  y,
  fill,
  transform,
  fontSize = 10,
  fontWeight = 800,
}: {
  blockId: TwoTriangleAreaBlockId;
  x: number;
  y: number;
  fill: string;
  transform?: string;
  fontSize?: number;
  fontWeight?: number;
}) {
  if (blockId === "one-level") {
    return (
      <text
        x={x}
        y={y}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={fontSize}
        fontWeight={fontWeight}
        fill={fill}
        transform={transform}
        pointerEvents="none"
      >
        <tspan>H(P)=2.557</tspan>
      </text>
    );
  }

  const moduleLabel =
    blockId === "module-a" ? "A" : blockId === "module-b" ? "B" : null;
  const value = blockId === "q-total" ? "1" : "1.906";

  return (
    <text
      x={x}
      y={y}
      textAnchor="middle"
      dominantBaseline="middle"
      fontSize={fontSize}
      fontWeight={fontWeight}
      fill={fill}
      transform={transform}
      pointerEvents="none"
    >
      <tspan>H(</tspan>
      {moduleLabel === null ? (
        <tspan>Q</tspan>
      ) : (
        <>
          <tspan>P</tspan>
          <tspan baselineShift="super" fontSize={fontSize * 0.72}>
            {moduleLabel}
          </tspan>
        </>
      )}
      <tspan>)={value}</tspan>
    </text>
  );
}

function FormulaTerm({
  id,
  activeTerm,
  setHoveredTerm,
  explanation,
  children,
}: {
  id: TwoTriangleTerm;
  activeTerm: TwoTriangleTerm | null;
  setHoveredTerm: (term: TwoTriangleTerm | null) => void;
  explanation?: ReactNode;
  children: ReactNode;
}) {
  const active = activeTerm === id;
  const termExplanation = explanation ?? getTwoTriangleTermExplanation(id);

  return (
    <button
      type="button"
      className={`group relative mx-px inline-flex rounded-md border px-1 py-px align-baseline transition ${
        active
          ? "border-[#b22222] bg-[#b22222]/10 text-gray-950"
          : "border-transparent bg-transparent text-gray-900 hover:border-[#b22222]/40 hover:bg-[#b22222]/5"
      }`}
      onMouseEnter={() => setHoveredTerm(id)}
      onMouseLeave={() => setHoveredTerm(null)}
    >
      {children}
      {termExplanation && (
        <span className={EQUATION_TOOLTIP_CLASS}>{termExplanation}</span>
      )}
    </button>
  );
}

function EquationInfo({
  children,
  explanation,
  active = false,
}: {
  children: ReactNode;
  explanation: ReactNode;
  active?: boolean;
}) {
  return (
    <span
      className={`group relative inline-flex cursor-help rounded-md border px-1 py-px align-baseline transition ${
        active
          ? "border-[#b22222] bg-[#b22222]/10 text-gray-950"
          : "border-transparent hover:border-[#b22222]/40 hover:bg-[#b22222]/5"
      }`}
    >
      {children}
      <span className={EQUATION_TOOLTIP_CLASS}>{explanation}</span>
    </span>
  );
}

function TwoTriangleNetwork({
  activeTerm,
  setHoveredTerm,
  variant = "two-level",
}: {
  activeTerm: TwoTriangleTerm | null;
  setHoveredTerm: (term: TwoTriangleTerm | null) => void;
  variant?: TwoTriangleLevel;
}) {
  const isOneLevel = variant === "one-level";
  const moduleAActive =
    !isOneLevel && termIsActive(activeTerm, "module-a", "h-pa");
  const moduleBActive =
    !isOneLevel && termIsActive(activeTerm, "module-b", "h-pb");
  const indexActive = !isOneLevel && termIsActive(activeTerm, "q-total", "h-q");
  const bridgeAHalfActive =
    !isOneLevel &&
    (moduleAActive || indexActive || termIsActive(activeTerm, "exit-a", "enter-a"));
  const bridgeBHalfActive =
    !isOneLevel &&
    (moduleBActive || indexActive || termIsActive(activeTerm, "exit-b", "enter-b"));
  const oneLevelActive = isOneLevel && termIsActive(activeTerm, "one-level");
  const activeDegreeNodeId = getNodeIdFromTwoTriangleTerm(activeTerm);
  const bridgeSource = TWO_TRIANGLE_NODE_POSITIONS[1];
  const bridgeTarget = TWO_TRIANGLE_NODE_POSITIONS[4];
  const bridgeMidpoint = {
    x: (bridgeSource.x + bridgeTarget.x) / 2,
    y: (bridgeSource.y + bridgeTarget.y) / 2,
  };
  const bridgeHighlightGap =
    bridgeAHalfActive && bridgeBHalfActive ? 8 : 0;

  return (
    <svg
      viewBox="0 0 560 305"
      className="block w-full overflow-visible"
      role="img"
      aria-label="Two triangles connected by one bridge link"
    >
      {!isOneLevel && (
        <>
          <polygon
            points="230,145 95,65 95,225"
            fill={scheme[0]}
            fillOpacity={moduleAActive ? 0.2 : 0.09}
            stroke="none"
          />
          <polygon
            points="330,145 465,65 465,225"
            fill={scheme[1]}
            fillOpacity={moduleBActive ? 0.2 : 0.09}
            stroke="none"
          />
        </>
      )}
      {TWO_TRIANGLE_EDGES.map(([sourceId, targetId]) => {
        const source = TWO_TRIANGLE_NODE_POSITIONS[sourceId];
        const target = TWO_TRIANGLE_NODE_POSITIONS[targetId];
        const isBridge = sourceId === 1 && targetId === 4;
        const degreeMode = activeDegreeNodeId !== null;
        const incidentToDegreeNode =
          sourceId === activeDegreeNodeId || targetId === activeDegreeNodeId;
        const active =
          oneLevelActive ||
          (isBridge
            ? false
            : source.module === "a"
              ? moduleAActive
              : moduleBActive);

        return (
          <line
            key={`${sourceId}-${targetId}`}
            x1={source.x}
            y1={source.y}
            x2={target.x}
            y2={target.y}
            stroke={active ? "#4b5563" : neutralLinkColor}
            strokeWidth={active ? 4.2 : degreeMode ? 2 : 2.6}
            strokeLinecap="round"
            opacity={
              active ? 0.95 : degreeMode ? (incidentToDegreeNode ? 0.22 : 0.14) : 0.5
            }
          />
        );
      })}
      {[
        {
          id: "bridge-a-half",
          active: bridgeAHalfActive,
          source: bridgeSource,
        },
        {
          id: "bridge-b-half",
          active: bridgeBHalfActive,
          source: bridgeTarget,
        },
      ].map((bridgeHalf) => {
        if (!bridgeHalf.active) {
          return null;
        }

        const dx = bridgeHalf.source.x - bridgeMidpoint.x;
        const dy = bridgeHalf.source.y - bridgeMidpoint.y;
        const length = Math.hypot(dx, dy) || 1;
        const endPoint = {
          x: bridgeMidpoint.x + (dx / length) * bridgeHighlightGap,
          y: bridgeMidpoint.y + (dy / length) * bridgeHighlightGap,
        };

        return (
          <line
            key={bridgeHalf.id}
            x1={bridgeHalf.source.x}
            y1={bridgeHalf.source.y}
            x2={endPoint.x}
            y2={endPoint.y}
            stroke="#b22222"
            strokeWidth={7}
            strokeLinecap="round"
            opacity={0.92}
          />
        );
      })}
      {activeDegreeNodeId !== null &&
        TWO_TRIANGLE_EDGES.map(([sourceId, targetId]) => {
          if (sourceId !== activeDegreeNodeId && targetId !== activeDegreeNodeId) {
            return null;
          }

          const source = TWO_TRIANGLE_NODE_POSITIONS[sourceId];
          const target = TWO_TRIANGLE_NODE_POSITIONS[targetId];
          const activeNode =
            sourceId === activeDegreeNodeId ? source : target;
          const otherNode =
            sourceId === activeDegreeNodeId ? target : source;
          const midX = (activeNode.x + otherNode.x) / 2;
          const midY = (activeNode.y + otherNode.y) / 2;

          return (
            <line
              key={`degree-half-${sourceId}-${targetId}`}
              x1={activeNode.x}
              y1={activeNode.y}
              x2={midX}
              y2={midY}
              stroke="#b22222"
              strokeWidth={7}
              strokeLinecap="round"
              opacity={0.92}
            />
          );
        })}
      {Object.entries(TWO_TRIANGLE_NODE_POSITIONS).map(([id, node]) => {
        const numericId = Number(id);
        const active =
          oneLevelActive ||
          activeDegreeNodeId === numericId ||
          (node.module === "a" ? moduleAActive : moduleBActive);

        return (
          <g
            key={id}
            tabIndex={0}
            role="button"
            onMouseEnter={() => setHoveredTerm(getTwoTriangleNodeTerm(numericId))}
            onMouseLeave={() => setHoveredTerm(null)}
            className="cursor-pointer outline-none"
          >
            <circle
              cx={node.x}
              cy={node.y}
              r={active ? 20 : 17}
              fill={
                isOneLevel
                  ? neutralNodeColor
                  : node.module === "a"
                    ? scheme[0]
                    : scheme[1]
              }
              stroke={
                active
                  ? isOneLevel
                    ? neutralNodeColorAlt
                    : schemeAlt[node.module === "a" ? 0 : 1]
                  : "#ffffff"
              }
              strokeWidth={active ? 3.2 : 2}
              opacity={active ? 1 : 0.94}
            />
            <text
              x={node.x}
              y={node.y + 1}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={15}
              fontWeight={900}
              fill="#111827"
              pointerEvents="none"
            >
              {id}
            </text>
          </g>
        );
      })}
      {!isOneLevel && [
        {
          id: "exit-a" as const,
          kind: "exit" as const,
          x: 218,
          y: 96,
          label: "exit A",
          accent: schemeAlt[0],
        },
        {
          id: "enter-b" as const,
          kind: "enter" as const,
          x: 358,
          y: 96,
          label: "enter B",
          accent: "#b22222",
        },
        {
          id: "exit-b" as const,
          kind: "exit" as const,
          x: 358,
          y: 220,
          label: "exit B",
          accent: schemeAlt[1],
        },
        {
          id: "enter-a" as const,
          kind: "enter" as const,
          x: 218,
          y: 220,
          label: "enter A",
          accent: "#b22222",
        },
      ].map((item) => {
        const labelActive =
          activeTerm === item.id ||
          (item.kind === "enter" && indexActive) ||
          (item.id === "exit-a" && moduleAActive) ||
          (item.id === "exit-b" && moduleBActive);

        return (
          <g
            key={item.id}
            tabIndex={0}
            role="button"
            onMouseEnter={() => setHoveredTerm(item.id)}
            onMouseLeave={() => setHoveredTerm(null)}
            className="cursor-pointer outline-none"
          >
            <rect
              x={item.x - 43}
              y={item.y - 17}
              width={86}
              height={30}
              rx={15}
              fill={labelActive ? item.accent : "#ffffff"}
              stroke={item.accent}
              strokeOpacity={0.5}
            />
            <SvgFraction
              numerator="1"
              denominator="14"
              x={item.x - 16}
              y={item.y - 3}
              fill={labelActive ? "#ffffff" : item.accent}
              fontSize={8}
              fontWeight={900}
            />
            <text
              x={item.x + 14}
              y={item.y - 1}
              textAnchor="middle"
              fontSize={11}
              fontWeight={800}
              fill={labelActive ? "#ffffff" : item.accent}
              pointerEvents="none"
            >
              {item.label}
            </text>
          </g>
        );
      })}
      {!isOneLevel && (
        <>
          <text x={140} y={282} textAnchor="middle" fontSize={13} fill="#4b5563">
            Module A
          </text>
          <text x={420} y={282} textAnchor="middle" fontSize={13} fill="#4b5563">
            Module B
          </text>
        </>
      )}
    </svg>
  );
}

function TwoTriangleUseArea({
  activeTerm,
  setHoveredTerm,
  variant = "two-level",
}: {
  activeTerm: TwoTriangleTerm | null;
  setHoveredTerm: (term: TwoTriangleTerm | null) => void;
  variant?: TwoTriangleLevel;
}) {
  const baseline = 190;
  const xAxisLabelY = baseline + 13;
  const widthGuideY = baseline + 32;
  const useRateLabelY = baseline + 62;
  const blocks =
    variant === "one-level"
      ? ONE_LEVEL_TRIANGLE_AREA_BLOCKS
      : TWO_TRIANGLE_AREA_BLOCKS;

  return (
    <svg
      viewBox="0 0 760 270"
      className="block w-full overflow-visible"
      role="img"
      aria-label="Use-rate by entropy area diagram"
    >
      <line
        x1={20}
        x2={742}
        y1={baseline}
        y2={baseline}
        stroke="#d1d5db"
        strokeWidth={1.4}
      />
      <text x={20} y={14} fontSize={13} fontWeight={800} fill="#4b5563">
        Height = entropy
      </text>
      <text x={165} y={14} fontSize={13} fontWeight={800} fill="#4b5563">
        Width = codebook use rate
      </text>
      {blocks.map((block) => {
        const blockId = block.id as TwoTriangleAreaBlockId;
        const blockIsTarget = getAreaBlockIdForTerm(activeTerm) === blockId;
        const active =
          blockIsTarget ||
          activeTerm === block.id;
        const heightActive = termHighlightsHeight(activeTerm, blockId);
        const widthActive = termHighlightsWidth(activeTerm, blockId);
        const termId = blockId as TwoTriangleTerm;
        const widthTerm = getAreaWidthTerm(blockId);
        const heightTerm = getAreaHeightTerm(blockId);
        const y = baseline - block.height;
        const slices = getTwoTriangleAreaSlices(blockId);
        const heightGuideX = block.x + block.width + 10;
        const heightLabelX = block.x + block.width + 23;
        const heightLabelY = y + block.height / 2;
        const heightColor = heightActive ? "#b22222" : "#6b7280";
        const widthColor = widthActive ? "#b22222" : "#6b7280";
        const blockCenterX = block.x + block.width / 2;
        const isNarrowBlock = block.width < 90;
        const inlineFractionX = blockCenterX - (isNarrowBlock ? 9 : 8);
        const inlineEntropyX = blockCenterX + (isNarrowBlock ? 3 : 7);
        const inlineFontSize = isNarrowBlock ? 10 : 12;
        const useRateLabelX = blockCenterX - (isNarrowBlock ? 12 : 20);
        const useRateFractionX = blockCenterX + (isNarrowBlock ? 16 : 28);
        let sliceX = block.x;

        return (
          <g key={block.id}>
            <rect
              x={block.x}
              y={y}
              width={block.width}
              height={block.height}
              rx={7}
              fill="#ffffff"
              opacity={0.001}
            />
            {slices.map((slice, index) => {
              const currentSliceX = sliceX;
              const width =
                index === slices.length - 1
                  ? block.x + block.width - currentSliceX
                  : block.width * slice.widthFraction;
              const sliceCenterX = currentSliceX + width / 2;
              const sliceActive = activeTerm === slice.id;
              const sliceElement = (
                <g
                  key={slice.id}
                  tabIndex={0}
                  role="button"
                  onMouseEnter={(event) => {
                    event.stopPropagation();
                    setHoveredTerm(slice.id as TwoTriangleTerm);
                  }}
                  onMouseLeave={(event) => {
                    event.stopPropagation();
                    setHoveredTerm(null);
                  }}
                  className="cursor-pointer outline-none"
                >
                  <rect
                    x={currentSliceX}
                    y={y}
                    width={width}
                    height={block.height}
                    rx={7}
                    ry={7}
                    fill={block.fill}
                    opacity={
                      sliceActive ? 0.9 : active ? 0.7 : 0.34
                    }
                    stroke={sliceActive ? "#111827" : "#ffffff"}
                    strokeWidth={sliceActive ? 2.2 : 1}
                  />
                  <text
                    x={sliceCenterX}
                    y={baseline - 12}
                    textAnchor="middle"
                    fontSize={width < 36 ? 8 : 9.5}
                    fontWeight={800}
                    fill={sliceActive ? "#ffffff" : "#111827"}
                    paintOrder="stroke"
                    stroke={sliceActive ? "none" : "#ffffff"}
                    strokeWidth={sliceActive ? 0 : 2.4}
                    pointerEvents="none"
                  >
                    {slice.label}
                  </text>
                  <line
                    x1={currentSliceX}
                    x2={currentSliceX}
                    y1={baseline}
                    y2={baseline + 5}
                    stroke="#9ca3af"
                    strokeWidth={1}
                    pointerEvents="none"
                  />
                  {index === slices.length - 1 && (
                    <line
                      x1={currentSliceX + width}
                      x2={currentSliceX + width}
                      y1={baseline}
                      y2={baseline + 5}
                      stroke="#9ca3af"
                      strokeWidth={1}
                      pointerEvents="none"
                    />
                  )}
                  <SvgSubscriptLabel
                    main={slice.axisMain}
                    sub={slice.axisSub}
                    x={sliceCenterX}
                    y={xAxisLabelY}
                    fill={sliceActive ? "#111827" : "#6b7280"}
                    fontSize={width < 36 ? 8 : 10}
                    fontWeight={sliceActive ? 900 : 800}
                  />
                </g>
              );

              sliceX += width;
              return sliceElement;
            })}
            <rect
              x={block.x}
              y={y}
              width={block.width}
              height={block.height}
              rx={7}
              fill="none"
              stroke={active ? "#111827" : "transparent"}
              strokeWidth={2}
            />
            <g
              tabIndex={0}
              role="button"
              onMouseEnter={(event) => {
                event.stopPropagation();
                setHoveredTerm(heightTerm);
              }}
              onMouseLeave={(event) => {
                event.stopPropagation();
                setHoveredTerm(null);
              }}
              className="cursor-pointer outline-none"
            >
              <rect
                x={heightGuideX - 16}
                y={y - 8}
                width={52}
                height={block.height + 16}
                fill="#ffffff"
                opacity={0.001}
              />
              <line
                x1={heightGuideX}
                x2={heightGuideX}
                y1={y}
                y2={baseline}
                stroke={heightColor}
                strokeWidth={heightActive ? 3 : 1.6}
                strokeLinecap="round"
              />
              <line
                x1={heightGuideX - 4}
                x2={heightGuideX + 4}
                y1={y}
                y2={y}
                stroke={heightColor}
                strokeWidth={heightActive ? 3 : 1.6}
                strokeLinecap="round"
              />
              <line
                x1={heightGuideX - 4}
                x2={heightGuideX + 4}
                y1={baseline}
                y2={baseline}
                stroke={heightColor}
                strokeWidth={heightActive ? 3 : 1.6}
                strokeLinecap="round"
              />
              <SvgEntropyLabel
                blockId={blockId}
                x={heightLabelX}
                y={heightLabelY}
                fill={heightColor}
                transform={`rotate(-90 ${heightLabelX} ${heightLabelY})`}
                fontSize={10}
                fontWeight={heightActive ? 900 : 700}
              />
            </g>
            <g
              tabIndex={0}
              role="button"
              onMouseEnter={(event) => {
                event.stopPropagation();
                setHoveredTerm(widthTerm);
              }}
              onMouseLeave={(event) => {
                event.stopPropagation();
                setHoveredTerm(null);
              }}
              className="cursor-pointer outline-none"
            >
              <rect
                x={block.x - 4}
                y={baseline + 8}
                width={block.width + 8}
                height={76}
                fill="#ffffff"
                opacity={0.001}
              />
              <line
                x1={block.x}
                x2={block.x + block.width}
                y1={widthGuideY}
                y2={widthGuideY}
                stroke={widthColor}
                strokeWidth={widthActive ? 3 : 1.6}
                strokeLinecap="round"
              />
              <line
                x1={block.x}
                x2={block.x}
                y1={widthGuideY - 4}
                y2={widthGuideY + 4}
                stroke={widthColor}
                strokeWidth={widthActive ? 3 : 1.6}
                strokeLinecap="round"
              />
              <line
                x1={block.x + block.width}
                x2={block.x + block.width}
                y1={widthGuideY - 4}
                y2={widthGuideY + 4}
                stroke={widthColor}
                strokeWidth={widthActive ? 3 : 1.6}
                strokeLinecap="round"
              />
              <SvgUseRateLabel
                blockId={blockId}
                x={useRateLabelX}
                y={useRateLabelY}
                fill={widthColor}
                fontSize={12}
                fontWeight={widthActive ? 900 : 700}
              />
              <SvgFraction
                numerator={block.useRateNumerator}
                denominator={block.useRateDenominator}
                x={useRateFractionX}
                y={useRateLabelY - 1}
                fill={widthColor}
                fontSize={10}
                fontWeight={widthActive ? 900 : 700}
              />
            </g>
            <g
              tabIndex={0}
              role="button"
              onMouseEnter={() => setHoveredTerm(termId)}
              onMouseLeave={() => setHoveredTerm(null)}
              className="cursor-pointer outline-none"
            >
              <rect
                x={blockCenterX - 72}
                y={y - 30}
                width={144}
                height={24}
                rx={12}
                fill="#ffffff"
                opacity={0.001}
              />
              <text
                x={blockCenterX}
                y={y - 12}
                textAnchor="middle"
                fontSize={13}
                fill="#111827"
                pointerEvents="none"
              >
                <tspan fontWeight={900}>{block.label}</tspan>
                <tspan fontSize={11} fontWeight={800} fill="#4b5563">
                  {" "}
                  {block.contribution}
                </tspan>
              </text>
            </g>
            <text
              x={inlineEntropyX}
              y={y + block.height / 2 - 10}
              textAnchor="start"
              fontSize={inlineFontSize}
              fontWeight={800}
              fill="#111827"
              pointerEvents="none"
            >
              ×{block.entropyInline}
            </text>
            <SvgFraction
              numerator={block.useRateNumerator}
              denominator={block.useRateDenominator}
              x={inlineFractionX}
              y={y + block.height / 2 - 10}
              fill="#111827"
              fontSize={isNarrowBlock ? 8 : 10}
              fontWeight={800}
            />
          </g>
        );
      })}
    </svg>
  );
}

function TwoTriangleCodelengthWalkthrough() {
  const [hoverState, setHoverState] = useState<TwoTriangleHoverState | null>(
    null,
  );
  const activeTerm = hoverState?.term ?? null;
  const activeLevel = hoverState?.scope.startsWith("one-level")
    ? "one-level"
    : hoverState?.scope.startsWith("two-level")
      ? "two-level"
      : null;
  const oneLevelActiveTerm = activeLevel === "one-level" ? activeTerm : null;
  const twoLevelActiveTerm = activeLevel === "two-level" ? activeTerm : null;
  const setScopedHoveredTerm =
    (scope: TwoTriangleHoverScope) => (term: TwoTriangleTerm | null) => {
      setHoverState(term === null ? null : { term, scope });
    };
  const oneLevelNetworkTermProps = {
    activeTerm: oneLevelActiveTerm,
    setHoveredTerm: setScopedHoveredTerm("one-level-network"),
  };
  const oneLevelAreaTermProps = {
    activeTerm: oneLevelActiveTerm,
    setHoveredTerm: setScopedHoveredTerm("one-level-area"),
  };
  const oneLevelTermProps = {
    activeTerm: oneLevelActiveTerm,
    setHoveredTerm: setScopedHoveredTerm("one-level-calculation"),
  };
  const twoLevelNetworkTermProps = {
    activeTerm: twoLevelActiveTerm,
    setHoveredTerm: setScopedHoveredTerm("two-level-network"),
  };
  const twoLevelAreaTermProps = {
    activeTerm: twoLevelActiveTerm,
    setHoveredTerm: setScopedHoveredTerm("two-level-area"),
  };
  const twoLevelTermProps = {
    activeTerm: twoLevelActiveTerm,
    setHoveredTerm: setScopedHoveredTerm("two-level-calculation"),
  };

  return (
    <div className="mb-12 space-y-8">
      <div className="max-w-4xl space-y-3">
        <h3 className="mb-2 text-2xl font-bold text-gray-900">
          How codelength is calculated
        </h3>
        <p className="m-0 text-sm leading-relaxed text-gray-600">
          This toy network is unweighted and undirected: every link counts the
          same, and the walker can traverse each link both ways. Seven links
          become fourteen equally likely link directions, so the fractions in
          the equations can be counted directly.
        </p>
        <p className="m-0 text-sm leading-relaxed text-gray-600">
          Each term is a use rate multiplied by an entropy: how often a
          codebook is used times the average number of bits needed when it is
          used. Hover a formula part to see where that term appears in the
          network and in the area diagram.
        </p>
      </div>

      <div className="space-y-4">
        <h4 className="m-0 text-lg font-bold text-gray-900">
          One-level partition
        </h4>
        <div className="grid gap-8 xl:grid-cols-[minmax(0,0.72fr)_minmax(0,1.28fr)] xl:items-start">
          <div className="min-w-0">
            <h5 className="mb-3 text-base font-semibold text-gray-900">
              One shared network partition
            </h5>
            <TwoTriangleNetwork
              {...oneLevelNetworkTermProps}
              variant="one-level"
            />
          </div>
          <div className="min-w-0">
            <h5 className="mb-3 text-base font-semibold text-gray-900">
              Area = one-level codelength
            </h5>
            <TwoTriangleUseArea
              {...oneLevelAreaTermProps}
              variant="one-level"
            />
          </div>
        </div>
        <div className="min-w-0 space-y-1.5">
          <h4 className="m-0 text-base font-semibold text-gray-900">
            One-level calculation
          </h4>
          <div className="mt-1 space-y-0.5">
              <div className="flex flex-wrap items-center gap-y-0 py-0 text-[0.95rem] leading-7 text-gray-900">
                <FormulaTerm
                  id="one-level"
                  {...oneLevelTermProps}
                  explanation="The one-level codelength is the entropy of the full node-visit distribution P. With one shared codebook, every step is encoded by naming the next node from one global list."
                >
                  <TeX math="L_1=H(P)=" />
                </FormulaTerm>
                <FormulaTerm
                  id="one-level"
                  {...oneLevelTermProps}
                  explanation="This is the entropy formula. We use this same calculation for H(P), H(Q), H(Pᴬ), and H(Pᴮ): multiply each probability by its log₂ code length contribution and add the terms."
                >
                  <TeX math="-\sum_{\alpha}p_{\alpha}\log_2 p_{\alpha}" />
                </FormulaTerm>
              </div>
              <p className="m-0 text-sm leading-snug text-gray-600">
                Hover equation parts for the counting behind each number. In
                one level, each <TeX math="p_{\alpha}" /> is the node&apos;s
                degree <HelpTooltip content={DEGREE_HELP} /> divided by 14 link
                directions; no module codebooks are involved yet.
              </p>
              <div className="flex flex-wrap items-center gap-y-0 py-0 text-[0.95rem] leading-7 text-gray-900">
                <EquationInfo explanation="P is the one-level node-visit distribution. Entropy needs probabilities, so each node's flow rate becomes one entry in P.">
                  <TeX math="P=(" />
                </EquationInfo>
                <FormulaTerm
                  id="node-1"
                  {...oneLevelTermProps}
                  explanation={getOneLevelNodeExplanation(1)}
                >
                  <TeX math="\frac{3}{14}" />
                </FormulaTerm>
                <TeX math="," />
                <FormulaTerm
                  id="node-2"
                  {...oneLevelTermProps}
                  explanation={getOneLevelNodeExplanation(2)}
                >
                  <TeX math="\frac{2}{14}" />
                </FormulaTerm>
                <TeX math="," />
                <FormulaTerm
                  id="node-3"
                  {...oneLevelTermProps}
                  explanation={getOneLevelNodeExplanation(3)}
                >
                  <TeX math="\frac{2}{14}" />
                </FormulaTerm>
                <TeX math="," />
                <FormulaTerm
                  id="node-4"
                  {...oneLevelTermProps}
                  explanation={getOneLevelNodeExplanation(4)}
                >
                  <TeX math="\frac{3}{14}" />
                </FormulaTerm>
                <TeX math="," />
                <FormulaTerm
                  id="node-5"
                  {...oneLevelTermProps}
                  explanation={getOneLevelNodeExplanation(5)}
                >
                  <TeX math="\frac{2}{14}" />
                </FormulaTerm>
                <TeX math="," />
                <FormulaTerm
                  id="node-6"
                  {...oneLevelTermProps}
                  explanation={getOneLevelNodeExplanation(6)}
                >
                  <TeX math="\frac{2}{14}" />
                </FormulaTerm>
                <TeX math=")" />
              </div>
              <div className="flex flex-wrap items-center gap-y-0 py-0 text-[0.95rem] leading-7 text-gray-900">
                <EquationInfo explanation="This substitutes every probability in P into the entropy formula. Each term is the codelength contribution of one node in the one-level codebook.">
                  <TeX math="L_1=H(P)=-[" />
                </EquationInfo>
                <FormulaTerm
                  id="node-1"
                  {...oneLevelTermProps}
                  explanation={getOneLevelNodeExplanation(1)}
                >
                  <TeX math="\frac{3}{14}\log_2(\frac{3}{14})" />
                </FormulaTerm>
                <TeX math="+" />
                <FormulaTerm
                  id="node-2"
                  {...oneLevelTermProps}
                  explanation={getOneLevelNodeExplanation(2)}
                >
                  <TeX math="\frac{2}{14}\log_2(\frac{2}{14})" />
                </FormulaTerm>
                <TeX math="+" />
                <FormulaTerm
                  id="node-3"
                  {...oneLevelTermProps}
                  explanation={getOneLevelNodeExplanation(3)}
                >
                  <TeX math="\frac{2}{14}\log_2(\frac{2}{14})" />
                </FormulaTerm>
                <TeX math="+" />
                <FormulaTerm
                  id="node-4"
                  {...oneLevelTermProps}
                  explanation={getOneLevelNodeExplanation(4)}
                >
                  <TeX math="\frac{3}{14}\log_2(\frac{3}{14})" />
                </FormulaTerm>
                <TeX math="+" />
                <FormulaTerm
                  id="node-5"
                  {...oneLevelTermProps}
                  explanation={getOneLevelNodeExplanation(5)}
                >
                  <TeX math="\frac{2}{14}\log_2(\frac{2}{14})" />
                </FormulaTerm>
                <TeX math="+" />
                <FormulaTerm
                  id="node-6"
                  {...oneLevelTermProps}
                  explanation={getOneLevelNodeExplanation(6)}
                >
                  <TeX math="\frac{2}{14}\log_2(\frac{2}{14})" />
                </FormulaTerm>
                <EquationInfo explanation="2.557 bits is the average one-level code length per walker step. It is the baseline used to judge whether two-level coding finds regularities in the network. If a structured description is shorter than this flat one, the partition is capturing useful flow structure.">
                  <TeX math="]=2.557\ \text{bits}" />
                </EquationInfo>
              </div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h4 className="m-0 text-lg font-bold text-gray-900">
          Two-level partition
        </h4>
        <div className="grid gap-8 xl:grid-cols-[minmax(0,0.72fr)_minmax(0,1.28fr)] xl:items-start">
          <div className="min-w-0">
            <h5 className="mb-3 text-base font-semibold text-gray-900">
              Two module network partition
            </h5>
            <TwoTriangleNetwork
              {...twoLevelNetworkTermProps}
              variant="two-level"
            />
          </div>
          <div className="min-w-0">
            <h5 className="mb-3 text-base font-semibold text-gray-900">
              Area = two-level codelength contributions
            </h5>
            <TwoTriangleUseArea
              {...twoLevelAreaTermProps}
              variant="two-level"
            />
          </div>
        </div>
        <div className="min-w-0 space-y-1.5">
          <h4 className="m-0 text-base font-semibold text-gray-900">
            Two-level calculation
          </h4>
          <div className="mt-1 space-y-0.5">
              <div className="flex flex-wrap items-center gap-y-0 py-0 text-[0.95rem] leading-7 text-gray-900">
                <EquationInfo explanation="This is the general two-level map equation. The first term is the index-codebook cost, and the sum adds the cost of every module codebook.">
                  <TeX math="L(M)=q_{\curvearrowleft}H(Q)+\sum_i p_{\circlearrowright}^{i}H(P^i)" />
                </EquationInfo>
              </div>
              <div className="flex flex-wrap items-center gap-y-0 py-0 text-[0.95rem] leading-7 text-gray-900">
                <EquationInfo explanation="L(M) is the two-level codelength for partition M. It adds the cost of using the index codebook and the local module codebooks.">
                  <TeX math="L(M)=" />
                </EquationInfo>
                <FormulaTerm id="q-total" {...twoLevelTermProps}>
                  <TeX math="q_{\curvearrowleft}" />
                </FormulaTerm>
                <FormulaTerm id="h-q" {...twoLevelTermProps}>
                  <TeX math="H(Q)" />
                </FormulaTerm>
                <TeX math="+" />
                <FormulaTerm id="module-a" {...twoLevelTermProps}>
                  <TeX math="p_{\circlearrowright}^{A}" />
                </FormulaTerm>
                <FormulaTerm id="h-pa" {...twoLevelTermProps}>
                  <TeX math="H(P^A)" />
                </FormulaTerm>
                <TeX math="+" />
                <FormulaTerm id="module-b" {...twoLevelTermProps}>
                  <TeX math="p_{\circlearrowright}^{B}" />
                </FormulaTerm>
                <FormulaTerm id="h-pb" {...twoLevelTermProps}>
                  <TeX math="H(P^B)" />
                </FormulaTerm>
              </div>
              <div className="flex flex-wrap items-center gap-y-0 py-0 text-[0.95rem] leading-7 text-gray-900">
                <FormulaTerm id="exit-a" {...twoLevelTermProps}>
                  <TeX math="q_A=\frac{1}{14}" />
                </FormulaTerm>
                <TeX math="," />
                <FormulaTerm id="exit-b" {...twoLevelTermProps}>
                  <TeX math="q_B=\frac{1}{14}" />
                </FormulaTerm>
                <TeX math=",\quad" />
                <FormulaTerm id="q-total" {...twoLevelTermProps}>
                  <TeX math="q_{\curvearrowleft}=\frac{2}{14}" />
                </FormulaTerm>
              </div>
              <div className="flex flex-wrap items-center gap-y-0 py-0 text-[0.95rem] leading-7 text-gray-900">
                <FormulaTerm id="enter-a" {...twoLevelTermProps}>
                  <TeX math="Q_A=\frac{1}{14}\div\frac{2}{14}=\frac{1}{2}" />
                </FormulaTerm>
                <TeX math="," />
                <FormulaTerm id="enter-b" {...twoLevelTermProps}>
                  <TeX math="Q_B=\frac{1}{14}\div\frac{2}{14}=\frac{1}{2}" />
                </FormulaTerm>
                <TeX math=",\quad" />
                <FormulaTerm id="h-q" {...twoLevelTermProps}>
                  <TeX math="H(Q)=1" />
                </FormulaTerm>
              </div>
              <p className="m-0 text-sm leading-snug text-gray-600">
                Once a module codebook is active, we only choose among that
                module&apos;s exit and node symbols. Dividing by its use rate
                makes the local distribution sum to one.
              </p>
              <div className="flex flex-wrap items-center gap-y-0 py-0 text-[0.95rem] leading-7 text-gray-900">
                <FormulaTerm id="module-a" {...twoLevelTermProps}>
                  <TeX math="p_{\circlearrowright}^{A}=\frac{1}{14}+\frac{7}{14}=\frac{8}{14}" />
                </FormulaTerm>
                <TeX math="," />
                <FormulaTerm id="module-b" {...twoLevelTermProps}>
                  <TeX math="p_{\circlearrowright}^{B}=\frac{1}{14}+\frac{7}{14}=\frac{8}{14}" />
                </FormulaTerm>
              </div>
              <div className="flex flex-wrap items-center gap-y-0 py-0 text-[0.95rem] leading-7 text-gray-900">
                <FormulaTerm id="h-pa" {...twoLevelTermProps}>
                  <TeX math="P^A" />
                </FormulaTerm>
                <TeX math="=(" />
                <FormulaTerm
                  id="exit-a"
                  {...twoLevelTermProps}
                  explanation={getNormalizedExitExplanation("A")}
                >
                  <TeX math="\frac{1}{8}" />
                </FormulaTerm>
                <TeX math="," />
                <FormulaTerm id="node-1" {...twoLevelTermProps}>
                  <TeX math="\frac{3}{8}" />
                </FormulaTerm>
                <TeX math="," />
                <FormulaTerm id="node-2" {...twoLevelTermProps}>
                  <TeX math="\frac{2}{8}" />
                </FormulaTerm>
                <TeX math="," />
                <FormulaTerm id="node-3" {...twoLevelTermProps}>
                  <TeX math="\frac{2}{8}" />
                </FormulaTerm>
                <TeX math="),\quad" />
                <FormulaTerm id="h-pb" {...twoLevelTermProps}>
                  <TeX math="P^B" />
                </FormulaTerm>
                <TeX math="=(" />
                <FormulaTerm
                  id="exit-b"
                  {...twoLevelTermProps}
                  explanation={getNormalizedExitExplanation("B")}
                >
                  <TeX math="\frac{1}{8}" />
                </FormulaTerm>
                <TeX math="," />
                <FormulaTerm id="node-4" {...twoLevelTermProps}>
                  <TeX math="\frac{3}{8}" />
                </FormulaTerm>
                <TeX math="," />
                <FormulaTerm id="node-5" {...twoLevelTermProps}>
                  <TeX math="\frac{2}{8}" />
                </FormulaTerm>
                <TeX math="," />
                <FormulaTerm id="node-6" {...twoLevelTermProps}>
                  <TeX math="\frac{2}{8}" />
                </FormulaTerm>
                <TeX math=")" />
              </div>
              <div className="flex flex-wrap items-center gap-y-0 py-0 text-[0.88rem] leading-7 text-gray-900">
                <FormulaTerm id="h-pa" {...twoLevelTermProps}>
                  <TeX math="H(P^A)" />
                </FormulaTerm>
                <TeX math="=-[" />
                <FormulaTerm
                  id="exit-a"
                  {...twoLevelTermProps}
                  explanation={getNormalizedExitExplanation("A")}
                >
                  <TeX math="\frac{1}{8}\log_2(\frac{1}{8})" />
                </FormulaTerm>
                <TeX math="+" />
                <FormulaTerm id="node-1" {...twoLevelTermProps}>
                  <TeX math="\frac{3}{8}\log_2(\frac{3}{8})" />
                </FormulaTerm>
                <TeX math="+" />
                <FormulaTerm id="node-2" {...twoLevelTermProps}>
                  <TeX math="\frac{2}{8}\log_2(\frac{2}{8})" />
                </FormulaTerm>
                <TeX math="+" />
                <FormulaTerm id="node-3" {...twoLevelTermProps}>
                  <TeX math="\frac{2}{8}\log_2(\frac{2}{8})" />
                </FormulaTerm>
                <FormulaTerm id="h-pa" {...twoLevelTermProps}>
                  <TeX math="]=1.906" />
                </FormulaTerm>
              </div>
              <div className="flex flex-wrap items-center gap-y-0 py-0 text-[0.88rem] leading-7 text-gray-900">
                <FormulaTerm id="h-pb" {...twoLevelTermProps}>
                  <TeX math="H(P^B)" />
                </FormulaTerm>
                <TeX math="=-[" />
                <FormulaTerm
                  id="exit-b"
                  {...twoLevelTermProps}
                  explanation={getNormalizedExitExplanation("B")}
                >
                  <TeX math="\frac{1}{8}\log_2(\frac{1}{8})" />
                </FormulaTerm>
                <TeX math="+" />
                <FormulaTerm id="node-4" {...twoLevelTermProps}>
                  <TeX math="\frac{3}{8}\log_2(\frac{3}{8})" />
                </FormulaTerm>
                <TeX math="+" />
                <FormulaTerm id="node-5" {...twoLevelTermProps}>
                  <TeX math="\frac{2}{8}\log_2(\frac{2}{8})" />
                </FormulaTerm>
                <TeX math="+" />
                <FormulaTerm id="node-6" {...twoLevelTermProps}>
                  <TeX math="\frac{2}{8}\log_2(\frac{2}{8})" />
                </FormulaTerm>
                <FormulaTerm id="h-pb" {...twoLevelTermProps}>
                  <TeX math="]=1.906" />
                </FormulaTerm>
              </div>
              <div className="flex flex-wrap items-center gap-y-0 py-0 text-[0.95rem] leading-7 text-gray-900">
                <EquationInfo explanation="This line substitutes the measured use rates and entropies into the two-level map equation. It turns the abstract equation into the predicted average bits per step.">
                  <TeX math="L(M)=" />
                </EquationInfo>
                <FormulaTerm id="q-total" {...twoLevelTermProps}>
                  <TeX math="\frac{2}{14}" />
                </FormulaTerm>
                <TeX math="\cdot" />
                <FormulaTerm id="h-q" {...twoLevelTermProps}>
                  <TeX math="1" />
                </FormulaTerm>
                <TeX math="+" />
                <FormulaTerm id="module-a" {...twoLevelTermProps}>
                  <TeX math="\frac{8}{14}" />
                </FormulaTerm>
                <TeX math="\cdot" />
                <FormulaTerm id="h-pa" {...twoLevelTermProps}>
                  <TeX math="1.906" />
                </FormulaTerm>
                <TeX math="+" />
                <FormulaTerm id="module-b" {...twoLevelTermProps}>
                  <TeX math="\frac{8}{14}" />
                </FormulaTerm>
                <TeX math="\cdot" />
                <FormulaTerm id="h-pb" {...twoLevelTermProps}>
                  <TeX math="1.906" />
                </FormulaTerm>
                <EquationInfo explanation="2.321 bits is the two-level average codelength per step. Because it is lower than the one-level value, the module partition gives a shorter description. That tells us the partition reveals regularities and structure in the network flow.">
                  <TeX math="=2.321\ \text{bits}" />
                </EquationInfo>
              </div>
              <p className="m-0 font-semibold text-gray-700">
                Two-level coding is about 9.2% shorter than one-level.
              </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Main demo component embedding the interactive visualizations and
 * explanatory text. This component is NOT observed to prevent re-rendering
 * on every walker step. Walker-dependent components are isolated.
 */
export default function Main() {
  const [speed, setSpeed] = useState(3);
  const [showOptimized, setShowOptimized] = useState(false);
  const [showVisitRates, setShowVisitRates] = useState(false);
  const [showLinkWeights, setShowLinkWeights] = useState(false);
  const [activeCommunity, setActiveCommunity] = useState(0);
  const firstNetworkRef = useRef<HTMLDivElement>(null);
  const pajekNetworks = useMemo(
    () => [
      {
        key: "opening-two-level",
        title: "Two-level partition network",
        description:
          "The weighted network used in the opening interaction and Huffman coding section.",
        pajekText: serializeModelNetworkToPajek(network),
      },
      {
        key: "two-triangles",
        title: "Two triangles, one bridge",
        description:
          "The small unweighted codelength example with two triangle modules connected by one bridge.",
        pajekText: serializeTwoTriangleNetworkToPajek(),
      },
      {
        key: "nine-triangles",
        title: "Nine-triangle hierarchical network",
        description:
          "The weighted toy network used for the two-level and multilevel codebook comparison.",
        pajekText: serializeHierarchicalToyToPajek(),
      },
    ],
    [],
  );

  const setWalkerSpeed = (value: number) => {
    setSpeed(value);
    network.walker.setSpeed(value);
  };

  const startRandomWalk = useCallback(() => network.walker.start(), []);

  useEffect(() => {
    const currentRef = firstNetworkRef.current;
    if (!currentRef) return;

    // Start the random walk when the first network element becomes fully
    // visible in the viewport. This improves perceived performance by
    // deferring animation until the user scrolls to the demo area.
    const observer = new IntersectionObserver(
      (entries, observer) =>
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;

          startRandomWalk();

          observer.unobserve(entry.target);
        }),
      { threshold: 0.35, rootMargin: "0px 0px -120px 0px" },
    );

    observer.observe(currentRef);

    return () => observer.disconnect();
  }, [startRandomWalk]);

  const toggleSolution = () => {
    const wasStarted = network.walker.isStarted;
    network.walker.reset();

    // Always reset to initial optimal solution first
    network.setInitialModules();

    // If currently showing optimal, apply bad solution
    if (showOptimized) {
      applyBadSolution(network);
    }
    // If currently showing bad solution, we've already reset to initial (optimal) above

    network.finalize();
    setShowOptimized(!showOptimized);
    network.walker.step();
    if (wasStarted) startRandomWalk();
  };

  return (
    <>
      <ArticleSection
        id="node-selection"
        eyebrow="Learn the Map Equation"
        title="Can you compress the code?"
        className="mb-36"
      >
        <div className="grid gap-10 xl:grid-cols-2 xl:items-start">
          <div className="min-w-0 space-y-5">
            <p className="text-lg leading-relaxed text-gray-700">
              Before reading the definitions, try changing the partition.
              Choose a community, draw a lasso around nodes, and watch the
              total codelength respond.
            </p>
            <ArticleStep label="1" title="Choose a community">
              <p className="m-0">
                Pick one of the colored community buttons below the network.
                This is the module the selected nodes will be assigned to.
              </p>
            </ArticleStep>
            <ArticleStep label="2" title="Move nodes between modules">
              <p className="m-0">
                Drag a free-hand lasso around nodes. When you release, the
                selected nodes move to the active community and the map equation
                recalculates the codelength.
              </p>
            </ArticleStep>
            <ArticleStep label="3" title="Look for shorter descriptions">
              <p className="m-0">
                Lower codelength means the random walk can be described with
                fewer bits. The rest of the article explains why this reveals
                regularities in the network.
              </p>
            </ArticleStep>
          </div>

          <div
            ref={firstNetworkRef}
            className="-mt-6 min-w-0 p-4 xl:sticky xl:top-8"
          >
            <InteractiveNetwork
              network={network}
              numCommunities={NUM_COMMUNITIES}
              scheme={scheme}
              schemeAlt={schemeAlt}
              activeCommunity={activeCommunity}
              onActiveCommunityChange={setActiveCommunity}
              communitySelectorPlacement="overlay"
              communitySelectorOverlay={{ x: 0, y: 748, width: 785, height: 74 }}
              communitySelectorScale={1.35}
              topContent={<TwoLevelCodelengthSummary network={network} />}
              showLabels={true}
              showModules={true}
              showNodeId={false}
              showInstructions={false}
              nodeIdLayer="top"
              rate={showVisitRates ? Rate.Visits : Rate.Uniform}
              showVisiting={showVisitRates}
              scaleLinksByWeight={showLinkWeights}
              width={800}
              height={830}
              getNodeIdFill={getDarkerNodeIdFill}
            >
              <WalkTrace
                walker={network.walker}
                stroke={neutralLinkColor}
                opacity={0.66}
                minWidth={3.5}
                maxWidth={18}
                stableSegments
                getStableSegmentStroke={getModuleTraceStroke}
              />
              <Walker
                walker={network.walker}
                r={12}
                fill={neutralNodeColorAlt}
              />
              <EnterExitCodes network={network} x={610} y={390} />
            </InteractiveNetwork>
          </div>
        </div>
      </ArticleSection>

      <ArticleSection
        id="why-compression"
        eyebrow="Why compression?"
        title="Regularities make descriptions shorter"
      >
        <div className="grid gap-8 xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] xl:items-center">
          <div className="min-w-0 space-y-5">
            <p>
              Networks of nodes and links are powerful, but large networks are
              too complicated to understand directly. Like geographic maps, we
              need to simplify and highlight the organization that matters.
            </p>
            <p>
              The map equation does this through compression. If a random walk
              has regular patterns, a good code can describe it with fewer bits.
              Searching for the shortest description becomes a way to find
              modules in the network.
            </p>
            <p className="text-gray-700">
              The same idea appears in ordinary compression: repeated structure
              is easier to describe than irregular detail. In networks, the
              repeated structure is flow that stays within modules before
              crossing between them.
            </p>
          </div>
          <div className="grid min-w-0 gap-4 sm:grid-cols-[0.85fr_1fr]">
            <div className="p-4">
              <img
                className="mix-blend-multiply"
                src={getAssetPath("/images/hairball.png")}
                alt="Dense network before simplification"
              />
            </div>
            <div className="space-y-4 p-4">
              <div className="text-sm font-bold text-gray-700">
                5.8 MB &rarr; <strong>0.91 MB</strong>
              </div>
              <img
                className="rounded-lg"
                src={getAssetPath("/images/compression-top.png")}
                alt="Image region with repeated sky pattern"
              />
              <img
                className="rounded-lg"
                src={getAssetPath("/images/compression-bottom.png")}
                alt="Image region with more irregular detail"
              />
              <div className="text-sm font-bold text-gray-700">
                5.8 MB &rarr; <strong>2.8 MB</strong>
              </div>
            </div>
          </div>
        </div>
      </ArticleSection>

      <ArticleSection
        id="huffman-coding"
        eyebrow="Codebooks"
        title="Huffman coding"
      >
        <p>
          To understand the network, we need a compact way to describe how the
          random walker moves on it. Huffman coding gives short binary codes to
          symbols that appear often and longer codes to symbols that appear
          rarely, much like Morse code. If we can describe the walker with few
          bits, then we have captured important regularities in the network.
        </p>
        <p className="mb-8 text-gray-700">
          In a one-level partition, the walker uses one shared{" "}
          <strong>codebook</strong> <HelpTooltip content={CODEBOOK_HELP} /> for
          all nodes. In a two-level partition, the walker uses an{" "}
          <strong>index codebook</strong> to say which community it enters and a
          local module codebook for the nodes inside that community.
        </p>
        <WalkerControls
          network={network}
          rate={showVisitRates ? Rate.Visits : Rate.Uniform}
          showOptimized={showOptimized}
          showLinkWeights={showLinkWeights}
          onStartWalk={startRandomWalk}
          onToggleRate={() => setShowVisitRates(!showVisitRates)}
          onToggleLinkWeights={() => setShowLinkWeights(!showLinkWeights)}
          onToggleSolution={toggleSolution}
          speed={speed}
          onSpeedChange={setWalkerSpeed}
        />

        <div className="grid gap-10 xl:grid-cols-2 xl:items-start">
          <div className="min-w-0 space-y-8">
            <div className="p-5">
              <h3 className="mb-4 text-lg font-bold">One-level reference</h3>
              <div className="mb-4">
                <OneLevelCodelengthSummary network={network} />
              </div>
              <Network
                network={network}
                scheme={[neutralNodeColor]}
                schemeAlt={[neutralNodeColorAlt]}
                rate={showVisitRates ? Rate.Visits : Rate.Uniform}
                showLabels={true}
                showModules={false}
                showNodeId={false}
                nodeIdLayer="top"
                showVisiting={showVisitRates}
                scaleLinksByWeight={showLinkWeights}
                width={800}
                height={830}
                getNodeIdFill={getDarkerNodeIdFill}
              >
                <WalkTrace
                  walker={network.walker}
                  stroke={neutralLinkColor}
                  opacity={0.58}
                  minWidth={3.5}
                  maxWidth={18}
                  stableSegments
                />
                <Walker
                  walker={network.walker}
                  r={12}
                  fill={neutralNodeColorAlt}
                />
              </Network>
            </div>

            <div className="p-5">
              <h3 className="mb-4 text-lg font-bold">Running code printer</h3>
              <div className="space-y-2">
                <div className="min-w-0">
                  <InlineTrace network={network} />
                </div>
                <div className="min-w-0">
                  <InlineTrace network={network} showModules />
                </div>
              </div>
              <p className="mb-0 mt-4">
                The first trace prints the one-level code. The second trace
                prints the two-level code: when the walker crosses a community
                boundary, it prints an exit code, an enter code, and then the
                node code inside the new community.
              </p>
            </div>

            <div className="p-5">
              <h3 className="mb-4 text-lg font-bold">Two-level codebooks</h3>
              <CodeBooks network={network} />
              <CodeBookLegend />
            </div>
          </div>

          <aside className="min-w-0 xl:sticky xl:top-8">
            <div className="p-5">
              <div className="mb-4">
                <h3 className="m-0 text-lg font-bold">Two-level partition</h3>
              </div>
              <InteractiveNetwork
                network={network}
                numCommunities={NUM_COMMUNITIES}
                scheme={scheme}
                schemeAlt={schemeAlt}
                activeCommunity={activeCommunity}
                onActiveCommunityChange={setActiveCommunity}
                communitySelectorPlacement="overlay"
                communitySelectorOverlay={{ x: 0, y: 748, width: 785, height: 74 }}
                communitySelectorScale={1.35}
                topContent={<TwoLevelCodelengthSummary network={network} />}
                showLabels={true}
                showModules={true}
                showNodeId={false}
                showInstructions={false}
                nodeIdLayer="top"
                rate={showVisitRates ? Rate.Visits : Rate.Uniform}
                showVisiting={showVisitRates}
                scaleLinksByWeight={showLinkWeights}
                width={800}
                height={830}
                getNodeIdFill={getDarkerNodeIdFill}
              >
                <WalkTrace
                  walker={network.walker}
                  stroke={neutralLinkColor}
                  opacity={0.66}
                  minWidth={3.5}
                  maxWidth={18}
                  stableSegments
                  getStableSegmentStroke={getModuleTraceStroke}
                />
                <Walker
                  walker={network.walker}
                  r={12}
                  fill={neutralNodeColorAlt}
                />
                <EnterExitCodes network={network} x={610} y={390} />
              </InteractiveNetwork>
            </div>
          </aside>
        </div>
      </ArticleSection>

      <ArticleSection
        id="map-equation-codelength"
        eyebrow="Codelength"
        title="From Huffman codes to Shannon entropies"
        titleClassName="whitespace-nowrap"
        className="mb-36"
      >
        <p className="max-w-4xl">
          The code printer shows the symbols produced by a particular walk.
          Codelength asks for the average cost of that description: how many
          bits are needed per step for the one-level or two-level code. The map
          equation computes that average directly from flow rates and the
          current partition.
        </p>
        <div className="mt-8 min-w-0">
          <CodelengthChart network={network} />
        </div>
        <p className="max-w-4xl">
          Those formulas use the full weighted network. To make the counting
          easier to see, we next use a small unweighted network where every link
          contributes equally.
        </p>
        <TwoTriangleCodelengthWalkthrough />
      </ArticleSection>

      <ArticleSection
        id="beyond-two-levels"
        eyebrow="Multilevel mapequation"
        title="Beyond two levels"
        className="mb-32"
      >
        <div className="grid gap-10 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] xl:items-start">
          <div className="min-w-0 space-y-5">
            <p className="text-lg leading-relaxed text-gray-700">
              A two-level map can shorten the description by letting one index
              codebook point to smaller local codebooks. But if the network has
              structure inside those modules, stopping after one module layer
              leaves compression on the table.
            </p>
            <p>
              The map equation is naturally hierarchical: after the index
              chooses a module, that module can contain its own smaller map.
              Two-level coding is the constrained case where every module must
              immediately end in one local codebook.
            </p>
            <div className="space-y-2 text-base leading-8 text-gray-900">
              <h3 className="m-0 text-base font-bold text-gray-900">
                Multilevel map equation
              </h3>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <TeX math="L(M)=" />
                <MapEquationTerm
                  math="q_{\curvearrowleft}H(\mathcal{Q})"
                  tooltip="Top index. This codebook chooses among the broad modules at the current level."
                />
                <TeX math="+" />
                <MapEquationTerm
                  math="\sum_i L(M^i)"
                  tooltip={
                    <>
                      Recursive part. After module <TeX math="i" /> is chosen,
                      calculate the codelength of the smaller map inside that
                      module instead of stopping immediately.
                    </>
                  }
                />
              </div>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <TeX math="L(M^i)=" />
                <MapEquationTerm
                  math="q_{\circlearrowright}^{i}H(\mathcal{Q}^{i})"
                  tooltip={
                    <>
                      Lower index inside module <TeX math="i" />. This extra
                      codebook chooses among submodules contained in that
                      module.
                    </>
                  }
                />
                <TeX math="+" />
                <MapEquationTerm
                  math="\sum_j L(M^{ij})"
                  tooltip="Continue recursively. Each submodule is tested in the same way, and another level is kept only if it lowers total codelength."
                />
              </div>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <TeX math="L(M^{ij})=" />
                <MapEquationTerm
                  math="p_{\circlearrowright}^{ij}H(\mathcal{P}^{ij})"
                  tooltip={
                    <>
                      Final local codebook. When no deeper useful map remains,
                      this codebook prints node visits and exits inside module{" "}
                      <TeX math="ij" />.
                    </>
                  }
                />
              </div>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-gray-700">
                <span className="font-semibold">Two-level constraint:</span>
                <MapEquationTerm
                  math="q_{\curvearrowleft}H(\mathcal{Q})+\sum_i p_{\circlearrowright}^{i}H(\mathcal{P}^{i})"
                  tooltip="The two-level version has only the top index and one local codebook per module. There is no recursive submap, so nested structure is flattened."
                />
              </div>
            </div>
            <p className="text-gray-700">
              Infomap does not need the number of levels fixed in advance. It
              keeps an extra level only when the savings from smaller, more
              specific codebooks are larger than the cost of using another
              index codebook.
            </p>
          </div>
          <div className="min-w-0">
            <ArticleStep label="1" title="Two-level">
              <p className="m-0">
                One index codebook chooses among flat modules. Each module then
                uses one local codebook for node and exit symbols.
              </p>
            </ArticleStep>
            <ArticleStep label="2" title="Nested structure">
              <p className="m-0">
                A broad module can contain submodules, so the code can name a
                path through nested codebooks before naming the node.
              </p>
            </ArticleStep>
            <ArticleStep label="3" title="Keep levels that compress">
              <p className="m-0">
                Infomap keeps the nested structure only if it shortens the full
                flow description.
              </p>
            </ArticleStep>
          </div>
        </div>
      </ArticleSection>

      <HierarchicalCodebooks />

      <section className="col-span-4 mb-40">
        <RegularizedInfomap
          width={700}
          height={300}
          pajekNetworks={pajekNetworks}
        />
      </section>
    </>
  );
}
