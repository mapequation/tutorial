import React, { useState } from 'react';
import type { Network as NetworkModel, Node } from '../model';
import Network from './Network';
import Rates from './Rates';
import { Rate } from '../model/enums';
import Header from './Header';
import Footer from './Footer';
import Button from './Button';
import hairball from '../images/hairball.png';
import globe from '../images/globe.png';
import map1 from '../images/map-1.png';
import map2 from '../images/map-2.png';
import map3 from '../images/map-3.png';
import compressionTop from '../images/compression-top.png';
import compressionBottom from '../images/compression-bottom.png';
import CodeBooks from './CodeBooks';

export default function Layout(props: { network: NetworkModel }) {
  const { network } = props;

  const [rate, setRate] = useState(Rate.None);

  const intervalStopped = -1;

  const [intervalId, setIntervalId] = useState(intervalStopped);

  const walkStarted = intervalId !== intervalStopped;

  const interval = 400;

  const startRandomWalk = () => {
    if (walkStarted) return;
    setRate(Rate.Visits);
    const id = window.setInterval(() => network.walker.step(), interval);
    setIntervalId(id);
  };

  const stopRandomWalk = () => {
    window.clearInterval(intervalId);
    setIntervalId(intervalStopped);
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const resetRandomWalk = () => {
    setRate(Rate.None);
    stopRandomWalk();
    network.walker.reset();
  };

  const stepRandomWalk = () => {
    stopRandomWalk();
    setRate(Rate.Visits);
    network.walker.step();
  };

  const toggleRandomWalk = () =>
    walkStarted ? stopRandomWalk() : startRandomWalk();

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

  return (
    <div className="container mx-auto px-5">
      <Header />
      <main className="xl:grid xl:grid-cols-4 xl:gap-x-20">
        <div className="col-span-1 xl:mt-12 mb-20">
          <img
            className="rounded-full w-1/2 mx-auto xl:w-full"
            src={hairball}
            alt="Hairball graph"
          />
        </div>

        <div className="col-span-3 mb-48">
          <h1>Page title</h1>
          <p>
            Networks of nodes and links are powerful abstractions of complex
            systems. But when the networks have thousands of nodes and links,
            they are themselves too complicated to comprehend, unless we
            simplify and highlight their organization.
          </p>
        </div>

        <div className="col-span-4 mb-20">
          <h2>Maps of networks</h2>
          <p>
            Maps simplify and highlight streets, neighborhoods, cities, and
            highways from high-resolution satellite images. We want to create
            similar maps of networks.
          </p>
        </div>

        <div className="col-span-4 grid grid-cols-4 gap-x-5 md:gap-x-10 lg:gap-x-20 mb-48">
          <div>
            <img
              className="filter-grayscale-25 object-cover rounded-full shadow-xl"
              src={globe}
              alt="The Earth"
            />
          </div>
          <div className="relative">
            <img
              src={map1}
              alt="Map over Europe"
              className="filter-grayscale-25 object-cover rounded-full shadow-xl"
            />
          </div>
          <div className="relative">
            <img
              src={map2}
              alt="Map over Umeå"
              className="filter-grayscale-25 object-cover rounded-full shadow-xl"
            />
          </div>
          <div className="relative">
            <img
              src={map3}
              alt="Map over Umeå University"
              className="filter-grayscale-25 object-cover rounded-full shadow-xl"
            />
          </div>
        </div>

        <div className="col-span-2 xl:mb-48">
          <h2>Network flows</h2>
          <p>
            We are often not interested in the network itself. We want to know
            how things move &mdash; flow &mdash; on the network.
          </p>
          <ul className="ml-6 list-disc">
            <li>The flow of ideas in social networks</li>
            <li>Passenger moving in traffic networks</li>
            <li>Money in transaction networks</li>
          </ul>
          <p>
            The things moving on a network tend to stay within certain groups of
            nodes for a relatively long time before exiting. We call these
            groups modules, and these are what we are interested in.
          </p>
          <p>
            We can simulate the flows using a <strong>random walk</strong> on
            the network. Here, we can identify four modules. Notice how the
            random walker will tend to get stuck in the modules. To prevent
            getting stuck, in each step, it teleports to a random node with low
            probability.
          </p>

          <div className="flex flex-row justify-center space-x-4 my-10">
            <Button className="button" onClick={stepRandomWalk}>
              Step
            </Button>
            <Button
              className={`transition button ${
                !walkStarted ? 'button--primary' : ''
              }`}
              onClick={toggleRandomWalk}
            >
              {walkStarted ? 'Stop Random Walk' : 'Start Random Walk'}
            </Button>
          </div>
        </div>

        <div className="col-span-2 w-4/5 mx-auto xl:w-full mb-48">
          <Network
            network={network}
            getRate={getRate}
            rate={rate}
            showLabels={false}
            showModules={false}
            showWalker={walkStarted}
          />
        </div>

        <div className="col-span-2 mb-20 xl:mb-48">
          <h1>The duality between compression and finding regularities</h1>
          <p>
            Like maps show interesting things in satellite images using less
            information, we want to use the duality between finding regularities
            and compressing information for finding modules in networks. This
            goal leads to fundamental principles of cartography and information
            theory. Compression algorithms use regularities to compress data.
            The more they find, the better they can compress. In this image, the
            top half is easier to compress than the bottom part because of the
            clear blue sky.
          </p>
        </div>

        <div className="col-span-2 mb-48 mt-16 flex flex-col items-center space-y-6">
          <div>
            5.8 MB &rarr; <strong>0.91 MB</strong>
          </div>
          <div>
            <img
              className="rounded-lg shadow-lg"
              src={compressionTop}
              alt="top"
            />
          </div>
          <div>
            <img
              className="rounded-lg shadow-lg"
              src={compressionBottom}
              alt=""
            />
          </div>
          <div>
            5.8 MB &rarr; <strong>2.8 MB</strong>
          </div>
        </div>

        <div className="col-span-4 mb-48">
          <h2 className="font-light mx-auto text-center lg:w-3/5 mb-48">
            We are after the <strong>regularities</strong> and use the{' '}
            <strong>compression rate</strong> to measure how good we are at
            finding them.
          </h2>
        </div>

        <div className="col-span-2 mb-20 xl:mb-48">
          <h2>Huffman coding</h2>
          <p>
            To use the machinery of information theory, we describe the random
            walker with a binary message. Huffman coding (Like Morse code, more
            frequently used symbols should be shorter).
          </p>
        </div>

        <div className="col-span-2 mb-48">
          <Rates
            network={network}
            getRate={getRate}
            rate={rate}
            showModules={false}
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
          {'Module codelength'}{' '}
          {network.mapequation.moduleCodelength.toFixed(3)} {'bits'}
          <br />
          {'Codelength'} {network.mapequation.codelength.toFixed(3)} {'bits'}
        </div>
      </main>
      <Footer />
    </div>
  );
}
