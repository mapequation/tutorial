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

const PULSE_FADE_STEPS = 5;
const PULSE_JITTER_X = [0, 1.6, -1.2, 0.8, 0];

function hexToRgb(hex: string) {
  const normalized = hex.replace("#", "");
  const parsed = Number.parseInt(normalized, 16);

  return {
    r: (parsed >> 16) & 255,
    g: (parsed >> 8) & 255,
    b: parsed & 255,
  };
}

function rgbToHex({ r, g, b }: { r: number; g: number; b: number }) {
  return `#${[r, g, b]
    .map((value) =>
      Math.max(0, Math.min(255, Math.round(value)))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

function interpolateHexColor(start: string, end: string, progress: number) {
  const clampedProgress = Math.max(0, Math.min(1, progress));
  const from = hexToRgb(start);
  const to = hexToRgb(end);

  return rgbToHex({
    r: from.r + (to.r - from.r) * clampedProgress,
    g: from.g + (to.g - from.g) * clampedProgress,
    b: from.b + (to.b - from.b) * clampedProgress,
  });
}

function darkenHexColor(color: string, amount: number) {
  return interpolateHexColor(color, "#000000", amount);
}

function getPulseProgress(age: number | null) {
  if (age === null) {
    return null;
  }

  if (PULSE_FADE_STEPS <= 1) {
    return 1;
  }

  return Math.max(0, Math.min(1, age / (PULSE_FADE_STEPS - 1)));
}

function getPulseFill(
  baseColor: string,
  activeColor: string,
  age: number | null,
) {
  const progress = getPulseProgress(age);

  if (progress === null) {
    return baseColor;
  }

  return interpolateHexColor(
    darkenHexColor(activeColor, 0.4),
    baseColor,
    progress,
  );
}

function getPulseJitterX(age: number | null) {
  return age === 0 ? PULSE_JITTER_X : 0;
}

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

  if (modules.length <= 1) {
    return null;
  }

  const barWidth = 60;
  const barHeight = 20;

  const moduleY = barHeight + 4;

  const fontFamily = "Helvetica, sans-serif";
  const fontSize = 14;
  const codeFontSize = 16;
  const textOffset = 5;
  const recentModuleEnterAgeById = new Map<number, number>();
  const recentModuleExitAgeById = new Map<number, number>();
  const trace = walker.trace;
  const firstRelevantTraceIndex = Math.max(trace.length - PULSE_FADE_STEPS, 0);

  for (
    let traceIndex = trace.length - 1;
    traceIndex >= firstRelevantTraceIndex;
    traceIndex--
  ) {
    const nodeId = trace[traceIndex];
    const age = trace.length - 1 - traceIndex;
    const currentTreeNode = tree.root.getLeaf(nodeId);

    if (!currentTreeNode) {
      continue;
    }

    const previousNodeId = traceIndex > 0 ? trace[traceIndex - 1] : null;
    const previousTreeNode =
      previousNodeId === null ? null : tree.root.getLeaf(previousNodeId);
    const enteredModuleId = currentTreeNode.parent?.id ?? -1;
    const previousModuleId = previousTreeNode?.parent?.id ?? null;
    const moduleChangedOnStep =
      previousTreeNode === null || previousModuleId !== enteredModuleId;

    if (moduleChangedOnStep && !recentModuleEnterAgeById.has(enteredModuleId)) {
      recentModuleEnterAgeById.set(enteredModuleId, age);
    }

    if (
      moduleChangedOnStep &&
      previousModuleId !== null &&
      !recentModuleExitAgeById.has(previousModuleId)
    ) {
      recentModuleExitAgeById.set(previousModuleId, age);
    }
  }

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

  const duration = (0.5 * walker.interval) / 1000;

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
        const exitPulseAge = recentModuleExitAgeById.get(module.id) ?? null;
        const enterPulseAge = recentModuleEnterAgeById.get(module.id) ?? null;
        const exitFill = getPulseFill(mainColor, altColor, exitPulseAge);
        const enterFill = getPulseFill(mainColor, altColor, enterPulseAge);

        return (
          <Fragment key={module.id}>
            <CodeWord
              x={-textOffset}
              y={textY}
              textAnchor="end"
              fontSize={codeFontSize}
              initial={{ fill: mainColor }}
              animate={{
                fill: exitFill,
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
                fill: exitFill,
                scale: 1,
                translateX: getPulseJitterX(exitPulseAge),
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
                fill: enterFill,
                scale: 1,
                translateX: getPulseJitterX(enterPulseAge),
              }}
              transition={{ duration }}
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
              fontSize={codeFontSize}
              initial={{ fill: mainColor }}
              animate={{
                fill: enterFill,
              }}
              transition={{ duration }}
            >
              {module.enterCode}
            </CodeWord>
          </Fragment>
        );
      })}
    </g>
  );
});
