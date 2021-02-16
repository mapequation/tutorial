import React, { SVGProps } from 'react';
import { Link, Node } from './index';
import ArrowMarker from './ArrowMarker';
import type {
  Link as LinkModel,
  Network as NetworkModel,
  Node as NodeModel,
} from '../../model';
import { observer } from 'mobx-react';

interface NetworkParams {
  network: NetworkModel;
}

function Network({
  network,
  ...props
}: NetworkParams & SVGProps<SVGSVGElement>) {
  const arrowId = 'arrow';
  const markerEnd = network.directed ? `url(#${arrowId})` : undefined;

  const nodeRadius = (node: NodeModel): number => {
    if (network.showVisitRate) {
      return 10 + 50 * node.visitRate;
    }
    return 10 + 200 * node.flow;
  };

  const nodeFill = (node: NodeModel) => {
    if (network.showVisitRate && network.walker.current.id == node.id) {
      return '#00ACDA';
    }

    return '#fafafa';
  };

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
          stroke="#888"
          strokeWidth={2}
        />
      ))}
    </svg>
  );
}

export default observer(Network);
