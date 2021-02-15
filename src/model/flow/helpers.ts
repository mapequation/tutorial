import type { Id, Link } from '../index';

export function nodeIds(links: Iterable<Link>): Iterable<Id> {
  const nodeIds: Set<Id> = new Set();

  for (let link of links) {
    nodeIds.add(link.source.id);
    nodeIds.add(link.target.id);
  }

  return nodeIds.values();
}

export interface NodeFlow {
  [nodeId: number]: number;
}

export interface FlowLink {
  source: number;
  target: number;
  flow: number;
}
