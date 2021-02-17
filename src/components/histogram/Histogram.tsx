import React from 'react';
import { observer } from 'mobx-react';
import type { Network as NetworkModel } from '../../model';
import Svg from '../Svg';
import Bar from './Bar';

interface HistogramProps {
  network: NetworkModel;
  width?: number;
  height?: number;
}

function Histogram({ network, width = 800, height = 800 }: HistogramProps) {
  const { nodes } = network;

  const [viewBoxWidth, viewBoxHeight] = [1000, 1000];
  const viewBox = `0 0 ${viewBoxWidth} ${viewBoxHeight}`;

  const barWidth = viewBoxWidth / nodes.length;
  const minHeight = 1;
  const maxHeight = viewBoxHeight;

  const x = (i: number): number => barWidth * i;

  const barHeight = (scale: number): number => minHeight + maxHeight * scale;
  const y = (scale: number): number => maxHeight - barHeight(scale);

  const barProps = (i: number, scale: number) => ({
    key: i,
    x: x(i),
    y: y(scale),
    width: barWidth,
    height: barHeight(scale),
    stroke: '#888',
    strokeWidth: 1,
  });

  return (
    <Svg className="histogram" width={width} height={height} viewBox={viewBox}>
      {nodes.map((node, i) => (
        <Bar fill="#fafafa" {...barProps(i, node.flow)} />
      ))}
      {nodes.map((node, i) => (
        <Bar fill="#00ACDA" opacity={0.2} {...barProps(i, node.visitRate)} />
      ))}
    </Svg>
  );
}

export default observer(Histogram);
