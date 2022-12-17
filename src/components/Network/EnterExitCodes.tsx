import { Fragment, SVGProps } from "react";
import { observer } from "mobx-react";
import type { Network } from "../../model";
import { scheme, schemeAlt } from "../scheme";
import { EnterFlow, ExitFlow } from "../CodeBooks";

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

  const moduleY = barHeight + 4;

  const fontSize = 14;
  const textOffset = 5;

  const { current, prev } = walker;

  const currentModuleId = tree.root.getLeaf(current?.id!)?.parent?.id;
  const prevModuleId = prev ? tree.root.getLeaf(prev.id)?.parent?.id : -1;
  const moduleChanged = currentModuleId !== prevModuleId;

  const CodeWord = (props: SVGProps<SVGTextElement>) =>
    <text dominantBaseline="middle" fontSize={fontSize}{...props} />;

  const Label = (props: SVGProps<SVGTextElement>) =>
    <text y={-28} textAnchor="middle" fontSize={fontSize} {...props} />;

  return <g transform={`translate(${x}, ${y})`}>
    <Label x={barWidth / 2}>Exit</Label>
    <Label x={barWidth * 3 / 2}>Enter</Label>

    {modules.map((module, i) => {
        const mainColor = scheme[module.id];
        const altColor = schemeAlt[module.id];

        const currentY = i * moduleY;
        const textY = currentY - barHeight * 0.45;
        const enterX = barWidth;

        const prevModule = moduleChanged && module.id === prevModuleId;
        const currentModule = moduleChanged && module.id === currentModuleId;

        return <Fragment key={i}>
          <CodeWord x={-textOffset} y={textY} textAnchor="end">{module.exitCode}</CodeWord>
          <ExitFlow
            fill={prevModule ? altColor : mainColor}
            stroke={altColor}
            strokeWidth={2}
            pointerInside
            width={barWidth}
            height={barHeight}
            x={0}
            y={currentY}
          />
          <EnterFlow
            fill={currentModule ? altColor : mainColor}
            stroke={altColor}
            strokeWidth={2}
            width={barWidth}
            height={barHeight}
            x={enterX}
            y={currentY}
          />
          <CodeWord x={enterX + barWidth + textOffset} y={textY}>{module.enterCode}</CodeWord>
        </Fragment>;
      },
    )}
  </g>;
});
