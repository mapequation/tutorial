import React, { SVGProps } from 'react';
import { scaleSqrt, schemePastel2, schemeSet2 } from 'd3';
import Link from './Link';
import Node from './Node';
import ArrowMarker from './ArrowMarker';
import type {
  Link as LinkModel,
  Network as NetworkModel,
  Node as NodeModel,
} from '../../model';
import { Rate, getRate } from '../../model';
import { observer } from 'mobx-react';
import Svg from '../Svg';
import Walker from './Walker';

const nodeScale = scaleSqrt().domain([0, 1]).range([10, 100]);

interface Props {
  network: NetworkModel;
  rate?: Rate;
  showLabels?: boolean;
  showModules?: boolean;
  showWalker?: boolean;
}

function Network({
  network,
  rate = Rate.None,
  showLabels = false,
  showModules = false,
  showWalker = false,
  ...props
}: Props & SVGProps<SVGSVGElement>) {
  const arrowId = 'arrow';
  const markerEnd = network.directed ? `url(#${arrowId})` : undefined;

  const getNodeRate = getRate(rate, 1 / network.numNodes);

  const nodeRadius = (node: NodeModel): number => nodeScale(getNodeRate(node));

  const nodeFill = (node: NodeModel): string => {
    if (network.walker.current?.id === node.id) {
      return !showModules ? schemeSet2[0] : schemePastel2[node.module];
    }

    if (!showModules) return schemePastel2[0];

    return schemePastel2[node.module];
  };

  const nodeStroke = (node: NodeModel): string => {
    if (!showModules) return schemeSet2[0];

    return schemeSet2[node.module];
  };

  const getLabel = (node: NodeModel) =>
    showModules ? node.code : node.oneLevelCode;

  return (
    <Svg className="network" viewBox="0 0 800 800" {...props}>
      <defs>
        <ArrowMarker id={arrowId} fill="#888" />
      </defs>

      {network.links.map((link: LinkModel, i) => (
        <Link
          key={i}
          link={link}
          stroke="#888"
          strokeWidth={1.5 + 30 * link.flow}
          sourceRadius={nodeRadius(link.source)}
          targetRadius={nodeRadius(link.target)}
          markerEnd={markerEnd}
        />
      ))}

      {network.nodes.map((node: NodeModel, i) => (
        <Node
          node={node}
          key={i}
          r={nodeRadius(node)}
          x={node.x}
          y={node.y}
          fill={nodeFill(node)}
          stroke={nodeStroke(node)}
          showLabel={showLabels}
          getLabel={getLabel}
          strokeWidth={2}
        />
      ))}
      {showWalker && <Walker walker={network.walker} />}
    </Svg>
  );
}

export default observer(Network);
