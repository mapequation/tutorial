import { Fragment } from "react";
import type { Network } from "../../model";
import { scheme, schemeAlt } from "../scheme";
import { EnterFlow, ExitFlow } from "../CodeBooks";
import { observer } from "mobx-react";

type Props = {
  network: Network,
  x?: number,
  y?: number
}

export default observer(function EnterExitCodes({ network, x = 0, y = 0 }: Props) {
  const { tree, walker } = network;

  const modules = tree.root.sort((a, b) => {
    const enterCodelengthDiff = b.enterCode.length - a.enterCode.length;
    if (enterCodelengthDiff !== 0) return enterCodelengthDiff;
    const exitCodelengthDiff = b.exitCode.length - a.exitCode.length;
    if (exitCodelengthDiff !== 0) return exitCodelengthDiff;
    return a.exitFlow - b.exitFlow;
  });

  const barWidth = 60;
  const barHeight = 20;
  const moduleX = 0;
  const moduleY = barHeight + 4;
  const fontSize = 14;

  const { current, prev } = walker;

  const currentModuleId = tree.root.getLeaf(current?.id!)?.parent?.id;
  const prevModuleId = prev ? tree.root.getLeaf(prev.id)?.parent?.id : -1;
  const moduleChanged = currentModuleId !== prevModuleId;

  return <g transform={`translate(${x}, ${y})`}>
    {modules.map((module, i) =>
      <Fragment key={i}>
        <text
          dominantBaseline="middle"
          textAnchor="end"
          fontSize={fontSize}
          x={moduleX - 4}
          y={i * moduleY - barHeight * 0.45}
        >
          {module.enterCode}
        </text>
        <EnterFlow
          fill={moduleChanged && module.id === currentModuleId ? schemeAlt[module.id] : scheme[module.id]}
          stroke={schemeAlt[module.id]}
          strokeWidth={2}
          width={barWidth}
          height={barHeight}
          x={moduleX}
          y={i * moduleY}
        />
        <ExitFlow
          fill={moduleChanged && module.id === prevModuleId ? schemeAlt[module.id] : scheme[module.id]}
          stroke={schemeAlt[module.id]}
          strokeWidth={2}
          pointerInside
          width={barWidth}
          height={barHeight}
          x={moduleX + barWidth + 5}
          y={i * moduleY}
        />
        <text
          dominantBaseline="middle"
          fontSize={fontSize}
          x={moduleX + 2 * barWidth + 10}
          y={i * moduleY - barHeight * 0.45}
        >
          {module.exitCode}
        </text>
      </Fragment>,
    )}
  </g>;
});
