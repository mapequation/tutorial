import { observer } from "mobx-react";
import type { Network, Node } from "../../model";
import { getRate, Rate } from "../../model";
import Bar from "./Bar";
import OverflowMask from "./OverflowMask";
import { scheme, schemeAlt } from "../scheme";

interface Props {
  network: Network;
  rate: Rate;
  showModules?: boolean;
  duration?: number;
  width?: number | string;
  height?: number | string;
}

function Rates({ network, rate, showModules = true, duration = 100 }: Props) {
  const { nodes, maxNodeFlow } = network;

  const getNodeRate = getRate(rate);

  const [viewBoxWidth, viewBoxHeight] = [1000, 800];
  const viewBox = `0 0 ${viewBoxWidth} ${viewBoxHeight}`;

  const barWidth = viewBoxWidth / nodes.length;

  const x = (i: number): number => barWidth * i;

  const minHeight = 1;
  const maxHeight = viewBoxHeight / 2;

  const barHeight = (scale: number): number =>
    minHeight + (maxHeight * scale) / maxNodeFlow;
  const y = (scale: number): number => viewBoxHeight - barHeight(scale);

  const barProps = (i: number, scale: number) => ({
    x: x(i),
    y: y(scale),
    width: barWidth,
    height: barHeight(scale),
    strokeWidth: 2,
    mask: "url(#bar-overflow)",
  });

  const barFillStroke = (node: Node) => {
    return {
      fill: showModules ? scheme[node.topModule] : scheme[0],
      stroke: showModules ? schemeAlt[node.topModule] : schemeAlt[0],
    };
  };

  const nodesByFlow = nodes.sort((a: Node, b: Node): number => {
    if (a.topModule !== b.topModule) return b.moduleFlow - a.moduleFlow;
    return b.flow - a.flow;
  });

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="rateView"
      viewBox={viewBox}
    >
      <defs>
        <OverflowMask
          id="bar-overflow"
          numPoints={3 * nodes.length}
          width={viewBoxWidth}
          height={200} // NOTE this is the height from the top of the viewBox
        />
      </defs>
      {nodesByFlow.map((node, i) => (
        <Bar
          key={i}
          fill="transparent"
          stroke="#ccc"
          {...barProps(i, node.flow)}
        />
      ))}
      {rate !== Rate.Uniform &&
        nodesByFlow.map((node, i) => (
          <Bar
            key={i}
            animate
            duration={duration}
            opacity={0.6}
            {...barFillStroke(node)}
            {...barProps(i, getNodeRate(node))}
          />
        ))}
    </svg>
  );
}

export default observer(Rates);
