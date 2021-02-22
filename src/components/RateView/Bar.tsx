import React, { SVGProps } from 'react';
import { useSpring, animated } from 'react-spring';

interface Props {
  y: number;
  height: number;
}

export default function Bar({
  y,
  height,
  ...props
}: Props & SVGProps<SVGRectElement>) {
  const animatedProps = useSpring({ y, height });

  return <animated.rect {...animatedProps} width={10} rx={2} {...props} />;
}
