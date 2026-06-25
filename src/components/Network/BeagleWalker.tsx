import { observer } from "mobx-react";
import { animated, to, useSpring } from "react-spring";
import { RandomWalker } from "../../model/algorithms";
import { getAssetPath } from "../../lib/basePath";

interface Props {
  walker: RandomWalker;
  duration?: number;
}

/**
 * BeagleWalker renders the HMS Beagle image as an animated walker on the network.
 * Uses `react-spring` to smoothly animate the image between node positions.
 */
export default observer(function Walker({ walker, duration }: Props) {
  const { current, prev } = walker;

  const x2 = current?.x ?? 0;
  const y2 = current?.y ?? 0;

  const x1 = prev ? prev.x : x2;
  const y1 = prev ? prev.y : y2;

  const props = useSpring({
    reset: true,
    config: { duration },
    from: { x: x1, y: y1 },
    to: { x: x2, y: y2 },
  });

  if (!walker.current) return null;

  // @ts-ignore
  return (
    <animated.image
      href={getAssetPath("/images/hms-beagle.png")}
      width={100}
      height={100}
      transform="translate(-50 -60)"
      {...props}
    />
  );
});
