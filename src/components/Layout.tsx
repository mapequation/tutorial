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
import globe from '../images/globe.png';
import map1 from '../images/map-1.png';
import map2 from '../images/map-2.png';
import map3 from '../images/map-3.png';
import { animated, useChain, useSpring } from 'react-spring';

export default function Layout(props: { network: NetworkModel }) {
  const { network } = props;

  const [rate, setRate] = useState(Rate.None);

  const intervalStopped = -1;

  const [intervalId, setIntervalId] = useState(intervalStopped);

  const walkStarted = intervalId !== intervalStopped;

  const interval = 200;

  const startRandomWalk = () => {
    if (walkStarted) return;
    const id = window.setInterval(() => network.walker.step(), interval);
    setIntervalId(id);
  };

  const stopRandomWalk = () => {
    window.clearInterval(intervalId);
    setIntervalId(intervalStopped);
  };

  const resetRandomWalk = () => {
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

  const intersected = () => {
    setRate(Rate.Visits);
    if (!walkStarted) {
      //startRandomWalk();
    }
  };

  const rateWrapperRef = useRef<HTMLDivElement>(null);
  const isRateVisible = useOnScreen(rateWrapperRef, 1, intersected);

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
    <div className="container mx-auto text-gray-800 text-xl">
      <Header />

      <div className="grid grid-cols-4 gap-x-5 my-20 md:gap-x-10 lg:gap-x-20">
        <div className="flex flex-col gap-y-8 items-center my-12 mx-auto">
          <figure>
            <img
              className="rounded-full"
              src="//picsum.photos/400/400.jpg?grayscale"
              alt="Hairball graph"
            />
          </figure>
          <figcaption>placeholder hairball</figcaption>
        </div>
        <div className="col-span-3">
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

      <h2>What do we want to understand?</h2>

      <p>
        Like maps simplify and highlight important objects such as
        neighborhoods, cities, streets, and highways from high-resolution
        satellite images to help us navigate and explore our surroundings,{' '}
        <strong>we want to identify functional modules</strong> and how they are
        connected from large networks.
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
      <div className="grid grid-cols-2 gap-10">
        <div>
          <div className="sticky top-20">
            <Network
              network={network}
              getRate={getRate}
              rate={rate}
              showLabels={false}
              showModules={false}
            />
          </div>
        </div>

        <div>
          <p>
            We are often not interested in the raw network itself but the{' '}
            <strong>flows</strong> on the network.
          </p>
          <p>
            Flows of ideas in social networks, passenger flows in traffic
            networks, money flows in transaction networks&hellip;
          </p>
          <p>
            The flows connect nodes beyond nearest neighbors and interconnect
            the entire system. Flows tend to stay within certain groups of nodes
            for a relatively long time before exiting.
          </p>
          <p>These groups are the flow modules we are interested in.</p>
          <div className="flex mb-96 my-12">
            <Button
              className="button button--primary"
              onClick={startRandomWalk}
            >
              Start random walk
            </Button>
          </div>
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
          <div ref={rateWrapperRef} className="mb-96">
            <Rates
              network={network}
              getRate={getRate}
              rate={rate}
              showModules={false}
            />
            <div className="flex flex-row space-x-4 my-10">
              <Button className="button" type="reset" onClick={resetRandomWalk}>
                Reset
              </Button>
              <Button className="button" onClick={stepRandomWalk}>
                Step
              </Button>
              <Button
                className="button button--primary"
                onClick={toggleRandomWalk}
              >
                {walkStarted ? 'Stop' : 'Start'}
              </Button>
            </div>
          </div>
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
        </div>
      </div>
      <Footer />
    </div>
  );
}
