import React, { SVGProps } from 'react';
import { useSpring, animated } from 'react-spring';

interface Props {
  y: number;
  height: number;
  duration?: number;
}

export default function Bar({
  y,
  height,
  duration = 100,
  ...props
}: Props & SVGProps<SVGRectElement>) {
  const animatedProps = useSpring({ y, height, config: { duration } });

  // @ts-ignore
  return <animated.rect {...animatedProps} width={10} rx={2} {...props} />;
}
