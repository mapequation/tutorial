import { observer } from "mobx-react";
import { motion } from "framer-motion";
import { Network } from "../../model";
import { schemeAlt } from "../scheme";
import type { TreeNode } from "../../model/algorithms/Tree";

interface Props {
  network: Network;
  showModules?: boolean;
}

/**
 * InlineTrace shows a short, animated sequence of most recent codewords. It
 * is a compact alternative to the full `Trace` component for inline
 * sections and uses `framer-motion` for a simple entrance animation.
 */
function InlineTrace({ network, showModules = false }: Props) {
  const { walker } = network;

  const maxNumCodes = 10;

  const visibleTraceIds = walker.trace.slice(-maxNumCodes);
  const firstVisibleStep = walker.totalVisits - visibleTraceIds.length + 1;
  const trace = visibleTraceIds.map((id) => network.tree.root.getLeaf(id)!);
  const last = trace.pop();

  const duration = walker.interval / 1000;

  return (
    <>
      <div
        className="h-9 w-full overflow-hidden whitespace-nowrap px-4 py-2 text-left font-mono text-sm leading-5 -word-spacing-7"
      >
        {trace.map((node, i, nodes) => (
          <CodeWord
            key={i}
            node={node}
            prev={nodes[i - 1]}
            showModules={showModules}
            firstEnter={firstVisibleStep + i === 1}
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
              firstEnter={firstVisibleStep + trace.length === 1}
            />
          )}
        </motion.strong>
      </div>
    </>
  );
}

export default observer(InlineTrace);

// Helper for rendering a single codeword. When `showModules` is true this
// helper also renders enter/exit codes colored by module, otherwise it
// renders the compact one-level code.
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
  const shouldPrintInitialEnter =
    firstEnter && (currentModule?.parent?.children.size ?? 0) > 1;

  if (!prev)
    return (
      <span style={{ color: schemeAlt[currentModuleId] }}>
        {shouldPrintInitialEnter && currentModule?.enterCode} {node.code} {" "}
      </span>
    );

  const prevModule = prev.parent;
  const prevModuleId = prevModule?.id ?? 0;

  if (prevModuleId === currentModuleId)
    return (
      <span style={{ color: schemeAlt[currentModuleId] }}>
        {node.code} {" "}
      </span>
    );

  return (
    <>
      <span style={{ color: schemeAlt[prevModuleId] }}>
        {prevModule?.exitCode} {" "}
      </span>
      <span style={{ color: schemeAlt[currentModuleId] }}>
        {currentModule?.enterCode} {node.code} {" "}
      </span>
    </>
  );
}
