import assert from "node:assert/strict";
import test from "node:test";
import { Network } from "../src/model/index";
import hierarchicalPaperToy, {
  paperToyFineModules,
} from "../src/networks/hierarchical_paper_toy";

const tinyHierarchicalNetwork = {
  flowModel: "directed",
  nodes: [
    { id: 0, path: "1:10" },
    { id: 1, path: "1:11" },
    { id: 2, path: "2:20" },
  ],
  links: [
    { source: 0, target: 1, weight: 1 },
    { source: 1, target: 2, weight: 1 },
    { source: 2, target: 0, weight: 1 },
  ],
};

function getSegmentSummary(network: Network) {
  return (
    network.walker.latestEncodedStep?.hierarchicalSegments.map((segment) => ({
      kind: segment.kind,
      path: segment.modulePath.join(":"),
      nodeId: segment.nodeId ?? null,
    })) ?? []
  );
}

function approxEqual(actual: number, expected: number, epsilon = 1e-9) {
  assert.ok(
    Math.abs(actual - expected) <= epsilon,
    `Expected ${actual} to be within ${epsilon} of ${expected}`,
  );
}

test("tree routes boundary flow through the lowest common ancestor", () => {
  const network = Network.parse(tinyHierarchicalNetwork);
  const coarseOne = network.tree.getModule([1]);
  const coarseTwo = network.tree.getModule([2]);
  const fineTen = network.tree.getModule([1, 10]);
  const fineEleven = network.tree.getModule([1, 11]);
  const fineTwenty = network.tree.getModule([2, 20]);

  assert.ok(coarseOne);
  assert.ok(coarseTwo);
  assert.ok(fineTen);
  assert.ok(fineEleven);
  assert.ok(fineTwenty);

  const sameCoarseFlow =
    network.links.find(
      (link) => link.source.id === 0 && link.target.id === 1,
    )?.flow ?? 0;
  const coarseJumpFlow =
    network.links.find(
      (link) => link.source.id === 1 && link.target.id === 2,
    )?.flow ?? 0;
  const returnJumpFlow =
    network.links.find(
      (link) => link.source.id === 2 && link.target.id === 0,
    )?.flow ?? 0;

  approxEqual(fineTen.enterFlow, returnJumpFlow);
  approxEqual(fineTen.exitFlow, sameCoarseFlow);
  approxEqual(fineEleven.enterFlow, sameCoarseFlow);
  approxEqual(fineEleven.exitFlow, coarseJumpFlow);
  approxEqual(fineTwenty.enterFlow, coarseJumpFlow);
  approxEqual(fineTwenty.exitFlow, returnJumpFlow);

  approxEqual(coarseOne.enterFlow, returnJumpFlow);
  approxEqual(coarseOne.exitFlow, coarseJumpFlow);
  approxEqual(coarseTwo.enterFlow, coarseJumpFlow);
  approxEqual(coarseTwo.exitFlow, returnJumpFlow);
});

test("walker emits nested enter and exit segments for hierarchical moves", () => {
  const network = Network.parse(tinyHierarchicalNetwork);

  network.walker.setTeleportRate(0);

  network.walker.step();
  assert.deepEqual(getSegmentSummary(network), [
    { kind: "enter", path: "1", nodeId: null },
    { kind: "enter", path: "1:10", nodeId: null },
    { kind: "visit", path: "1:10", nodeId: 0 },
  ]);

  network.walker.step();
  assert.deepEqual(getSegmentSummary(network), [
    { kind: "exit", path: "1:10", nodeId: null },
    { kind: "enter", path: "1:11", nodeId: null },
    { kind: "visit", path: "1:11", nodeId: 1 },
  ]);

  network.walker.step();
  assert.deepEqual(getSegmentSummary(network), [
    { kind: "exit", path: "1:11", nodeId: null },
    { kind: "exit", path: "1", nodeId: null },
    { kind: "enter", path: "2", nodeId: null },
    { kind: "enter", path: "2:20", nodeId: null },
    { kind: "visit", path: "2:20", nodeId: 2 },
  ]);
});

test("paper toy keeps nine fine modules and benefits from hierarchy", () => {
  const hierarchical = Network.parse(hierarchicalPaperToy);
  const twoLevel = Network.parse(hierarchicalPaperToy);

  paperToyFineModules.forEach((module_) => {
    module_.nodeIds.forEach((nodeId) => {
      twoLevel.getNode(nodeId)?.setPath([module_.id]);
    });
  });

  twoLevel.finalize();

  assert.equal(paperToyFineModules.length, 9);
  assert.equal(
    new Set(paperToyFineModules.map((module_) => module_.coarseId)).size,
    3,
  );
  assert.ok(hierarchical.mapequation.codelength < twoLevel.mapequation.codelength);
});
