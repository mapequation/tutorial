// Global stylesheet for the application. Imported at the top-level so styles
// are applied to every page in the Next.js app.
import "../../styles/globals.css";
import "katex/dist/katex.min.css";
import type { AppProps } from "next/app";
import { useEffect } from "react";

/**
 * Top-level App component used by Next.js.
 *
 * Next.js uses this component to initialize pages. We keep it minimal here
 * — simply rendering the active page component with its props — but this is
 * the right place to add global providers (e.g. MobX Provider, ThemeProvider)
 * if the app grows and needs shared context or state wrappers.
 */
function MyApp({ Component, pageProps }: AppProps) {
  useEffect(() => {
    // Set CSS variables based on environment
    const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "/tutorial";
    document.documentElement.style.setProperty(
      "--bg-noise-url",
      `url("${basePath}/images/noise-100-90-5.png")`,
    );
  }, []);

  return <Component {...pageProps} />;
}

export default MyApp;
