import React from 'react';
import { schemePastel2, schemeSet2 } from 'd3';
import { TreeNode } from '../../model/Tree';
import EnterFlow from './EnterFlow';
import ExitFlow from './ExitFlow';
import Flow from './Flow';

interface Props {
  root: TreeNode;
  width: number;
  height: number;
  barWidth?: number;
}

export default function Diagram(props: Props) {
  const { root, width, height, barWidth = 200 } = props;

  const modules = root.sort((a, b) => b.enterFlow - a.enterFlow);

  const verticalSpace = 5;
  const horizontalSpace = width - 2 * barWidth;
  const flowScale = 0.8 * height;

  const x = 0;
  const y = height;
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
    fill: schemePastel2[parent!.isRoot ? id : parent!.id],
    stroke: schemeSet2[parent!.isRoot ? id : parent!.id],
    strokeWidth: 2,
  });

  const minFlow = 0.001;
  const exitFlowNodes = modules.map((module) => {
    const exitFlowNode = new TreeNode(module, module.id);
    exitFlowNode.exitFlow = module.exitFlow > 0 ? module.exitFlow : minFlow;
    exitFlowNode.flow = module.exitFlow;
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

  return (
    <g>
      {modules.map((module) => (
        <EnterFlow {...getProps(module)} />
      ))}
      <g id="nodes">
        {nodes.map((node) =>
          node.exitFlow > 0 ? (
            <ExitFlow {...getProps(node)} />
          ) : (
            <Flow {...getProps(node)} />
          ),
        )}
      </g>
    </g>
  );
}
