/**
 * EnterFlow renders an arrow-shaped bar indicating module entry traffic.
 * 
 * Path shape: starts at (x,y), angles inward with a chevron pointing right,
 * then extends a rectangular bar to the right. Visual indication of flow
 * entering a module from external sources.
 * 
 * Animated with framer-motion for smooth transitions.
 */
import { motion, SVGMotionProps } from "framer-motion";

interface Props extends SVGMotionProps<SVGPathElement> {
  x: number;
  y: number;
  width: number;
  height: number;
  dx?: number;  // Horizontal indent of chevron point
}

export default function EnterFlow({
  x,
  y,
  width,
  height,
  dx = 10,
  ...props
}: Props) {
  /**
   * SVG path drawn clockwise from bottom-left (x, y):
   * 1. Start at (x, y)
   * 2. Line to (x+dx, y-height/2) - right point of chevron
   * 3. Line to (x, y-height) - top point of chevron
   * 4. Line right to (x+width, y-height) - top-right of bar
   * 5. Line down to (x+width, y) - bottom-right
   * 6. Close path back to start
   */
  const dy = height / 2;
  const path = `M ${x} ${y} l ${dx} ${-dy} l ${-dx} ${-dy} l ${width} 0 l 0 ${height} z`;

  return <motion.path strokeLinejoin="round" {...props} d={path} />;
}
