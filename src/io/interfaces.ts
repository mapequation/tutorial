/**
 * Interfaces describing the minimal JSON/netlist format expected by the
 * `Network.parse` and the simple `.net`-style parser in `NetworkReader`.
 */
export interface SerializedNode {
  id: number;
  name?: string;
  x?: number;
  y?: number;
  path?: string | number[];
  flow?: number;
}

export interface SerializedLink {
  source: number;
  target: number;
  weight: number;
}

export interface SerializedNetwork {
  flowModel: string;
  nodes: SerializedNode[];
  links: SerializedLink[];
}

export interface Parser {
  (lines: string): SerializedNetwork;
}
