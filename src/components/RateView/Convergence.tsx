import React, { useState } from 'react';
import { Progress } from 'semantic-ui-react';
import type { Network } from '../../model';

interface Props {
  network: Network;
}

export default function ({ network }: Props) {
  const error = network.nodes.reduce((tot, node) => {
    const diff = Math.abs(node.visitRate - node.flow);
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
