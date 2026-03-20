export interface LinkData {
  source: number;
  target: number;
  weight: number;
}

export interface NetworkData {
  nodes: Array<{ id: number; x: number; y: number; topModule: number }>;
  links: LinkData[];
}

export interface RegularizedBaseNetwork {
  nodeIds: number[];
  links: LinkData[];
}

class SeededRandom {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed;
  }

  next() {
    this.seed = (this.seed * 9301 + 49297) % 233280;
    return this.seed / 233280;
  }
}

const LINK_REMOVAL_SEED = 42;
const POSITION_SEED = 73;
const POSITION_RING_RADIUS = 0.3;
const POSITION_CLUSTER_RADIUS = 0.13;

const clamp01 = (value: number) => Math.max(0.05, Math.min(0.95, value));

export const parseRegularizedNetworkDat = (
  text: string,
): RegularizedBaseNetwork => {
  const nodeIdSet = new Set<number>();
  const links: LinkData[] = [];

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#") || line.startsWith("*")) {
      continue;
    }

    const tokens = line.split(/\s+/);
    if (tokens.length < 2) {
      continue;
    }

    const source = Number(tokens[0]);
    const target = Number(tokens[1]);
    const parsedWeight = tokens.length >= 3 ? Number(tokens[2]) : 1;
    const weight = Number.isFinite(parsedWeight) ? parsedWeight : 1;

    if (!Number.isFinite(source) || !Number.isFinite(target)) {
      continue;
    }

    nodeIdSet.add(source);
    nodeIdSet.add(target);
    links.push({ source, target, weight });
  }

  return {
    nodeIds: [...nodeIdSet].sort((a, b) => a - b),
    links,
  };
};

export const buildRegularizedNetworkData = (
  base: RegularizedBaseNetwork,
  partitionByNodeId: Map<number, number>,
): NetworkData => {
  const moduleIds = [
    ...new Set(base.nodeIds.map((nodeId) => partitionByNodeId.get(nodeId) ?? 0)),
  ].sort((a, b) => a - b);
  const moduleIndexById = new Map(
    moduleIds.map((moduleId, index) => [moduleId, index]),
  );
  const nodeIdsByModule = new Map<number, number[]>();

  base.nodeIds.forEach((nodeId) => {
    const moduleId = partitionByNodeId.get(nodeId) ?? 0;
    const bucket = nodeIdsByModule.get(moduleId);

    if (bucket) {
      bucket.push(nodeId);
    } else {
      nodeIdsByModule.set(moduleId, [nodeId]);
    }
  });

  const rng = new SeededRandom(POSITION_SEED);
  const nodes: NetworkData["nodes"] = [];

  moduleIds.forEach((moduleId, moduleIndex) => {
    const nodeIds = (nodeIdsByModule.get(moduleId) ?? []).sort((a, b) => a - b);
    const angle =
      -Math.PI / 2 + (2 * Math.PI * moduleIndex) / Math.max(moduleIds.length, 1);
    const centerX = 0.5 + POSITION_RING_RADIUS * Math.cos(angle);
    const centerY = 0.5 + POSITION_RING_RADIUS * Math.sin(angle);

    nodeIds.forEach((nodeId) => {
      const theta = rng.next() * Math.PI * 2;
      const radius = Math.sqrt(rng.next()) * POSITION_CLUSTER_RADIUS;

      nodes.push({
        id: nodeId,
        x: clamp01(centerX + Math.cos(theta) * radius),
        y: clamp01(centerY + Math.sin(theta) * radius),
        topModule: moduleIndexById.get(moduleId) ?? moduleIndex,
      });
    });
  });

  nodes.sort((a, b) => a.id - b.id);

  return {
    nodes,
    links: base.links.map((link) => ({ ...link })),
  };
};

export const createRegularizedIncompleteNetwork = (
  completeData: NetworkData,
  removalPercentage: number,
): NetworkData => {
  if (removalPercentage <= 0) {
    return {
      nodes: completeData.nodes.map((node) => ({ ...node })),
      links: completeData.links.map((link) => ({ ...link })),
    };
  }

  const rng = new SeededRandom(LINK_REMOVAL_SEED);
  const linkIndices = completeData.links.map((_, index) => index);
  const numToRemove = Math.floor(
    completeData.links.length * (removalPercentage / 100),
  );

  for (let i = 0; i < numToRemove; i++) {
    const j = i + Math.floor(rng.next() * (linkIndices.length - i));
    [linkIndices[i], linkIndices[j]] = [linkIndices[j], linkIndices[i]];
  }

  const removedIndices = new Set(linkIndices.slice(0, numToRemove));

  return {
    nodes: completeData.nodes.map((node) => ({ ...node })),
    links: completeData.links
      .filter((_, index) => !removedIndices.has(index))
      .map((link) => ({ ...link })),
  };
};
