/**
 * HuffmanCoder generates optimal variable-length codes for network modules.
 * 
 * Implements Huffman coding algorithm to assign binary codes that minimize
 * message length. Codes are assigned at three levels:
 * - One-level: codes for all nodes in a flat structure
 * - Index: codes for module enter events (in tree's middle level)
 * - Module: codes for within-module visits and module exits (in modules)
 * 
 * Uses priority queue for efficient tree construction and depth-first
 * traversal to assign codes by path (left='0', right='1').
 */
import type Network from "../Network";
import type { TreeNode } from "./Tree";

/**
 * Comparison function type for priority queue.
 */
type CompareFn<T> = (a: T, b: T) => number;

/**
 * Priority queue backed by a sorted array.
 * Uses insertion sort for simplicity (not optimal for large queues).
 */
class PriorityQueue<T> {
  private heap: T[] = [];
  private readonly compareFn: CompareFn<T>;

  constructor(compareFn: CompareFn<T>) {
    this.compareFn = compareFn;
  }

  push(item: T) {
    this.heap.push(item);
    this.heap.sort(this.compareFn);
  }

  get size(): number {
    return this.heap.length;
  }

  popLeft(): T | undefined {
    return this.heap.shift();
  }
}

/**
 * Node in a Huffman coding tree.
 * Leaf nodes hold data items (flow values, node/module ids).
 * Internal nodes are created during tree construction and hold aggregated data.
 * Code is computed during tree construction: left child appends '0', right appends '1'.
 */
export class HuffmanNode<T> {
  code: string = "";

  constructor(
    public data: T,
    public left?: HuffmanNode<T>,
    public right?: HuffmanNode<T>
  ) {}

  /**
   * Generator yielding all nodes in depth-first order.
   */
  *depthFirst(): Generator<HuffmanNode<T>> {
    yield this;

    if (this.left) {
      yield* this.left.depthFirst();
    }

    if (this.right) {
      yield* this.right.depthFirst();
    }
  }

  /**
   * True if this is a leaf node (data source).
   */
  get isLeaf(): boolean {
    return !this.left && !this.right;
  }
}

/**
 * Function type for combining two items (used to sum flows of children).
 */
type AddFn<T> = (a: T, b: T) => T;
type HuffmanTree<T> = HuffmanNode<T>;

/**
 * Build a Huffman coding tree from items.
 * 
 * Algorithm:
 * 1. Create leaf nodes for each item
 * 2. Repeatedly combine two lowest-flow nodes until one root remains
 * 3. Assign codes by path: left='0', right='1'
 */
function createHuffmanTree<T>(
  items: T[],
  compareFn: CompareFn<T>,
  addFn: AddFn<T>
): HuffmanTree<T> | null {
  if (items.length === 0) {
    return null;
  }

  const nodeCompareFn = (a: HuffmanNode<T>, b: HuffmanNode<T>) =>
    compareFn(a.data, b.data);

  const nodes = items.map((item) => new HuffmanNode(item));
  const queue = new PriorityQueue(nodeCompareFn);

  for (let node of nodes) {
    queue.push(node);
  }

  // Combine lowest-flow pairs until single tree remains
  while (queue.size > 1) {
    const left = queue.popLeft()!;
    const right = queue.popLeft()!;
    const data = addFn(left.data, right.data);
    queue.push(new HuffmanNode<T>(data, left, right));
  }

  let root = queue.popLeft()!;

  // Handle single-item case: wrap in a parent node so it gets a non-empty code
  if (items.length === 1) {
    const singleChild = root;
    root = new HuffmanNode<T>(singleChild.data, singleChild, undefined);
    singleChild.code = "0";
  } else if (items.length > 1) {
    // Assign codes: traverse tree and append '0' for left, '1' for right
    for (let node of root.depthFirst()) {
      if (node.left) {
        node.left.code = node.code + "0";
      }
      if (node.right) {
        node.right.code = node.code + "1";
      }
    }
  }
  return root;
}

/**
 * Item with flow value and optional id for tracking data source.
 */
type Item = {
  flow: number;
  id?: number;
};

/**
 * HuffmanCoder generates optimal binary codes for all levels of network hierarchy.
 */
export default class HuffmanCoder {
  private readonly network: Network;
  private readonly compareFn = (a: Item, b: Item) => a.flow - b.flow;
  private readonly addFn = (a: Item, b: Item) => ({ flow: a.flow + b.flow });

  constructor(network: Network) {
    this.network = network;
  }

  /**
   * Generate all Huffman codes for the hierarchical module structure.
   * Must be called after Tree.update() and MapEquation.calculate().
   */
  code() {
    const { tree } = this.network;


    // Generate flat codes for all nodes (ignoring modules)
    this.calculateOneLevelCodes(tree.root);

    // Generate hierarchical codes
    for (let treeNode of tree.depthFirstModules()) {
      if (treeNode.isLeafModule) {
        // Leaf module: code for module exits and node visits
        this.calculateModuleCodes(treeNode);
      } else {
        // Index module: codes for entering child modules
        this.calculateIndexCodes(treeNode);
      }
    }
  }

  /**
   * Create a Huffman tree from a list of items with flow values.
   */
  private createTree(items: Item[]): HuffmanTree<Item> | null {
    return createHuffmanTree(items, this.compareFn, this.addFn);
  }

  /**
   * Assign one-level codes: single flat Huffman tree over all nodes.
   * Used as baseline for compression comparison.
   */
  private calculateOneLevelCodes(node: TreeNode) {
    const { network } = this;

    const root = this.createTree(network.nodes);

    // Store the Huffman tree for visualization
    node.huffmanOneLevelTree = root;

    if (!root) {
      return;
    }

    for (let treeNode of root.depthFirst()) {
      if (treeNode.isLeaf) {
        node.getLeaf(treeNode.data.id!)!.oneLevelCode = treeNode.code;
      }
    }
  }

  /**
   * Assign enter codes: codes for entering child modules within this index module.
   * Uses child modules' enterFlow as probability weights, and for non-root
   * modules also assigns one exit code for returning to the parent level.
   */
  private calculateIndexCodes(node: TreeNode) {
    const exitId = -1;
    const items = node.map(({ id, enterFlow }) => ({ id, flow: enterFlow }));

    if (!node.isRoot) {
      items.unshift({ id: exitId, flow: node.exitFlow });
    }

    const root = this.createTree(items);

    // Store the Huffman tree for visualization
    node.huffmanIndexTree = root;

    if (!root) {
      return;
    }

    for (let treeNode of root.depthFirst()) {
      if (treeNode.isLeaf) {
        if (treeNode.data.id === exitId) {
          node.exitCode = treeNode.code;
          continue;
        }

        node.get(treeNode.data.id!)!.enterCode = treeNode.code;
      }
    }
  }

  /**
   * Assign module codes: codes for module exit and within-module node visits.
   * Special pseudo-node (id=-1) represents module exit event.
   * Uses flow (node visits) as probability weights.
   */
  private calculateModuleCodes(node: TreeNode) {
    const exitId = -1;
    const nodes = node.map(({ id, flow }) => ({ flow, id }));
    const items =
      node.exitFlow > 0
        ? [{ flow: node.exitFlow, id: exitId }, ...nodes]
        : nodes;

    node.exitCode = "";

    const root = this.createTree(items);

    // Store the Huffman tree for visualization
    node.huffmanModuleTree = root;

    if (!root) {
      return null;
    }

    // Assign codes from tree
    for (let treeNode of root.depthFirst()) {
      if (treeNode.isLeaf) {
        if (treeNode.data.id === exitId) {
           node.exitCode = treeNode.code;
        } else {
          node.get(treeNode.data.id!)!.code = treeNode.code;
        }
      }
    }
    return root;
  }
}
