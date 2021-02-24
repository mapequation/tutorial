import React, { SVGProps } from 'react';

export default function ArrowMarker({
  id,
  fill,
  ...props
}: SVGProps<SVGPathElement & SVGMarkerElement>) {
  return (
    <marker
      id={id}
      markerHeight={5}
      markerWidth={5}
      orient="auto"
      refX={3}
      viewBox="-5 -5 10 10"
    >
      <path d="M 0,0 m -5,-5 L 5,0 L -5,5 Z" fill={fill} {...props} />
    </marker>
  );
}
