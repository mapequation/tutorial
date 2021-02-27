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

  const textStyle = {
    fill: '#393939',
    fontWeight: 800,
    letterSpacing: '0.1rem',
  };

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
          textAnchor="middle"
          dominantBaseline="middle"
          style={textStyle}
        >
          {node.code}
        </text>
      )}
    </>
  );
}
