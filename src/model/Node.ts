import type { SimulationNodeDatum } from "d3";
import type Link from "./Link";
import type Network from "./Network";
import { computed, makeObservable, observable } from "mobx";
import { weightedRandom } from "./helpers";

interface Params {
  x?: number;
  y?: number;
  name?: string;
  path?: string;
  flow?: number;
}

export default class Node implements SimulationNodeDatum {
  id: number;
  name: string;
  path: number[];
  topModule: number;
  outLinks: Link[] = [];
  neighbors: Node[] = [];

  network: Network;

  flow: number = 0.0;
  visits: number = 0;
  voteRate: number = 0;

  // d3
  index: number = 0;
  x: number;
  y: number;
  vx: number = 0;
  vy: number = 0;

  constructor(
    network: Network,
    id: number,
    { x = 0, y = 0, name = "", path = "0", flow = 0.0 }: Params = {}
  ) {
    makeObservable(this, {
      flow: observable,
      visits: observable,
      voteRate: observable,
      visitRate: computed,
    });

    this.network = network;
    this.id = id;
    this.x = x;
    this.y = y;
    this.name = name || id.toString();
    this.path = path.split(":").map(Number);
    this.topModule = this.path[0];
    this.flow = flow;
  }

  get code(): string {
    const treeNode = this.network.tree.root.getLeaf(this.id);

    return treeNode?.code ?? "";
  }

  get oneLevelCode(): string {
    const treeNode = this.network.tree.root.getLeaf(this.id);

    return treeNode?.oneLevelCode ?? "";
  }

  get visitRate(): number {
    const { totalVisits } = this.network.walker;

    return totalVisits === 0 ? 0 : this.visits / totalVisits;
  }

  get degree(): number {
    return this.outLinks.length;
  }

  get outWeight(): number {
    return this.outLinks.reduce((weight, link) => weight + link.weight, 0.0);
  }

  get moduleFlow(): number {
    return this.network.moduleFlow(this);
  }

  get isDangling(): boolean {
    return this.degree === 0;
  }

  addLink(link: Link) {
    this.outLinks.push(link);
    this.addNeighbor(link.target);
    link.target.addNeighbor(this)
  }

  private addNeighbor(node: Node) {
    const found = this.neighbors.includes(node);
    if (!found) this.neighbors.push(node)
  }

  randomLink(): Link | null {
    const weights = this.outLinks.map((link) => link.weight);
    const i = weightedRandom(weights);
    return this.outLinks[i];
  }

  randomNeighbor(): Node | null {
    if (!this.neighbors.length) return null;
    return this.neighbors[Math.floor(Math.random() * this.neighbors.length)];
  }
}
