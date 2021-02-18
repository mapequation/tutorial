import React, { SVGProps } from 'react';
import { schemePastel2, schemeSet2 } from 'd3';
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

interface NetworkParams {
  network: NetworkModel;
  showVisitRate: boolean;
}

function Network({
  network,
  showVisitRate,
  ...props
}: NetworkParams & SVGProps<SVGSVGElement>) {
  const arrowId = 'arrow';
  const markerEnd = network.directed ? `url(#${arrowId})` : undefined;

  const nodeRadius = (node: NodeModel): number =>
    10 + 200 * (showVisitRate ? node.visitRate : node.flow);

  const nodeFill = (node: NodeModel): string => {
    if (showVisitRate && network.walker.current?.id === node.id) {
      return network.walker.teleported ? '#FE3265' : schemeSet2[node.module];
    }

    if (!network.haveModules) return '#fafafa';

    return schemePastel2[node.module];
  };

  const nodeStroke = (node: NodeModel): string => {
    if (!network.haveModules) return '#888888';

    return schemeSet2[node.module];
  };

  return (
    <Svg
      className="network"
      width={800}
      height={800}
      viewBox="0 0 800 800"
      {...props}
    >
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
          cx={node.x}
          cy={node.y}
          fill={nodeFill(node)}
          stroke={nodeStroke(node)}
          strokeWidth={2}
        />
      ))}
    </Svg>
  );
}

export default observer(Network);
