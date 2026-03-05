/**
 * MapEquation calculates information-theoretic compression metrics for network flow.
 * 
 * Implements the Map Equation (http://www.mapequation.org) to measure how well
 * a module partition explains network flow. Lower codelength = better compression.
 * 
 * Splits codelength into two components:
 * - Index codelength: Cost to describe inter-module flow and module structure
 * - Module codelength: Cost to describe intra-module flow and node visits
 * 
 * Uses entropy(probability distribution) * total_flow to compute compression cost,
 * with MobX computed properties for reactive updates.
 */
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

  /**
   * Calculate codelength for all modules in the tree.
   * Must be called before reading codelength values to ensure they're up-to-date.
   * Returns this for chaining.
   */
  calculate() {
    for (let treeNode of this.tree.depthFirstModules()) {
      if (treeNode.isLeafModule) {
        // Leaf modules contain individual network nodes
        MapEquation.calculateModuleCodelength(treeNode);
      } else {
        // Index modules contain other modules
        MapEquation.calculateIndexCodelength(treeNode);
      }
    }
    return this;
  }

  /**
   * Calculate codelength for a module (leaf) containing network nodes.
   * Probability: [exit flow, node flows...]
   * Cost: sum(probabilities) * entropy(probabilities)
   */
  private static calculateModuleCodelength(module: TreeNode): number {
    const p = [module.exitFlow, ...module.map((node) => node.flow)];
    module.codelength = sum(p) * entropy(p);
    return module.codelength;
  }

  /**
   * Calculate codelength for an index module containing sub-modules.
   * Probability: [exit flow, enter flows of child modules...]
   * Cost: sum(probabilities) * entropy(probabilities)
   */
  private static calculateIndexCodelength(module: TreeNode): number {
    const p = [module.exitFlow, ...module.map((module) => module.enterFlow)];
    module.codelength = sum(p) * entropy(p);
    return module.codelength;
  }

  /**
   * One-level codelength: compression with all nodes in a single flat module.
   * Uses entropy of all individual node flows.
   * Baseline for comparison to hierarchical partitions.
   */
  get oneLevelCodelength(): number {
    const visitRates = []

    for (let node of this.tree.root.leafNodes()) {
      visitRates.push(node.flow)
    }

    return entropy(visitRates);
  }

  /**
   * Total cost to describe inter-module navigation and module structure.
   * Sum of all index modules' codelengths.
   */
  get indexCodelength(): number {
    return sum(this.indexCodelengths);
  }

  /**
   * Array of codelengths for all index (intermediate) modules.
   */
  get indexCodelengths(): number[] {
    const codelengths = [];

    for (let module_ of this.tree.depthFirstModules()) {
      if (!module_.isLeafModule) {
        codelengths.push(module_.codelength);
      }
    }

    return codelengths;
  }

  /**
   * Total cost to describe intra-module navigation and node visits.
   * Sum of all leaf module codelengths.
   */
  get moduleCodelength(): number {
    return sum(this.moduleCodelengths);
  }

  /**
   * Array of codelengths for all leaf (terminal) modules.
   */
  get moduleCodelengths(): number[] {
    const codelengths = [];

    for (let module_ of this.tree.depthFirstModules()) {
      if (module_.isLeafModule) {
        codelengths.push(module_.codelength);
      }
    }

    return codelengths;
  }

  /**
   * Total codelength = index + module costs.
   * Lower values indicate better module partition quality.
   */
  get codelength(): number {
    return this.indexCodelength + this.moduleCodelength;
  }
}
