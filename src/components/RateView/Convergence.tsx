import React, { useState } from 'react';
import { Progress } from 'semantic-ui-react';
import type { Network, Node } from '../../model';

interface Props {
  network: Network;
  getRate: (node: Node) => number;
}

export default function ({ network, getRate }: Props) {
  const error = network.nodes.reduce((tot, node) => {
    const diff = Math.abs(getRate(node) - node.flow);
    return tot + diff;
  }, 0.0);

  const percent = Math.round(Math.max(0, 100 * (1 - error)));

  return (
    <Progress
      style={{ width: '40vw' }}
      percent={percent}
      size="tiny"
      color="grey"
    />
  );
}
