import { SVGProps } from "react";

interface Props {
  y: number;
  height: number;
}

export default function Flow({
  y,
  ...props
}: Props & SVGProps<SVGRectElement>) {
  /*
    Same as a rect, but instead of (x, y) being top left, it's on bottom left
     ______________
    |             |
    |_____________|
    (x, y)

   */
  return <rect strokeLinejoin="round" y={y - props.height} {...props} />;
}
