import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { observer } from "mobx-react";
import {
  Network as NetworkModel,
  Node as NodeModel,
  Rate,
} from "../model";
import { modular_w_json } from "../networks";
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
import Rates from "./Rates";
import CodeBooks from "./CodeBooks";
import CodeBookLegend from "./CodeBooks/CodeBookLegend";
import Network from "./Network/Network";
import InteractiveNetwork from "./InteractiveNetwork";
import WalkerControls from "./WalkerControls";
import PerformanceDashboard from "./PerformanceDashboard";
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

function CodelengthOverlay({
  x,
  y,
  width,
  lines,
}: {
  x: number;
  y: number;
  width: number;
  lines: ReactNode[];
}) {
  return (
    <foreignObject
      x={x}
      y={y}
      width={width}
      height={Math.max(32, lines.length * 28)}
    >
      <div className="pointer-events-none space-y-1 text-base leading-6 text-gray-900">
        {lines.map((line, index) => (
          <div key={index} className="pointer-events-none">
            {line}
          </div>
        ))}
      </div>
    </foreignObject>
  );
}

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
const ONE_LEVEL_FLOW_PULSE_INTERVAL_MS = 3000;
const ONE_LEVEL_FLOW_BLOB_ARRIVAL_MS = 2250;
const ONE_LEVEL_FLOW_RATE_STEPS = 5;
const ONE_LEVEL_FLOW_RATE_BASELINE = 0.02;
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

const ONE_LEVEL_FLOW_NODE_RADIUS = 28;

function linkEndpoints(
  source: NodeModel,
  target: NodeModel,
  radius = ONE_LEVEL_FLOW_NODE_RADIUS,
) {
  const x1 = source.x || 0;
  const y1 = source.y || 0;
  const x2 = target.x || 0;
  const y2 = target.y || 0;
  const dx = x2 - x1 || 1e-6;
  const dy = y2 - y1 || 1e-6;
  const length = Math.sqrt(dx * dx + dy * dy);
  const unitX = dx / length;
  const unitY = dy / length;

  return {
    x1: x1 + radius * unitX,
    y1: y1 + radius * unitY,
    x2: x2 - radius * unitX,
    y2: y2 - radius * unitY,
  };
}

function getOneLevelReceivedFlowRates(network: NetworkModel) {
  const rates = new Map(network.nodes.map((node) => [node.id, 0]));

  network.links.forEach((link) => {
    if (network.directed) {
      rates.set(link.target.id, (rates.get(link.target.id) ?? 0) + link.flow);
      return;
    }

    const flowPerDirection = link.flow / 2;
    rates.set(
      link.source.id,
      (rates.get(link.source.id) ?? 0) + flowPerDirection,
    );
    rates.set(
      link.target.id,
      (rates.get(link.target.id) ?? 0) + flowPerDirection,
    );
  });

  return rates;
}

function OneLevelFlowPulses({
  network,
  animationKey,
}: {
  network: NetworkModel;
  animationKey: number;
}) {
  const maxFlow = Math.max(...network.links.map((link) => link.flow), 1e-6);

  const pulses = network.links.flatMap((link, index) => [
    { link, source: link.source, target: link.target, key: `${index}-forward` },
    { link, source: link.target, target: link.source, key: `${index}-back` },
  ]);

  return (
    <g key={`one-level-flow-pulses-${animationKey}`} pointerEvents="none">
      {pulses.map(({ link, source, target, key }, index) => {
        const { x1, y1, x2, y2 } = linkEndpoints(source, target);
        const radius = 4.5 + 11 * Math.sqrt(link.flow / maxFlow);
        const begin = `${(index % 8) * 0.035}s`;

        return (
          <circle
            key={key}
            cx={x1}
            cy={y1}
            r={radius}
            fill="#4b5563"
            opacity={0}
          >
            <animate
              attributeName="cx"
              values={`${x1};${x2};${x2}`}
              keyTimes="0;0.667;1"
              dur="3s"
              begin={begin}
              repeatCount="indefinite"
            />
            <animate
              attributeName="cy"
              values={`${y1};${y2};${y2}`}
              keyTimes="0;0.667;1"
              dur="3s"
              begin={begin}
              repeatCount="indefinite"
            />
            <animate
              attributeName="opacity"
              values="0;0.72;0.72;0;0"
              keyTimes="0;0.05;0.6;0.667;1"
              dur="3s"
              begin={begin}
              repeatCount="indefinite"
            />
          </circle>
        );
      })}
    </g>
  );
}

const OneLevelCodelengthOverlay = observer(function OneLevelCodelengthOverlay({
  network,
}: {
  network: NetworkModel;
}) {
  // Read the update counter so this summary refreshes after partition edits
  // trigger `network.finalize()`, even though `Main` itself is not observed.
  network.treeUpdateCounter;
  const anchorNode = network.getNode(15);
  const x = (anchorNode?.x ?? 500) - 120;
  const y = (anchorNode?.y ?? 700) + 54;
  const relativeCodelength = formatRelativeCodelength(
    network.mapequation.oneLevelCodelength,
    network.mapequation.codelength,
  );

  return (
    <CodelengthOverlay
      x={x}
      y={y}
      width={240}
      lines={[
        `One-level codelength ${network.mapequation.oneLevelCodelength.toFixed(3)} bits`,
        relativeCodelength,
      ]}
    />
  );
});

const TwoLevelCodelengthOverlay = observer(function TwoLevelCodelengthOverlay({
  network,
}: {
  network: NetworkModel;
}) {
  // Read the update counter so this summary refreshes after partition edits
  // trigger `network.finalize()`, even though `Main` itself is not observed.
  network.treeUpdateCounter;
  const anchorNode = network.getNode(15);
  const x = (anchorNode?.x ?? 500) - 120;
  const y = (anchorNode?.y ?? 700) + 54;

  return (
    <CodelengthOverlay
      x={x}
      y={y}
      width={280}
      lines={[
        <span>
          <HelpTooltip content={INDEX_CODELENGTH_HELP} /> Index codelength{" "}
          {network.mapequation.indexCodelength.toFixed(3)} bits
        </span>,
        <span>
          <HelpTooltip content={MODULE_CODELENGTH_HELP} /> Module codelength{" "}
          {network.mapequation.moduleCodelength.toFixed(3)} bits
        </span>,
        `Total codelength ${network.mapequation.codelength.toFixed(3)} bits`,
      ]}
    />
  );
});

function ArticleSection({
  id,
  eyebrow,
  title,
  children,
  className = "",
}: {
  id?: string;
  eyebrow?: string;
  title?: string;
  children: ReactNode;
  className?: string;
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
          {title && <h2 className="mb-4 mt-0">{title}</h2>}
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
  const [oneLevelFlowPulseIndex, setOneLevelFlowPulseIndex] = useState(0);
  const [oneLevelFlowActive, setOneLevelFlowActive] = useState(false);
  const [oneLevelFlowAnimationKey, setOneLevelFlowAnimationKey] = useState(0);
  const firstNetworkRef = useRef<HTMLDivElement>(null);
  const oneLevelFlowRef = useRef<HTMLDivElement>(null);
  const oneLevelFlowRateScale =
    oneLevelFlowPulseIndex / ONE_LEVEL_FLOW_RATE_STEPS;
  const oneLevelReceivedFlowRates = getOneLevelReceivedFlowRates(network);

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

  useEffect(() => {
    const currentRef = oneLevelFlowRef.current;
    if (!currentRef) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        const isVisible = entry.isIntersecting;
        setOneLevelFlowActive(isVisible);

        if (isVisible) {
          setOneLevelFlowPulseIndex(0);
          setOneLevelFlowAnimationKey((key) => key + 1);
        }
      },
      { threshold: 0.05 },
    );

    observer.observe(currentRef);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!oneLevelFlowActive) return;

    let intervalId: number | undefined;
    const updateBarsAfterBlobArrival = () => {
      setOneLevelFlowPulseIndex(
        (pulseIndex) => (pulseIndex + 1) % (ONE_LEVEL_FLOW_RATE_STEPS + 1),
      );
    };
    const arrivalTimeoutId = window.setTimeout(() => {
      updateBarsAfterBlobArrival();
      intervalId = window.setInterval(
        updateBarsAfterBlobArrival,
        ONE_LEVEL_FLOW_PULSE_INTERVAL_MS,
      );
    }, ONE_LEVEL_FLOW_BLOB_ARRIVAL_MS);

    return () => {
      window.clearTimeout(arrivalTimeoutId);
      if (intervalId !== undefined) {
        window.clearInterval(intervalId);
      }
    };
  }, [oneLevelFlowActive]);

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
        title="Can you make the code shorter?"
        className="mb-36"
      >
        <div className="grid gap-8 xl:grid-cols-[minmax(0,0.72fr)_minmax(0,1fr)] xl:items-start">
          <div className="min-w-0 space-y-5">
            <p className="text-lg leading-relaxed text-gray-700">
              Before reading the definitions, try changing the partition. Draw
              a lasso around nodes, choose a community, and watch the total
              codelength respond.
            </p>
            <ArticleStep label="1" title="Choose a community">
              <p className="m-0">
                Pick one of the colored community buttons above the network.
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
            className="min-w-0 p-4 xl:sticky xl:top-8"
          >
            <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h3 className="m-0 text-lg font-bold">Two-level partition</h3>
                <p className="m-0 text-sm text-gray-600">
                  Directly edit the communities and see the coding cost change.
                </p>
              </div>
            </div>
            <InteractiveNetwork
              network={network}
              numCommunities={NUM_COMMUNITIES}
              scheme={scheme}
              schemeAlt={schemeAlt}
              activeCommunity={activeCommunity}
              onActiveCommunityChange={setActiveCommunity}
              showLabels={true}
              showModules={true}
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
              <EnterExitCodes network={network} x={200} y={660} />
              <TwoLevelCodelengthOverlay network={network} />
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
              <Network
                network={network}
                scheme={[neutralNodeColor]}
                schemeAlt={[neutralNodeColorAlt]}
                rate={showVisitRates ? Rate.Visits : Rate.Uniform}
                showLabels={true}
                showModules={false}
                showNodeId={true}
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
                <OneLevelCodelengthOverlay network={network} />
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
              <CodeBooks network={network} />
              <CodeBookLegend />
            </div>
          </div>

          <aside className="min-w-0 xl:sticky xl:top-8">
            <div className="p-5">
              <h3 className="mb-4 text-lg font-bold">Two-level partition</h3>
              <InteractiveNetwork
                network={network}
                numCommunities={NUM_COMMUNITIES}
                scheme={scheme}
                schemeAlt={schemeAlt}
                activeCommunity={activeCommunity}
                onActiveCommunityChange={setActiveCommunity}
                showLabels={true}
                showModules={true}
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
                <EnterExitCodes network={network} x={200} y={660} />
                <TwoLevelCodelengthOverlay network={network} />
              </InteractiveNetwork>
            </div>
          </aside>
        </div>
      </ArticleSection>

      <ArticleSection
        id="map-equation-codelength"
        eyebrow="Codelength"
        title="Start with one-level codelength"
        className="mb-36"
      >
        <p className="max-w-4xl">
          A one-level code uses one shared codebook for the whole network. The
          codelength is the average number of bits needed to name the next node
          visited by flow on the network: common nodes should get short codes,
          and rare nodes can afford longer codes.
        </p>
        <div
          ref={oneLevelFlowRef}
          className="grid gap-10 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] xl:items-start"
        >
          <div className="min-w-0 p-5">
            <CodelengthChart network={network} />
          </div>
          <aside className="min-w-0 space-y-6 p-5 xl:sticky xl:top-8">
            <div>
              <h3 className="mb-2 text-lg font-bold">
                One-level flow reference
              </h3>
              <p className="mb-4 text-sm leading-relaxed text-gray-600">
                Every three seconds, each node sends flow along its links.
                Larger blobs mark links with higher flow.
              </p>
              <Network
                network={network}
                scheme={[neutralNodeColor]}
                schemeAlt={[neutralNodeColorAlt]}
                rate={Rate.Uniform}
                showLabels={false}
                showModules={false}
                showNodeId={true}
                nodeIdLayer="top"
                showVisiting={false}
                width={800}
                height={830}
                getNodeIdFill={getDarkerNodeIdFill}
                underlayChildren={
                  <OneLevelFlowPulses
                    network={network}
                    animationKey={oneLevelFlowAnimationKey}
                  />
                }
              />
            </div>
            <div>
              <h3 className="mb-2 text-lg font-bold">Node visit rates</h3>
              <p className="mb-3 text-sm leading-relaxed text-gray-600">
                These grey bars start from an even 0.02 baseline and move
                toward the visit-rate probabilities used in the one-level
                entropy calculation as the flow pulses repeat.
              </p>
              <Rates
                network={network}
                rate={Rate.Flow}
                showModules={false}
                duration={900}
                monochrome
                rateScale={oneLevelFlowRateScale}
                rateBaseline={ONE_LEVEL_FLOW_RATE_BASELINE}
                getRateOverride={(node) =>
                  oneLevelReceivedFlowRates.get(node.id) ?? node.flow
                }
              />
            </div>
            <div>
              <h3 className="mb-2 text-lg font-bold">
                Walker node visit rates
              </h3>
              <p className="mb-3 text-sm leading-relaxed text-gray-600">
                The colored bars show the visit rates measured from the running
                random walker.
              </p>
              <Rates
                network={network}
                rate={Rate.Visits}
                showModules
                duration={network.walker.interval}
              />
            </div>
          </aside>
        </div>
      </ArticleSection>

      <section className="col-span-4 mb-40">
        <RegularizedInfomap width={700} height={300} />
      </section>

      <HierarchicalCodebooks />

      {/* Performance Dashboard */}
      <PerformanceDashboard />
    </>
  );
}
