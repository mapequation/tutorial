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

export default function Layout(props: { network: NetworkModel }) {
  const { network } = props;

  const [rate, setRate] = useState(Rate.None);

  const intervalStopped = -1;

  const [intervalId, setIntervalId] = useState(intervalStopped);

  const walkStarted = intervalId !== intervalStopped;

  const interval = 300;

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

  const ref = useRef<HTMLDivElement>(null);
  const isVisible = useOnScreen(ref, 1, intersected);

  return (
    <div className="container mx-auto text-gray-800 text-xl">
      <Header />
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
          <h2>What is The Map Equation?</h2>
          <ul className="space-y-4 mb-10">
            <li>
              The map equation is a way to <strong>cluster nodes</strong> in
              networks.
            </li>
            <li>
              Clusters (or modules) are where a you stay a long time if you
              follow the links randomly.
            </li>
            <li>
              We model this using a <strong>random walk</strong> on the network.
            </li>
          </ul>
          <div className="flex mb-96">
            <Button
              className="button button--primary"
              onClick={startRandomWalk}
            >
              Start random walk
            </Button>
          </div>
          <h2>How to measure random walks?</h2>
          <div ref={ref} className="mb-96">
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
