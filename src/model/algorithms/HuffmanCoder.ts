import type Network from "../Network";
import type { TreeNode } from "./Tree";

type CompareFn<T> = (a: T, b: T) => number;

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

  popLeft(): T | null {
    return this.heap.shift() ?? null;
  }
}

class HuffmanNode<T> {
  left: HuffmanNode<T> | null = null;
  right: HuffmanNode<T> | null = null;
  data: T;
  code: string = "";

  constructor(data: T, left?: HuffmanNode<T>, right?: HuffmanNode<T>) {
    this.data = data;
    if (left) this.left = left;
    if (right) this.right = right;
  }

  *depthFirst(): Generator<HuffmanNode<T>> {
    yield this;

    if (this.left) {
      yield* this.left.depthFirst();
    }

    if (this.right) {
      yield* this.right.depthFirst();
    }
  }

  get isLeaf(): boolean {
    return !this.left && !this.right;
  }
}

type AddFn<T> = (a: T, b: T) => T;
type HuffmanTree<T> = HuffmanNode<T>;

function createHuffmanTree<T>(
  items: T[],
  compareFn: CompareFn<T>,
  addFn: AddFn<T>
): HuffmanTree<T> {
  const nodeCompareFn = (a: HuffmanNode<T>, b: HuffmanNode<T>) =>
    compareFn(a.data, b.data);

  const nodes = items.map((item) => new HuffmanNode(item));
  const queue = new PriorityQueue(nodeCompareFn);

  for (let node of nodes) {
    queue.push(node);
  }

  while (queue.size > 1) {
    const left = queue.popLeft()!;
    const right = queue.popLeft()!;
    const data = addFn(left.data, right.data);
    queue.push(new HuffmanNode<T>(data, left, right));
  }

  const root = queue.popLeft()!;

  for (let node of root.depthFirst()) {
    if (node.left) {
      node.left.code = node.code + "0";
    }
    if (node.right) {
      node.right.code = node.code + "1";
    }
  }

  return root;
}

type Item = {
  flow: number;
  id?: number;
};

export default class HuffmanCoder {
  private readonly network: Network;
  private readonly compareFn = (a: Item, b: Item) => a.flow - b.flow;
  private readonly addFn = (a: Item, b: Item) => ({ flow: a.flow + b.flow });

  constructor(network: Network) {
    this.network = network;
  }

  code() {
    const { tree } = this.network;

    this.calculateOneLevelCodes(tree.root);

    for (let treeNode of tree.depthFirstModules()) {
      if (treeNode.isLeafModule) {
        this.calculateModuleCodes(treeNode);
      } else {
        this.calculateIndexCodes(treeNode);
      }
    }
  }

  private createTree(items: Item[]): HuffmanTree<Item> {
    return createHuffmanTree(items, this.compareFn, this.addFn);
  }

  private calculateOneLevelCodes(node: TreeNode) {
    const { network } = this;

    const root = this.createTree(network.nodes);

    for (let treeNode of root.depthFirst()) {
      if (treeNode.isLeaf) {
        node.getLeaf(treeNode.data.id!)!.oneLevelCode = treeNode.code;
      }
    }
  }

  private calculateIndexCodes(node: TreeNode) {
    const items = node.map(({ id, enterFlow }) => ({ id, flow: enterFlow }));

    const root = this.createTree(items);

    for (let treeNode of root.depthFirst()) {
      if (treeNode.isLeaf) {
        node.get(treeNode.data.id!)!.enterCode = treeNode.code;
      }
    }
  }

  private calculateModuleCodes(node: TreeNode) {
    const exitId = -1;

    const exit = {
      flow: node.exitFlow,
      id: exitId,
    };

    const nodes = node.map(({ id, flow }) => ({ flow, id }));

    const items = [exit, ...nodes];

    const root = this.createTree(items);

    for (let treeNode of root.depthFirst()) {
      if (treeNode.isLeaf) {
        if (treeNode.data.id === exitId) {
          node.exitCode = treeNode.code;
        } else {
          node.get(treeNode.data.id!)!.code = treeNode.code;
        }
      }
    }
  }
}
