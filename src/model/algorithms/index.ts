import { Teleportation } from "../enums";
export { default as Tree } from "./Tree";
export { default as MapEquation } from "./MapEquation";
export { default as PageRank } from "./PageRank";
export { default as RandomWalker } from "./RandomWalker";
export { default as IterativeVoter } from "./IterativeVoter";
export { default as HuffmanCoder } from "./HuffmanCoder";

export const DEFAULT_TELEPORT_RATE = 0.15 as const;
export const DEFAULT_TELEPORT_MODEL: Teleportation = Teleportation.Recorded as const;
