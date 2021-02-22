import React from 'react';
import { schemePastel2, schemeSet2 } from 'd3';
import type { TreeNode } from '../../model/Tree';
import EnterFlow from './EnterFlow';
import ExitFlow from './ExitFlow';

interface Props {
  module: TreeNode;
  x: number;
  y: number;
  width: number;
  exitFlow: number;
  parentId?: number;
}

export default function Module(props: Props) {
  const { module, x, y, width, parentId } = props;

  const id = module.isRoot
    ? 'module-root'
    : `module-${parentId ? `${parentId}:` : ''}${module.id}`;

  const children = module.sort((a, b) => b.enterFlow - a.enterFlow);

  const scale = 2000;

  const moduleProps = (id: number, i: number) => {
    const totHeight = children
      .slice(0, i)
      .reduce((tot, child) => tot + scale * child.enterFlow, 0.0);

    const spacing = (i - 1) * 5;

    return {
      y: y - totHeight - spacing,
    };
  };

  const barProps = (id: number, flow: number) => {
    return {
      x,
      y,
      width,
      height: scale * flow,
      fill: schemePastel2[id],
      stroke: schemeSet2[id],
      strokeWidth: 2,
    };
  };

  return (
    <g id={id}>
      {module.isRoot &&
        children.map((child, i) => (
          <Module
            x={x}
            width={width}
            {...moduleProps(child.id, i)}
            module={child}
            exitFlow={module.exitFlow}
          />
        ))}

      {!module.isRoot && (
        <EnterFlow {...barProps(module.id, module.enterFlow)} />
      )}
    </g>
  );
}
