import React, { useState } from 'react';
import { observer } from 'mobx-react';
import type { Network, Node } from '../../model';
import Svg from '../Svg';
import Bar from './Bar';
import OverflowMask from './OverflowMask';
import { schemePastel2, schemeSet2 } from 'd3';
import Convergence from './Convergence';
import { Button, Header, Icon } from 'semantic-ui-react';

interface Props {
  network: Network;
  width?: number | string;
  height?: number | string;
}

function Histogram({ network, width = '40vw', height = '30vw' }: Props) {
  const { nodes } = network;

  const [showVotes, setShowVotes] = useState(false);

  const initVotes = () => {
    network.voter.initialize();
    setShowVotes(true);
  };
  const vote = () => network.voter.vote();

  const rate = (node: Node): number =>
    showVotes ? node.votes : node.visitRate;

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

  const barFillStroke = (node: Node) => ({
    fill: schemePastel2[node.module],
    stroke: schemeSet2[node.module],
  });

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

  return (
    <>
      <Svg className="rateView" width={width} height={height} viewBox={viewBox}>
        <defs>
          <OverflowMask
            id="bar-overflow"
            numPoints={3 * nodes.length}
            width={viewBoxWidth}
            height={200} // NOTE this is the height from the top of the viewBox
          />
        </defs>
        {nodes.sort(byFlow).map((node, i) => (
          <Bar fill="#fafafa" stroke="#aaa" {...barProps(i, node.flow)} />
        ))}
        {nodes.sort(byFlow).map((node, i) => (
          <Bar
            {...barFillStroke(node)}
            opacity={0.6}
            {...barProps(i, rate(node))}
          />
        ))}
      </Svg>
      <Convergence network={network} rate={rate} />
      <Header>Iterative voting</Header>
      <Button onClick={initVotes}>
        <Icon name="undo alternate" /> Initialize votes
      </Button>
      <Button disabled={!showVotes} primary onClick={vote}>
        <Icon name="step forward" /> Vote
      </Button>
    </>
  );
}

export default observer(Histogram);
