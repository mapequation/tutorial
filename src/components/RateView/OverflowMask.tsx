import React, { SVGProps } from 'react';

interface Props {
  numPoints: number;
  width: number;
  height: number;
}

export default function OverflowMask(props: Props & SVGProps<SVGMaskElement>) {
  const { id, numPoints, width, height } = props;

  /*
    Drawn counter clock-wise with one "point" having the width 2 * dx

    (0, 0)
    |                    |
    |                    |
    |                    |  height
    |                    |
    |                    |
    |/\/\/\/\/\/\/\/\/\/\|
    dx
           width
   */

  const dx = width / numPoints / 2;
  const points = `l ${dx} ${-dx} l ${dx} ${dx} `.repeat(numPoints);
  const maskPath = `M 0 0 v ${height} ${points} v -${height} z`;

  return (
    <mask id={id}>
      <rect width="100%" height="100%" fill="white" />
      <path fill="black" d={maskPath} />
    </mask>
  );
}
