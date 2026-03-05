import type {
  SerializedLink,
  SerializedNetwork,
  SerializedNode,
} from "./interfaces";

// Very small parser for a simple `.net`-like format. The parser supports a
// nodes/vertices section and a links/edges section. Lines starting with
// `#` are comments and `*nodes` / `*links` control which section follows.
enum Context {
  Nodes,
  Links,
  None,
}

class NetworkReader {
  /**
   * Parse a text representation into the `SerializedNetwork` shape used by
   * `Network.parse`. This is intentionally forgiving and prints errors to
   * console for lines it cannot parse instead of throwing.
   */
  static parse(lines: string): SerializedNetwork {
    const nodes: SerializedNode[] = [];
    const links: SerializedLink[] = [];

    let context = Context.None;
    let directed = false;

    for (const line of lines.split("\n")) {
      if (line.startsWith("#") || line.trim().length === 0) {
        continue;
      }

      if (line.startsWith("*")) {
        const lower = line.toLowerCase();
        if (lower.startsWith("*nodes") || lower.startsWith("*vertices")) {
          context = Context.Nodes;
        } else if (
          lower.startsWith("*links") ||
          lower.startsWith("*edges") ||
          lower.startsWith("*arcs")
        ) {
          directed = lower.startsWith("*links");
          context = Context.Links;
        } else {
          context = Context.None;
        }

        continue;
      }

      if (context === Context.Nodes) {
        // Expect lines like: 1 "Node name"
        let match = line.trim().match(/^(\d+) "(.+)"/);
        if (match) {
          const [, id, name] = match;
          nodes.push({ id: +id, name });
        } else {
          console.error(`Cannot parse line: "${line}"`);
        }
      } else if (context === Context.Links) {
        // Expect lines like: source target weight
        const [source, target, weight] = line.split(" ");
        links.push({ source: +source, target: +target, weight: +weight });
      }
    }

    const nodeIds: Set<number> = new Set();

    links.forEach((link) => {
      nodeIds.add(link.source);
      nodeIds.add(link.target);
    });

    // Verify that declared nodes exist; log missing declarations.
    for (let node of nodes) {
      if (!nodeIds.has(node.id)) {
        console.error(`Missing node for id ${node.id}`);
      }
    }

    // If the input only contains links, synthesize node entries for each
    // referenced id so downstream code can safely iterate nodes.
    if (nodes.length === 0) {
      nodeIds.forEach((id) => nodes.push({ id, name: id.toString() }));
    }

    const flowModel = directed ? "directed" : "undirected";

    return { flowModel, nodes, links };
  }
}

export default NetworkReader;
