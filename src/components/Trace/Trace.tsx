import React, { useEffect, useRef } from 'react';
import { Network } from '../../model';
import { observer } from 'mobx-react';
import { schemeSet2 } from 'd3';
import { TreeNode } from '../../model/algorithms/Tree';

const Code = ({
  node,
  i,
  nodes,
  showModules = false,
}: {
  node: TreeNode;
  i: number;
  nodes: TreeNode[];
  showModules?: boolean;
}) => {
  if (!showModules) return <span>{node.oneLevelCode} </span>;

  if (i === 0)
    return (
      <span style={{ color: schemeSet2[node.parent?.id ?? 0] }}>
        {node.parent?.enterCode} {node.code}{' '}
      </span>
    );

  const prev = nodes[i - 1];

  if (prev.parent?.id === node.parent?.id)
    return (
      <span style={{ color: schemeSet2[node.parent?.id ?? 0] }}>
        {node.code}{' '}
      </span>
    );

  return (
    <>
      <span style={{ color: schemeSet2[prev.parent?.id ?? 0] }}>
        {prev.parent?.exitCode}{' '}
      </span>
      <span style={{ color: schemeSet2[node.parent?.id ?? 0] }}>
        {node.parent?.enterCode} {node.code}{' '}
      </span>
    </>
  );
};

interface Props {
  network: Network;
  showModules?: boolean;
}

function Trace({ network, showModules = false }: Props) {
  const { walker, tree } = network;

  const nodes = walker.trace.map((id) => tree.root.getLeaf(id)!);

  const last = nodes.pop();

  const containerRef = useRef<HTMLDivElement>(null);
  const lastRef = useRef<HTMLElement>(null);

  useEffect(() => {
    containerRef.current!.scrollTop = lastRef.current?.offsetTop ?? 0;
  }, [last]);

  return (
    <div
      ref={containerRef}
      className="px-4 py-2 w-full h-32 overflow-y-auto overscroll-contain rounded-lg border-2 border-gray-200 dark:border-gray-700 leading-snug text-sm font-mono -word-spacing-7"
    >
      {nodes.map((node, i, nodes) => (
        <Code
          node={node}
          i={i}
          key={i}
          nodes={nodes}
          showModules={showModules}
        />
      ))}
      <strong ref={lastRef}>
        {last && (
          <Code
            node={last}
            i={nodes.length}
            nodes={nodes}
            showModules={showModules}
          />
        )}
      </strong>
    </div>
  );
}

export default observer(Trace);
