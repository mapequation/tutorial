import { observer } from "mobx-react";
import TeX from "@matejmazur/react-katex";
import type { ReactNode } from "react";
import type { Network } from "../../model";
import HelpTooltip from "../HelpTooltip";

interface Props {
  network: Network;
}

function EquationLine({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto overflow-y-visible py-1 text-base leading-8 text-gray-900">
      {children}
    </div>
  );
}

function formatRelativeComparison(
  baselineCodelength: number,
  comparisonCodelength: number,
) {
  if (baselineCodelength <= 0) {
    return "Unavailable";
  }

  const relativeChange =
    ((comparisonCodelength - baselineCodelength) / baselineCodelength) * 100;

  if (Math.abs(relativeChange) < 0.05) {
    return "About the same as one-level";
  }

  return relativeChange < 0
    ? `${Math.abs(relativeChange).toFixed(1)}% shorter than one-level`
    : `${relativeChange.toFixed(1)}% longer than one-level`;
}

function formatRatio(numerator: number, denominator: number) {
  if (denominator <= 0) {
    return "Unavailable";
  }

  return `${(numerator / denominator).toFixed(3)}x`;
}

function formatNumberSummary(
  values: number[],
  formatter: (value: number) => string = (value) => value.toFixed(3),
) {
  if (values.length === 0) {
    return "none";
  }

  const visibleValues = values.slice(0, 6).map(formatter).join(", ");

  return values.length > 6
    ? `${visibleValues}, and ${values.length - 6} more`
    : visibleValues;
}

export default observer(function CodelengthChart({ network }: Props) {
  // Read the update counter so the equations refresh when modules change.
  network.treeUpdateCounter;

  const { walker, mapequation } = network;
  const oneLevelCodelength = mapequation.oneLevelCodelength;
  const indexCodelength = mapequation.indexCodelength;
  const moduleCodelength = mapequation.moduleCodelength;
  const twoLevelCodelength = mapequation.codelength;
  const modules = Array.from(network.tree.root.children.values()).sort(
    (a, b) => a.id - b.id,
  );
  const moduleCount = modules.length;
  const moduleSwitchRate = modules.reduce(
    (total, module) => total + module.exitFlow,
    0,
  );
  const moduleEntryRates = modules.map((module) => module.enterFlow);
  const moduleUseRates = modules.map(
    (module) =>
      module.exitFlow +
      module
        .map((node) => node.flow)
        .reduce((total, nodeFlow) => total + nodeFlow, 0),
  );
  const moduleCodebookSizes = modules.map((module) => module.children.size + 1);

  const estimatedOneLevelCodelength =
    walker.totalVisits > 0
      ? walker.cumulativeOneLevelBits / walker.totalVisits
      : null;
  const estimatedTwoLevelCodelength =
    walker.totalVisits > 0
      ? walker.cumulativeTwoLevelBits / walker.totalVisits
      : null;

  const predictedRatio = formatRatio(twoLevelCodelength, oneLevelCodelength);
  const predictedComparison = formatRelativeComparison(
    oneLevelCodelength,
    twoLevelCodelength,
  );
  const estimatedRatio =
    estimatedOneLevelCodelength !== null &&
    estimatedTwoLevelCodelength !== null &&
    estimatedOneLevelCodelength > 0
      ? formatRatio(estimatedTwoLevelCodelength, estimatedOneLevelCodelength)
      : null;
  const estimatedComparison =
    estimatedOneLevelCodelength !== null && estimatedTwoLevelCodelength !== null
      ? formatRelativeComparison(
          estimatedOneLevelCodelength,
          estimatedTwoLevelCodelength,
        )
      : null;
  const nodeVisitRateHelp =
    `This network has ${network.numNodes} node-visit probabilities, one for each node. ` +
    "They come from the visit-rate calculation and sum to 1.";
  const entropyHelp =
    "H(·) is Shannon entropy in bits: it tells us how many binary questions are needed on average to identify an outcome from the given probability distribution.";
  const estimatedHelp =
    "A hat means an empirical estimate from the simulated random walker: emitted bits divided by the number of visits so far.";
  const partitionHelp =
    `M is the current partition of the network into modules. Right now the network is split into ${moduleCount} ` +
    `${moduleCount === 1 ? "module" : "modules"}, so m = ${moduleCount}.`;
  const switchRateHelp =
    `For the current partition, q↷ = ${moduleSwitchRate.toFixed(3)}. ` +
    "This is the total rate at which the walker leaves its current module and has to use the index codebook.";
  const moduleEntryHelp =
    `Q is the index-codebook distribution over module entries. For the current partition its entry rates are ` +
    `${formatNumberSummary(moduleEntryRates)}.`;
  const moduleUseHelp =
    `Each p⟳^i is the total use rate of module i's codebook: visits inside that module plus its exit rate. ` +
    `For the current partition those rates are ${formatNumberSummary(moduleUseRates)}.`;
  const localCodebookHelp =
    "Each P^i is the local distribution inside module i: all node visits in that module plus one extra exit symbol. " +
    `The current module codebooks therefore contain ${formatNumberSummary(moduleCodebookSizes, (value) => `${value} symbols`)}.`;
  const ratioDifferenceHelp =
    "The estimated ratio comes from a finite random walk, so it needs many steps before it settles close to the predicted ratio. In this demo, if teleportation is on, the estimate will usually look a bit worse than the prediction because teleportation jumps between modules and prints extra exit and enter codewords. If teleportation is off, the walker instead tends to remain inside modules for long stretches, which also changes the measured codelength compared with the flow assumptions used by the Map Equation.";

  return (
    <section className="mt-6 space-y-6">
      <div>
        <h4 className="text-lg font-bold text-gray-900">
          One-level and two-level codelength
        </h4>
        <p className="text-sm leading-relaxed text-gray-600">
          The one-level partition uses a single codebook for all node visits.
          The two-level partition uses an index codebook between modules and a
          module codebook inside each module. The Map Equation does not need a
          simulated random walker to calculate these codelengths or to find
          communities: it computes the expected description length directly
          from the network's flow rates and the current partition, and Infomap
          searches for the partition that minimizes that value.
        </p>
        <p className="mt-2 text-sm leading-relaxed text-gray-600">
          The random walker in this demo is therefore a way to build intuition,
          not a requirement for the method. It samples actual moves through the
          network and prints the corresponding codewords, so its averages give
          an empirical estimate of the same codelength that the Map Equation
          has already calculated exactly. As the walk gets longer, those
          estimates should move closer to the predicted values.
        </p>
      </div>

      <div className="space-y-6">
        <div className="space-y-2">
          <h5 className="text-base font-semibold text-gray-900">
            One-level partition
          </h5>
          <EquationLine>
            <TeX math="L_1 = H(\mathcal{P}) = -\sum_{\alpha} p_{\alpha} \log_2 p_{\alpha}" />
          </EquationLine>
          <div className="text-sm leading-relaxed text-gray-600">
            <TeX math="H(\cdot)" /> <HelpTooltip content={entropyHelp} /> means
            entropy in bits.
          </div>
          <EquationLine>
            <TeX
              math={`L_1 = ${oneLevelCodelength.toFixed(3)}\\ \\text{bits}`}
            />
          </EquationLine>
          <div className="text-sm leading-relaxed text-gray-600">
            <TeX math="L_1" /> is the average bits per step when one shared
            codebook is used for the whole network. Here{" "}
            <TeX math="\mathcal{P}" /> is the full node-visit distribution for
            all {network.numNodes} nodes, and <TeX math="p_{\alpha}" />{" "}
            <HelpTooltip content={nodeVisitRateHelp} /> is the visit rate of
            node <TeX math="\alpha" />.
          </div>
          <EquationLine>
            {estimatedOneLevelCodelength === null ? (
              <span>
                Start the walker to estimate the one-level codelength
                empirically.
              </span>
            ) : (
              <TeX
                math={`\\hat{L}_1 = \\frac{${walker.cumulativeOneLevelBits}}{${walker.totalVisits}} = ${estimatedOneLevelCodelength.toFixed(3)}\\ \\text{bits}`}
              />
            )}
          </EquationLine>
          <div className="text-sm leading-relaxed text-gray-600">
            A hat such as <TeX math="\hat{L}" />{" "}
            <HelpTooltip content={estimatedHelp} /> means a walker-based
            estimate.
          </div>
        </div>

        <div className="space-y-2">
          <h5 className="text-base font-semibold text-gray-900">
            Two-level partition
          </h5>
          <EquationLine>
            <TeX math="L(M) = q_{\curvearrowright} H(\mathcal{Q}) + \sum_{i = 1}^{m} p_{\circlearrowright}^{i} H(\mathcal{P}^{i})" />
          </EquationLine>
          <EquationLine>
            <TeX
              math={`L(M) = ${indexCodelength.toFixed(3)} + ${moduleCodelength.toFixed(3)} = ${twoLevelCodelength.toFixed(3)}\\ \\text{bits}`}
            />
          </EquationLine>
          <div className="space-y-1 text-sm leading-relaxed text-gray-600">
            <div>
              <TeX math="M" /> <HelpTooltip content={partitionHelp} /> is the
              current partition, and <TeX math="m" /> ={" "}
              {moduleCount}. For this network, <TeX math="q_{\curvearrowright}" />{" "}
              <HelpTooltip content={switchRateHelp} /> ={" "}
              {moduleSwitchRate.toFixed(3)}.
            </div>
            <div>
              <TeX math="\mathcal{Q}" /> <HelpTooltip content={moduleEntryHelp} />{" "}
              is the distribution over which module the walker enters next, and{" "}
              <TeX math="p_{\circlearrowright}^{i}" />{" "}
              <HelpTooltip content={moduleUseHelp} /> is the total rate of
              using module <TeX math="i" />'s codebook.
            </div>
            <div>
              <TeX math="\mathcal{P}^{i}" />{" "}
              <HelpTooltip content={localCodebookHelp} /> is the local
              distribution inside module <TeX math="i" />: the node visits in
              that module plus its exit symbol.
            </div>
          </div>
          <EquationLine>
            {estimatedTwoLevelCodelength === null ? (
              <span>
                Start the walker to estimate the two-level codelength
                empirically.
              </span>
            ) : (
              <TeX
                math={`\\hat{L}_{\\mathrm{two}} = \\frac{${walker.cumulativeTwoLevelBits}}{${walker.totalVisits}} = ${estimatedTwoLevelCodelength.toFixed(3)}\\ \\text{bits}`}
              />
            )}
          </EquationLine>
        </div>

        <div className="space-y-2">
          <h5 className="text-base font-semibold text-gray-900">Comparison</h5>
          <div className="text-base text-gray-900">
            Predicted ratio:{" "}
            <strong>
              {predictedRatio}
            </strong>{" "}
            ({predictedComparison})
          </div>
          <div className="text-base text-gray-900">
            Estimated ratio:{" "}
            <strong>{estimatedRatio ?? "Waiting for visits"}</strong>
            {estimatedComparison ? ` (${estimatedComparison})` : ""}
          </div>
          <div className="text-sm leading-relaxed text-gray-600">
            Why aren't these the same?{" "}
            <HelpTooltip content={ratioDifferenceHelp} />
          </div>
        </div>
      </div>
    </section>
  );
});
