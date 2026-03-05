import { Node as NodeModel } from "../../model";
import { memo } from "react";
import { motion, SVGMotionProps } from "framer-motion";
import { observer } from "mobx-react";

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
  showNodeId?: boolean;
  nodeIdPosition?: "top" | "middle";
  nodeIdFontSize?: number;
  isSelected?: boolean;
}

/**
 * Visual node glyph used inside the `Network` SVG.
 *
 * Uses `framer-motion` to animate radius and fill transitions so node size
 * and color changes smoothly when visit rates or module assignments
 * change. Labels are optional and can be positioned above, below or in the
 * middle of the node.
 * 
 * Wrapped with `observer` to react to MobX changes in node properties like
 * codes, which are computed values. This ensures labels update correctly
 * when module assignments change and codes are recalculated.
 */
const Node = memo(observer(function Node({
  node,
  r,
  x,
  y,
  fill,
  duration = 100,
  showLabel,
  labelPosition = "top",
  getLabel = (node: NodeModel) => node.oneLevelCode,
  showNodeId = false,
  nodeIdPosition = "middle",
  nodeIdFontSize = 12,
  isSelected = false,
  ...props
}: Props & SVGMotionProps<SVGCircleElement>) {
  let labelOffset = 0;
  if (showLabel && labelPosition !== "middle") {
    labelOffset = labelPosition === "top" ? -r - 5 : r + 5;
  }
  const nodeIdY = nodeIdPosition === "top" ? y - r - 4 : y;

  return (
    <>
      {/* Animate the circle's radius and fill for smooth visual updates. */}
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
      {/* Darker overlay when node is selected */}
      {isSelected && (
        <circle
          cx={x}
          cy={y}
          r={r}
          fill="#000"
          opacity={0.25}
          pointerEvents="none"
        />
      )}
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
      {showNodeId && (
        <motion.text
          initial={false}
          animate={{ attrY: nodeIdY }}
          transition={{ duration: duration / 1000 }}
          x={x}
          fontFamily="Helvetica, sans-serif"
          fontSize={nodeIdFontSize}
          fontWeight={600}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="#393939"
        >
          {node.id}
        </motion.text>
      )}
    </>
  );
}));
export default Node;
