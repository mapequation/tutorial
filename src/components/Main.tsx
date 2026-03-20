import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { observer } from "mobx-react";
import { Network as NetworkModel, Node as NodeModel, Rate } from "../model";
import { modular_w_json } from "../networks";
import { scheme, schemeAlt } from "./scheme";
import { CodelengthChart, InlineTrace } from "./Trace";
import Rates from "./Rates";
import CodeBooks from "./CodeBooks";
import CodeBookLegend from "./CodeBooks/CodeBookLegend";
import Network from "./Network/Network";
import InteractiveNetwork from "./InteractiveNetwork";
import WalkerControls from "./WalkerControls";
import PerformanceDashboard from "./PerformanceDashboard";
import RegularizedInfomap from "./RegularizedInfomap";
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

const CodelengthSummary = observer(function CodelengthSummary({
  network,
}: {
  network: NetworkModel;
}) {
  // Read the update counter so this summary refreshes after partition edits
  // trigger `network.finalize()`, even though `Main` itself is not observed.
  network.treeUpdateCounter;

  return (
    <div className="mt-4 space-y-1 text-sm">
      <div>
        {"One-level codelength "}
        {network.mapequation.oneLevelCodelength.toFixed(3)} {"bits"}
      </div>
      <div>
        {"Index codelength "}
        {network.mapequation.indexCodelength.toFixed(3)} {"bits"}
      </div>
      <div>
        {"Module codelength "}
        {network.mapequation.moduleCodelength.toFixed(3)} {"bits"}
      </div>
      <div>
        {"Codelength"} {network.mapequation.codelength.toFixed(3)} {"bits"}
      </div>
    </div>
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
          scheme={["#d7d7d7"]}
          schemeAlt={["#a8a8a8"]}
          rate={showVisitRates ? Rate.Visits : Rate.Uniform}
          showLabels={false}
          showModules={false}
          showNodeId={false}
          showVisiting={showVisitRates}
          scaleLinksByWeight={showLinkWeights}
          width={800}
          height={830}
        >
          <WalkTrace walker={network.walker} stroke="#a3a3a3" opacity={0.28} />
          <Walker walker={network.walker} r={12} fill="#4a4a4a" />
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
            src="/demo/images/compression-top.png"
            alt="top"
          />
        </div>
        <div>
          <img
            className="rounded-lg shadow-lg"
            src="/demo/images/compression-bottom.png"
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

      <div className="col-span-4">
        <h2>Huffman coding</h2>
        <p>
          To use the machinery of information theory, we describe the random
          walker with a binary message. Huffman coding (Like Morse code, more
          frequently used symbols should be shorter).
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
      </div>

      <div className="col-span-2 mb-10">
        <h3 className="text-lg font-bold mb-4">One-Level Partition</h3>
        <Network
          network={network}
          scheme={["#ddd"]}
          schemeAlt={["#aaa"]}
          rate={showVisitRates ? Rate.Visits : Rate.Uniform}
          showLabels={true}
          showModules={false}
          showNodeId={true}
          showVisiting={showVisitRates}
          scaleLinksByWeight={showLinkWeights}
          width={800}
          height={830}
        >
          <WalkTrace walker={network.walker} stroke="#999" opacity={0.4} />
          <Walker walker={network.walker} r={12} fill="#666" />
        </Network>
        <CodelengthSummary network={network} />
      </div>

      <div className="col-span-2 mb-10">
        <h3 className="text-lg font-bold mb-4">Two-Level Partition</h3>
        <InteractiveNetwork
          network={network}
          numCommunities={8}
          scheme={scheme}
          schemeAlt={schemeAlt}
          showLabels={true}
          showModules={true}
          rate={showVisitRates ? Rate.Visits : Rate.Uniform}
          showVisiting={showVisitRates}
          scaleLinksByWeight={showLinkWeights}
          width={800}
          height={830}
        >
          <WalkTrace walker={network.walker} stroke="#888" opacity={0.5} />
          <Walker walker={network.walker} r={12} fill="#393939" />
          <EnterExitCodes network={network} x={200} y={660} />
        </InteractiveNetwork>
      </div>

      <div className="col-span-4 mb-12">
        <h3 className="text-lg font-bold mb-4">Running code printer</h3>
        <p className="mb-4">
          This trace prints the codewords emitted by the random walker in real
          time. The first line shows the one-level code, where every node uses a
          single shared codebook. The second line shows the two-level code: when
          the walker crosses a community boundary it prints an exit code, then
          an enter code, and then the node code inside the new community.
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

      <div className="col-span-2 mb-48">
        <Rates
          network={network}
          rate={Rate.Visits}
          showModules
          duration={network.walker.interval}
        />
      </div>

      <div className="col-span-2 mb-48">
        <CodeBooks network={network} />
        <CodeBookLegend />
      </div>

      {/* Regularized Infomap Section */}
      <div className="col-span-4 mb-48">
        <RegularizedInfomap width={700} height={300} />
      </div>

      {/* Performance Dashboard */}
      <PerformanceDashboard />
    </>
  );
}
