// Global stylesheet for the application. Imported at the top-level so styles
// are applied to every page in the Next.js app.
import "../../styles/globals.css";
import type { AppProps } from "next/app";

/**
 * Top-level App component used by Next.js.
 *
 * Next.js uses this component to initialize pages. We keep it minimal here
 * — simply rendering the active page component with its props — but this is
 * the right place to add global providers (e.g. MobX Provider, ThemeProvider)
 * if the app grows and needs shared context or state wrappers.
 */
function MyApp({ Component, pageProps }: AppProps) {
  return <Component {...pageProps} />;
}

export default MyApp;
