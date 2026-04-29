import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useMemo,
  type ReactNode,
} from "react";
import { observer } from "mobx-react";
import { Network as NetworkModel, Node as NodeModel, Rate } from "../model";
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
        <span className="inline-flex items-center gap-1">
          <HelpTooltip content={INDEX_CODELENGTH_HELP} />
          <span>
            Index codelength {network.mapequation.indexCodelength.toFixed(3)}{" "}
            bits
          </span>
        </span>,
        <span className="inline-flex items-center gap-1">
          <HelpTooltip content={MODULE_CODELENGTH_HELP} />
          <span>
            Module codelength {network.mapequation.moduleCodelength.toFixed(3)}{" "}
            bits
          </span>
        </span>,
        `Total codelength ${network.mapequation.codelength.toFixed(3)} bits`,
      ]}
    />
  );
});

/**
 * Main demo component embedding the interactive visualizations and
 * explanatory text. This component is NOT observed to prevent re-rendering
 * on every walker step. Walker-dependent components are isolated.
 */
export default function Main() {
  const [rate, setRate] = useState(Rate.Uniform);
  const [speed, setSpeed] = useState(3);
  const [showOptimized, setShowOptimized] = useState(true);
  const [showVisitRates, setShowVisitRates] = useState(false);
  const [showLinkWeights, setShowLinkWeights] = useState(false);
  const [activeCommunity, setActiveCommunity] = useState(0);
  const firstNetworkRef = useRef<HTMLDivElement>(null);

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
      { threshold: 1, rootMargin: "0px 0px -100px 0px" },
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
      // Apply a hand-crafted (suboptimal) module assignment to demonstrate
      // differences between an optimized and a non-optimized partition.
      network.getNode(2)?.setTopModule(4);
      network.getNode(4)?.setTopModule(4);
      network.getNode(8)?.setTopModule(0);
      network.getNode(9)?.setTopModule(0);
      network.getNode(11)?.setTopModule(0);
      network.getNode(13)?.setTopModule(4);
      network.getNode(14)?.setTopModule(4);
      network.getNode(17)?.setTopModule(3);
      network.getNode(20)?.setTopModule(3);
      network.getNode(21)?.setTopModule(3);
    }
    // If currently showing bad solution, we've already reset to initial (optimal) above

    network.finalize();
    setShowOptimized(!showOptimized);
    network.walker.step();
    if (wasStarted) startRandomWalk();
  };

  return (
    <>
      {/* Primary visualization area. Children like `Walker` will be injected
          into the `Network` SVG so they can render overlays such as the
          moving walker glyph or visit trace. */}
      <div
        ref={firstNetworkRef}
        className="col-span-2 w-4/5 mx-auto xl:w-full mb-48"
      >
        <Network
          network={network}
          scheme={[neutralNodeColor]}
          schemeAlt={[neutralNodeColorAlt]}
          rate={showVisitRates ? Rate.Visits : Rate.Uniform}
          showLabels={false}
          showModules={false}
          showNodeId={false}
          showVisiting={showVisitRates}
          scaleLinksByWeight={showLinkWeights}
          width={800}
          height={830}
        >
          <WalkTrace
            walker={network.walker}
            stroke={neutralLinkColor}
            opacity={0.28}
          />
          <Walker walker={network.walker} r={12} fill={neutralNodeColorAlt} />
        </Network>
      </div>

      <div className="col-span-2 mb-20 xl:mb-48">
        <h1>The duality between compression and finding regularities</h1>
        <p>
          Compression algorithms use regularities to compress data. The more
          regularities they find, the better they can compress. In this image,
          the top half is easier to compress than the bottom part because of the
          repeated pattern in the clear blue sky.
        </p>
      </div>

      <div className="col-span-2 mb-48 mt-16 flex flex-col items-center space-y-6">
        <div>
          5.8 MB &rarr; <strong>0.91 MB</strong>
        </div>
        <div>
          <img
            className="rounded-lg shadow-lg"
            src={getAssetPath("/images/compression-top.png")}
            alt="top"
          />
        </div>
        <div>
          <img
            className="rounded-lg shadow-lg"
            src={getAssetPath("/images/compression-bottom.png")}
            alt=""
          />
        </div>
        <div>
          5.8 MB &rarr; <strong>2.8 MB</strong>
        </div>
      </div>

      <div className="col-span-4 mb-48">
        <h2 className="font-light mx-auto text-center lg:w-3/5 mb-48 leading-relaxed">
          By searching for <strong>optimal compression</strong> we will find the{" "}
          <strong>regularities</strong> that simplifies the data.
        </h2>
      </div>

      <section id="huffman-coding" className="col-span-4 mb-48">
        <h2>Huffman coding</h2>
        <p>
          To understand the network, we need a compact way to describe how the
          random walker moves on it. Huffman coding gives short binary codes to
          symbols that appear often and longer codes to symbols that appear
          rarely, much like Morse code. If we can describe the walker with few
          bits, then we have captured important regularities in the network.
        </p>
        <p className="mb-4 text-gray-700">
          Below we compare a <strong>one-level partition</strong> and a{" "}
          <strong>two-level partition</strong>. In the one-level partition, the
          walker uses one shared codebook for all nodes in the network. In the
          two-level partition, the walker uses an{" "}
          <strong>index codebook</strong> to say which community it is in and a
          separate local codebook inside each community for the nodes there.
        </p>
        <p className="mb-6 text-gray-700">
          When the walker stays inside the same community, it only prints the
          node code. When it moves to a different community, it first prints an{" "}
          <strong>exit code</strong> to leave the old community, then an{" "}
          <strong>enter code</strong> to enter the new one, and then the node
          code inside that community. Try changing the two-level partition
          yourself by selecting nodes and assigning them to different
          communities, and watch how the codelength changes.
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

        <div className="xl:grid xl:grid-cols-4 xl:items-start xl:gap-x-20">
          <div className="min-w-0 xl:col-span-2">
            <div className="mb-12">
              <h3 className="text-lg font-bold mb-4">One-Level Partition</h3>
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

            <div className="mb-12">
              <h3 className="text-lg font-bold mb-4">Running code printer</h3>
              <p className="mb-4">
                This trace prints the codewords emitted by the random walker in
                real time. The first line shows the one-level code, where every
                node uses a single shared codebook. The second line shows the
                two-level code: when the walker crosses a community boundary it
                prints an exit code, then an enter code, and then the node code
                inside the new community.
              </p>
              <div className="space-y-2">
                <div>
                  <InlineTrace network={network} />
                </div>
                <div>
                  <InlineTrace network={network} showModules />
                </div>
              </div>
              <CodelengthChart network={network} />
            </div>

            <div className="mb-16">
              <Rates
                network={network}
                rate={Rate.Visits}
                showModules
                duration={network.walker.interval}
              />
            </div>

            <div>
              <CodeBooks network={network} />
              <CodeBookLegend />
            </div>
          </div>

          <aside className="mt-10 xl:sticky xl:top-[10vh] xl:col-span-2 xl:mt-0 xl:w-[min(42vw,520px)] xl:justify-self-center">
            <h3 className="text-lg font-bold mb-4">Two-Level Partition</h3>
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
          </aside>
        </div>
      </section>

      <HierarchicalCodebooks />

      {/* Regularized Infomap Section */}
      <div className="col-span-4 mb-48">
        <RegularizedInfomap width={700} height={300} />
      </div>

      {/* Performance Dashboard */}
      <PerformanceDashboard />
    </>
  );
}
