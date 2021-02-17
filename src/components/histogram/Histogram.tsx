import React from 'react';
import { observer } from 'mobx-react';
import type { Network as NetworkModel, Node as NodeModel } from '../../model';
import Svg from '../Svg';
import Bar from './Bar';
import OverflowMask from './OverflowMask';

interface HistogramProps {
  network: NetworkModel;
  width?: number;
  height?: number;
}

function Histogram({ network, width = 800, height = 800 }: HistogramProps) {
  const { nodes } = network;

  const [viewBoxWidth, viewBoxHeight] = [1000, 400];
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
    mask: 'url(#bar-overflow)',
  });

  const byFlow = (a: NodeModel, b: NodeModel): number => b.flow - a.flow;

  return (
    <Svg className="histogram" width={width} height={height} viewBox={viewBox}>
      <defs>
        <OverflowMask
          id="bar-overflow"
          numPoints={3 * nodes.length}
          width={viewBoxWidth}
          height={200}
        />
      </defs>
      {nodes.sort(byFlow).map((node, i) => (
        <Bar fill="#fafafa" {...barProps(i, node.flow)} />
      ))}
      {nodes
        .sort(byFlow)
        .filter((node) => node.visitRate > 0)
        .map((node, i) => (
          <Bar fill="#00ACDA" opacity={0.25} {...barProps(i, node.visitRate)} />
        ))}
    </Svg>
  );
}

export default observer(Histogram);
