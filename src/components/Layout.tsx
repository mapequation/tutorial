import { useEffect, useRef, useState, useCallback } from 'react';
import type { Network as NetworkModel, Node } from '../model';
import Network from './Network';
import Rates from './Rates';
import { Rate } from '../model/enums';
import Button from './Button';
import CodeBooks from './CodeBooks';
import Trace from './Trace';

export default function Layout({ network }: { network: NetworkModel }) {
  const [rate, setRate] = useState(Rate.None);
  const [nodeSizeShowsRate, setNodeSizeShowsRate] = useState(false);

  const startRandomWalk = useCallback(() => {
    network.walker.start();
    setRate(Rate.Visits);
  }, [network]);

  const stopRandomWalk = () => network.walker.stop();

  const resetRandomWalk = () => {
    network.walker.reset();
    setRate(Rate.None);
  };

  const stepRandomWalk = () => {
    network.walker.step();
    setRate(Rate.Visits);
  };

  const toggleNodeSizeShowsRate = () =>
    setNodeSizeShowsRate(!nodeSizeShowsRate);

  const toggleRandomWalk = () =>
    network.walker.isStarted ? stopRandomWalk() : startRandomWalk();

  const getRate = (node: Node) => {
    if (rate === Rate.Visits) {
      return node.visitRate;
    } else if (rate === Rate.Votes) {
      return node.votes;
    } else if (rate === Rate.Flow) {
      return node.flow;
    }

    return 1 / network.numNodes;
  };

  const getUniformRate = (_: Node) => 1 / network.numNodes;

  const firstNetworkRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const firstNetworkObserver = new IntersectionObserver(
      (entries, observer) =>
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;

          startRandomWalk();

          observer.unobserve(entry.target);
        }),
      { threshold: 1, rootMargin: '0px 0px -100px 0px' },
    );

    firstNetworkObserver.observe(firstNetworkRef.current!);

    return () => firstNetworkObserver.disconnect();
  }, [startRandomWalk]);

  return (
    <main className="xl:grid xl:grid-cols-4 xl:gap-x-20">
      <div className="col-span-1 xl:mt-12 mb-20">
        <img
          className="rounded-full w-1/2 mx-auto xl:w-full"
          src="/demo/images/hairball.png"
          alt="Hairball graph"
        />
      </div>

      <div className="col-span-3 mb-48">
        <h1>A network is not enough</h1>
        <p>
          Networks of nodes and links are powerful abstractions of complex
          systems. But when the networks have thousands of nodes and links, they
          are themselves too complicated to comprehend, unless we simplify and
          highlight their organization.
        </p>
      </div>

      <div className="col-span-4 mb-20">
        <h2>Maps of networks</h2>
        <p>
          Geographic maps <b>simplify</b> and <b>highlight</b> streets,
          neighborhoods, cities, and highways from high-resolution satellite
          images. We want to create similar maps of networks.
        </p>
      </div>

      <div className="col-span-4 grid grid-cols-4 gap-x-5 md:gap-x-10 lg:gap-x-20 mb-48">
        <div>
          <img
            className="filter-grayscale-25 object-cover rounded-full shadow-xl"
            src="/demo/images/globe.png"
            alt="The Earth"
          />
        </div>
        <div className="relative">
          <img
            src="/demo/images/map-1.png"
            alt="Map over Europe"
            className="filter-grayscale-25 object-cover rounded-xl shadow-xl"
          />
        </div>
        <div className="relative">
          <img
            src="/demo/images/map-2.png"
            alt="Map over Umeå"
            className="filter-grayscale-25 object-cover rounded-xl shadow-xl"
          />
        </div>
        <div className="relative">
          <img
            src="/demo/images/map-3.png"
            alt="Map over Umeå University"
            className="filter-grayscale-25 object-cover rounded-xl shadow-xl"
          />
        </div>
      </div>

      <div className="col-span-2 xl:mb-48">
        <h2>Network flows</h2>
        <p>
          We are often not interested in the network itself. We want to know how
          things move &mdash; flow &mdash; on the network.
        </p>
        <ul className="ml-6 list-disc">
          <li>The flow of ideas in social networks</li>
          <li>Passenger moving in traffic networks</li>
          <li>Money in transaction networks</li>
        </ul>
        <p>
          The things moving on a network tend to stay within certain groups of
          nodes for a relatively long time before exiting. We call these groups
          modules, and these are what we are interested in.
        </p>
        <p>
          We can simulate the flows using a <strong>random walk</strong> on the
          network. Notice how the random walker will tend to get stuck in
          modules. To prevent getting too stuck, it teleports with a low
          probability to a random node.
        </p>
      </div>

      <div
        ref={firstNetworkRef}
        className="col-span-2 w-4/5 mx-auto xl:w-full mb-48"
      >
        <Network
          network={network}
          getRate={() => 1 / network.numNodes}
          showLabels={false}
          showModules={false}
          showWalker={rate === Rate.Visits}
        />
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
          By searching for <strong>optimal compression</strong> we will find the{' '}
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
        <div className="flex flex-row justify-center space-x-4 mt-10 mb-10">
          <Button className="button" onClick={resetRandomWalk}>
            Reset
          </Button>
          <Button className="button" onClick={stepRandomWalk}>
            Step
          </Button>
          <Button
            className={`button ${
              !network.walker.isStarted ? 'button--primary' : ''
            }`}
            onClick={toggleRandomWalk}
          >
            {network.walker.isStarted
              ? 'Stop Random Walk'
              : 'Start Random Walk'}
          </Button>
          <Button
            className={`button ${!nodeSizeShowsRate ? 'button--primary' : ''}`}
            onClick={toggleNodeSizeShowsRate}
          >
            {nodeSizeShowsRate ? 'Hide visit rate' : 'Show visit rate'}
          </Button>
        </div>
      </div>

      <div className="col-span-2 mb-48">
        <Network
          network={network}
          getRate={nodeSizeShowsRate ? getRate : getUniformRate}
          showLabels={true}
          showModules={false}
          showWalker={rate === Rate.Visits}
        />

        <Trace network={network} showModules={false} />
      </div>

      <div className="col-span-2 mb-48">
        <Network
          network={network}
          getRate={nodeSizeShowsRate ? getRate : getUniformRate}
          showLabels={true}
          showModules={true}
          showWalker={rate === Rate.Visits}
        />

        <Trace network={network} showModules={true} />
      </div>

      <div className="col-span-2 mb-48">
        <Rates
          network={network}
          getRate={getRate}
          rate={rate}
          showModules={true}
        />
      </div>

      <div className="col-span-2 mb-48">
        <CodeBooks network={network} />
        <br />
        {'One-level codelength'}{' '}
        {network.mapequation.oneLevelCodelength.toFixed(3)} {'bits'}
        <br />
        {'Index codelength'} {network.mapequation.indexCodelength.toFixed(3)}{' '}
        {'bits'}
        <br />
        {'Module codelength'} {network.mapequation.moduleCodelength.toFixed(3)}{' '}
        {'bits'}
        <br />
        {'Codelength'} {network.mapequation.codelength.toFixed(3)} {'bits'}
      </div>
    </main>
  );
}
