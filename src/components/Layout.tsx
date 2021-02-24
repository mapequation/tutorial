import React, { useState } from 'react';
import type { Network as NetworkModel, Node } from '../model';
import Network from './Network';
import RateView from './RateView';
import CodeView from './CodeView';
import { Rate } from '../model/enums';
import Header from './Header';
import Footer from './Footer';

export default function Layout(props: { network: NetworkModel }) {
  const { network } = props;

  const [rate, setRate] = useState(Rate.None);

  const intervalStopped = -1;

  const [intervalId, setIntervalId] = useState(intervalStopped);

  const walkStarted = intervalId !== intervalStopped;

  const interval = 300;

  const startRandomWalk = () => {
    if (walkStarted) {
      window.clearInterval(intervalId);
      setIntervalId(intervalStopped);
    }
    const id = window.setInterval(() => network.walker.step(), interval);
    setIntervalId(id);
  };

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
    <>
      <div className="container mx-auto text-gray-800 text-xl">
        <Header />
        <div className="fixed -my-40">
          <Network
            network={network}
            getRate={getRate}
            rate={rate}
            showLabels={false}
            showModules={false}
          />
        </div>
        <div className="grid grid-cols-2 gap-10">
          <div />
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
                We model this using a <strong>random walk</strong> on the
                network.
              </li>
            </ul>
            <div className="flex mb-96">
              <button
                className="button button--primary ml-40"
                type="button"
                onClick={startRandomWalk}
              >
                Start random walk
              </button>
            </div>

            <h2>How to measure random walks?</h2>

            <RateView
              network={network}
              getRate={getRate}
              rate={rate}
              setRate={setRate}
            />
            <CodeView network={network} />
          </div>
        </div>
        <Footer />
      </div>
    </>
  );
}
