import React, { SVGProps } from 'react';
import type { Link } from '../../model';

const linkPosition = (link: Link, r: number) => {
  const x1 = link.source.x || 0;
  const y1 = link.source.y || 0;
  const x2 = link.target.x || 0;
  const y2 = link.target.y || 0;
  const dx = x2 - x1 || 1e-6;
  const dy = y2 - y1 || 1e-6;
  const l = Math.sqrt(dx * dx + dy * dy);
  const dir = { x: dx / l, y: dy / l };

  return {
    x1: x1 + r * dir.x,
    y1: y1 + r * dir.y,
    x2: x2 - r * dir.x,
    y2: y2 - r * dir.y,
  };
};

interface LinkProps {
  link: Link;
  nodeRadius: number;
}

export default ({
  link,
  nodeRadius,
  ...props
}: LinkProps & SVGProps<SVGLineElement>) => {
  return (
    <line className="link" {...linkPosition(link, nodeRadius)} {...props} />
  );
};
