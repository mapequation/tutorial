import type { Node } from ".";
import { Rate } from ".";

/**
 * Returns a function that maps a `Node` to a numeric rate according to the
 * requested `Rate` strategy. This abstraction lets visualization code ask
 * for a rate without coupling to the specific metric (visits, votes, flow,
 * or uniform).
 */
export function getRate(rate: Rate) {
  return (node: Node): number => {
    switch (rate) {
      case Rate.Visits:
        return node.visitRate;
      case Rate.Votes:
        return node.voteRate;
      case Rate.Flow:
        return node.flow;
      case Rate.Uniform:
        return 1 / node.network.numNodes;
    }
  };
}
