import { ReactNode, SVGProps } from "react";
import { observer } from "mobx-react";
import { useMemo, useCallback, useId } from "react";
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
import Node, { NodeId } from "./Node";

// A scale used to map a node's visit-rate to a visual radius. The domain
// and range are tuned for the demo but can be configured if networks grow.
const defaultNodeScale = scaleSqrt().domain([0, 1]).range([10, 100]);

const linkEndpointPosition = (
  link: LinkModel,
  sourceRadius: number,
  targetRadius: number,
) => {
  const x1 = link.source.x || 0;
  const y1 = link.source.y || 0;
  const x2 = link.target.x || 0;
  const y2 = link.target.y || 0;
  const dx = x2 - x1 || 1e-6;
  const dy = y2 - y1 || 1e-6;
  const length = Math.sqrt(dx * dx + dy * dy);
  const unitX = dx / length;
  const unitY = dy / length;

  return {
    x1: x1 + sourceRadius * unitX,
    y1: y1 + sourceRadius * unitY,
    x2: x2 - targetRadius * unitX,
    y2: y2 - targetRadius * unitY,
  };
};

interface Props {
  network: NetworkModel;
  scheme?: string[];
  schemeAlt?: string[];
  rate?: Rate;
  showLabels?: boolean;
  showModules?: boolean;
  showNodeId?: boolean;
  nodeIdLayer?: "inline" | "top";
  nodeIdPosition?: "top" | "middle";
  nodeIdFontSize?: number;
  showVisiting?: boolean;
  colorIntraModuleLinks?: boolean;
  interModuleLinkColor?: string;
  nodeStroke?: string;
  nodeStrokeWidth?: number;
  modules?: "topModule";
  width?: number;
  height?: number;
  getLabel?: (node: NodeModel) => string | number;
  getNodeIdFill?: (node: NodeModel, fill: string) => string;
  labelPosition?: "top" | "bottom" | "middle";
  selectedNodeIds?: Set<number>;
  nodeScale?: (value: number) => number;
  scaleLinksByWeight?: boolean;
  baseLinkStrokeWidth?: number;
  getLinkOpacity?: (link: LinkModel) => number;
  onNodeMouseEnter?: (node: NodeModel) => void;
  onNodeMouseLeave?: (node: NodeModel) => void;
  linkBackgroundChildren?: ReactNode;
  underlayChildren?: ReactNode;
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
  nodeIdLayer = "inline",
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
  getNodeIdFill,
  labelPosition = "top",
  selectedNodeIds,
  nodeScale = defaultNodeScale,
  scaleLinksByWeight = false,
  baseLinkStrokeWidth = 3,
  getLinkOpacity,
  onNodeMouseEnter,
  onNodeMouseLeave,
  linkBackgroundChildren,
  underlayChildren,
  children,
  style,
  ...props
}: Props & SVGProps<SVGSVGElement>) {
  // Mark render start
  performanceMonitor.mark("network-render");

  const arrowId = "arrow";
  const markerEnd = network.directed ? `url(#${arrowId})` : undefined;
  const linkGradientIdPrefix = useId().replace(/[^a-zA-Z0-9_-]/g, "");

  const getNodeRate = useMemo(() => getRate(rate), [rate]);

  // Memoize the nodeRadius function
  const nodeRadius = useCallback(
    (node: NodeModel): number => nodeScale(getNodeRate(node)),
    [getNodeRate, nodeScale],
  );

  const schemeIndex = useCallback(
    (node: NodeModel) => (showModules ? node[modules] : 0),
    [showModules, modules],
  );

  const nodeFill = useCallback(
    (node: NodeModel) => {
      const i = schemeIndex(node);
      return showVisiting && network.walker.isVisiting(node)
        ? schemeAlt[i >= schemeAlt.length ? 0 : i]
        : scheme[i >= scheme.length ? 0 : i];
    },
    [showVisiting, scheme, schemeAlt, schemeIndex, network.walker],
  );

  const moduleColor = useCallback(
    (moduleId: number) => {
      const i = moduleId >= scheme.length ? 0 : moduleId;
      return scheme[i];
    },
    [scheme],
  );

  const interModuleLinkGradients = useMemo(() => {
    const gradients = new Map<
      LinkModel,
      {
        id: string;
        x1: number;
        y1: number;
        x2: number;
        y2: number;
        sourceColor: string;
        targetColor: string;
      }
    >();

    if (!colorIntraModuleLinks || !showModules) {
      return gradients;
    }

    network.links.forEach((link, index) => {
      const sourceModule = link.source[modules];
      const targetModule = link.target[modules];

      if (sourceModule === targetModule) {
        return;
      }

      gradients.set(link, {
        id: `inter-module-link-${linkGradientIdPrefix}-${index}`,
        ...linkEndpointPosition(
          link,
          nodeRadius(link.source),
          nodeRadius(link.target),
        ),
        sourceColor: moduleColor(sourceModule),
        targetColor: moduleColor(targetModule),
      });
    });

    return gradients;
  }, [
    colorIntraModuleLinks,
    linkGradientIdPrefix,
    moduleColor,
    modules,
    network.links,
    nodeRadius,
    showModules,
  ]);

  const linkStroke = useCallback(
    (link: LinkModel) => {
      if (!colorIntraModuleLinks || !showModules) {
        return interModuleLinkColor;
      }

      const sourceModule = link.source[modules];
      const targetModule = link.target[modules];

      if (sourceModule === targetModule) {
        return moduleColor(sourceModule);
      }

      const gradient = interModuleLinkGradients.get(link);
      return gradient ? `url(#${gradient.id})` : interModuleLinkColor;
    },
    [
      colorIntraModuleLinks,
      interModuleLinkColor,
      interModuleLinkGradients,
      moduleColor,
      modules,
      showModules,
    ],
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
    [baseLinkStrokeWidth, maxLinkWeight, scaleLinksByWeight],
  );

  const getLabel = useCallback(
    (node: NodeModel) =>
      customGetLabel
        ? customGetLabel(node)
        : showModules
          ? node.code
          : node.oneLevelCode,
    [showModules, customGetLabel, network.treeUpdateCounter],
  );

  const svgElement = (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="network"
      viewBox={`0 0 ${width} ${height}`}
      onLoad={() => performanceMonitor.measure("network-render")}
      style={{ overflow: "visible", ...style }}
      {...props}
    >
      <defs>
        <ArrowMarker id={arrowId} fill={interModuleLinkColor} />
        {[...interModuleLinkGradients.values()].map((gradient) => (
          <linearGradient
            key={gradient.id}
            id={gradient.id}
            x1={gradient.x1}
            y1={gradient.y1}
            x2={gradient.x2}
            y2={gradient.y2}
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor={gradient.sourceColor} />
            <stop offset="50%" stopColor={interModuleLinkColor} />
            <stop offset="100%" stopColor={gradient.targetColor} />
          </linearGradient>
        ))}
      </defs>

      {linkBackgroundChildren}

      {/* Render links first so nodes appear above them. Optionally scale
          thickness by link weight; otherwise keep a uniform width. */}
      {network.links.map((link, i) => (
        <Link
          key={i}
          link={link}
          stroke={linkStroke(link)}
          strokeWidth={linkStrokeWidth(link)}
          opacity={getLinkOpacity?.(link)}
          sourceRadius={nodeRadius(link.source)}
          targetRadius={nodeRadius(link.target)}
          markerEnd={markerEnd}
        />
      ))}

      {/* Optional overlays that should sit below nodes, such as walk traces. */}
      {underlayChildren}

      {/* Render nodes on top of links. Pass animation duration from the
          network walker so node transitions sync with the walker updates. */}
      {network.nodes.map((node, i) => {
        const fill = nodeFill(node);

        return (
          <Node
            node={node}
            key={i}
            r={nodeRadius(node)}
            x={node.x}
            y={node.y}
            fill={fill}
            stroke={nodeStroke}
            strokeWidth={nodeStrokeWidth}
            duration={network.walker.interval}
            showLabel={showLabels}
            getLabel={showLabels ? getLabel : undefined}
            labelPosition={labelPosition}
            showNodeId={showNodeId && nodeIdLayer === "inline"}
            nodeIdPosition={nodeIdPosition}
            nodeIdFontSize={nodeIdFontSize}
            nodeIdFill={getNodeIdFill?.(node, fill)}
            isSelected={selectedNodeIds?.has(node.id)}
            onMouseEnter={() => onNodeMouseEnter?.(node)}
            onMouseLeave={() => onNodeMouseLeave?.(node)}
          />
        );
      })}

      {/* Render children overlays (walkers, traces, annotations) */}
      {children}

      {showNodeId &&
        nodeIdLayer === "top" &&
        network.nodes.map((node, i) => {
          const fill = nodeFill(node);

          return (
            <NodeId
              node={node}
              key={`node-id-${i}`}
              x={node.x}
              y={node.y}
              r={nodeRadius(node)}
              duration={network.walker.interval}
              nodeIdPosition={nodeIdPosition}
              nodeIdFontSize={nodeIdFontSize}
              nodeIdFill={getNodeIdFill?.(node, fill)}
            />
          );
        })}
    </svg>
  );

  // Measure performance after render
  performanceMonitor.measure("network-render");

  return svgElement;
}

export default observer(Network);
