import { schemeAlt } from "../scheme";
import type { TreeNode } from "../../model/algorithms/Tree";

type Props = {
  node: TreeNode;
  prev?: TreeNode;
  showModules?: boolean;
};

export default function CodeWord({ node, prev, showModules = false }: Props) {
  if (!showModules) return <>{node.oneLevelCode} </>;

  const currentModule = node.parent;
  const currentModuleId = currentModule?.id ?? 0;
  const shouldPrintInitialEnter =
    (currentModule?.parent?.children.size ?? 0) > 1;

  if (!prev)
    return (
      <span style={{ color: schemeAlt[currentModuleId] }}>
        {shouldPrintInitialEnter && currentModule?.enterCode} {node.code}{" "}
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
