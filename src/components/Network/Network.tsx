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
import { observer } from 'mobx-react';
import Svg from '../Svg';
import { Rate } from '../../model/enums';
import Walker from './Walker';

interface Props {
  network: NetworkModel;
  rate: Rate;
  getRate: (node: NodeModel) => number;
  showLabels: boolean;
  showModules: boolean;
  showWalker: boolean;
}

function Network({
  network,
  rate,
  getRate,
  showLabels,
  showModules,
  showWalker,
  ...props
}: Props & SVGProps<SVGSVGElement>) {
  const arrowId = 'arrow';
  const markerEnd = network.directed ? `url(#${arrowId})` : undefined;

  const nodeScale = scaleSqrt().domain([0, 1]).range([10, 100]);

  const nodeRadius = (node: NodeModel): number => nodeScale(getRate(node));

  const nodeFill = (node: NodeModel): string => {
    if (network.walker.current?.id === node.id) {
      if (network.walker.teleported) {
        return '#FE3265';
      }

      return !showModules ? schemeSet2[0] : schemePastel2[node.module];
    }

    if (!showModules) return schemePastel2[0];

    return schemePastel2[node.module];
  };

  const nodeStroke = (node: NodeModel): string => {
    if (!showModules) return schemeSet2[0];

    return schemeSet2[node.module];
  };

  const nodeLabel = (node: NodeModel): string => {
    if (!showLabels) return '';

    return node.code;
  };

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
          strokeWidth={1.5 + 20 * link.flow}
          sourceRadius={nodeRadius(link.source)}
          targetRadius={nodeRadius(link.target)}
          markerEnd={markerEnd}
        />
      ))}

      {network.nodes.map((node: NodeModel, i) => (
        <Node
          key={i}
          r={nodeRadius(node)}
          x={node.x}
          y={node.y}
          fill={nodeFill(node)}
          label={nodeLabel(node)}
          stroke={nodeStroke(node)}
          strokeWidth={2}
        />
      ))}
      {showWalker && <Walker walker={network.walker} />}
    </Svg>
  );
}

export default observer(Network);
