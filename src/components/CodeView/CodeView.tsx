import React from 'react';
import Svg from '../Svg';
import type { Network } from '../../model';
import Diagram from './Diagram';

interface Props {
  network: Network;
  width?: number | string;
  height?: number | string;
}

export default function ({ network, width = '40vw', height = '40vw' }: Props) {
  const [viewBoxWidth, viewBoxHeight] = [1000, 1000];
  const viewBox = `0 0 ${viewBoxWidth} ${viewBoxHeight}`;

  return (
    <>
      <Svg className="codeView" width={width} height={height} viewBox={viewBox}>
        <Diagram
          root={network.tree.root}
          width={viewBoxWidth}
          height={viewBoxHeight}
        />
      </Svg>
      <br />
      {'One-level codelength'}{' '}
      {network.mapequation.oneLevelCodelength.toFixed(3)} {'bits'}
      <br />
      {'Index codelength'} {network.mapequation.indexCodelength.toFixed(3)}{' '}
      {'bits'}
      <br />
      {'Module codelength'} {network.mapequation.moduleCodelength.toFixed(3)}{' '}
      {'bits'}
      <br />
      {'Codelength'} {network.mapequation.codelength.toFixed(3)} {'bits'}
    </>
  );
}
