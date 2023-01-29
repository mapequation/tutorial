import { useCallback, useEffect, useState } from "react";
import type { NextPage } from "next";
import Head from "next/head";
import { observer } from "mobx-react";
import { modular_overlap } from "../networks";
import Header from "../components/Header";
import Footer from "../components/Footer";
import { Network, WalkTrace } from "../components/Network";
import Node from "../components/Network/Node";
import Walker from "../components/Network/Walker";
import { Network as NetworkModel, Node as NodeModel, Rate } from "../model";
import Button from "../components/Button";
import { scheme, schemeAlt } from "../components/scheme";
import BiasedWalker from "../model/algorithms/BiasedWalker";
import { scaleSqrt } from "d3";

const network = NetworkModel.parse(modular_overlap)
  .setNodeExtents([100, 700], [100, 700]);

network.walker = new BiasedWalker(network).setReturnParam(1);

const biasedNetwork = NetworkModel.parse(modular_overlap)
  .setNodeExtents([100, 700], [100, 700]);

const biasedWalker = new BiasedWalker(biasedNetwork)
  .setReturnParam(10)
  .setInOutParam(10);
biasedNetwork.walker = biasedWalker;

biasedNetwork.getNode(7)?.setTopModule(0);
biasedNetwork.getNode(8)?.setTopModule(0);
biasedNetwork.getNode(16)?.setTopModule(3);
biasedNetwork.getNode(24)?.setTopModule(3);

const node4 = network.getNode(4)!;
const node9 = network.getNode(9)!;
const node16 = network.getNode(16)!;

const nodeScale = scaleSqrt().domain([0, 1]).range([10, 100]);
const r = nodeScale(1 / network.numNodes);

const Home: NextPage = observer(() => {
  const [speed, setSpeed] = useState(3);
  const [returnParam, setReturnParam] = useState(19);
  const [inOutParam, setInOutParam] = useState(19);

  const startRandomWalk = useCallback(() => {
    network.walker.start();
    biasedNetwork.walker.start();
  }, []);

  const setWalkerSpeed = (value: number) => {
    setSpeed(value);
    network.walker.setSpeed(value);
    biasedNetwork.walker.setSpeed(value);
  };

  const setBiasReturnParam = (value: number) => {
    setReturnParam(value);
    biasedWalker.setReturnParam(value < 10 ? value / 10 : value - 9);
  };

  const setBiasInOutParam = (value: number) => {
    setInOutParam(value);
    biasedWalker.setInOutParam(value < 10 ? value / 10 : value - 9);
  };


  useEffect(() => startRandomWalk(), [startRandomWalk]);

  return (
    <>
      <Head>
        <title>The Map Equation</title>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#000000" />
        <meta
          name="description"
          content="Understand the mechanics of The Map Equation"
        />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className="container max-w-screen-xl mx-auto px-5">
        <Header />

        <main className="xl:grid xl:grid-cols-4 xl:gap-x-20">
          <div className="col-span-4">
            <div className="flex flex-row justify-center space-x-4 mt-10 mb-10">
              <Button className="button" onClick={() => {
                network.walker.reset();
                biasedNetwork.walker.reset();
              }}>
                Reset
              </Button>
              <Button className="button" onClick={() => {
                network.walker.step();
                biasedNetwork.walker.step();
              }}>
                Step
              </Button>
              <Button
                className={`button ${
                  !network.walker.isStarted ? "button--primary" : ""
                }`}
                onClick={() => network.walker.isStarted ? (network.walker.stop(), biasedNetwork.walker.stop()) : startRandomWalk()}
              >
                {network.walker.isStarted
                  ? "Stop Random Walk"
                  : "Start Random Walk"}
              </Button>
              <div className="flex flex-col items-center">
                <input type="range" id="walkerSpeed" min={1} max={10} step={1} value={speed}
                       onChange={(e) => setWalkerSpeed(+e.target.value)} />
                <label htmlFor="walkerSpeed">{speed} steps per second</label>
              </div>
            </div>
          </div>


          <div className="col-span-2 mb-48">
            <Network
              network={network}
              scheme={scheme}
              schemeAlt={schemeAlt}
              rate={Rate.Uniform}
              //showLabels
              showModules
            >
              {/*<EnterExitCodes network={network} x={60} y={700} />*/}
              <WalkTrace walker={network.walker} />
              <Walker walker={network.walker} />
            </Network>
            {/*<Trace network={network} showModules />*/}
          </div>

          <div className="col-span-2 mb-48">
            <Network
              network={biasedNetwork}
              scheme={scheme}
              schemeAlt={schemeAlt}
              rate={Rate.Uniform}
              // showLabels
              showModules
            >
              <OverlappingNode node={node4} r={r} overlapModule={0}
                               isVisiting={biasedNetwork.walker.isVisiting(node4)} />
              <OverlappingNode node={node9} r={r} overlapModule={0}
                               isVisiting={biasedNetwork.walker.isVisiting(node9)} />
              <OverlappingNode node={node16} r={r} overlapModule={4}
                               isVisiting={biasedNetwork.walker.isVisiting(node16)} />
              {/*<EnterExitCodes network={biasedNetwork} x={60} y={700} />*/}
              <WalkTrace walker={biasedNetwork.walker} />
              <Walker walker={biasedNetwork.walker} />
            </Network>
            {/*<Trace network={biasedNetwork} showModules />*/}
            <div className="flex flex-col items-center">
              <label htmlFor="returnParam">return parameter: {returnParam < 10 ? returnParam / 10 : returnParam - 9}</label>
              <input type="range" id="returnParam" min={1} max={19} step={1} value={returnParam}
                     onChange={(e) => setBiasReturnParam(+e.target.value)} />
              <label htmlFor="inOutParam">in-out parameter: {inOutParam < 10 ? inOutParam / 10 : inOutParam - 9}</label>
              <input type="range" id="inOutParam" min={1} max={19} step={1} value={inOutParam}
                     onChange={(e) => setBiasInOutParam(+e.target.value)} />
            </div>
          </div>
        </main>

        <Footer />
      </div>
    </>
  );
});

export default Home;

function OverlappingNode({ node, r, overlapModule, isVisiting = false }: {
  node: NodeModel,
  r: number,
  overlapModule: number,
  isVisiting: boolean
}) {
  const id = `cut-off-node-${node.id}`;
  return <>
    <clipPath id={id}>
      <rect x={node.x} y={node.y - r} width={2 * r} height={2 * r} />
    </clipPath>
    <Node
      node={node}
      x={node.x}
      y={node.y}
      r={r}
      strokeWidth={2}
      fill={isVisiting ? schemeAlt[overlapModule] : scheme[overlapModule]}
      stroke={schemeAlt[overlapModule]}
      clipPath={`url(#${id})`}
    />
  </>;
}
