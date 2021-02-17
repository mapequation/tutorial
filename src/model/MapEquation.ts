import { computed, makeObservable } from 'mobx';
import type { Network } from './index';

const divide = (xs: number[], numerator: number): number[] => {
  for (let i = 0; i < xs.length; ++i) {
    xs[i] /= numerator;
  }

  return xs;
};

const sum = (xs: number[]): number => xs.reduce((a, b) => a + b, 0.0);

const normalize = (xs: number[]): number[] => divide(xs, sum(xs));

const plogp = (p: number): number => (p > 0 ? p * Math.log2(p) : 0);

const entropy = (ps: number[]): number =>
  normalize(ps).reduce((tot, p) => tot - plogp(p), 0.0);

export default class MapEquation {
  network: Network;

  constructor(network: Network) {
    this.network = network;

    makeObservable(this, {
      oneLevelCodelength: computed,
      codelength: computed,
      indexCodelength: computed,
      moduleCodelengths: computed,
    });
  }

  get oneLevelCodelength(): number {
    const visitRates = this.network.nodes.map((node) => node.flow);

    normalize(visitRates);

    return entropy(visitRates);
  }

  get indexCodelength(): number {
    const { nodes, links } = this.network;

    const enterFlow: { [module: string]: number } = {};

    nodes.forEach(({ module }) => (enterFlow[module] = 0));

    links
      .filter(({ source, target }) => source.module !== target.module)
      .forEach(({ target, flow }) => (enterFlow[target.module] += flow));

    const enterFlows = Array.from(Object.values(enterFlow));

    return sum(enterFlows) * entropy(enterFlows);
  }

  get moduleCodelengths(): number[] {
    const { nodes, links } = this.network;

    const exitFlow: { [module: string]: number } = {};
    const visitRates: { [module: string]: number[] } = {};

    nodes.forEach(({ module, flow }) => {
      exitFlow[module] = 0;

      if (!(module in visitRates)) {
        visitRates[module] = [];
      }

      visitRates[module].push(flow);
    });

    links
      .filter(({ source, target }) => source.module !== target.module)
      .forEach(({ source, flow }) => (exitFlow[source.module] += flow));

    const codelengths: { [module: string]: number } = {};

    for (let module of Object.keys(exitFlow)) {
      const xs = [exitFlow[module], ...visitRates[module]];
      codelengths[module] = sum(xs) * entropy(xs);
    }

    return Array.from(Object.values(codelengths));
  }

  get codelength(): number {
    return this.indexCodelength + sum(this.moduleCodelengths);
  }
}
