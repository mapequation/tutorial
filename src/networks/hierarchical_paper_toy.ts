import type { SerializedNetwork } from "../io/interfaces";

export interface PaperToyFineModule {
  id: number;
  coarseId: number;
  localIndex: number;
  label: string;
  nodeIds: number[];
  center: {
    x: number;
    y: number;
  };
}

export const PAPER_REFERENCE_CODELENGTHS = {
  twoLevel: 3.57,
  hierarchical: 3.48,
} as const;

export const paperToyDefaultCoarseByFine = new Map<number, number>();

const coarseCenters = [
  { x: 0.24, y: 0.27 },
  { x: 0.76, y: 0.27 },
  { x: 0.5, y: 0.74 },
] as const;

const fineOffsets = [
  { x: -0.09, y: -0.06 },
  { x: 0.1, y: -0.02 },
  { x: 0.0, y: 0.11 },
] as const;

const nodeOffsets = [
  { x: -0.028, y: 0.024 },
  { x: 0.028, y: 0.024 },
  { x: 0.0, y: -0.032 },
] as const;

export const paperToyFineModules: PaperToyFineModule[] = coarseCenters.flatMap(
  (coarseCenter, coarseIndex) =>
    fineOffsets.map((offset, localIndex) => {
      const fineId = coarseIndex * fineOffsets.length + localIndex + 1;
      const center = {
        x: coarseCenter.x + offset.x,
        y: coarseCenter.y + offset.y,
      };
      const nodeIds = [0, 1, 2].map((nodeOffset) => (fineId - 1) * 3 + nodeOffset);

      paperToyDefaultCoarseByFine.set(fineId, coarseIndex + 1);

      return {
        id: fineId,
        coarseId: coarseIndex + 1,
        localIndex: localIndex + 1,
        label: `${coarseIndex + 1}.${localIndex + 1}`,
        nodeIds,
        center,
      };
    }),
);

const nodes = paperToyFineModules.flatMap((module_) =>
  module_.nodeIds.map((nodeId, nodeIndex) => ({
    id: nodeId,
    path: `${module_.coarseId}:${module_.id}`,
    x: module_.center.x + nodeOffsets[nodeIndex].x,
    y: module_.center.y + nodeOffsets[nodeIndex].y,
    name: `${module_.label}.${nodeIndex + 1}`,
  })),
);

const intraModuleLinks = paperToyFineModules.flatMap((module_) => {
  const [a, b, c] = module_.nodeIds;

  return [
    { source: a, target: b, weight: 1 },
    { source: b, target: c, weight: 1 },
    { source: c, target: a, weight: 1 },
  ];
});

const bridgePairs: Array<[number, number]> = [
  [1, 2],
  [2, 3],
  [3, 1],
  [4, 5],
  [5, 6],
  [6, 4],
  [7, 8],
  [8, 9],
  [9, 7],
  [2, 4],
  [3, 7],
  [6, 8],
];

const moduleNode = (fineModuleId: number, offset: number) =>
  paperToyFineModules[fineModuleId - 1].nodeIds[offset];

const bridgeLinks = bridgePairs.map(([sourceModuleId, targetModuleId], index) => ({
  source: moduleNode(sourceModuleId, index % 3),
  target: moduleNode(targetModuleId, (index + 1) % 3),
  weight: 1,
}));

const hierarchicalPaperToy: SerializedNetwork = {
  flowModel: "undirected",
  nodes,
  links: [...intraModuleLinks, ...bridgeLinks],
};

export default hierarchicalPaperToy;
