import { motion, SVGMotionProps } from "framer-motion";

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
}: Props & SVGMotionProps<SVGRectElement>) {
  const defaultProps = {
    width: 10,
    rx: 2,
  };

  return (
    <>
      {animate && (
        <motion.rect
          initial={false}
          animate={{ attrY: y, height }}
          transition={{ duration: duration / 1000 }}
          {...defaultProps}
          {...props}
        />
      )}
      {!animate && <motion.rect y={y} height={height} {...defaultProps} {...props} />}
    </>
  );
}
