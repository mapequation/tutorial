import Node from './Node';
import type Network from './Network';

export class Module {
  flow = 0;
  enterFlow = 0;
  exitFlow = 0;
  codelength = 0;

  parent: Module | null;
  children: Map<number, Module | Node> = new Map();

  constructor(parent: Module | null) {
    this.parent = parent;
  }

  get isLeaf(): boolean {
    if (this.children.size === 0) return true;

    const first = this.children.values().next().value;
    return first instanceof Node;
  }

  map<T>(callback: (item: Module | Node, i?: number) => T): T[] {
    return Array.from(this.children.values()).map(callback);
  }

  *depthFirst(): Generator<Module> {
    yield this;

    for (let child of this.children.values()) {
      if (child instanceof Module) {
        yield* child.depthFirst();
      }
    }
  }
}

export default class Tree {
  root = new Module(null);
  network: Network;

  constructor(network: Network) {
    this.network = network;
  }

  update() {
    this.root = new Module(null);

    const { root, network } = this;

    // 1. Assign nodes to modules
    network.nodes.forEach((node) => {
      if (!root.children.has(node.module)) {
        const module = new Module(root);
        root.children.set(node.module, module);
      }

      const module = root.children.get(node.module)! as Module;

      module.children.set(node.id, node);
      node.parent = module;
    });

    // 2. Add enter/exit-flow to modules
    network.links.forEach(({ source, target, flow }) => {
      let sourceParent = source.parent;
      let targetParent = target.parent;

      // Note: assumes at same level
      // TODO in general, need to equalize levels
      while (sourceParent !== targetParent) {
        sourceParent!.exitFlow += flow;
        targetParent!.enterFlow += flow;

        sourceParent = sourceParent!.parent;
        targetParent = targetParent!.parent;
      }
    });
  }

  *depthFirstModules(): Generator<Module> {
    yield* this.root.depthFirst();
  }
}
