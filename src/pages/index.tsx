import type { NextPage } from 'next';
import Head from 'next/head';
import { modular_wd_json } from '../networks';
import { Network } from '../model';
import Header from '../components/Header';
import Footer from '../components/Footer';
import Layout from '../components/Layout';

const Home: NextPage = () => {
  const network = Network.parse(modular_wd_json);
  network.flowCalculator.calculateFlow();
  network.tree.update();
  network.mapequation.calculateCodelength();
  network.coder.code();

  // TODO generalize and remove
  network.nodes.forEach((node) => {
    node.x *= 800;
    node.y *= 800;
  });

  const toggleDarkMode = () => {
    const html = document.getElementsByTagName('html')[0];
    html.classList.toggle('dark');
  };

  return (
    <>
      <Head>
        <title>Understanding The Map Equation</title>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#000000" />
        <meta
          name="description"
          content="Understand how The Map Equation works"
        />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className="container max-w-screen-xl mx-auto px-5">
        <input
          type="checkbox"
          id="toggle-darkmode"
          className="toggle-darkmode"
          onClick={toggleDarkMode}
        />
        <label htmlFor="toggle-darkmode" />

        <Header />

        <Layout network={network} />

        <Footer />
      </div>
    </>
  );
};

export default Home;
