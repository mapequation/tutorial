import React from 'react';
import { schemePastel2, schemeSet2 } from 'd3';
import EnterFlow from './EnterFlow';
import ExitFlow from './ExitFlow';
import Flow from './Flow';
import { Network } from '../../model';
import { TreeNode } from '../../model/algorithms/Tree';
import Svg from '../Svg';

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

  return (
    <Svg className="codeView" viewBox={viewBox}>
      <g>
        <g id="modules">
          {modules.map((module) => (
            <>
              <EnterFlow {...getProps(module)} />
              <text
                x={module.x + barWidth + 20}
                y={module.y - module.height / 2}
                dy={4}
              >
                {module.enterCode}
              </text>
            </>
          ))}
        </g>
        <g id="nodes">
          {nodes.map((node) =>
            node.exitFlow > 0 ? (
              <>
                <ExitFlow {...getProps(node)} />
                <text
                  x={node.x + barWidth + 40}
                  y={node.y - node.height / 2}
                  dy={4}
                >
                  {node.exitCode}
                </text>
              </>
            ) : (
              <>
                <Flow {...getProps(node)} />
                <text
                  x={node.x + barWidth + 40}
                  y={node.y - node.height / 2}
                  dy={4}
                >
                  {node.code}
                </text>
              </>
            ),
          )}
        </g>
      </g>
    </Svg>
  );
}
