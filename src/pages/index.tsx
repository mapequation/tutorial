import type { NextPage } from 'next';
import Head from 'next/head';
import App from '../components/App';
import Header from '../components/Header';
import Footer from '../components/Footer';

const Home: NextPage = () => {
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

        <App />

        <Footer />
      </div>
    </>
  );
};

export default Home;
