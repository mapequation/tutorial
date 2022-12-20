import { computed, makeObservable } from "mobx";
import type Tree from "./Tree"
import type { TreeNode } from "./Tree";
import { entropy, sum } from "../helpers";

export default class MapEquation {
  private readonly tree: Tree;

  constructor(tree: Tree) {
    this.tree = tree;

    makeObservable(this, {
      oneLevelCodelength: computed,
      codelength: computed,
      indexCodelength: computed,
      indexCodelengths: computed,
      moduleCodelength: computed,
      moduleCodelengths: computed,
    });
  }

  calculate() {
    for (let treeNode of this.tree.depthFirstModules()) {
      if (treeNode.isLeafModule) {
        MapEquation.calculateModuleCodelength(treeNode);
      } else {
        MapEquation.calculateIndexCodelength(treeNode);
      }
    }
    return this;
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
    const visitRates = []

    for (let node of this.tree.root.leafNodes()) {
      visitRates.push(node.flow)
    }

    return entropy(visitRates);
  }

  get indexCodelength(): number {
    return sum(this.indexCodelengths);
  }

  get indexCodelengths(): number[] {
    const codelengths = [];

    for (let module_ of this.tree.depthFirstModules()) {
      if (!module_.isLeafModule) {
        codelengths.push(module_.codelength);
      }
    }

    return codelengths;
  }

  get moduleCodelength(): number {
    return sum(this.moduleCodelengths);
  }

  get moduleCodelengths(): number[] {
    const codelengths = [];

    for (let module_ of this.tree.depthFirstModules()) {
      if (module_.isLeafModule) {
        codelengths.push(module_.codelength);
      }
    }

    return codelengths;
  }

  get codelength(): number {
    return this.indexCodelength + this.moduleCodelength;
  }
}
