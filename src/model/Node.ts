import type { Link, Id } from '.';

export interface SerializedNode {
  id: Id;
  name: string;
};

interface Vec2 {
  x: number;
  y: number;
}

class Node {
  id: Id;
  label: string;
  private _flow: number;
  color: string;
  code: string;
  outLinks: Link[] = [];
  position: Vec2 = { x: 0, y: 0 };

  constructor(id: Id, flow: number = 0.0, code: string = "", label: string = "", color: string = "") {
    this.id = id;
    this._flow = flow;
    this.code = code;
    this.label = label;
    this.color = color;
  }

  static deserialize(node: SerializedNode): Node {
    return new Node(node.id, 0.0, "", node.name);
  }

  set flow(flow: number) {
    if (flow < 0.0 || flow > 1.0) {
      throw new RangeError("flow must be within [0.0, 1.0]");
    }

    this._flow = flow;
  }

  get flow(): number {
    return this._flow;
  }

  get degree(): number {
    return this.outLinks.length;
  }

  addLink(link: Link) {
    this.outLinks.push(link);
  }
}

export default Node;