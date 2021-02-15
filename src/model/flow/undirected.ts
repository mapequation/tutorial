import type { Link } from '../index';
import type { NodeFlow } from './helpers';

/*
  Calculate visit-rates on undirected networks

  Takes a collection of links
  Modifies the links to set the flow property

  Returns a map from node id to page rank
 */
function undirectedFlow(links: Iterable<Link>): NodeFlow {
  let sumLinkWeight = 0.0;
  let sumSelfLinkWeight = 0.0;

  for (let link of links) {
    sumLinkWeight += link.weight;

    if (link.source.id == link.target.id) {
      sumSelfLinkWeight += link.weight;
    }
  }

  const sumUndirLinkWeight = 2.0 * sumLinkWeight - sumSelfLinkWeight;

  const nodeFlowMap: NodeFlow = {};

  for (let link of links) {
    link.flow = link.weight / (0.5 * sumUndirLinkWeight);

    const linkFlow = link.weight / sumUndirLinkWeight;
    if (link.source.id in nodeFlowMap) {
      nodeFlowMap[link.source.id] += linkFlow;
    } else {
      nodeFlowMap[link.source.id] = linkFlow;
    }
  }

  return nodeFlowMap;
}

export default undirectedFlow;
