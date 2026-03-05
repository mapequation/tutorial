/**
 * BiasedWalker extends RandomWalker with node2vec-style biased navigation.
 * 
 * Implements biased random walking using return parameter (p) and in-out parameter (q)
 * to modify edge weights based on local graph structure:
 * - Return bias (p < 1): Penalizes returning to the previous node, encouraging exploration
 * - In-out bias (q): Controls balance between exploring neighbors of previous node (q > 1)
 *   vs exploring new nodes (q < 1), creating breadth-first vs depth-first behavior
 * 
 * Parameters stored as inverses (p_inv, q_inv) for efficient multiplication during
 * weight calculation.
 */
import RandomWalker from "./RandomWalker";
import { weightedRandom } from "../helpers";

export default class BiasedWalker extends RandomWalker {
  // Inverse of return and in-out bias parameters (default 1 = no bias)
  private p_inv = 1;
  private q_inv = 1;

  /**
   * Set the return parameter (p) - controls penalization of returning to previous node.
   * p < 1 penalizes return moves, p > 1 encourages returns.
   * Stored as 1/p for efficient weight computation.
   */
  setReturnParam(p: number) {
    if (p <= 0) throw new Error("p must be a positive number");
    this.p_inv = 1 / p;
    return this;
  }

  /**
   * Set the in-out parameter (q) - controls exploration vs neighborhood balance.
   * q < 1 explores new areas (DFS-like), q > 1 explores neighbors (BFS-like).
   * Stored as 1/q for efficient weight computation.
   */
  setInOutParam(q: number) {
    if (q <= 0) throw new Error("q must be a positive number");
    this.q_inv = 1 / q;
    return this;
  }

  /**
   * Override getRandomLink to apply node2vec biasing.
   * Modifies edge weights based on relationship to previous node:
   * - If target is previous node: multiply by p_inv (return bias)
   * - If target is not neighbor of previous node: multiply by q_inv (in-out bias)
   * - Otherwise: use original weight (local neighborhood is neutral)
   */
  protected getRandomLink() {
    if (!this.current) return;
    if (!this.prev || (this.p_inv === 1 && this.q_inv === 1)) return super.getRandomLink();
    
    // Apply bias modifiers to each outgoing edge weight
    const weights = this.current.outLinks.map((link) => {
      // Return penalty: target is the previous node we came from
      if (link.target == this.prev) return this.p_inv * link.weight;
      // In-out penalty: target is not a neighbor of the previous node (new exploration)
      if (!this.prev?.neighbors.includes(link.target)) return this.q_inv * link.weight;
      // Local neighborhood: no penalty, use original weight
      return link.weight;
    });
    const i = weightedRandom(weights);
    return this.current.outLinks[i];
  }
}
