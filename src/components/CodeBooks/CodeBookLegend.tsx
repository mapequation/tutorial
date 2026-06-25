import EnterFlow from "./EnterFlow";
import ExitFlow from "./ExitFlow";
import Flow from "./Flow";

const exampleStyle = {
  fill: "#111827",
  stroke: "none",
  strokeWidth: 0,
};

const examples = [
  {
    key: "enter",
    title: "Enter block",
    description:
      "Used in the index codebook. This marks the codeword emitted when the walker enters a module.",
    shape: (
      <svg viewBox="0 0 120 48" className="h-14 w-full">
        <EnterFlow {...exampleStyle} x={12} y={36} width={84} height={24} />
      </svg>
    ),
  },
  {
    key: "node",
    title: "Node block",
    description:
      "Used in the module codebook. A plain rectangle means the walker visits a node inside the current module.",
    shape: (
      <svg viewBox="0 0 120 48" className="h-14 w-full">
        <Flow {...exampleStyle} x={18} y={36} width={72} height={24} />
      </svg>
    ),
  },
  {
    key: "exit",
    title: "Exit block",
    description:
      "Used in the module codebook. The outward point marks the codeword emitted when the walker leaves a module.",
    shape: (
      <svg viewBox="0 0 120 48" className="h-14 w-full">
        <ExitFlow {...exampleStyle} x={12} y={36} width={78} height={24} />
      </svg>
    ),
  },
];

export default function CodeBookLegend() {
  return (
    <section className="mt-8">
      <h4 className="mb-2 text-lg font-bold text-gray-900">
        How to read the codebook
      </h4>
      <p className="mb-4 text-sm leading-relaxed text-gray-600">
        Each shape stands for a different kind of event in the compressed walk.
        The index codebook tells you when the walker enters a module, and the
        module codebooks describe visits to nodes and exits from modules.
      </p>
      <div className="grid gap-4 md:grid-cols-3">
        {examples.map((example) => (
          <div key={example.key} className="p-4">
            <div className="mb-3 flex h-16 items-center justify-center">
              {example.shape}
            </div>
            <h5 className="mb-1 font-bold text-gray-900">{example.title}</h5>
            <p className="text-sm leading-relaxed text-gray-600">
              {example.description}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
