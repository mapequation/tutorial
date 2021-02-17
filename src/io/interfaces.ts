import type { Id } from '../model';

export interface SerializedNode {
  id: Id;
  name?: string;
  x?: number;
  y?: number;
  bestmodule?: number;
}

export interface SerializedLink {
  source: Id;
  target: Id;
  weight: number;
}

export interface SerializedNetwork {
  flowModel: string;
  nodes: SerializedNode[];
  links: SerializedLink[];
}

export interface ParserInterface {
  (lines: string): SerializedNetwork;
}
