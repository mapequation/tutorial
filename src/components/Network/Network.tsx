import { SVGProps } from "react";
import { observer } from "mobx-react";
import { useMemo, useCallback } from "react";
import { scaleSqrt } from "d3";
import type {
  Network as NetworkModel,
  Node as NodeModel,
  Link as LinkModel,
} from "../../model";
import { getRate, Rate } from "../../model";
import { performanceMonitor } from "../../utils/performance";
import {
  neutralLinkColor,
  neutralNodeColor,
  neutralNodeColorAlt,
} from "../scheme";
import ArrowMarker from "./ArrowMarker";
import Link from "./Link";
import Node from "./Node";

// A scale used to map a node's visit-rate to a visual radius. The domain
// and range are tuned for the demo but can be configured if networks grow.
const defaultNodeScale = scaleSqrt().domain([0, 1]).range([10, 100]);

interface Props {
  network: NetworkModel;
  scheme?: string[],
  schemeAlt?: string[],
  rate?: Rate;
  showLabels?: boolean;
  showModules?: boolean;
  showNodeId?: boolean;
  nodeIdPosition?: "top" | "middle";
  nodeIdFontSize?: number;
  showVisiting?: boolean;
  colorIntraModuleLinks?: boolean;
  interModuleLinkColor?: string;
  nodeStroke?: string;
  nodeStrokeWidth?: number;
  modules?: "topModule",
  width?: number,
  height?: number,
  getLabel?: (node: NodeModel) => string | number;
  labelPosition?: "top" | "bottom" | "middle";
  selectedNodeIds?: Set<number>;
  nodeScale?: (value: number) => number;
  scaleLinksByWeight?: boolean;
  baseLinkStrokeWidth?: number;
}

/**
 * `Network` SVG component.
 *
 * Renders the network model as an SVG using `Link` and `Node` subcomponents.
 * It accepts visual options like color schemes, whether to reveal module
 * labels, and how to compute node radii (via `rate`). Children passed into
 * this component are rendered inside the SVG, enabling overlays such as the
 * walker glyph or visit trace.
 */
function Network({
  network,
  scheme = [neutralNodeColor],
  schemeAlt = [neutralNodeColorAlt],
  rate = Rate.Uniform,
  showLabels = false,
  showModules = false,
  showNodeId = true,
  nodeIdPosition = "middle",
  nodeIdFontSize = 12,
  showVisiting = true,
  colorIntraModuleLinks = false,
  interModuleLinkColor = neutralLinkColor,
  nodeStroke = "#fff",
  nodeStrokeWidth = 4,
  modules = "topModule",
  width = 800,
  height = 800,
  getLabel: customGetLabel,
  labelPosition = "top",
  selectedNodeIds,
  nodeScale = defaultNodeScale,
  scaleLinksByWeight = false,
  baseLinkStrokeWidth = 3,
  children,
  style,
  ...props
}: Props & SVGProps<SVGSVGElement>) {
  // Mark render start
  performanceMonitor.mark('network-render');

  const arrowId = "arrow";
  const markerEnd = network.directed ? `url(#${arrowId})` : undefined;

  const getNodeRate = useMemo(() => getRate(rate), [rate]);

  // Memoize the nodeRadius function
  const nodeRadius = useCallback(
    (node: NodeModel): number => nodeScale(getNodeRate(node)),
    [getNodeRate, nodeScale]
  );

  const schemeIndex = useCallback(
    (node: NodeModel) => (showModules ? node[modules] : 0),
    [showModules, modules]
  );

  const nodeFill = useCallback(
    (node: NodeModel) => {
      const i = schemeIndex(node);
      return showVisiting && network.walker.isVisiting(node)
        ? schemeAlt[i >= schemeAlt.length ? 0 : i]
        : scheme[i >= scheme.length ? 0 : i];
    },
    [showVisiting, scheme, schemeAlt, schemeIndex, network.walker]
  );

  const linkStroke = useCallback(
    (link: LinkModel) => {
      if (!colorIntraModuleLinks || !showModules) {
        return interModuleLinkColor;
      }

      const sourceModule = link.source[modules];
      const targetModule = link.target[modules];

      if (sourceModule === targetModule) {
        const i = sourceModule >= scheme.length ? 0 : sourceModule;
        return scheme[i];
      }

      return interModuleLinkColor;
    },
    [colorIntraModuleLinks, showModules, interModuleLinkColor, modules, scheme]
  );

  const maxLinkWeight = network.links.reduce(
    (maxWeight, link) => Math.max(maxWeight, link.weight),
    1,
  );

  const linkStrokeWidth = useCallback(
    (link: LinkModel) => {
      if (!scaleLinksByWeight) return baseLinkStrokeWidth;

      return 1.5 + (12 * link.weight) / maxLinkWeight;
    },
    [baseLinkStrokeWidth, maxLinkWeight, scaleLinksByWeight]
  );

  const getLabel = useCallback(
    (node: NodeModel) => customGetLabel ? customGetLabel(node) : (showModules ? node.code : node.oneLevelCode),
    [showModules, customGetLabel, network.treeUpdateCounter]
  );

  const svgElement = (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="network"
      viewBox={`0 0 ${width} ${height}`}
      onLoad={() => performanceMonitor.measure('network-render')}
      style={{ overflow: "visible", ...style }}
      {...props}
    >
      <defs>
        <ArrowMarker id={arrowId} fill={interModuleLinkColor} />
      </defs>

      {/* Render links first so nodes appear above them. Optionally scale
          thickness by link weight; otherwise keep a uniform width. */}
      {network.links.map((link, i) => (
        <Link
          key={i}
          link={link}
          stroke={linkStroke(link)}
          strokeWidth={linkStrokeWidth(link)}
          sourceRadius={nodeRadius(link.source)}
          targetRadius={nodeRadius(link.target)}
          markerEnd={markerEnd}
        />
      ))}

      {/* Render nodes on top of links. Pass animation duration from the
          network walker so node transitions sync with the walker updates. */}
      {network.nodes.map((node, i) => (
        <Node
          node={node}
          key={i}
          r={nodeRadius(node)}
          x={node.x}
          y={node.y}
          fill={nodeFill(node)}
          stroke={nodeStroke}
          strokeWidth={nodeStrokeWidth}
          duration={network.walker.interval}
          showLabel={showLabels}
          getLabel={showLabels ? getLabel : undefined}
          labelPosition={labelPosition}
          showNodeId={showNodeId}
          nodeIdPosition={nodeIdPosition}
          nodeIdFontSize={nodeIdFontSize}
          isSelected={selectedNodeIds?.has(node.id)}
        />
      ))}

      {/* Render children overlays (walkers, traces, annotations) */}
      {children}
    </svg>
  );

  // Measure performance after render
  performanceMonitor.measure('network-render');
  
  return svgElement;
}

export default observer(Network);
