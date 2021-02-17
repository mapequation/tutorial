import React, { SVGProps } from 'react';

export default function OverflowMask(
  props: {
    numPoints: number;
    width: number;
    height: number;
  } & SVGProps<SVGMaskElement>,
) {
  const { id, numPoints, width, height } = props;

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
