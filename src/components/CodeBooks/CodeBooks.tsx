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
import { scheme, schemeAlt } from "../scheme";
import { Network } from "../../model";
import { TreeNode } from "../../model/algorithms/Tree";
import EnterFlow from "./EnterFlow";
import ExitFlow from "./ExitFlow";
import Flow from "./Flow";

interface Props {
  network: Network;
  barWidth?: number;  // Width of each bar visualization
}

export default function CodeBooks({ barWidth = 200, network }: Props) {
  const { root } = network.tree;

  // SVG canvas setup
  const [viewBoxWidth, viewBoxHeight] = [1000, 1000];
  const viewBox = `0 0 ${viewBoxWidth} ${viewBoxHeight}`;

  // Sort modules by enter flow for visual prominence
  const modules = root.sort((a, b) => b.enterFlow - a.enterFlow);

  const width = viewBoxWidth;
  const height = viewBoxHeight;

  // Layout spacing and scaling
  const verticalSpace = 5;
  const horizontalSpace = width - barWidth - 100;
  const flowScale = 0.7 * height;
  const minFlow = 0.001;

  // Layout modules on left side by enter flow
  const x = 5;
  const y = height - 5;
  let currentY = y;

  modules.forEach((module, i) => {
    module.index = i;
    module.x = x;
    module.y = currentY;
    // Bar height proportional to enter flow
    module.height = flowScale * module.enterFlow;
    currentY -= module.height + verticalSpace;
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
  currentY = y;

  nodes.forEach((node, i) => {
    node.index = i;
    node.x = x + horizontalSpace;
    node.y = currentY;
    // Bar height proportional to flow (with minimum for visibility)
    node.height = flowScale * (node.flow > 0 ? node.flow : minFlow);
    currentY -= node.height + verticalSpace;
  });

  /**
   * Compute font size based on bar height for readability.
   * Taller bars get larger text, with 7px minimum.
   */
  const fontSize = (height: number) => Math.max(Math.sqrt(height) * 3, 7);

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      version="1.1"
      className="codeView"
      viewBox={viewBox}
    >
      {/* Left column: module enter codes */}
      <g>
        <g id="modules">
          {modules.map((module, i) => (
            <g key={i}>
              <EnterFlow {...getProps(module)} />
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
          {nodes.map((node, i) =>
            node.exitFlow > 0 ? (
              // Exit flow node (module exit event)
              <g key={i}>
                <ExitFlow {...getProps(node)} />
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
              <g key={i}>
                <Flow {...getProps(node)} />
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
            )
          )}
        </g>
      </g>
    </svg>
  );
}
