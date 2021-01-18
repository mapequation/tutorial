import type { Id } from '../model';

export interface SerializedLink {
  source: Id;
  target: Id;
  weight: number;
}

export interface SerializedNode {
  id: Id;
  name: string;
}

export interface ReaderResult {
  nodes: SerializedNode[];
  links: SerializedLink[];
}

export interface ParserInterface {
  (lines: string): ReaderResult;
}
