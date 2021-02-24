import { computed, makeObservable } from 'mobx';
import type Network from '../Network';
import type { TreeNode } from './Tree';
import { entropy, sum } from '../helpers';

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

  private static calculateModuleCodelength(module: TreeNode): number {
    const p = [module.exitFlow, ...module.map((node) => node.flow)];

    module.codelength = sum(p) * entropy(p);

    return module.codelength;
  }

  private static calculateIndexCodelength(module: TreeNode): number {
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
