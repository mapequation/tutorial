import RandomWalker from "./RandomWalker";
import { weightedRandom } from "../helpers";

export default class BiasedWalker extends RandomWalker {

  private p_inv = 1;
  private q_inv = 1;

  setReturnParam(p: number) {
    if (p <= 0) throw new Error("p must be a positive number");
    this.p_inv = 1 / p;
    return this;
  }

  setInOutParam(q: number) {
    if (q <= 0) throw new Error("q must be a positive number");
    this.q_inv = 1 / q;
    return this;
  }

  protected getRandomLink() {
    if (!this.current) return;
    if (!this.prev || (this.p_inv === 1 && this.q_inv === 1)) return super.getRandomLink();
    const weights = this.current.outLinks.map((link) => {
      if (link.target == this.prev) return this.p_inv * link.weight;
      if (!this.prev?.neighbors.includes(link.target)) return this.q_inv * link.weight;
      return link.weight;
    });
    const i = weightedRandom(weights);
    return this.current.outLinks[i];
  }
}
