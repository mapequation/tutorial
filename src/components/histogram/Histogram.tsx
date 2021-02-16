import React from 'react';
import { observer } from 'mobx-react';
import type { Network as NetworkModel } from '../../model';
import Svg from '../Svg';
import Bar from './Bar';

function Histogram(props: { network: NetworkModel }) {
  const { network } = props;

  return (
    <Svg className="histogram" width={800} height={800} viewBox="0 0 800 800">
      {network.nodes.map((node, i) => (
        <Bar
          key={i}
          x={20 * i}
          y={550 - 1000 * node.flow}
          width={20}
          height={1000 * node.flow}
          stroke="#888"
          strokeWidth={1}
          fill="#fafafa"
        />
      ))}
      {network.nodes.map((node, i) => (
        <Bar
          key={i}
          x={20 * i}
          y={550 - 1000 * node.visitRate}
          width={20}
          height={1000 * node.visitRate}
          stroke="#888"
          strokeWidth={1}
          fill="#00ACDA"
          opacity={0.2}
        />
      ))}
    </Svg>
  );
}

export default observer(Histogram);
