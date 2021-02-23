import { computed, makeObservable } from 'mobx';
import type Network from '../Network';
import type { TreeNode } from './Tree';

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
  private network: Network;

  constructor(network: Network) {
    this.network = network;

    makeObservable(this, {
      oneLevelCodelength: computed,
      codelength: computed,
      indexCodelength: computed,
      indexCodelengths: computed,
      moduleCodelength: computed,
      moduleCodelengths: computed,
    });
  }

  calculateCodelength() {
    const { tree } = this.network;

    for (let treeNode of tree.depthFirstModules()) {
      if (treeNode.isLeafModule) {
        MapEquation.calculateModuleCodelength(treeNode);
      } else {
        MapEquation.calculateIndexCodelength(treeNode);
      }
    }
  }

  static calculateModuleCodelength(module: TreeNode): number {
    const p = [module.exitFlow, ...module.map((node) => node.flow)];

    module.codelength = sum(p) * entropy(p);

    return module.codelength;
  }

  static calculateIndexCodelength(module: TreeNode): number {
    const p = [module.exitFlow, ...module.map((module) => module.enterFlow)];

    module.codelength = sum(p) * entropy(p);

    return module.codelength;
  }

  get oneLevelCodelength(): number {
    const visitRates = this.network.nodes.map((node) => node.flow);

    return entropy(visitRates);
  }

  get indexCodelength(): number {
    return sum(this.indexCodelengths);
  }

  get indexCodelengths(): number[] {
    const { tree } = this.network;

    const codelengths = [];

    for (let module of tree.depthFirstModules()) {
      if (!module.isLeafModule) {
        codelengths.push(module.codelength);
      }
    }

    return codelengths;
  }

  get moduleCodelength(): number {
    return sum(this.moduleCodelengths);
  }

  get moduleCodelengths(): number[] {
    const { tree } = this.network;

    const codelengths = [];

    for (let module of tree.depthFirstModules()) {
      if (module.isLeafModule) {
        codelengths.push(module.codelength);
      }
    }

    return codelengths;
  }

  get codelength(): number {
    return this.indexCodelength + this.moduleCodelength;
  }
}
