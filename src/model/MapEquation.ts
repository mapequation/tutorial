import { computed, makeObservable } from 'mobx';
import type Network from './Network';
import type { Module } from './Tree';

const divide = (xs: number[], numerator: number): number[] => {
  for (let i = 0; i < xs.length; ++i) {
    xs[i] /= numerator;
  }

  return xs;
};

const sum = (xs: number[]): number => xs.reduce((a, b) => a + b, 0.0);

const normalize = (xs: number[]): number[] => divide(xs, sum(xs));

const plogp = (p: number): number => (p > 0 ? p * Math.log2(p) : 0);

const entropy = (ps: number[]): number =>
  normalize(ps).reduce((tot, p) => tot - plogp(p), 0.0);

export default class MapEquation {
  network: Network;

  constructor(network: Network) {
    this.network = network;

    makeObservable(this, {
      oneLevelCodelength: computed,
      codelength: computed,
      indexCodelength: computed,
      moduleCodelengths: computed,
    });
  }

  calculateCodelength() {
    const { tree } = this.network;

    for (let module of tree.depthFirstModules()) {
      if (module.isLeaf) {
        MapEquation.calculateModuleCodelength(module);
      } else {
        MapEquation.calculateIndexCodelength(module);
      }
    }
  }

  static calculateModuleCodelength(module: Module): number {
    const p = [module.exitFlow, ...module.map((node) => node.flow)];

    module.codelength = sum(p) * entropy(p);

    return module.codelength;
  }

  static calculateIndexCodelength(module: Module): number {
    const p = [module.exitFlow, ...module.map((module) => module.enterFlow)];

    module.codelength = sum(p) * entropy(p);

    return module.codelength;
  }

  get oneLevelCodelength(): number {
    const visitRates = this.network.nodes.map((node) => node.flow);

    return entropy(visitRates);
  }

  get indexCodelength(): number {
    const { tree } = this.network;

    let codelength = 0;

    for (let module of tree.depthFirstModules()) {
      if (!module.isLeaf) {
        codelength += module.codelength;
      }
    }

    return codelength;
  }

  get moduleCodelength(): number {
    return sum(this.moduleCodelengths);
  }

  get moduleCodelengths(): number[] {
    const { tree } = this.network;

    const codelengths = [];

    for (let module of tree.depthFirstModules()) {
      if (module.isLeaf) {
        codelengths.push(module.codelength);
      }
    }

    return codelengths;
  }

  get codelength(): number {
    return this.indexCodelength + this.moduleCodelength;
  }
}
