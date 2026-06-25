/**
 * Flow renders a bar that grows downward from a baseline position.
 *
 * Unlike standard SVG rects where (x, y) is the top-left corner,
 * this component positions (x, y) at the bottom-left, with height
 * extending upward. Useful for code visualization where bars grow
 * from a common baseline.
 */
import { motion, SVGMotionProps } from "framer-motion";

interface Props {
  y: number;
  height: number;
}

export default function Flow({
  y,
  ...props
}: Props & SVGMotionProps<SVGRectElement>) {
  /**
   * Adjust y position upward by height to implement bottom-left anchor.
   * SVG rect will draw from (x, y-height) to (x+width, y).
   */
  return <motion.rect strokeLinejoin="round" y={y - props.height} {...props} />;
}
