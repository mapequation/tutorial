import React, { useEffect, useRef } from 'react';
import { Network } from '../../model';
import { observer } from 'mobx-react';
import { animated, useSpring } from 'react-spring';

interface Props {
  network: Network;
}

function Trace({ network }: Props) {
  const { walker } = network;

  const containerRef = useRef<HTMLDivElement>(null);
  const lastRef = useRef<HTMLSpanElement>(null);

  const nodes = walker.trace.map((id) => network.getNode(id)!);

  const codes = nodes.map((node) => node.code);

  const last = codes.pop();

  useEffect(() => {
    containerRef.current!.scrollTop = lastRef.current?.offsetTop ?? 0;
  }, [last]);

  const props = useSpring({
    reset: true,
    from: { opacity: 0 },
    to: { opacity: 1 },
  });

  return (
    <div
      ref={containerRef}
      className="px-4 py-2 w-full h-32 overflow-y-auto overscroll-contain rounded-lg border-2 border-gray-200 leading-snug text-base"
    >
      {codes.join(' ')} {/* @ts-ignore */}
      <animated.span ref={lastRef} style={props}>
        {last}
      </animated.span>
    </div>
  );
}

export default observer(Trace);
