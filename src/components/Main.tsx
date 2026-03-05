import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { Network as NetworkModel, Node as NodeModel, Rate } from "../model";
import { modular_w_json } from "../networks";
import { scheme, schemeAlt } from "./scheme";
import { InlineTrace } from "./Trace";
import Rates from "./Rates";
import CodeBooks from "./CodeBooks";
import HuffmanTreeView from "./HuffmanTreeView";
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
const network = NetworkModel.parse(modular_w_json)
  .setNodeExtents([50, 650], [50, 700]);

/**
 * Main demo component embedding the interactive visualizations and
 * explanatory text. This component is NOT observed to prevent re-rendering
 * on every walker step. Walker-dependent components are isolated.
 */
export default function Main() {
  const [rate, setRate] = useState(Rate.Uniform);
  const [speed, setSpeed] = useState(3);
  const [showOptimized, setShowOptimized] = useState(true);
  const [showVisitRates, setShowVisitRates] = useState(true);
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
        <h2 className="text-2xl font-bold mb-4">Network Visualization</h2>
        <InteractiveNetwork
          network={network}
          numCommunities={8}
          scheme={scheme}
          schemeAlt={schemeAlt}
          showLabels={true}
          showModules={true}
        />
      </div>

      <div className="col-span-2 mb-20 xl:mb-48">
        <h1>The duality between compression and finding regularities</h1>
        <p>
          Compression algorithms use regularities to compress data. The more
          regularities they find, the better they can compress. In this
          image, the top half is easier to compress than the bottom part
          because of the repeated pattern in the clear blue sky.
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
          By searching for <strong>optimal compression</strong> we will find
          the <strong>regularities</strong> that simplifies the data.
        </h2>
      </div>

      <div className="col-span-4">
        <h2>Huffman coding</h2>
        <p>
          To use the machinery of information theory, we describe the random
          walker with a binary message.
          Huffman coding (Like Morse code, more frequently used symbols should be shorter).
        </p>

        <WalkerControls
          network={network}
          rate={showVisitRates ? Rate.Visits : Rate.Uniform}
          showOptimized={showOptimized}
          onStartWalk={startRandomWalk}
          onToggleRate={() => setShowVisitRates(!showVisitRates)}
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
          width={800}
          height={830}
        >
          <WalkTrace walker={network.walker} stroke="#999" opacity={0.4} />
          <Walker walker={network.walker} r={12} fill="#666" />
        </Network>
      </div>

      <div className="col-span-2 mb-10">
        <h3 className="text-lg font-bold mb-4">Reassign Nodes to Communities</h3>
        <InteractiveNetwork
          network={network}
          numCommunities={8}
          scheme={scheme}
          schemeAlt={schemeAlt}
          showLabels={true}
          showModules={true}
          rate={showVisitRates ? Rate.Visits : Rate.Uniform}
          showVisiting={showVisitRates}
          width={800}
          height={830}
        >
          <WalkTrace walker={network.walker} stroke="#888" opacity={0.5} />
          <Walker walker={network.walker} r={12} fill="#393939" />
          <EnterExitCodes network={network} x={200} y={660} />
        </InteractiveNetwork>
      </div>

      <div className="col-span-4">
        <InlineTrace network={network} />
        <InlineTrace network={network} showModules />
      </div>

      <div className="col-span-2 mb-48">
        <Rates network={network} rate={Rate.Visits} showModules duration={network.walker.interval} />
      </div>

      <div className="col-span-2 mb-48">
        <CodeBooks network={network} />
        <br />
        {"One-level codelength "}
        {network.mapequation.oneLevelCodelength.toFixed(3)} {"bits"}
        <br />
        {"Index codelength "}
        {network.mapequation.indexCodelength.toFixed(3)} {"bits"}
        <br />
        {"Module codelength "}
        {network.mapequation.moduleCodelength.toFixed(3)} {"bits"}
        <br />
        {"Codelength"} {network.mapequation.codelength.toFixed(3)} {"bits"}
      </div>

      {/* Huffman Index Tree - updates when modules change */}
      <div className="col-span-2 mb-48">
        <h3 className="text-xl font-bold mb-4">Module Enter Codes (Index Tree)</h3>
        <HuffmanTreeView 
          treeNode={network.tree.root} 
          treeType="index" 
          network={network}
          width={1400} 
          height={500} 
        />
      </div>

      {/* Huffman One-Level Tree */}
      <div className="col-span-2 mb-48">
        <h3 className="text-xl font-bold mb-4">One-Level Huffman Tree</h3>
        <p className="mb-4 text-gray-600">
          Flat Huffman tree for all nodes, ignoring module structure.
        </p>
        <HuffmanTreeView 
          treeNode={network.tree.root} 
          treeType="oneLevel" 
          network={network}
          width={1400} 
          height={600} 
        />
      </div>

      {/* Module Huffman Trees */}
      <div className="col-span-2 mb-48">
        <h3 className="text-xl font-bold mb-4">Module Huffman Trees</h3>
        <p className="mb-4 text-gray-600">
          Individual Huffman trees for each module, showing codes for module exits and node visits.
        </p>
        <div className="space-y-8">
          {Array.from(network.tree.root.children.values()).map((moduleNode) => (
            <div key={moduleNode.id} className="border rounded-lg p-4 w-full">
              <h4 className="text-lg font-semibold mb-4">Module {moduleNode.id}</h4>
              {moduleNode.isLeafModule ? (
                <HuffmanTreeView
                  treeNode={moduleNode}
                  treeType="module"
                  network={network}
                  width={1400}
                  height={450}
                />
              ) : (
                <p className="text-gray-500">Not a leaf module</p>
              )}
            </div>
          ))}
        </div>
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
