import React, { useRef, useState } from 'react';
import type { Network as NetworkModel, Node } from '../model';
import Network from './Network';
import Rates from './Rates';
import CodeBooks from './CodeBooks';
import { Rate } from '../model/enums';
import Header from './Header';
import Footer from './Footer';
import useOnScreen from '../hooks/useOnScreen';
import Button from './Button';
import hairball from '../images/hairball.png';
import globe from '../images/globe.png';
import map1 from '../images/map-1.png';
import map2 from '../images/map-2.png';
import map3 from '../images/map-3.png';
import compressionTop from '../images/compression-top.png';
import compressionBottom from '../images/compression-bottom.png';
import { animated, useChain, useSpring } from 'react-spring';

export default function Layout(props: { network: NetworkModel }) {
  const { network } = props;

  const [rate, setRate] = useState(Rate.None);

  const intervalStopped = -1;

  const [intervalId, setIntervalId] = useState(intervalStopped);

  const walkStarted = intervalId !== intervalStopped;

  const interval = 300;

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

  const resetRandomWalk = () => {
    setRate(Rate.None);
    stopRandomWalk();
    network.walker.reset();
  };

  const stepRandomWalk = () => {
    stopRandomWalk();
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

  const mapsWrapperRef = useRef<HTMLDivElement>(null);
  const isMapsVisible = useOnScreen(mapsWrapperRef, 0);

  const springRefs = [useRef(), useRef(), useRef()];

  const mapProps = [
    useSpring({
      from: {
        opacity: 0,
        transform: 'scale(0) translate(-1400px, -300px)',
      },
      to: {
        opacity: 1,
        transform: 'scale(1) translate(0, 0)',
      },
      ref: springRefs[0],
    }),
    useSpring({
      from: {
        opacity: 0,
        transform: 'scale(0) translate(-1400px, -200px)',
      },
      to: {
        opacity: 1,
        transform: 'scale(1) translate(0, 0)',
      },
      ref: springRefs[1],
    }),
    useSpring({
      from: {
        opacity: 0,
        transform: 'scale(0) translate(-1400px, 0px)',
      },
      to: {
        opacity: 1,
        transform: 'scale(1) translate(0, 0)',
      },
      ref: springRefs[2],
    }),
  ];

  useChain(
    // @ts-ignore
    springRefs,
    isMapsVisible ? [1, 2, 3] : [10 ** 30, 10 ** 30, 10 ** 30],
  );

  const maps = [
    {
      src: map1,
      alt: 'Map over Europe',
    },
    {
      src: map2,
      alt: 'Map over Umeå',
    },
    {
      src: map3,
      alt: 'Map over Umeå University',
    },
  ];

  return (
    <div className="container mx-auto px-5 text-gray-800 text-xl">
      <Header />

      <div className="grid sm:grid-cols-4 mb-48 gap-x-5 my-20 md:gap-x-10 lg:gap-x-20">
        <div className="w-2/3 sm:w-auto mx-auto sm:my-12">
          <img className="rounded-full" src={hairball} alt="Hairball graph" />
        </div>
        <div className="md:col-span-3">
          <h1>
            <span className="font-serif font-thin tracking-tight italic text-indigo-400">
              Problem
            </span>
            <br />
            Complex systems are hard to understand
          </h1>
          <p>
            The <strong>network of interactions</strong> between the components
            of a complex system contains answers to the{' '}
            <strong>inner-workings</strong> of the system.
          </p>
          <p>
            But large interconnected systems are{' '}
            <strong>hard to understand</strong>.
          </p>
        </div>
      </div>

      <div className="mb-48">
        <h2>What do we want to understand?</h2>

        <p>
          Like maps simplify and highlight important objects such as
          neighborhoods, cities, streets, and highways from high-resolution
          satellite images to help us navigate and explore our surroundings,{' '}
          <strong>we want to identify functional modules</strong> and how they
          are connected from large networks.
        </p>

        <div
          ref={mapsWrapperRef}
          className="grid grid-cols-4 gap-x-5 my-28 md:gap-x-10 lg:gap-x-20 relative"
        >
          <div>
            <img
              className="object-cover rounded-full shadow-xl"
              src={globe}
              alt="The Earth"
            />
          </div>
          {isMapsVisible &&
            mapProps.map((props, i) => (
              // @ts-ignore
              <animated.div className="relative" style={props}>
                <img
                  src={maps[i].src}
                  alt={maps[i].alt}
                  className="object-cover shadow-lg rounded-lg"
                />
              </animated.div>
            ))}
        </div>
      </div>

      <div className="flex flex-row flex-wrap lg:flex-nowrap gap-x-20 mb-48 items-center">
        <div className="lg:w-3/5">
          <h2>Network flows</h2>
          <p>
            We are often not interested in the raw network itself but the{' '}
            <strong>flows</strong> on the network.
          </p>
          <ul className="ml-6 text-gray-600 list-disc">
            <li>Flows of ideas in social networks</li>
            <li>Passenger flows in traffic networks</li>
            <li>Money flows in transaction networks</li>
          </ul>
          <p>
            The flows connect nodes beyond nearest neighbors and interconnect
            the entire system. Flows tend to stay within certain groups of nodes
            for a relatively long time before exiting.
          </p>
          <p>These groups are the flow modules we are interested in.</p>
          <p>
            We can simulate the flows using a <strong>random walk</strong> on
            the network.
          </p>

          <div className="flex flex-row space-x-4 my-10">
            <Button className="button" onClick={stepRandomWalk}>
              Step
            </Button>
            <Button
              className="button button--primary"
              onClick={toggleRandomWalk}
            >
              {walkStarted ? 'Stop Random Walk' : 'Start Random Walk'}
            </Button>
          </div>
        </div>
        <div className="w-4/5 lg:w-2/5 ">
          <Network
            network={network}
            getRate={getRate}
            rate={rate}
            showLabels={false}
            showModules={false}
            showWalker={true}
          />
        </div>
      </div>

      <div className="flex flex-row flex-wrap md:flex-nowrap gap-x-20 mb-48">
        <div>
          <h1>
            <span className="font-serif font-thin tracking-tight italic text-indigo-400">
              Solution
            </span>
            <br />
            The duality between compression and finding regularities
          </h1>
          <p>
            Like maps depict regularities of interest in satellite images with
            less information, we want to exploit the{' '}
            <strong>
              duality between finding regularities and compressing information
            </strong>{' '}
            for finding modules in large networks.
          </p>
          <h2>Compression</h2>
          <p>
            This goal takes us to fundamental principles of cartography and
            information theory. Information-theoretic compression algorithms
            identify regularities to compress data.{' '}
            <strong>
              The more regularities they find, the better they can compress the
              data
            </strong>
            .
          </p>
        </div>
        <div className="mt-24 flex flex-col items-center space-y-6">
          <div>
            5.8 MB (tiff) &rarr; <strong>0.91 MB</strong> (tiff + LZW)
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
            5.8 MB (tiff) &rarr; <strong>2.8 MB</strong> (tiff + LZW)
          </div>
        </div>
      </div>

      <h2 className="font-light mx-auto text-center lg:w-3/5 mb-48">
        We are after the <span className="text-indigo-500">regularities</span>{' '}
        and use the <span className="text-indigo-500">compression rate</span> to
        measure how good we are at finding them.
      </h2>

      <h2>Huffman coding</h2>
      <p>
        To use the machinery of information theory, we describe the random
        walker with a binary message.
      </p>
      <p>
        Huffman coding (Like Morse code, more frequently used symbols should be
        shorter).
      </p>

      <Rates
        network={network}
        getRate={getRate}
        rate={rate}
        showModules={false}
      />
      <div className="mb-96">
        {/*
          <h2>Measuring the description length</h2>
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
          */}
      </div>
      <Footer />
    </div>
  );
}
