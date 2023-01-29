import { SVGProps } from "react";
import { observer } from "mobx-react";
import { scaleSqrt } from "d3";
import type { Network as NetworkModel, Node as NodeModel } from "../../model";
import { getRate, Rate } from "../../model";
import ArrowMarker from "./ArrowMarker";
import Link from "./Link";
import Node from "./Node";

const nodeScale = scaleSqrt().domain([0, 1]).range([10, 100]);

interface Props {
  network: NetworkModel;
  scheme: string[],
  schemeAlt: string[],
  rate?: Rate;
  showLabels?: boolean;
  showModules?: boolean;
  showVisiting?: boolean;
  modules?: "topModule",
  width?: number,
  height?: number
}

function Network({
  network,
  scheme,
  schemeAlt,
  rate = Rate.Uniform,
  showLabels = false,
  showModules = false,
  showVisiting = true,
  modules = "topModule",
  width = 800,
  height = 800,
  children,
  ...props
}: Props & SVGProps<SVGSVGElement>) {
  const arrowId = "arrow";
  const markerEnd = network.directed ? `url(#${arrowId})` : undefined;

  const getNodeRate = getRate(rate);

  const nodeRadius = (node: NodeModel): number => nodeScale(getNodeRate(node));

  const schemeIndex = (node: NodeModel) => (showModules ? node[modules] : 0);

  const nodeFill = (node: NodeModel) => {
    const i = schemeIndex(node)
    return showVisiting && network.walker.isVisiting(node)
      ? schemeAlt[i >= schemeAlt.length ? 0 : i]
      : scheme[i >= scheme.length ? 0 : i];
  };

  const nodeStroke = (node: NodeModel) => {
    const i = schemeIndex(node)
    return schemeAlt[i >= schemeAlt.length ? 0 : i];
  };

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
          strokeWidth={1 + 100 * link.flow}
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
          getLabel={showLabels ? getLabel : undefined}
          strokeWidth={2}
        />
      ))}

      {children}
    </svg>
  );
}

export default observer(Network);
