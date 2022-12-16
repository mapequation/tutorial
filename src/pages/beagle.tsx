import { useCallback, useEffect } from "react";
import type { NextPage } from "next";
import Head from "next/head";
import { observer } from "mobx-react";
import { modular_w_json } from "../networks";
import Header from "../components/Header";
import Footer from "../components/Footer";
import { EnterExitCodes, Network, WalkTrace } from "../components/Network";
import Walker from "../components/Network/BeagleWalker";
import Trace from "../components/Trace";
import { Network as NetworkModel, Rate } from "../model";
import Button from "../components/Button";

const network = NetworkModel.parse(modular_w_json);
network.flowCalculator.calculateFlow();
network.tree.update();
network.mapequation.calculateCodelength();
network.coder.code();
network.voter.initialize();
network.walker.interval = 250;

// TODO generalize and remove
network.nodes.forEach((node) => {
  node.x *= 800;
  node.y *= 800;
});

const Home: NextPage = observer(() => {
  const startRandomWalk = useCallback(() => network.walker.start(), []);

  useEffect(() => startRandomWalk(), [startRandomWalk]);

  const walkTrace = <WalkTrace walker={network.walker} />;
  const walker = <Walker walker={network.walker} />;

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

          <div className="col-span-4 mb-48">
            <div className="w-1/2 mx-auto xl:w-full mb-48">
              <Network
                network={network}
                rate={Rate.Uniform}
              >
                {walkTrace}
                {walker}
              </Network>
            </div>
          </div>

          <div className="col-span-4">
            <div className="flex flex-row justify-center space-x-4 mt-10 mb-10">
              <Button className="button" onClick={() => network.walker.reset()}>
                Reset
              </Button>
              <Button className="button" onClick={() => network.walker.step()}>
                Step
              </Button>
              <Button
                className={`button ${
                  !network.walker.isStarted ? "button--primary" : ""
                }`}
                onClick={() => network.walker.isStarted ? network.walker.stop() : startRandomWalk()}
              >
                {network.walker.isStarted
                  ? "Stop Random Walk"
                  : "Start Random Walk"}
              </Button>
            </div>
          </div>


          <div className="col-span-2 mb-48">
            <Network
              network={network}
              rate={Rate.Uniform}
              showLabels
            >
              {walkTrace}
              {walker}
            </Network>

            <Trace network={network} />
          </div>

          <div className="col-span-2 mb-48">
            <Network
              network={network}
              rate={Rate.Uniform}
              showLabels
              showModules
            >
              <EnterExitCodes network={network} x={30} y={700} />
              {walkTrace}
              {walker}
            </Network>

            <Trace network={network} showModules />
          </div>

        </main>

        <Footer />
      </div>
    </>
  );
});

export default Home;
