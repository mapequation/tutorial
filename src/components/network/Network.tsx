import React from 'react';
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

function Network({ network, directed }: NetworkParams) {
  const arrowId = 'arrow';
  const markerEnd = directed ? `url(#${arrowId})` : undefined;

  return (
    <svg className="network" style={{ width: '100vw', height: '100vh' }}>
      <defs>
        <ArrowMarker id={arrowId} fill="#000" />
      </defs>

      {network.links.map((link: LinkModel) => (
        <Link
          key={link.index}
          link={link}
          stroke="#000"
          strokeWidth={2}
          nodeRadius={20}
          markerEnd={markerEnd}
        />
      ))}

      {network.nodes.map((node: NodeModel) => (
        <Node
          key={node.index}
          r={20}
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
