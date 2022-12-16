import type { Node } from ".";
import { Rate } from ".";

export function getRate(rate: Rate) {
  return (node: Node): number => {
    switch (rate) {
      case Rate.Visits:
        return node.visitRate;
      case Rate.Votes:
        return node.voteRate;
      case Rate.Flow:
        return node.flow;
      case Rate.None:
        return 1 / node.network.numNodes;
    }
  };
}
