import React, { SVGProps } from 'react';
import { animated, useSpring } from 'react-spring';

interface Props {
  r: number;
  fill: string;
}

export default ({ r, fill, ...props }: Props & SVGProps<SVGCircleElement>) => {
  const animatedProps = useSpring({ r, fill });

  // @ts-ignore
  return <animated.circle {...animatedProps} className="node" {...props} />;
};
