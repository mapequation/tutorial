import * as d3 from "d3";
import type { Network } from "../model";

export default async function ForceDirected(
  network: Network,
  cx: number = 0,
  cy: number = 0,
  strength: number = -100,
  nodeRadius: number = 20,
  linkDistance: number = 50
): Promise<void> {
  return new Promise<void>((resolve) => {
    d3.forceSimulation(network.nodes)
      .force("charge", d3.forceManyBody().strength(strength))
      .force("link", d3.forceLink(network.links).distance(linkDistance))
      .force("collide", d3.forceCollide(2 * nodeRadius))
      .force("center", d3.forceCenter(cx, cy))
      .on("end", resolve);
  });
}
