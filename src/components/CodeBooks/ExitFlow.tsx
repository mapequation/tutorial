import React, { SVGProps } from 'react';

interface Props {
  x: number;
  y: number;
  width: number;
  height: number;
  dx?: number;
}

export default function ExitFlow({
  x,
  y,
  width,
  height,
  dx = 10,
  ...props
}: Props & SVGProps<SVGPathElement>) {
  /*
     Drawn clock-wise from (x, y)

               width
       ____________________dx
      |                    \ dy
      |                    /       height
     (x, y)

   */

  const dy = height / 2;
  const path = `M ${x} ${y} l 0 ${-height} l ${width} 0 l ${dx} ${dy} l ${-dx} ${dy} z`;

  return <path strokeLinejoin="round" {...props} d={path} />;
}
