/**
 * Tree data structure for hierarchical module organization.
 * 
 * Represents a tree of modules and their contained network nodes, organized by the
 * topModule property. Stores flow metrics for each module (enter/exit flow) to enable
 * visualization of traffic flowing between modules. Used by HuffmanCoder for code
 * generation and by UI components for rendering module structure.
 */
import type Network from "../Network";
import type { HuffmanNode } from "./HuffmanCoder";
import { action, makeObservable, observable } from "mobx";

/**
 * TreeNode represents a module or network node in the hierarchical tree structure.
 * 
 * Properties:
 * - flow: Total flow/visits within this node
 * - enterFlow/exitFlow: Flow crossing module boundaries (for intermediate nodes)
 * - code/enterCode/exitCode/oneLevelCode: Huffman codes for this node
 * - codelength: Compressed size when using this code
 * - x/y/height/index: Layout and rendering properties
 * - parent/children: Tree structure (parent is null only for root)
 */
export class TreeNode {
  id: number;

  // Flow metrics
  flow = 0;
  enterFlow = 0;
  exitFlow = 0;

  // Huffman codes assigned during compression
  code = "";
  enterCode = "";
  exitCode = "";
  oneLevelCode = "";

  // Huffman trees for visualization
  huffmanOneLevelTree: HuffmanNode<{ flow: number; id?: number }> | null = null;
  huffmanIndexTree: HuffmanNode<{ flow: number; id?: number }> | null = null;
  huffmanModuleTree: HuffmanNode<{ flow: number; id?: number }> | null = null;

  // Compressed message length using this code
  codelength = 0;

  // Visualization layout properties
  x = 0;
  y = 0;
  height = 0;
  index = 0;

  // Hierarchical structure
  parent: TreeNode | null;
  children: Map<number, TreeNode> = new Map();

  constructor(parent: TreeNode | null, id: number = -1) {
    this.parent = parent;
    this.id = id;

    makeObservable(this, {
      flow: observable,
      enterFlow: observable,
      exitFlow: observable,
      code: observable,
      enterCode: observable,
      exitCode: observable,
      oneLevelCode: observable,
      codelength: observable,
    });
  }

  /**
   * Add a child node with the given id.
   * Returns the new child for fluent chaining.
   */
  add(id: number): TreeNode {
    const child = new TreeNode(this, id);
    this.children.set(id, child);
    return child;
  }

  /**
   * Check if a child with the given id exists.
   */
  has(id: number): boolean {
    return this.children.has(id);
  }

  /**
   * Get direct child by id, or null if not found.
   */
  get(id: number): TreeNode | null {
    return this.children.get(id) ?? null;
  }

  /**
   * Recursively search for a leaf node with the given id.
   * Returns null if not found or if this is not a leaf module.
   */
  getLeaf(id: number): TreeNode | null {
    if (this.isLeafModule) {
      return this.get(id);
    }

    for (const child of this.children.values()) {
      const found = child.getLeaf(id);
      if (found) return found;
    }

    return null;
  }

  /**
   * True if this is the root node (no parent).
   */
  get isRoot(): boolean {
    return this.parent === null;
  }

  /**
   * True if this node's direct children are leaf nodes.
   * Used to identify module containers vs individual nodes.
   */
  get isLeafModule(): boolean {
    if (this.children.size === 0) return false;

    const first = this.children.values().next().value;
    return first?.isLeafNode ?? false;
  }

  /**
   * True if this is a leaf node (has a parent but no children).
   * Represents an individual network node in the tree.
   */
  get isLeafNode(): boolean {
    return this.parent !== null && this.children.size === 0;
  }

  /**
   * Helper to convert children Map to array.
   */
  private get arrayChildren(): TreeNode[] {
    return Array.from(this.children.values());
  }

  /**
   * Sort direct children using the provided comparison function.
   * Returns sorted array without modifying tree structure.
   */
  sort(compareFn: (a: TreeNode, b: TreeNode) => number): TreeNode[] {
    return this.arrayChildren.sort(compareFn);
  }

  /**
   * Map a function over direct children.
   */
  map<T>(callback: (item: TreeNode, i?: number) => T): T[] {
    return this.arrayChildren.map(callback);
  }

  /**
   * Generator yielding all leaf nodes in this subtree (depth-first order).
   */
  *leafNodes(): Generator<TreeNode> {
    for (let child of this.children.values()) {
      if (child.isLeafNode) {
        yield child;
      } else {
        yield* child.leafNodes();
      }
    }
  }

  /**
   * Generator yielding all non-leaf nodes in this subtree in depth-first order.
   * Used to iterate through modules only (skips individual network nodes).
   */
  *depthFirst(): Generator<TreeNode> {
    yield this;

    for (let child of this.children.values()) {
      if (!child.isLeafNode) {
        yield* child.depthFirst();
      }
    }
  }
}

/**
 * Tree builds and manages the hierarchical module structure of a network.
 * 
 * Converts the network's flat node list into a tree organized by topModule,
 * then calculates enter/exit flow for each module boundary. This structure
 * enables hierarchical visualization and code generation in HuffmanCoder.
 */
export default class Tree {
  private network: Network;

  root = new TreeNode(null);
  private readonly module_ = "topModule";

  constructor(network: Network) {
    this.network = network;

    makeObservable(this, {
      root: observable.ref,
      update: action,
    });
  }

  /**
   * Rebuild the entire tree from the current network state.
   * Should be called whenever network topology or module assignments change.
   * Returns this for chaining.
   */
  update() {
    this.root = new TreeNode(null);
    this.addNodesToTree();
    this.addEnterExitFlowToTree();
    return this;
  }

  /**
   * Add all network nodes to the tree, organized by their topModule property.
   * Creates module containers as needed.
   */
  private addNodesToTree() {
    const { root } = this;

    this.network.nodes.forEach((node) => {
      const module_ = node[this.module_];

      if (!root.has(module_)) {
        root.add(module_);
      }

      const parent = root.get(module_)!;
      const child = parent.add(node.id);
      child.flow = node.flow;
    });
  }

  /**
   * Calculate enter/exit flow for each module by traversing all network links.
   * For inter-module links, accumulates flow at the boundary where modules diverge.
   * Handles both directed and undirected networks (undirected splits flow 50/50).
   * 
   * Note: Assumes all nodes are at the same tree level; hierarchical modules
   * would need level equalization logic (marked as TODO).
   */
  private addEnterExitFlowToTree() {
    const { root } = this;

    this.network.links.forEach(({ source, target, flow }) => {
      const sourceNode = root.getLeaf(source.id)!;
      const targetNode = root.getLeaf(target.id)!;

      let sourceParent = sourceNode.parent;
      let targetParent = targetNode.parent;

      // Walk up the tree until reaching a common ancestor
      // Accumulate flow at each module boundary crossed
      while (sourceParent !== targetParent) {
        if (this.network.directed) {
          // For directed: source module exits, target module enters
          sourceParent!.exitFlow += flow;
          targetParent!.enterFlow += flow;
        } else {
          // For undirected: both directions count equally
          sourceParent!.exitFlow += flow / 2;
          sourceParent!.enterFlow += flow / 2;
          targetParent!.exitFlow += flow / 2;
          targetParent!.enterFlow += flow / 2;
        }

        sourceParent = sourceParent!.parent;
        targetParent = targetParent!.parent;
      }
    });
  }

  /**
   * Generator yielding all modules (non-leaf nodes) in depth-first order.
   * Excludes individual network nodes, only yields module containers.
   */
  *depthFirstModules(): Generator<TreeNode> {
    yield* this.root.depthFirst();
  }
}
