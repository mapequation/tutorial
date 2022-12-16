import { useEffect, useRef } from "react";
import { observer } from "mobx-react";
import { Network } from "../../model";
import CodeWord from "./CodeWord";

interface Props {
  network: Network;
  showModules?: boolean;
}

function Trace({ network, showModules = false }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const lastRef = useRef<HTMLElement>(null);

  const { walker } = network;
  const trace = walker.trace.map((id) => network.tree.root.getLeaf(id)!);
  const last = trace.pop();

  useEffect(() => {
    containerRef.current!.scrollTop = lastRef.current?.offsetTop ?? 0;
  }, [last]);

  const avgCodelength = (() => {
    if (trace.length === 0) return 0;

    if (!showModules) {
      const oneLevelCodes = trace
        .map((node) => node.oneLevelCode)
        .join("").length;
      return oneLevelCodes / trace.length;
    }

    const codes = trace
      .map((node, i, nodes) => {
        if (i === 0) return node.parent?.enterCode + node.code; // first node must enter module
        const prev = nodes[i - 1];
        if (prev.parent?.id === node.parent?.id) return node.code; // same module
        return prev.parent?.exitCode! + node.parent?.enterCode + node.code; // different module: exit, enter, code
      })
      .join("").length;

    return codes / trace.length;
  })();

  return (
    <>
      <div
        ref={containerRef}
        className="px-4 py-2 w-full h-32 overflow-y-auto overscroll-contain rounded-lg border-2 border-gray-200 leading-snug text-sm font-mono -word-spacing-7"
      >
        {trace.map((node, i, nodes) => (
          <CodeWord
            key={i}
            node={node}
            prev={nodes[i - 1]}
            showModules={showModules}
          />
        ))}
        <strong ref={lastRef}>
          {last && (
            <CodeWord
              node={last}
              prev={trace[trace.length - 2]}
              showModules={showModules}
            />
          )}
        </strong>
      </div>
      Average codelength: {avgCodelength.toFixed(3)} bits
    </>
  );
}

export default observer(Trace);
