import React from 'react';
// @ts-ignore
import { BlockMath } from 'react-katex';
import 'katex/dist/katex.min.css';

export default function Header() {
  return (
    <header className="mx-auto my-48 text-center">
      <h1>
        <span className="m-0 text-indigo-400 font-serif font-thin italic tracking-tight text-4xl md:text-5xl lg:text-7xl">
          Understanding
        </span>
        <br />
        <span className="m-0 text-gray-700 border-gray-200 font-semibold tracking-wide lg:border-b-8 text-5xl md:text-6xl lg:text-8xl">
          The Map Equation
        </span>
      </h1>
      <div className="mt-32 md:mt-44 text-gray-600 text-xl sm:text-3xl md:text-4xl lg:text-5xl">
        <BlockMath math="L(M) = q_\curvearrowright H(\mathcal{Q}) + \sum_{i = 1}^{m}{p_{\circlearrowright}^i H(\mathcal{P}^i)}" />
      </div>
    </header>
  );
}
