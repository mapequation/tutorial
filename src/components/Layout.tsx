import React, { useState } from 'react';
// @ts-ignore
import { BlockMath } from 'react-katex';
import 'katex/dist/katex.min.css';
import type { Network as NetworkModel, Node } from '../model';
import Network from './Network';
import ToggleWalkButton from './ToggleWalkButton';
import RateView from './RateView';
import CodeView from './CodeView';
import { Rate } from '../model/enums';

export default function Layout(props: { network: NetworkModel }) {
  const { network } = props;

  const [rate, setRate] = useState(Rate.Flow);

  const step = () => {
    if (rate !== Rate.Visits) setRate(Rate.Visits);
    network.walker.step();
  };

  const getRate = (node: Node) => {
    if (rate === Rate.Visits) {
      return node.visitRate;
    } else if (rate === Rate.Votes) {
      return node.votes;
    }

    return node.flow;
  };

  const resetWalk = () => {
    setRate(Rate.Visits);
    network.walker.reset();
  };

  return (
    <>
      <div className="container mx-auto">
        <header className="mx-auto my-48 text-center">
          <h1>
            <span className="mb-0 text-indigo-400 text-7xl font-serif font-thin italic">
              Understanding
            </span>
            <br />
            <span className="text-gray-700 text-8xl border-b-8 border-gray-300">
              The Map Equation
            </span>
          </h1>
          <div className="mt-44 text-6xl text-gray-600">
            <BlockMath math="L(M) = q_\curvearrowright H(\mathcal{Q}) + \sum_{i = 1}^{m}{p_{\circlearrowright}^i H(\mathcal{P}^i)}" />
          </div>
        </header>
        <Network network={network} getRate={getRate} rate={rate} />
        <br />
        Random walker
        <br />
        <button onClick={resetWalk} type="button">
          Reset
        </button>
        <button onClick={step}>Step</button>
        <ToggleWalkButton onClick={step} />
        <RateView
          network={network}
          getRate={getRate}
          rate={rate}
          setRate={setRate}
        />
        <CodeView network={network} />
      </div>
    </>
  );
}
