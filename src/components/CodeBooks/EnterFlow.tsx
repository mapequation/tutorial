import { motion, SVGMotionProps } from "framer-motion";

interface Props extends SVGMotionProps<SVGPathElement> {
  x: number;
  y: number;
  width: number;
  height: number;
  dx?: number;
}

export default function EnterFlow({
  x,
  y,
  width,
  height,
  dx = 10,
  ...props
}: Props) {
  /*
     Drawn clock-wise from (x, y)

      dx       width
      _____________________
   dy \                   |
      /                   |  height
     (x, y)

   */

  const dy = height / 2;
  const path = `M ${x} ${y} l ${dx} ${-dy} l ${-dx} ${-dy} l ${width} 0 l 0 ${height} z`;

  return <motion.path strokeLinejoin="round" {...props} d={path} />;
}
