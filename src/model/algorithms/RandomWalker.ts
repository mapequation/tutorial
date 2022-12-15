import type Network from "../Network";
import type Node from "../Node";
import { Teleportation } from "../enums";
import { action, computed, makeObservable, observable } from "mobx";
import { weightedRandom } from "../helpers";
import { DEFAULT_TELEPORT_MODEL, DEFAULT_TELEPORT_RATE } from ".";

export default class RandomWalker {
  private network: Network;

  current: Node | null = null;
  prev: Node | null = null;

  totalVisits = 0;
  teleported = false;
  trace: number[] = [];
  nodeTrace: Node[] = [];
  private readonly maxVisibleLength = 50;

  private readonly teleportRate: number;
  private readonly teleportModel = DEFAULT_TELEPORT_MODEL;

  private readonly intervalStopped = -1 as const;
  intervalId: number = this.intervalStopped;
  private interval = 400;

  constructor(network: Network) {
    this.network = network;
    this.teleportRate = this.network.directed ? DEFAULT_TELEPORT_RATE : 0;

    makeObservable(this, {
      totalVisits: observable,
      current: observable,
      teleported: observable,
      trace: observable,
      intervalId: observable,
      start: action,
      stop: action,
      reset: action,
      step: action,
      isStarted: computed,
    });
  }

  get isStarted() {
    return this.intervalId !== this.intervalStopped;
  }

  isVisiting(node: Node) {
    return this.current?.id === node.id;
  }

  start() {
    if (this.isStarted) return;

    this.intervalId = window.setInterval(() => this.step(false), this.interval);
  }

  stop() {
    window.clearInterval(this.intervalId);
    this.intervalId = this.intervalStopped;
  }

  reset() {
    if (this.isStarted) this.stop();

    this.totalVisits = 0;
    this.trace.length = 0;
    this.nodeTrace.length = 0;

    this.network.nodes.forEach((node) => (node.visits = 0));

    this.setCurrent(null);
  }

  step(stop = true) {
    if (stop && this.isStarted) this.stop();

    if (!this.current) {
      this.setCurrent(this.network.nodes[0]);
      this.recordVisit();
      return;
    }

    this.teleported =
      Math.random() < this.teleportRate || this.current?.degree === 0;

    if (this.teleported) {
      return this.teleport();
    }

    // degree should always be > 0 here
    const link = this.current?.randomLink();

    if (!link) {
      throw new Error("No link found, but node has out degree > 0");
    }

    this.setCurrent(link.target);

    this.recordVisit();
  }

  private teleport() {
    const degrees = this.network.nodes.map((node) =>
      // set teleport-weight of current to 0 to avoid self-teleportation
      node.id === this.current?.id ? 0 : node.degree
    );

    const index = weightedRandom(degrees);

    const current = this.network.nodes[index];
    this.setCurrent(current);

    if (this.teleportModel === Teleportation.Recorded) {
      this.recordVisit();
    }
  }

  private recordVisit() {
    if (!this.current) return;

    this.current.visits++;
    this.totalVisits++;
    this.trace.push(this.current.id);
    this.pushCurrent(this.current)
  }

  private pushCurrent(node: Node) {
    this.nodeTrace.push(node);
    if (this.nodeTrace.length > this.maxVisibleLength) {
      this.nodeTrace.shift();
    }
  }

  private setCurrent(node: Node | null) {
    this.prev = this.current;
    this.current = node;
  }
}
