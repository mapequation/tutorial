import { scheme, schemeAlt } from "../scheme";
import { Network } from "../../model";
import { TreeNode } from "../../model/algorithms/Tree";
import EnterFlow from "./EnterFlow";
import ExitFlow from "./ExitFlow";
import Flow from "./Flow";

interface Props {
  network: Network;
  barWidth?: number;
}

export default function CodeBooks({ barWidth = 200, network }: Props) {
  const { root } = network.tree;

  const [viewBoxWidth, viewBoxHeight] = [1000, 1000];
  const viewBox = `0 0 ${viewBoxWidth} ${viewBoxHeight}`;

  const modules = root.sort((a, b) => b.enterFlow - a.enterFlow);

  const width = viewBoxWidth;
  const height = viewBoxHeight;

  const verticalSpace = 5;
  const horizontalSpace = width - barWidth - 100;
  const flowScale = 0.7 * height;
  const minFlow = 0.001;

  // Don't start in right in corner to avoid clipping.
  const x = 5;
  const y = height - 5;
  let currentY = y;

  modules.forEach((module, i) => {
    module.index = i;
    module.x = x;
    module.y = currentY;
    module.height = flowScale * module.enterFlow;
    currentY -= module.height + verticalSpace;
  });

  const getProps = ({ id, parent, x, y, height }: TreeNode) => ({
    x,
    y,
    width: barWidth,
    height,
    fill: scheme[parent!.isRoot ? id : parent!.id],
    stroke: schemeAlt[parent!.isRoot ? id : parent!.id],
    strokeWidth: 2,
  });

  const exitFlowNodes = modules.map((module) => {
    const exitFlowNode = new TreeNode(module, module.id);
    exitFlowNode.exitFlow = module.exitFlow > 0 ? module.exitFlow : minFlow;
    exitFlowNode.flow = module.exitFlow;
    exitFlowNode.exitCode = module.exitCode;
    return exitFlowNode;
  });

  const nodes = [...exitFlowNodes, ...root.leafNodes()];

  nodes.sort((a, b) => {
    if (a.parent!.id !== b.parent!.id) return a.parent!.index - b.parent!.index;
    return b.flow - a.flow;
  });

  currentY = y;

  nodes.forEach((node, i) => {
    node.index = i;
    node.x = x + horizontalSpace;
    node.y = currentY;
    node.height = flowScale * (node.flow > 0 ? node.flow : minFlow);
    currentY -= node.height + verticalSpace;
  });

  const fontSize = (height: number) => Math.max(Math.sqrt(height) * 3, 7);

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      version="1.1"
      className="codeView"
      viewBox={viewBox}
    >
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
        <g id="nodes">
          {nodes.map((node, i) =>
            node.exitFlow > 0 ? (
              <g key={i}>
                <ExitFlow {...getProps(node)} />
                <text
                  x={node.x + barWidth + 40}
                  y={node.y - node.height / 2}
                  dominantBaseline="middle"
                  fontSize={fontSize(node.height)}
                >
                  {node.exitCode}
                </text>
              </g>
            ) : (
              <g key={i}>
                <Flow {...getProps(node)} />
                <text
                  x={node.x + barWidth + 40}
                  y={node.y - node.height / 2}
                  dominantBaseline="middle"
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
