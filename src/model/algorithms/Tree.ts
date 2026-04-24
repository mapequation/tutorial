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
  path: number[];

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

  constructor(parent: TreeNode | null, id: number = -1, path: number[] = []) {
    this.parent = parent;
    this.id = id;
    this.path = [...path];

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
  add(id: number, path: number[] = [...this.path, id]): TreeNode {
    const child = new TreeNode(this, id, path);
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

  get depth(): number {
    return this.path.length;
  }

  get pathKey(): string {
    return this.path.length > 0 ? this.path.join(":") : "root";
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
  private leafLookup: Map<number, TreeNode> = new Map();

  root = new TreeNode(null);

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
    this.leafLookup = new Map();
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
      let parent = root;

      node.path.forEach((moduleId, index) => {
        if (!parent.has(moduleId)) {
          parent.add(moduleId, node.path.slice(0, index + 1));
        }

        parent = parent.get(moduleId)!;
      });

      const child = parent.add(node.id, parent.path);
      child.flow = node.flow;
      this.leafLookup.set(node.id, child);
    });
  }

  private getLeaf(id: number): TreeNode | null {
    return this.leafLookup.get(id) ?? null;
  }

  getModule(path: number[]): TreeNode | null {
    let current: TreeNode | null = this.root;

    for (const segment of path) {
      current = current?.get(segment) ?? null;

      if (!current) {
        return null;
      }
    }

    return current;
  }

  private getLowestCommonAncestor(source: TreeNode, target: TreeNode): TreeNode {
    const sourceAncestors = new Set<TreeNode>();
    let current: TreeNode | null = source.parent;

    while (current) {
      sourceAncestors.add(current);
      current = current.parent;
    }

    current = target.parent;

    while (current) {
      if (sourceAncestors.has(current)) {
        return current;
      }
      current = current.parent;
    }

    return this.root;
  }

  private getBoundaryModules(leaf: TreeNode, stopAt: TreeNode): TreeNode[] {
    const modules: TreeNode[] = [];
    let current = leaf.parent;

    while (current && current !== stopAt) {
      modules.push(current);
      current = current.parent;
    }

    return modules;
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
    this.network.links.forEach(({ source, target, flow }) => {
      const sourceNode = this.getLeaf(source.id);
      const targetNode = this.getLeaf(target.id);

      if (!sourceNode || !targetNode) {
        return;
      }

      const lowestCommonAncestor = this.getLowestCommonAncestor(
        sourceNode,
        targetNode,
      );
      const sourceModules = this.getBoundaryModules(
        sourceNode,
        lowestCommonAncestor,
      );
      const targetModules = this.getBoundaryModules(
        targetNode,
        lowestCommonAncestor,
      );

      if (this.network.directed) {
        sourceModules.forEach((module_) => {
          module_.exitFlow += flow;
        });
        targetModules.forEach((module_) => {
          module_.enterFlow += flow;
        });
        return;
      }

      [...sourceModules, ...targetModules].forEach((module_) => {
        module_.enterFlow += flow / 2;
        module_.exitFlow += flow / 2;
      });
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
