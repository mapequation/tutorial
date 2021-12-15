import React from 'react';
import { observer } from 'mobx-react';
import type { Network, Node } from '../../model';
import Svg from '../Svg';
import Bar from './Bar';
import OverflowMask from './OverflowMask';
import { schemePastel2, schemeSet2 } from 'd3';
import { Rate } from '../../model/enums';

interface Props {
  network: Network;
  getRate: (node: Node) => number;
  rate: Rate;
  showModules: boolean;
  width?: number | string;
  height?: number | string;
}

function Rates({ network, getRate, rate, showModules }: Props) {
  const { nodes, maxNodeFlow } = network;

  const [viewBoxWidth, viewBoxHeight] = [1000, 800];
  const viewBox = `0 0 ${viewBoxWidth} ${viewBoxHeight}`;

  const barWidth = viewBoxWidth / nodes.length;

  const x = (i: number): number => barWidth * i;

  const minHeight = 1;
  const maxHeight = viewBoxHeight / 2;

  const barHeight = (scale: number): number =>
    minHeight + (maxHeight * scale) / maxNodeFlow;
  const y = (scale: number): number => viewBoxHeight - barHeight(scale);

  const barProps = (i: number, scale: number) => ({
    x: x(i),
    y: y(scale),
    width: barWidth,
    height: barHeight(scale),
    strokeWidth: 2,
    mask: 'url(#bar-overflow)',
  });

  const barFillStroke = (node: Node) => {
    return {
      fill: showModules ? schemePastel2[node.module] : schemePastel2[0],
      stroke: showModules ? schemeSet2[node.module] : schemeSet2[0],
    };
  };

  const nodesByFlow = nodes.sort((a: Node, b: Node): number => {
    if (a.module !== b.module) return b.moduleFlow - a.moduleFlow;
    return b.flow - a.flow;
  });

  return (
    <Svg className="rateView" viewBox={viewBox}>
      <defs>
        <OverflowMask
          id="bar-overflow"
          numPoints={3 * nodes.length}
          width={viewBoxWidth}
          height={200} // NOTE this is the height from the top of the viewBox
        />
      </defs>
      {nodesByFlow.map((node, i) => (
        <Bar
          key={i}
          fill="transparent"
          stroke="#ccc"
          {...barProps(i, node.flow)}
        />
      ))}
      {rate !== Rate.None &&
        nodesByFlow.map((node, i) => (
          <Bar
            key={i}
            animate
            opacity={0.6}
            {...barFillStroke(node)}
            {...barProps(i, getRate(node))}
          />
        ))}
    </Svg>
  );
}

export default observer(Rates);
