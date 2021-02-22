import React from 'react';
import Svg from '../Svg';
import type { Network } from '../../model';
import Module from './Module';

interface Props {
  network: Network;
  width?: number;
  height?: number;
}

export default function ({ network, height = 800, width = 800 }: Props) {
  const [viewBoxWidth, viewBoxHeight] = [1000, 800];
  const viewBox = `0 0 ${viewBoxWidth} ${viewBoxHeight}`;

  return (
    <Svg className="codeView" height={height} width={width} viewBox={viewBox}>
      <Module
        module={network.tree.root}
        x={0}
        y={viewBoxHeight}
        width={200}
        exitFlow={0}
      />
    </Svg>
  );
}
