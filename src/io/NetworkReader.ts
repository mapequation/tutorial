import type {
  SerializedLink,
  SerializedNetwork,
  SerializedNode,
} from './interfaces';

enum Context {
  Nodes,
  Links,
  None,
}

class NetworkReader {
  static parse(lines: string): SerializedNetwork {
    const nodes: SerializedNode[] = [];
    const links: SerializedLink[] = [];

    let context = Context.None;
    let directed = false;

    for (let line of lines.split('\n')) {
      if (line.startsWith('#') || line.trim().length === 0) {
        continue;
      }

      if (line.startsWith('*')) {
        let lower = line.toLowerCase();
        if (lower.startsWith('*nodes') || lower.startsWith('*vertices')) {
          context = Context.Nodes;
        } else if (
          lower.startsWith('*links') ||
          lower.startsWith('*edges') ||
          lower.startsWith('*arcs')
        ) {
          directed = lower.startsWith('*links');
          context = Context.Links;
        } else {
          context = Context.None;
        }

        continue;
      }

      if (context === Context.Nodes) {
        let match = line.trim().match(/^(\d+) "(.+)"/);
        if (match) {
          const [, id, name] = match;
          nodes.push({ id: +id, name });
        } else {
          console.error(`Cannot parse line: "${line}"`);
        }
      } else if (context === Context.Links) {
        const [source, target, weight] = line.split(' ');
        links.push({ source: +source, target: +target, weight: +weight });
      }
    }

    const nodeIds: Set<number> = new Set();

    links.forEach((link) => {
      nodeIds.add(link.source);
      nodeIds.add(link.target);
    });

    // check that all nodes exists
    for (let node of nodes) {
      if (!nodeIds.has(node.id)) {
        console.error(`Missing node for id ${node.id}`);
      }
    }

    // if only links
    if (nodes.length === 0) {
      nodeIds.forEach((id) => nodes.push({ id, name: id.toString() }));
    }

    const flowModel = directed ? 'directed' : 'undirected';

    return { flowModel, nodes, links };
  }
}

export default NetworkReader;
