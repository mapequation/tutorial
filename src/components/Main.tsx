import { observer } from "mobx-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Network as NetworkModel, Rate } from "../model";
import { modular_w_json } from "../networks";
import { scheme, schemeAlt } from "./scheme";
import Button from "./Button";
import { EnterExitCodes, Network, Walker, WalkTrace } from "./Network";
import { InlineTrace } from "./Trace";
import Rates from "./Rates";
import CodeBooks from "./CodeBooks";

const network = NetworkModel.parse(modular_w_json)
  .setNodeExtents([50, 650], [50, 700]);

export default observer(function Main() {
  const [rate, setRate] = useState(Rate.Uniform);
  const [speed, setSpeed] = useState(3);
  const [showOptimized, setShowOptimized] = useState(true);
  const firstNetworkRef = useRef<HTMLDivElement>(null);

  const setWalkerSpeed = (value: number) => {
    setSpeed(value);
    network.walker.setSpeed(value);
  };

  const startRandomWalk = useCallback(() => network.walker.start(), []);

  useEffect(() => {
    const currentRef = firstNetworkRef.current;
    if (!currentRef) return;

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
    if (showOptimized) {
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
      network.finalize();
    } else {
      network.setInitialModules();
      network.finalize();
    }
    setShowOptimized(!showOptimized);
    network.walker.step();
    if (wasStarted) startRandomWalk();
  };

  const walkTrace = <WalkTrace walker={network.walker} />;
  const walker = <Walker walker={network.walker} stroke="#fff" strokeWidth={2} />;

  return (
    <>
      <div
        ref={firstNetworkRef}
        className="col-span-2 w-4/5 mx-auto xl:w-full mb-48"
      >
        <Network network={network}>
          {walker}
        </Network>
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

        <div className="flex flex-row justify-center space-x-4 mt-10 mb-10">
          <Button className="button" onClick={() => network.walker.reset()}>
            Reset
          </Button>
          <Button className="button" onClick={() => network.walker.step()}>
            Step
          </Button>
          <Button
            className={`button ${
              !network.walker.isStarted ? "button--primary" : ""
            }`}
            onClick={() => network.walker.isStarted ? network.walker.stop() : startRandomWalk()}
          >
            {network.walker.isStarted
              ? "Stop Random Walk"
              : "Start Random Walk"}
          </Button>
          <Button
            className={`button ${
              rate === Rate.Visits ? "button--primary" : ""
            }`}
            onClick={() =>
              setRate(rate === Rate.Visits ? Rate.Uniform : Rate.Visits)
            }
          >
            {rate === Rate.Visits ? "Hide visit rate" : "Show visit rate"}
          </Button>
          <Button className="button" onClick={toggleSolution}>
            {showOptimized ? "Bad solution" : "Optimal solution"}
          </Button>
          <div className="flex flex-col items-center">
            <input type="range" id="walkerSpeed" min={1} max={10} step={1} value={speed}
                   onChange={(e) => setWalkerSpeed(+e.target.value)} />
            <label htmlFor="walkerSpeed">{speed} steps per second</label>
          </div>
        </div>
      </div>

      <div className="col-span-2 mb-10">
        <Network
          network={network}
          rate={rate}
          showLabels
        >
          {walkTrace}
          {walker}
        </Network>
      </div>

      <div className="col-span-2 mb-10">
        <Network
          network={network}
          scheme={scheme}
          schemeAlt={schemeAlt}
          rate={rate}
          showLabels
          showModules
        >
          <EnterExitCodes network={network} x={60} y={700} />
          {walkTrace}
          {walker}
        </Network>
      </div>

      <div className="col-span-4">
        <InlineTrace network={network} />
        <InlineTrace network={network} showModules />
      </div>

      <div className="col-span-2 mb-48">
        <Rates network={network} rate={Rate.Visits} showModules />
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
    </>
  );
});
