// Enumerations used by the model and algorithms.
// `FlowModel` indicates whether the network should be treated as directed
// or undirected. `Teleportation` controls whether teleportation events are
// recorded by the walker. `Rate` defines different strategies to compute
// node radii and related visit-rate based visuals.
export enum FlowModel {
  Directed = "directed",
  Undirected = "undirected",
}

export enum Teleportation {
  Recorded,
  Unrecorded,
}

export enum Rate {
  Uniform,
  Flow,
  Visits,
  Votes,
}
