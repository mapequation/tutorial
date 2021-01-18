import type { Id } from '.';

export interface SerializedLink {
  source: Id;
  target: Id;
  weight: number;
}

class Link {
  source: Id;
  target: Id;
  private _flow: number;
  weight: number;

  constructor(
    source: Id,
    target: Id,
    flow: number = 0.0,
    weight: number = 0.0,
  ) {
    this.source = source;
    this.target = target;
    this._flow = flow;
    this.weight = weight;
  }

  static deserialize(link: SerializedLink): Link {
    return new Link(link.source, link.target, 0.0, link.weight);
  }

  set flow(flow: number) {
    if (flow < 0.0 || flow > 1.0) {
      throw new RangeError('flow must be within [0.0, 1.0]');
    }

    this._flow = flow;
  }

  get flow(): number {
    return this._flow;
  }
}

export default Link;
