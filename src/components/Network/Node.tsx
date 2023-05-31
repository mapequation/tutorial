import { SVGProps } from "react";
import { Node as NodeModel } from "../../model";
import { animated, useSpring } from "react-spring";

interface Props {
  node: NodeModel;
  r: number;
  x: number;
  y: number;
  fill: string;
  showLabel?: boolean;
  labelPosition?: "top" | "bottom" | "middle";
  getLabel?: (node: NodeModel) => string | number;
}

export default function Node({
  node,
  r,
  x,
  y,
  fill,
  showLabel,
  labelPosition = "top",
  getLabel = (node: NodeModel) => node.oneLevelCode,
  ...props
}: Props & SVGProps<SVGCircleElement>) {
  const animatedProps = useSpring({ r, fill });

  let labelOffset = 0;
  if (showLabel && labelPosition !== "middle") {
    labelOffset = labelPosition === "top" ? -r - 5 : r + 5;
  }

  return (
    <>
      {/* @ts-ignore */}
      <animated.circle
        {...animatedProps}
        className="node"
        cx={x}
        cy={y}
        {...props}
      />
      {showLabel && (
        <text
          x={x}
          y={y + labelOffset}
          fontFamily="Helvetica, sans-serif"
          fontSize={16}
          fontWeight={800}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="#393939"
          stroke="#fff"
          strokeWidth={5}
          strokeLinecap="round"
          strokeLinejoin="round"
          paintOrder="stroke"
        >
          {getLabel(node)}
        </text>
      )}
    </>
  );
}
