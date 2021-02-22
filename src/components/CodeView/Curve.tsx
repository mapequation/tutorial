import React, { SVGProps } from 'react';

interface Props {
  x1: number;
  y1: number;
  h1: number;
  x2: number;
  y2: number;
  h2: number;
  width: number;
  dx?: number;
  curvature?: number;
}

export default function ({
  x1,
  y1,
  h1,
  x2,
  y2,
  h2,
  width,
  curvature = 300,
  dx = 10,
  ...props
}: Props & SVGProps<SVGPathElement>) {
  const p1 = {
    x: x1 + width + dx,
    y: y1 - h1 / 2,
  };
  const c1 = {
    x: p1.x + curvature,
    y: p1.y,
  };
  const p2 = {
    x: x2 - dx,
    y: y2 - h2 / 2,
  };
  const c2 = {
    x: p2.x - curvature,
    y: p2.y,
  };

  const d = `M ${p1.x} ${p1.y} C ${c1.x} ${c1.y}, ${c2.x}, ${c2.y}, ${p2.x} ${p2.y}`;
  return (
    <path d={d} stroke="#aaa" strokeWidth={2} fill="transparent" {...props} />
  );
}
