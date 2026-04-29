import { Fragment, type SVGProps } from "react";
import { motion, type SVGMotionProps } from "framer-motion";
import { observer } from "mobx-react";
import type { Network } from "../../model";
import { scheme, schemeAlt } from "../scheme";
import { EnterFlow, ExitFlow } from "../CodeBooks";

type Props = {
  network: Network;
  x?: number;
  y?: number;
};

/**
 * EnterExitCodes visualizes the enter and exit codes for each module,
 * showing how the walker transitions between modules. Displays animated
 * bars that highlight when the walker enters or exits a module.
 */
export default observer(function EnterExitCodes({
  network,
  x = 0,
  y = 0,
}: Props) {
  const { tree, walker } = network;
  // Access treeUpdateCounter to ensure component re-renders when tree updates
  const treeVersion = network.treeUpdateCounter;

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

  const fontFamily = "Helvetica, sans-serif";
  const fontSize = 14;
  const textOffset = 5;

  const { current, prev } = walker;

  const currentModuleId = current
    ? (tree.root.getLeaf(current.id)?.parent?.id ?? -1)
    : -1;
  const prevModuleId = prev ? tree.root.getLeaf(prev.id)?.parent?.id : -1;
  const moduleChanged = currentModuleId !== prevModuleId;
  const motionStyle = {
    transformBox: "fill-box" as const,
    transformOrigin: "left center" as const,
  };

  const CodeWord = (props: SVGMotionProps<SVGTextElement>) => (
    <motion.text
      dominantBaseline="middle"
      fontSize={fontSize}
      fontFamily={fontFamily}
      {...props}
    />
  );

  const Label = (props: SVGProps<SVGTextElement>) => (
    <text
      y={-28}
      textAnchor="middle"
      fontSize={fontSize}
      fontFamily={fontFamily}
      {...props}
    />
  );

  const duration = Math.max(0.12, (0.35 * walker.interval) / 1000);
  const vibrateX = [0, 1.6, -1.2, 0.8, 0];

  return (
    <g transform={`translate(${x}, ${y})`}>
      <Label x={barWidth / 2}>Exit</Label>
      <Label x={(barWidth * 3) / 2}>Enter</Label>

      {modules.map((module, i) => {
        const mainColor = scheme[module.id];
        const altColor = schemeAlt[module.id];

        const currentY = i * moduleY;
        const textY = currentY - barHeight * 0.45;
        const enterX = barWidth;

        const changedFromModule = moduleChanged && module.id === prevModuleId;
        const atModule = module.id === currentModuleId;
        const changedToModule = moduleChanged && atModule;

        return (
          <Fragment key={module.id}>
            <CodeWord
              x={-textOffset}
              y={textY}
              textAnchor="end"
              fontSize={12}
              initial={{ fill: mainColor }}
              animate={{
                fill: changedFromModule
                  ? [mainColor, altColor, mainColor]
                  : mainColor,
              }}
              transition={{ duration }}
            >
              {module.exitCode}
            </CodeWord>
            <ExitFlow
              key={`exit-${module.id}`}
              initial={{
                fill: mainColor,
                scale: 1,
                translateX: 0,
              }}
              animate={{
                fill: changedFromModule
                  ? [mainColor, altColor, mainColor]
                  : mainColor,
                scale: 1,
                translateX: changedFromModule ? vibrateX : 0,
              }}
              transition={{ duration }}
              stroke="none"
              strokeWidth={0}
              pointerInside
              style={motionStyle}
              width={barWidth}
              height={barHeight}
              x={0}
              y={currentY}
            />
            <EnterFlow
              key={`enter-${module.id}`}
              initial={{
                fill: mainColor,
                scale: 1,
                translateX: 0,
              }}
              animate={{
                fill: changedToModule
                  ? [mainColor, altColor, mainColor]
                  : mainColor,
                scale: 1,
                translateX: changedToModule ? vibrateX : 0,
              }}
              transition={{ duration, delay: 0.2 * duration }}
              stroke="none"
              strokeWidth={0}
              style={motionStyle}
              width={barWidth}
              height={barHeight}
              x={enterX}
              y={currentY}
            />
            <CodeWord
              x={enterX + barWidth + textOffset}
              y={textY}
              fontSize={12}
              initial={{ fill: mainColor }}
              animate={{
                fill: changedToModule
                  ? [mainColor, altColor, mainColor]
                  : mainColor,
              }}
              transition={{ duration, delay: 0.2 * duration }}
            >
              {module.enterCode}
            </CodeWord>
          </Fragment>
        );
      })}
    </g>
  );
});
