import { SVGProps } from "react";
import type { Link as LinkModel } from "../../model";

const linkPosition = (link: LinkModel, r1: number, r2: number) => {
  const x1 = link.source.x || 0;
  const y1 = link.source.y || 0;
  const x2 = link.target.x || 0;
  const y2 = link.target.y || 0;
  const dx = x2 - x1 || 1e-6;
  const dy = y2 - y1 || 1e-6;
  const l = Math.sqrt(dx * dx + dy * dy);
  const dir = { x: dx / l, y: dy / l };

  return {
    x1: x1 + r1 * dir.x,
    y1: y1 + r1 * dir.y,
    x2: x2 - r2 * dir.x,
    y2: y2 - r2 * dir.y,
  };
};

interface Props {
  link: LinkModel;
  sourceRadius: number;
  targetRadius: number;
}

export default function Link({
  link,
  sourceRadius,
  targetRadius,
  ...props
}: Props & SVGProps<SVGLineElement>) {
  return <line className="link" {...props} {...linkPosition(link, sourceRadius, targetRadius)} />;
}
