/**
 * RandomWalker performs random walk simulation on a network.
 *
 * Simulates a walker that moves through the network by randomly selecting
 * neighbors weighted by link strength. Supports teleportation (jumping to random
 * nodes) based on the teleport rate. Tracks the path taken and supports both
 * continuous (interval-based) and manual stepping modes.
 *
 * Key capabilities:
 * - Random neighbor selection weighted by link strengths
 * - Teleportation with configurable rate and model (recorded/unrecorded)
 * - Continuous animation via setInterval or manual stepping
 * - Full trace history up to 200 steps; visible trace limited to 50 steps
 * - Observable state (MobX) for reactive UI updates
 */
import { action, computed, makeObservable, observable } from "mobx";
import { Teleportation } from "../enums";
import { weightedRandom } from "../helpers";
import { DEFAULT_TELEPORT_MODEL, DEFAULT_TELEPORT_RATE } from ".";
import { performanceMonitor } from "../../utils/performance";
import type Network from "../Network";
import type Node from "../Node";

export interface CodelengthHistoryPoint {
  step: number;
  oneLevelBits: number;
  twoLevelBits: number;
}

export default class RandomWalker {
  private network: Network;

  // Current location and previous location in the walk
  current: Node | null = null;
  prev: Node | null = null;

  // Statistics tracking
  totalVisits = 0;
  teleported = false;
  cumulativeOneLevelBits = 0;
  cumulativeTwoLevelBits = 0;
  codelengthHistory: CodelengthHistoryPoint[] = [];
  private readonly maxCodelengthHistoryLength = 400;

  // Full trace history (up to 200 steps) and visible trace for UI (up to 50 steps)
  trace: number[] = [];
  private readonly maxTraceLength = 200;
  nodeTrace: Node[] = [];
  private readonly maxVisibleLength = 50;

  // Teleportation settings for simulating real-world behavior
  private readonly defaultTeleportRate: number;
  private teleportRate: number;
  private readonly teleportModel = DEFAULT_TELEPORT_MODEL;

  // Continuous animation control via setInterval
  private readonly intervalStopped = -1 as const;
  intervalId: number = this.intervalStopped;
  interval = 1000 / 3;

  constructor(network: Network) {
    this.network = network;
    this.defaultTeleportRate = this.network.directed
      ? DEFAULT_TELEPORT_RATE
      : 0.02;
    this.teleportRate = this.defaultTeleportRate;

    makeObservable<RandomWalker, "teleportRate">(this, {
      totalVisits: observable,
      current: observable,
      teleported: observable,
      cumulativeOneLevelBits: observable,
      cumulativeTwoLevelBits: observable,
      codelengthHistory: observable,
      trace: observable,
      intervalId: observable,
      interval: observable,
      teleportRate: observable,
      setInterval: action,
      setSpeed: action,
      setTeleportRate: action,
      toggleRandomTeleportation: action,
      start: action,
      stop: action,
      restart: action,
      reset: action,
      step: action,
      isStarted: computed,
      teleportationEnabled: computed,
    });
  }

  get isStarted() {
    return this.intervalId !== this.intervalStopped;
  }

  get teleportationEnabled() {
    return this.teleportRate > 0;
  }

  setInterval(interval: number) {
    this.interval = interval;
    if (!this.isStarted) return;
    this.restart();
  }

  setSpeed(stepsPerSecond: number) {
    // interval is delay between each step in ms
    this.setInterval(1000 / stepsPerSecond);
  }

  setTeleportRate(teleportRate: number) {
    if (teleportRate < 0) throw new Error("teleportRate must be non-negative");
    this.teleportRate = teleportRate;
    return this;
  }

  toggleRandomTeleportation() {
    this.teleportRate = this.teleportationEnabled
      ? 0
      : this.defaultTeleportRate;
    return this;
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

  restart() {
    this.stop();
    this.start();
  }

  reset() {
    if (this.isStarted) this.stop();

    this.totalVisits = 0;
    this.cumulativeOneLevelBits = 0;
    this.cumulativeTwoLevelBits = 0;
    this.codelengthHistory.length = 0;
    this.trace.length = 0;
    this.nodeTrace.length = 0;
    this.teleported = false;

    for (const node of this.network.nodes) {
      node.visits = 0;
    }

    this.setCurrent(null);
  }

  step(stop = true) {
    performanceMonitor.mark("walker-step");

    if (stop && this.isStarted) this.stop();

    if (!this.current) {
      this.setCurrent(this.network.nodes[0]);
      this.recordVisit();
      performanceMonitor.measure("walker-step");
      return;
    }

    this.teleported =
      Math.random() < this.teleportRate || this.current?.degree === 0;

    if (this.teleported) {
      const result = this.teleport();
      performanceMonitor.measure("walker-step");
      return result;
    }

    // degree should always be > 0 here
    const link = this.getRandomLink();

    if (!link) {
      throw new Error("No link found, but node has out degree > 0");
    }

    this.setCurrent(link.target);

    this.recordVisit();
    performanceMonitor.measure("walker-step");
  }

  protected getRandomLink(selfAvoidBias = 2) {
    if (selfAvoidBias < 1) throw new Error("selfAvoidBias must be >= 1");
    if (!this.current) return;
    if (!this.prev || selfAvoidBias === 1) return this.current?.randomLink();

    const weights = this.current.outLinks.map((link) =>
      link.target == this.prev ? link.weight / selfAvoidBias : link.weight,
    );
    const i = weightedRandom(weights);
    return this.current.outLinks[i];
  }

  private teleport() {
    const degrees = this.network.nodes.map((node) =>
      // set teleport-weight of current to 0 to avoid self-teleportation
      node.id === this.current?.id ? 0 : node.degree,
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
    if (this.trace.length > this.maxTraceLength) {
      this.trace.shift();
    }
    this.updateCodelengthHistory();
    this.pushCurrent(this.current);
  }

  private updateCodelengthHistory() {
    if (!this.current) return;

    const currentTreeNode = this.network.tree.root.getLeaf(this.current.id);

    if (!currentTreeNode) return;

    this.cumulativeOneLevelBits += currentTreeNode.oneLevelCode.length;

    const previousTreeNode = this.prev
      ? this.network.tree.root.getLeaf(this.prev.id)
      : null;
    const enteredNewModule =
      previousTreeNode?.parent?.id !== currentTreeNode.parent?.id;
    const twoLevelIncrement = previousTreeNode
      ? (enteredNewModule
          ? (previousTreeNode.parent?.exitCode.length ?? 0)
          : 0) +
        (enteredNewModule
          ? (currentTreeNode.parent?.enterCode.length ?? 0)
          : 0) +
        currentTreeNode.code.length
      : (currentTreeNode.parent?.enterCode.length ?? 0) +
        currentTreeNode.code.length;

    this.cumulativeTwoLevelBits += twoLevelIncrement;
    this.codelengthHistory.push({
      step: this.totalVisits,
      oneLevelBits: this.cumulativeOneLevelBits,
      twoLevelBits: this.cumulativeTwoLevelBits,
    });

    if (this.codelengthHistory.length > this.maxCodelengthHistoryLength) {
      this.codelengthHistory.shift();
    }
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
