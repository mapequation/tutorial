import type { Node } from '.';
import { Rate } from '.';

export function getRate(rate: Rate, _default = 0) {
  return (node: Node) => {
    if (rate === Rate.Visits) {
      return node.visitRate;
    } else if (rate === Rate.Votes) {
      return node.votes;
    } else if (rate === Rate.Flow) {
      return node.flow;
    }

    return _default;
  };
}
