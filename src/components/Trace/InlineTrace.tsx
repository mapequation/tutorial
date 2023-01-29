import { observer } from "mobx-react";
import { motion } from "framer-motion";
import { Network } from "../../model";
import { schemeAlt } from "../scheme";
import type { TreeNode } from "../../model/algorithms/Tree";

interface Props {
  network: Network;
  showModules?: boolean;
}

function InlineTrace({ network, showModules = false }: Props) {
  const { walker } = network;

  const maxNumCodes = 20;

  const trace = walker.trace.slice(-maxNumCodes).map((id) => network.tree.root.getLeaf(id)!);
  const last = trace.pop();

  const duration = walker.interval / 1000;

  return (
    <>
      <div
        className="px-4 py-2 w-full overflow-y-auto overscroll-contain leading-snug text-sm font-mono -word-spacing-7"
      >
        {trace.map((node, i, nodes) => (
          <CodeWord
            key={i}
            node={node}
            prev={nodes[i - 1]}
            showModules={showModules}
            firstEnter={false}
          />
        ))}
        <motion.strong
          key={last?.id}
          initial={{ opacity: 0.5 }}
          animate={{ opacity: 1 }}
          transition={{ duration }}
        >
          {last && (
            <CodeWord
              node={last}
              prev={trace[trace.length - 1]}
              showModules={showModules}
              firstEnter={false}
            />
          )}
        </motion.strong>
      </div>
    </>
  );
}

export default observer(InlineTrace);

type CodeProps = {
  node: TreeNode;
  prev?: TreeNode;
  showModules?: boolean;
  firstEnter?: boolean;
};

function CodeWord({ node, prev, showModules = false, firstEnter = true }: CodeProps) {
  if (!showModules) return <>{node.oneLevelCode} </>;

  const currentModule = node.parent;
  const currentModuleId = currentModule?.id ?? 0;

  if (!prev)
    return (
      <span style={{ color: schemeAlt[currentModuleId] }}>
        {firstEnter && currentModule?.enterCode} {node.code}{" "}
      </span>
    );

  const prevModule = prev.parent;
  const prevModuleId = prevModule?.id ?? 0;

  if (prevModuleId === currentModuleId)
    return (
      <span style={{ color: schemeAlt[currentModuleId] }}>
        {node.code}{" "}
      </span>
    );

  return (
    <>
      <span style={{ color: schemeAlt[prevModuleId] }}>
        {prevModule?.exitCode}{" "}
      </span>
      <span style={{ color: schemeAlt[currentModuleId] }}>
        {currentModule?.enterCode} {node.code}{" "}
      </span>
    </>
  );
}
