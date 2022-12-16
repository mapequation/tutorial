import { observer } from "mobx-react";
import { animated, to, useSpring } from "react-spring";
import { RandomWalker } from "../../model/algorithms";

interface Props {
  walker: RandomWalker;
  r?: number;
}

export default observer(function Walker({ walker, r = 10 }: Props) {
  const { current, prev } = walker;

  const x2 = current?.x ?? 0;
  const y2 = current?.y ?? 0;

  const x1 = prev ? prev.x : x2;
  const y1 = prev ? prev.y : y2;

  const props = useSpring({
    reset: true,
    config: { duration: walker.interval },
    from: { x: x1, y: y1 },
    to: { x: x2, y: y2 },
  });

  if (!walker.current) return null;

  // @ts-ignore
  return (
    <animated.image
      href="/demo/images/hms-beagle.png"
      width={100}
      height={100}
      transform="translate(-50 -60)"
      {...props}
    />
  );
});
