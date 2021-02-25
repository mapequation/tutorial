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
  const { nodes } = network;

  const [viewBoxWidth, viewBoxHeight] = [1000, 800];
  const viewBox = `0 0 ${viewBoxWidth} ${viewBoxHeight}`;

  const barWidth = viewBoxWidth / nodes.length;

  const x = (i: number): number => barWidth * i;

  const minHeight = 1;
  const maxFlow = Math.max(...nodes.map((node) => node.flow));
  const maxHeight = viewBoxHeight / 2;

  const barHeight = (scale: number): number =>
    minHeight + (maxHeight * scale) / maxFlow;
  const y = (scale: number): number => viewBoxHeight - barHeight(scale);

  const barProps = (i: number, scale: number) => ({
    key: i,
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

  const moduleFlow = (node: Node) => {
    // TODO remove
    let totFlow = 0.0;

    for (let { module, flow } of nodes) {
      if (module === node.module) {
        totFlow += flow;
      }
    }

    return totFlow;
  };

  const byFlow = (a: Node, b: Node): number => {
    if (a.module !== b.module) return moduleFlow(b) - moduleFlow(a);
    return b.flow - a.flow;
  };

  const nodesByFlow = nodes.sort(byFlow);

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
        <Bar fill="transparent" stroke="#aaa" {...barProps(i, node.flow)} />
      ))}
      {rate !== Rate.None &&
        nodesByFlow.map((node, i) => (
          <Bar
            {...barFillStroke(node)}
            opacity={0.6}
            {...barProps(i, getRate(node))}
          />
        ))}
    </Svg>
  );
}

export default observer(Rates);
