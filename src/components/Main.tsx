import { observer } from "mobx-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Network as NetworkModel, Rate } from "../model";
import { modular_w_json } from "../networks";
import Button from "./Button";
import { Network, Walker, WalkTrace, EnterExitCodes } from "./Network";
import Trace from "./Trace";
import Rates from "./Rates";
import CodeBooks from "./CodeBooks";

const network = NetworkModel.parse(modular_w_json);

// TODO generalize and remove
network.nodes.forEach((node) => {
  node.x *= 800;
  node.y *= 800;
});


export default observer(function Main() {
  const [rate, setRate] = useState(Rate.Uniform);
  const firstNetworkRef = useRef<HTMLDivElement>(null);

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


  const walkTrace = <WalkTrace walker={network.walker} />;
  const walker = <Walker walker={network.walker} />;

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
          walker with a binary message. Huffman coding (Like Morse code,
          more frequently used symbols should be shorter).
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
        </div>
      </div>

      <div className="col-span-2 mb-48">
        <Network
          network={network}
          rate={rate}
          showLabels
        >
          {walkTrace}
          {walker}
        </Network>

        <Trace network={network} />
      </div>

      <div className="col-span-2 mb-48">
        <Network
          network={network}
          rate={rate}
          showLabels
          showModules
        >
          <EnterExitCodes network={network} x={30} y={700} />
          {walkTrace}
          {walker}
        </Network>

        <Trace network={network} showModules />
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
