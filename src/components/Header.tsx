// KaTeX stylesheet is required to render the mathematical formula in the
// header. We import it globally for this component.
import "katex/dist/katex.min.css";
import TeX from "@matejmazur/react-katex";

/**
 * Site header component.
 *
 * Renders the title, logo and the Map Equation formula using KaTeX. This is a
 * purely presentational component: it does not hold application state but
 * provides a visual anchor for the demo pages.
 */
export default function Header() {
  return (
    <header className="mx-auto my-56">
      <h1 className="flex flex-row justify-center gap-x-2 md:gap-x-4 lg:gap-x-8">
        <img
          className="h-8 sm:h-10 md:h-12 lg:h-24"
          src="//mapequation.org/assets/img/twocolormapicon_whiteboarder.svg"
          alt="Map Equation logo"
        />
        <div className="text-brand font-brand tracking-tight text-3xl sm:text-4xl md:text-5xl lg:text-8xl">
          The Map Equation
        </div>
      </h1>
      {/* Render the map equation using KaTeX for crisp math typesetting */}
      <div className="flex justify-center mt-24 md:mt-44 text-xl sm:text-2xl md:text-3xl lg:text-5xl">
        <TeX math="L(M) = q_\curvearrowleft H(\mathcal{Q}) + \sum_{i = 1}^{m}{p_{\circlearrowright}^i H(\mathcal{P}^i)}" />
      </div>
    </header>
  );
}
