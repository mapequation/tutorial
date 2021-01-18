import type { SerializedLink, SerializedNode } from '../model';

export interface ReaderResult {
  nodes: SerializedNode[];
  links: SerializedLink[];
}

export interface ParserInterface {
  (lines: string): ReaderResult;
}
