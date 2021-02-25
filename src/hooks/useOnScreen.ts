import { Ref, useEffect, useState } from 'react';

// https://stackoverflow.com/a/65008608/3690629
export default function useOnScreen<T>(
  ref: Ref<T>,
  threshold: number | number[] = 0,
  callback?: () => void,
): boolean {
  const [isIntersecting, setIntersecting] = useState(false);

  const observer = new IntersectionObserver(
    ([entry]) => {
      setIntersecting(entry.isIntersecting);
      if (isIntersecting && callback) {
        callback();
      }
    },
    { threshold },
  );

  useEffect(() => {
    // @ts-ignore
    observer.observe(ref.current);

    // Remove the observer as soon as the component is unmounted
    return () => {
      observer.disconnect();
    };
  });

  return isIntersecting;
}
