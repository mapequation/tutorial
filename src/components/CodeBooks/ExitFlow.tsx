import { motion, SVGMotionProps } from "framer-motion";

interface Props extends SVGMotionProps<SVGPathElement> {
  x: number;
  y: number;
  width: number;
  height: number;
  dx?: number;
  pointerInside?: boolean;
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
  /*
     Drawn clock-wise from (x, y)

               width
       ____________________dx
      |                    \ dy
      |                    /       height
     (x, y)

   */

  if (pointerInside) {
    width -= dx;
  }

  const dy = height / 2;
  const path = `M ${x} ${y} l 0 ${-height} l ${width} 0 l ${dx} ${dy} l ${-dx} ${dy} z`;

  return <motion.path strokeLinejoin="round" {...props} d={path} />;
}
