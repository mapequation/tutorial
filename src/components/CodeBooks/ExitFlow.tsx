/**
 * ExitFlow renders an arrow-shaped bar indicating module exit traffic.
 * 
 * Mirror image of EnterFlow: rectangular bar extending right with a
 * chevron pointing right at the end. Visual indication of flow exiting
 * a module to external destinations.
 * 
 * Animated with framer-motion for smooth transitions.
 */
import { motion, SVGMotionProps } from "framer-motion";

interface Props extends SVGMotionProps<SVGPathElement> {
  x: number;
  y: number;
  width: number;
  height: number;
  dx?: number;                  // Horizontal extent of chevron point
  pointerInside?: boolean;      // Reduce bar width if pointer extends inward
}

export default function ExitFlow({
  x,
  y,
  width,
  height,
  dx = 10,
  pointerInside = false,
  ...props
}: Props) {
  /**
   * SVG path drawn clockwise from bottom-left (x, y):
   * 1. Start at (x, y)
   * 2. Line up to (x, y-height) - left side
   * 3. Line right to (x+width, y-height) - top
   * 4. Line to (x+width+dx, y-height/2) - right point of chevron
   * 5. Line to (x+width, y) - bottom point of chevron
   * 6. Close path back to start
   * 
   * If pointerInside, reduce bar width to make chevron appear nested.
   */

  if (pointerInside) {
    width -= dx;
  }

  const dy = height / 2;
  const path = `M ${x} ${y} l 0 ${-height} l ${width} 0 l ${dx} ${dy} l ${-dx} ${dy} z`;

  return <motion.path strokeLinejoin="round" {...props} d={path} />;
}
