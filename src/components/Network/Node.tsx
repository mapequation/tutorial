import React, { SVGProps } from 'react';
import { animated, useSpring } from 'react-spring';

interface Props {
  r: number;
  x: number;
  y: number;
  fill: string;
  label?: string;
}

export default ({
  r,
  x,
  y,
  fill,
  label,
  ...props
}: Props & SVGProps<SVGCircleElement>) => {
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
      {label != null && (
        <text
          x={x}
          y={y}
          dy={5}
          textAnchor="middle"
          style={{
            fill: '#888',
            fontWeight: 800,
            fontSize: 16,
            letterSpacing: '0.1rem',
            textShadow:
              '-2px -2px 2px #fff, 2px -2px 2px #fff, -2px 2px 2px #fff, 2px 2px 2px #fff',
          }}
        >
          {label}
        </text>
      )}
    </>
  );
};
