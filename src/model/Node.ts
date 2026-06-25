import type { SimulationNodeDatum } from "d3";
import type Link from "./Link";
import type Network from "./Network";
import { action, computed, makeObservable, observable } from "mobx";
import { weightedRandom } from "./helpers";

interface Params {
  x?: number;
  y?: number;
  name?: string;
  path?: string | number[];
  flow?: number;
}

/**
 * Model for a single network node.
 *
 * Stores layout coordinates, connectivity (outgoing links and neighbors),
 * module assignment (`topModule`), and runtime statistics used by the
 * visualization (visit counts, flow). Many fields are observable (MobX)
 * so UI components can react to updates from walkers and iterative
 * algorithms.
 */
export default class Node implements SimulationNodeDatum {
  id: number;
  name: string;
  private pathSegments: number[];
  topModule: number = 0;
  private readonly initialPath: number[];
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
      topModule: observable,
      setPath: action,
      setTopModule: action,
      setInitialModule: action,
      visitRate: computed,
    });

    this.network = network;
    this.id = id;
    this.x = x;
    this.y = y;
    this.name = name || id.toString();
    this.pathSegments = Node.parsePath(path);
    this.initialPath = [...this.pathSegments];
    this.topModule = this.pathSegments[0];
    this.flow = flow;
  }

  private static parsePath(path: string | number[]): number[] {
    const rawSegments = Array.isArray(path)
      ? path
      : path
          .split(":")
          .map((value) => Number(value.trim()))
          .filter((value) => Number.isFinite(value));

    return rawSegments.length > 0 ? [...rawSegments] : [0];
  }

  get path(): number[] {
    return [...this.pathSegments];
  }

  get pathString(): string {
    return this.pathSegments.join(":");
  }

  setPath(path: string | number[]) {
    this.pathSegments = Node.parsePath(path);
    this.topModule = this.pathSegments[0];
  }

  setTopModule(module: number) {
    const nextPath = this.pathSegments.length > 0 ? [...this.pathSegments] : [0];
    nextPath[0] = module;
    this.setPath(nextPath);
  }

  setInitialModule() {
    this.setPath(this.initialPath);
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

  /**
   * Choose an outgoing link using the link weights as probabilities.
   * Returns `null` if there are no outgoing links.
   */
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
