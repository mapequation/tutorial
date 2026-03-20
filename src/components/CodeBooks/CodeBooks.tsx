/**
 * CodeBooks visualizes the hierarchical Huffman code structure.
 *
 * Displays two columns:
 * - Left: Enter codes for module boundaries (flow into each module)
 * - Right: Exit codes and visit codes for nodes within modules
 *
 * Modules are sorted by enter flow (top modules get more space).
 * Within each module, nodes are sorted by flow volume.
 * Bar heights are proportional to flow magnitudes for visual intuition.
 */
import { motion } from "framer-motion";
import { observer } from "mobx-react";
import { scheme, schemeAlt } from "../scheme";
import { Network } from "../../model";
import { TreeNode } from "../../model/algorithms/Tree";
import EnterFlow from "./EnterFlow";
import ExitFlow from "./ExitFlow";
import Flow from "./Flow";

interface Props {
  network: Network;
  barWidth?: number; // Width of each bar visualization
}

interface BandPathProps {
  startX: number;
  startTop: number;
  startBottom: number;
  endX: number;
  endTop: number;
  endBottom: number;
}

interface FittedHeights {
  heights: number[];
  gap: number;
}

function createBandPath({
  startX,
  startTop,
  startBottom,
  endX,
  endTop,
  endBottom,
}: BandPathProps) {
  const span = endX - startX;
  const firstControlX = startX + span * 0.28;
  const secondControlX = endX - span * 0.28;

  return [
    `M ${startX} ${startTop}`,
    `C ${firstControlX} ${startTop} ${secondControlX} ${endTop} ${endX} ${endTop}`,
    `L ${endX} ${endBottom}`,
    `C ${secondControlX} ${endBottom} ${firstControlX} ${startBottom} ${startX} ${startBottom}`,
    "Z",
  ].join(" ");
}

function fitHeights(
  weights: number[],
  availableHeight: number,
  preferredGap: number,
  preferredMinHeight: number,
): FittedHeights {
  if (weights.length === 0 || availableHeight <= 0) {
    return { heights: [], gap: 0 };
  }

  const count = weights.length;
  const safeWeights = weights.map((weight) => Math.max(weight, 0));
  const gapBudget =
    count > 1 ? availableHeight - preferredMinHeight * count : 0;
  const gap =
    count > 1
      ? Math.max(0, Math.min(preferredGap, gapBudget / (count - 1)))
      : 0;
  const heightBudget = Math.max(availableHeight - gap * (count - 1), 0);
  const minHeight = Math.min(preferredMinHeight, heightBudget / count);
  const heights = new Array<number>(count).fill(minHeight);
  let flexibleIndices = safeWeights.map((_, index) => index);
  let frozenHeight = 0;

  while (flexibleIndices.length > 0) {
    const remainingWeight = flexibleIndices.reduce(
      (sum, index) => sum + safeWeights[index],
      0,
    );
    const remainingHeight = Math.max(heightBudget - frozenHeight, 0);
    const nextFlexibleIndices: number[] = [];
    let frozeAny = false;

    flexibleIndices.forEach((index) => {
      const proposedHeight =
        remainingWeight > 0
          ? (remainingHeight * safeWeights[index]) / remainingWeight
          : remainingHeight / flexibleIndices.length;

      if (proposedHeight < minHeight) {
        heights[index] = minHeight;
        frozenHeight += minHeight;
        frozeAny = true;
      } else {
        nextFlexibleIndices.push(index);
      }
    });

    if (!frozeAny) {
      const finalWeight = flexibleIndices.reduce(
        (sum, index) => sum + safeWeights[index],
        0,
      );
      const finalHeight = Math.max(heightBudget - frozenHeight, 0);

      flexibleIndices.forEach((index) => {
        heights[index] =
          finalWeight > 0
            ? (finalHeight * safeWeights[index]) / finalWeight
            : finalHeight / flexibleIndices.length;
      });

      break;
    }

    flexibleIndices = nextFlexibleIndices;
  }

  return { heights, gap };
}

export default observer(function CodeBooks({ barWidth = 200, network }: Props) {
  const treeVersion = network.treeUpdateCounter;
  const { root } = network.tree;
  const { walker } = network;

  // SVG canvas setup
  const [viewBoxWidth, viewBoxHeight] = [1000, 1000];
  const viewBox = `0 0 ${viewBoxWidth} ${viewBoxHeight}`;

  // Sort modules by enter flow for visual prominence
  const modules = root.sort((a, b) => b.enterFlow - a.enterFlow);

  const width = viewBoxWidth;
  const height = viewBoxHeight;

  // Layout spacing and scaling
  const moduleGapPreference = 3;
  const nodeGapPreference = 4;
  const x = 45;
  const horizontalSpace = width - barWidth - 140;
  const minFlow = 0.001;
  const headingY = 34;
  const contentTop = 88;
  const bottomPadding = 18;
  const availableHeight = height - contentTop - bottomPadding;
  const moduleHeightRatio = 0.3;
  const duration = (0.5 * walker.interval) / 1000;
  const currentNodeId = walker.current?.id ?? -1;
  const prevNodeId = walker.prev?.id ?? -1;
  const currentModuleId = walker.current
    ? (root.getLeaf(walker.current.id)?.parent?.id ?? -1)
    : -1;
  const prevModuleId = walker.prev
    ? (root.getLeaf(walker.prev.id)?.parent?.id ?? -1)
    : -1;
  const moduleChanged = currentModuleId !== prevModuleId;
  const motionStyle = {
    transformBox: "fill-box" as const,
    transformOrigin: "left center" as const,
  };
  const pulseScale = 1.03;
  const pulseTranslateX = 1.5;
  const baseRibbonOpacity = 0.18;
  const activeRibbonOpacity = 0.3;
  const pulseRibbonOpacity = 0.38;

  // Layout modules on left side by enter flow
  const moduleAvailableHeight = availableHeight * moduleHeightRatio;
  const moduleWeights = modules.map((module) =>
    Math.max(module.enterFlow, minFlow),
  );
  const { heights: moduleHeights, gap: moduleGap } = fitHeights(
    moduleWeights,
    moduleAvailableHeight,
    moduleGapPreference,
    8,
  );
  const moduleStackHeight =
    moduleHeights.reduce((sum, barHeight) => sum + barHeight, 0) +
    moduleGap * Math.max(modules.length - 1, 0);
  const moduleStackTop = contentTop + availableHeight - moduleStackHeight;
  let currentTop = moduleStackTop;

  modules.forEach((module, i) => {
    module.index = i;
    module.x = x;
    module.height = moduleHeights[i] ?? 0;
    module.y = currentTop + module.height;
    currentTop += module.height + moduleGap;
  });

  /**
   * Helper to compute SVG bar properties from tree node position/flow.
   * Uses color scheme based on module (parent node) ID.
   */
  const getProps = ({ id, parent, x, y, height }: TreeNode) => ({
    x,
    y,
    width: barWidth,
    height,
    fill: scheme[parent!.isRoot ? id : parent!.id],
    stroke: schemeAlt[parent!.isRoot ? id : parent!.id],
    strokeWidth: 2,
  });

  // Create exit flow nodes (synthetic nodes for module exit events)
  const exitFlowNodes = modules.map((module) => {
    const exitFlowNode = new TreeNode(module, module.id);
    exitFlowNode.exitFlow = module.exitFlow > 0 ? module.exitFlow : minFlow;
    exitFlowNode.flow = module.exitFlow;
    exitFlowNode.exitCode = module.exitCode;
    return exitFlowNode;
  });

  // Combine exit flow nodes with actual leaf nodes (network nodes)
  const nodes = [...exitFlowNodes, ...root.leafNodes()];

  // Sort nodes: first by module (using module index), then by flow within module
  nodes.sort((a, b) => {
    if (a.parent!.id !== b.parent!.id) return a.parent!.index - b.parent!.index;
    return b.flow - a.flow;
  });

  // Layout nodes on right side by flow within each module
  currentTop = contentTop;
  const nodeWeights = nodes.map((node) => Math.max(node.flow, minFlow));
  const { heights: nodeHeights, gap: nodeGap } = fitHeights(
    nodeWeights,
    availableHeight,
    nodeGapPreference,
    6,
  );

  nodes.forEach((node, i) => {
    node.index = i;
    node.x = x + horizontalSpace;
    node.height = nodeHeights[i] ?? 0;
    node.y = currentTop + node.height;
    currentTop += node.height + nodeGap;
  });
  const nodeX = x + horizontalSpace;

  const nodesByModule = new Map<number, TreeNode[]>();

  nodes.forEach((node) => {
    const moduleId = node.parent!.id;
    const groupedNodes = nodesByModule.get(moduleId);

    if (groupedNodes) {
      groupedNodes.push(node);
    } else {
      nodesByModule.set(moduleId, [node]);
    }
  });

  const connectionBands = modules.flatMap((module) => {
    const groupedNodes = nodesByModule.get(module.id) ?? [];
    const totalNodeHeight = groupedNodes.reduce(
      (sum, node) => sum + node.height,
      0,
    );

    if (groupedNodes.length === 0 || totalNodeHeight <= 0) {
      return [];
    }

    let sliceTop = module.y - module.height;

    return groupedNodes.map((node, index) => {
      const isExitNode = node.exitFlow > 0;
      const isCurrentNode = !isExitNode && node.id === currentNodeId;
      const isTriggeredNode = isCurrentNode && node.id !== prevNodeId;
      const isTriggeredExit =
        isExitNode && moduleChanged && module.id === prevModuleId;
      const isActive = isCurrentNode;
      const transitionDelay = isTriggeredNode && moduleChanged ? duration : 0;
      const isLastNode = index === groupedNodes.length - 1;
      const sliceHeight = isLastNode
        ? module.y - sliceTop
        : module.height * (node.height / totalNodeHeight);
      const band = {
        key: `${module.id}-${node.id}-${index}`,
        fill: scheme[module.id],
        activeFill: schemeAlt[module.id],
        active: isActive,
        triggered: isTriggeredNode || isTriggeredExit,
        delay: transitionDelay,
        path: createBandPath({
          startX: module.x + barWidth,
          startTop: sliceTop,
          startBottom: sliceTop + sliceHeight,
          endX: node.x,
          endTop: node.y - node.height,
          endBottom: node.y,
        }),
      };

      sliceTop += sliceHeight;
      return band;
    });
  });

  /**
   * Compute font size based on bar height for readability.
   * Taller bars get larger text, with 7px minimum.
   */
  const fontSize = (barHeight: number) =>
    Math.max(Math.min(Math.sqrt(barHeight) * 2.6, 30), 6);

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      version="1.1"
      className="codeView"
      viewBox={viewBox}
      data-tree-version={treeVersion}
    >
      <text
        x={x + barWidth / 2}
        y={headingY}
        textAnchor="middle"
        fontSize={20}
        fontWeight={600}
        fill="#374151"
      >
        Index codebook
      </text>
      <text
        x={nodeX + barWidth / 2}
        y={headingY}
        textAnchor="middle"
        fontSize={20}
        fontWeight={600}
        fill="#374151"
      >
        Module codebook
      </text>
      <g id="connections">
        {connectionBands.map((band) => (
          <motion.path
            key={band.key}
            d={band.path}
            initial={{
              fill: band.active ? band.activeFill : band.fill,
              fillOpacity: band.active
                ? activeRibbonOpacity
                : baseRibbonOpacity,
            }}
            animate={{
              fill: band.triggered
                ? [
                    null,
                    band.activeFill,
                    band.active ? band.activeFill : band.fill,
                  ]
                : band.active
                  ? [null, band.activeFill]
                  : band.fill,
              fillOpacity: band.triggered
                ? [
                    null,
                    pulseRibbonOpacity,
                    band.active ? activeRibbonOpacity : baseRibbonOpacity,
                  ]
                : band.active
                  ? [null, activeRibbonOpacity]
                  : baseRibbonOpacity,
            }}
            transition={{ duration, delay: band.delay }}
          />
        ))}
      </g>
      {/* Left column: module enter codes */}
      <g>
        <g id="modules">
          {modules.map((module, i) => (
            <g key={`module-${module.id}`}>
              <EnterFlow
                {...getProps(module)}
                initial={{
                  fill: scheme[module.id],
                  scale: 1,
                  translateX: 0,
                }}
                animate={{
                  fill:
                    moduleChanged && module.id === currentModuleId
                      ? [null, schemeAlt[module.id], scheme[module.id]]
                      : scheme[module.id],
                  scale:
                    moduleChanged && module.id === currentModuleId
                      ? [null, pulseScale, 1]
                      : 1,
                  translateX:
                    moduleChanged && module.id === currentModuleId
                      ? [null, pulseTranslateX, 0]
                      : 0,
                }}
                transition={{
                  duration,
                  delay:
                    moduleChanged && module.id === currentModuleId
                      ? 0.5 * duration
                      : 0,
                }}
                style={motionStyle}
              />
              <text
                x={module.x + barWidth + 20}
                y={module.y - module.height / 2}
                dominantBaseline="middle"
                fontSize={fontSize(module.height)}
              >
                {module.enterCode}
              </text>
            </g>
          ))}
        </g>
        {/* Right column: node exit and visit codes */}
        <g id="nodes">
          {nodes.map((node) => {
            const isExitNode = node.exitFlow > 0;
            const moduleId = node.parent!.id;
            const mainColor = scheme[moduleId];
            const altColor = schemeAlt[moduleId];
            const changedFromModule =
              moduleChanged && moduleId === prevModuleId;
            const isCurrentNode = !isExitNode && node.id === currentNodeId;
            const isTriggeredNode = isCurrentNode && node.id !== prevNodeId;
            const transitionDelay =
              isTriggeredNode && moduleChanged ? duration : 0;

            return isExitNode ? (
              // Exit flow node (module exit event)
              <g key={`exit-${moduleId}`}>
                <ExitFlow
                  {...getProps(node)}
                  initial={{
                    fill: mainColor,
                    scale: 1,
                    translateX: 0,
                  }}
                  animate={{
                    fill: changedFromModule
                      ? [null, altColor, mainColor]
                      : mainColor,
                    scale: changedFromModule ? [null, pulseScale, 1] : 1,
                    translateX:
                      changedFromModule ? [null, pulseTranslateX, 0] : 0,
                  }}
                  transition={{ duration }}
                  style={motionStyle}
                />
                <text
                  x={node.x + barWidth + 40}
                  y={node.y - node.height / 2}
                  dominantBaseline="middle"
                  fontFamily="Helvetica, sans-serif"
                  fontSize={fontSize(node.height)}
                >
                  {node.exitCode}
                </text>
              </g>
            ) : (
              // Regular node (within-module visit)
              <g key={`node-${node.id}`}>
                <Flow
                  {...getProps(node)}
                  initial={{
                    fill: isCurrentNode ? altColor : mainColor,
                    scale: 1,
                    translateX: 0,
                  }}
                  animate={{
                    fill: isCurrentNode ? [null, altColor] : mainColor,
                    scale: isTriggeredNode ? [null, pulseScale, 1] : 1,
                    translateX:
                      isTriggeredNode ? [null, pulseTranslateX, 0] : 0,
                  }}
                  transition={{ duration, delay: transitionDelay }}
                  style={motionStyle}
                />
                <text
                  x={node.x + barWidth + 40}
                  y={node.y - node.height / 2}
                  dominantBaseline="middle"
                  fontFamily="Helvetica, sans-serif"
                  fontSize={fontSize(node.height)}
                >
                  {node.code}
                </text>
              </g>
            );
          })}
        </g>
      </g>
    </svg>
  );
});
