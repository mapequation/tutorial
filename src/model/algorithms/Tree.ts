import type Network from "../Network";

export class TreeNode {
  id: number;

  flow = 0;
  enterFlow = 0;
  exitFlow = 0;

  code = "";
  enterCode = "";
  exitCode = "";
  oneLevelCode = "";

  codelength = 0;

  x = 0;
  y = 0;
  height = 0;
  index = 0;

  parent: TreeNode | null;
  children: Map<number, TreeNode> = new Map();

  constructor(parent: TreeNode | null, id: number = -1) {
    this.parent = parent;
    this.id = id;
  }

  add(id: number): TreeNode {
    const child = new TreeNode(this, id);
    this.children.set(id, child);
    return child;
  }

  has(id: number): boolean {
    return this.children.has(id);
  }

  get(id: number): TreeNode | null {
    return this.children.get(id) ?? null;
  }

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

  get isRoot(): boolean {
    return this.parent === null;
  }

  get isLeafModule(): boolean {
    if (this.children.size === 0) return false;

    const first = this.children.values().next().value;
    return first.isLeafNode;
  }

  get isLeafNode(): boolean {
    return this.parent !== null && this.children.size === 0;
  }

  private get arrayChildren(): TreeNode[] {
    return Array.from(this.children.values());
  }

  sort(compareFn: (a: TreeNode, b: TreeNode) => number): TreeNode[] {
    return this.arrayChildren.sort(compareFn);
  }

  map<T>(callback: (item: TreeNode, i?: number) => T): T[] {
    return this.arrayChildren.map(callback);
  }

  *leafNodes(): Generator<TreeNode> {
    for (let child of this.children.values()) {
      if (child.isLeafNode) {
        yield child;
      } else {
        yield* child.leafNodes();
      }
    }
  }

  *depthFirst(): Generator<TreeNode> {
    yield this;

    for (let child of this.children.values()) {
      if (!child.isLeafNode) {
        yield* child.depthFirst();
      }
    }
  }
}

export default class Tree {
  private network: Network;

  root = new TreeNode(null);

  constructor(network: Network) {
    this.network = network;
  }

  update() {
    this.root = new TreeNode(null);

    const { root, network } = this;

    // 1. Assign nodes to modules
    network.nodes.forEach((node) => {
      if (!root.has(node.topModule)) {
        root.add(node.topModule);
      }

      const parent = root.get(node.topModule)!;

      const child = parent.add(node.id);
      child.flow = node.flow;
    });

    // 2. Add enter/exit-flow to modules
    network.links.forEach(({ source, target, flow }) => {
      const sourceNode = root.getLeaf(source.id)!;
      const targetNode = root.getLeaf(target.id)!;

      let sourceParent = sourceNode.parent;
      let targetParent = targetNode.parent;

      // Note: assumes at same level
      // TODO in general, need to equalize levels
      while (sourceParent !== targetParent) {
        if (network.directed) {
          sourceParent!.exitFlow += flow;
          targetParent!.enterFlow += flow;
        } else {
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

  *depthFirstModules(): Generator<TreeNode> {
    yield* this.root.depthFirst();
  }
}
