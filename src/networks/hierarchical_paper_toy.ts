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
  { x: 0.34, y: 0.31 },
  { x: 0.66, y: 0.31 },
  { x: 0.5, y: 0.64 },
] as const;

const fineOffsets = [
  { x: -0.07, y: -0.045 },
  { x: 0.07, y: -0.035 },
  { x: 0.0, y: 0.085 },
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
      const nodeIds = [1, 2, 3].map(
        (nodeOffset) => (fineId - 1) * 3 + nodeOffset,
      );

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
    name: `${nodeIndex + 1}`,
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

const bridgeLinks = [
  { source: 2, target: 7, weight: 1 },
  { source: 3, target: 4, weight: 1 },
  { source: 9, target: 5, weight: 1 },
  { source: 8, target: 19, weight: 1 },
  { source: 6, target: 10, weight: 1 },
  { source: 11, target: 16, weight: 1 },
  { source: 12, target: 13, weight: 1 },
  { source: 20, target: 25, weight: 1 },
  { source: 21, target: 22, weight: 1 },
  { source: 27, target: 23, weight: 1 },
  { source: 24, target: 17, weight: 1 },
  { source: 18, target: 14, weight: 1 },
];

const untitledLinks = [...intraModuleLinks, ...bridgeLinks];

export const hierarchicalPaperToyTopology: SerializedNetwork = {
  flowModel: "undirected",
  nodes: Array.from({ length: 27 }, (_, index) => {
    const id = index + 1;

    return {
      id,
      name: id.toString(),
    };
  }),
  links: untitledLinks,
};

const hierarchicalPaperToy: SerializedNetwork = {
  flowModel: "undirected",
  nodes,
  links: untitledLinks,
};

export default hierarchicalPaperToy;
