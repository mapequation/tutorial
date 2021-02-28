import React, { SVGProps } from 'react';
import { Node as NodeModel } from '../../model';
import { animated, useSpring } from 'react-spring';

interface Props {
  node: NodeModel;
  r: number;
  x: number;
  y: number;
  fill: string;
  showLabel?: boolean;
}

export default function Node({
  node,
  r,
  x,
  y,
  fill,
  showLabel,
  ...props
}: Props & SVGProps<SVGCircleElement>) {
  const animatedProps = useSpring({ r, fill });

  return (
    <>
      {/* @ts-ignore */}
      <animated.circle
        {...animatedProps}
        className="node"
        cx={x}
        cy={y}
        {...props}
      />
      {showLabel && (
        <text
          x={x}
          y={y}
          fontSize={16}
          fontWeight={800}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="#393939"
          stroke="#fff"
          strokeWidth={5}
          strokeLinecap="round"
          strokeLinejoin="round"
          paintOrder="stroke"
        >
          {node.code}
        </text>
      )}
    </>
  );
}
