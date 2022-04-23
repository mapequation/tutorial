import { SVGProps } from "react";
import { animated, useSpring } from "react-spring";

interface Props {
  y: number;
  height: number;
  duration?: number;
  animate?: boolean;
}

export default function Bar({
  y,
  height,
  duration = 100,
  animate = false,
  ...props
}: Props & SVGProps<SVGRectElement>) {
  const animatedProps = useSpring({ y, height, config: { duration } });

  const defaultProps = {
    width: 10,
    rx: 2,
  };

  return (
    <>
      {animate && (
        /* @ts-ignore */
        <animated.rect {...animatedProps} {...defaultProps} {...props} />
      )}
      {!animate && <rect y={y} height={height} {...defaultProps} {...props} />}
    </>
  );
}
