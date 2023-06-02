import { Node as NodeModel } from "../../model";
import { motion, SVGMotionProps } from "framer-motion";

interface Props {
  node: NodeModel;
  r: number;
  x: number;
  y: number;
  fill: string;
  duration?: number;
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
  duration = 100,
  showLabel,
  labelPosition = "top",
  getLabel = (node: NodeModel) => node.oneLevelCode,
  ...props
}: Props & SVGMotionProps<SVGCircleElement>) {
  let labelOffset = 0;
  if (showLabel && labelPosition !== "middle") {
    labelOffset = labelPosition === "top" ? -r - 5 : r + 5;
  }

  return (
    <>
      {/* @ts-ignore */}
      <motion.circle
        initial={false}
        animate={{ r, fill }}
        transition={{ duration: duration / 1000 }}
        className="node"
        cx={x}
        cy={y}
        {...props}
      />
      {showLabel && (
        <motion.text
          initial={false}
          animate={{ attrY: y + labelOffset }}
          transition={{ duration: duration / 1000 }}
          x={x}
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
        </motion.text>
      )}
    </>
  );
}
