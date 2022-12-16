import type { NextPage } from "next";
import Head from "next/head";
import dynamic from "next/dynamic";
import Header from "../components/Header";
import Footer from "../components/Footer";

const Main = dynamic(() => import("../components/Main"), { ssr: false });

const Home: NextPage = () => {
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
          <div className="col-span-1 xl:mt-12 mb-20">
            <img
              className="rounded-full w-1/2 mx-auto xl:w-full"
              src="/demo/images/hairball.png"
              alt="Hairball graph"
            />
          </div>

          <div className="col-span-3 mb-48">
            <h1>A network is not enough</h1>
            <p>
              Networks of nodes and links are powerful abstractions of complex
              systems. But when the networks have thousands of nodes and links,
              they are themselves too complicated to comprehend, unless we
              simplify and highlight their organization.
            </p>
          </div>

          <div className="col-span-4 mb-20">
            <h2>Maps of networks</h2>
            <p>
              Geographic maps <b>simplify</b> and <b>highlight</b> streets,
              neighborhoods, cities, and highways from high-resolution satellite
              images. We want to create similar maps of networks.
            </p>
          </div>

          <div className="col-span-4 grid grid-cols-4 gap-x-5 md:gap-x-10 lg:gap-x-20 mb-48">
            <div>
              <img
                className="filter-grayscale-25 object-cover rounded-full shadow-xl"
                src="/demo/images/globe.png"
                alt="The Earth"
              />
            </div>
            <div className="relative">
              <img
                src="/demo/images/map-1.png"
                alt="Map over Europe"
                className="filter-grayscale-25 object-cover rounded-xl shadow-xl"
              />
            </div>
            <div className="relative">
              <img
                src="/demo/images/map-2.png"
                alt="Map over Umeå"
                className="filter-grayscale-25 object-cover rounded-xl shadow-xl"
              />
            </div>
            <div className="relative">
              <img
                src="/demo/images/map-3.png"
                alt="Map over Umeå University"
                className="filter-grayscale-25 object-cover rounded-xl shadow-xl"
              />
            </div>
          </div>

          <div className="col-span-2 xl:mb-48">
            <h2>Network flows</h2>
            <p>
              We are often not interested in the network itself. We want to know
              how things move &mdash; flow &mdash; on the network.
            </p>
            <ul className="ml-6 list-disc">
              <li>The flow of ideas in social networks</li>
              <li>Passenger moving in traffic networks</li>
              <li>Money in transaction networks</li>
            </ul>
            <p>
              The things moving on a network tend to stay within certain groups
              of nodes for a relatively long time before exiting. We call these
              groups modules, and these are what we are interested in.
            </p>
            <p>
              We can simulate the flows using a <strong>random walk</strong> on
              the network. Notice how the random walker will tend to get stuck
              in modules. To prevent getting too stuck, it teleports with a low
              probability to a random node.
            </p>
          </div>

          <Main />
        </main>

        <Footer />
      </div>
    </>
  );
};

export default Home;
