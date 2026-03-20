/**
 * Synthetic network for demonstrating regularized Infomap with incomplete data.
 * 
 * Structure: 3 planted modules, 100 nodes total, average degree ~14.5.
 * Links are generated with a stochastic block model (higher within-module
 * probability, lower between-module probability), and a fraction of links
 * can be removed uniformly at random to simulate incomplete data.
 */

export interface LinkData {
  source: number;
  target: number;
  weight: number;
  isCrossCommunity?: boolean;
}

export interface NetworkData {
  nodes: Array<{ id: number; x: number; y: number; topModule: number }>;
  links: LinkData[];
}

// Seeded random number generator for deterministic randomization
class SeededRandom {
  private seed: number;
  
  constructor(seed: number) {
    this.seed = seed;
  }
  
  next(): number {
    this.seed = (this.seed * 9301 + 49297) % 233280;
    return this.seed / 233280;
  }
}

const MODULE_SIZES = [17, 17, 16];
const TOTAL_NODES = MODULE_SIZES.reduce((sum, n) => sum + n, 0);
const BASE_SEED = 42;
export const DEFAULT_SPARSE_NETWORK_SEED = BASE_SEED;

// Probabilities tuned to give average degree ~8
const P_IN = 0.45;
const P_OUT = 0.03;

// Cluster centers in normalized coordinates (0..1)
const CLUSTER_CENTERS: Array<[number, number]> = [
  [0.2, 0.6],
  [0.5, 0.2],
  [0.8, 0.6],
];

const CLUSTER_RADIUS = 0.12;

const clamp01 = (value: number) => Math.max(0.05, Math.min(0.95, value));

const generateNodes = (seed = BASE_SEED) => {
  const nodes: Array<{ id: number; x: number; y: number; topModule: number }> = [];
  const rng = new SeededRandom(seed);
  let nodeId = 1;

  for (let module = 0; module < MODULE_SIZES.length; module++) {
    const [cx, cy] = CLUSTER_CENTERS[module];
    for (let i = 0; i < MODULE_SIZES[module]; i++) {
      const angle = rng.next() * Math.PI * 2;
      const radius = Math.sqrt(rng.next()) * CLUSTER_RADIUS;
      const x = clamp01(cx + Math.cos(angle) * radius);
      const y = clamp01(cy + Math.sin(angle) * radius);

      nodes.push({
        id: nodeId,
        x,
        y,
        topModule: module,
      });

      nodeId++;
    }
  }

  return nodes;
};

// Generate links using a stochastic block model
const generateAllLinks = (seed = BASE_SEED): LinkData[] => {
  const links: LinkData[] = [];
  const rng = new SeededRandom(seed);
  const nodes = generateNodes(seed);

  for (let i = 0; i < TOTAL_NODES; i++) {
    for (let j = i + 1; j < TOTAL_NODES; j++) {
      const sourceCommunity = nodes[i].topModule;
      const targetCommunity = nodes[j].topModule;
      const isCrossCommunity = sourceCommunity !== targetCommunity;
      const probability = isCrossCommunity ? P_OUT : P_IN;

      if (rng.next() > probability) {
        continue;
      }

      links.push({
        source: nodes[i].id,
        target: nodes[j].id,
        weight: 1.0,
        isCrossCommunity,
      });
    }
  }

  return links;
};

export const fullNetwork: NetworkData = {
  nodes: generateNodes(BASE_SEED),
  links: generateAllLinks(BASE_SEED),
};

// Helper to create incomplete version by removing a percentage of links uniformly at random
export const createIncompleteNetwork = (removalPercentage: number, seed = BASE_SEED): NetworkData => {
  const allLinks = generateAllLinks(seed);

  const rng = new SeededRandom(seed + 1);
  const linkIndices = allLinks.map((_, i) => i);
  const numToRemove = Math.floor(allLinks.length * (removalPercentage / 100));

  // Fisher-Yates shuffle to select which links to remove
  for (let i = 0; i < numToRemove; i++) {
    const j = i + Math.floor(rng.next() * (linkIndices.length - i));
    [linkIndices[i], linkIndices[j]] = [linkIndices[j], linkIndices[i]];
  }

  const indicesToRemove = new Set(linkIndices.slice(0, numToRemove));
  const remainingLinks = allLinks.filter((_, i) => !indicesToRemove.has(i));

  return {
    nodes: generateNodes(seed),
    links: remainingLinks,
  };
};

// Backwards-compatible alias
export const createSparseNetwork = createIncompleteNetwork;
