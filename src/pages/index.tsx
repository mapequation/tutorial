import type { NextPage } from "next";
import Head from "next/head";
import dynamic from "next/dynamic";
import Footer from "../components/Footer";

// Dynamically import the `Main` component and disable server-side rendering
// because it depends on browser-only APIs (e.g. animation, window, or canvas).
// This keeps the initial server render lightweight and avoids SSR errors.
const Main = dynamic(() => import("../components/Main"), { ssr: false });

/**
 * Home page for the demo site.
 *
 * This Next.js page presents the interactive Map Equation article.
 */
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
        <main className="xl:grid xl:grid-cols-4 xl:gap-x-20">
          <Main />
        </main>

        {/* Site footer with attribution and extra links. */}
        <Footer />
      </div>
    </>
  );
};

export default Home;
