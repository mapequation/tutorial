import React, { SVGProps } from 'react';
import { Link, Node } from './index';
import ArrowMarker from './ArrowMarker';
import type {
  Network as NetworkModel,
  Link as LinkModel,
  Node as NodeModel,
} from '../../model';

interface NetworkParams {
  network: NetworkModel;
  directed: boolean;
}

function Network({
  network,
  directed,
  ...props
}: NetworkParams & SVGProps<SVGSVGElement>) {
  const arrowId = 'arrow';
  const markerEnd = directed ? `url(#${arrowId})` : undefined;

  const nodeRadius = (flow: number): number => 10 + 200 * flow;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      version="1.1"
      className="network"
      width={800}
      height={800}
      viewBox="0 0 800 800"
      style={{ border: '2px #000' }}
      {...props}
    >
      <defs>
        <ArrowMarker id={arrowId} fill="#000" />
      </defs>

      {network.links.map((link: LinkModel, i) => (
        <Link
          key={i}
          link={link}
          stroke="#000"
          strokeWidth={2}
          sourceRadius={nodeRadius(link.source.flow)}
          targetRadius={nodeRadius(link.target.flow)}
          markerEnd={markerEnd}
        />
      ))}

      {network.nodes.map((node: NodeModel, i) => (
        <Node
          key={i}
          r={nodeRadius(node.flow)}
          cx={node.x}
          cy={node.y}
          fill="#fafafa"
          stroke="#888"
          strokeWidth={2}
        />
      ))}
    </svg>
  );
}

export default Network;
