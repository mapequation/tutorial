import { SVGProps } from "react";
import { scaleSqrt, schemePastel2, schemeSet2 } from "d3";
import Link from "./Link";
import Node from "./Node";
import ArrowMarker from "./ArrowMarker";
import type { Network as NetworkModel, Node as NodeModel } from "../../model";
import { getRate, Rate } from "../../model";
import { observer } from "mobx-react";
import Walker from "./Walker";
import WalkTrace from "./WalkTrace";

const nodeScale = scaleSqrt().domain([0, 1]).range([10, 100]);

interface Props {
  network: NetworkModel;
  rate?: Rate;
  showLabels?: boolean;
  showModules?: boolean;
  showWalker?: boolean;
  width?: number,
  height?: number
}

function Network({
  network,
  rate = Rate.Uniform,
  showLabels = false,
  showModules = false,
  showWalker = false,
  width = 800,
  height = 800,
  ...props
}: Props & SVGProps<SVGSVGElement>) {
  const arrowId = "arrow";
  const markerEnd = network.directed ? `url(#${arrowId})` : undefined;

  const getNodeRate = getRate(rate);

  const nodeRadius = (node: NodeModel): number => nodeScale(getNodeRate(node));

  const scheme = schemePastel2;
  const visitScheme = schemeSet2;
  const strokeScheme = visitScheme;
  const schemeIndex = (node: NodeModel) => (showModules ? node.module : 0);

  const nodeFill = (node: NodeModel) =>
    network.walker.isVisiting(node)
      ? visitScheme[schemeIndex(node)]
      : scheme[schemeIndex(node)];

  const nodeStroke = (node: NodeModel) => strokeScheme[schemeIndex(node)];

  const getLabel = (node: NodeModel) =>
    showModules ? node.code : node.oneLevelCode;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="network"
      viewBox={`0 0 ${width} ${height}`}
      {...props}
    >
      <defs>
        <ArrowMarker id={arrowId} fill="#888" />
      </defs>

      {network.links.map((link, i) => (
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

      {network.nodes.map((node, i) => (
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
      {showWalker && <WalkTrace walker={network.walker} />}
      {showWalker && <Walker walker={network.walker} />}
    </svg>
  );
}

export default observer(Network);
