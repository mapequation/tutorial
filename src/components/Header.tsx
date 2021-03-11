import React from 'react';
// @ts-ignore
import { BlockMath } from 'react-katex';
import 'katex/dist/katex.min.css';
import logo from '../images/twocolormapicon.svg';

export default function Header() {
  return (
    <header className="mx-auto my-56">
      <h1 className="flex flex-row justify-center gap-x-2 md:gap-x-4 lg:gap-x-8">
        <img
          className="h-8 sm:h-10 md:h-12 lg:h-24"
          src={logo}
          alt="Map Equation logo"
        />
        <div className="text-brand font-brand tracking-tight text-3xl sm:text-4xl md:text-5xl lg:text-8xl">
          The Map Equation
        </div>
      </h1>
      <div className="mt-24 md:mt-44 text-xl sm:text-2xl md:text-3xl lg:text-5xl">
        <BlockMath math="L(M) = q_\curvearrowright H(\mathcal{Q}) + \sum_{i = 1}^{m}{p_{\circlearrowright}^i H(\mathcal{P}^i)}" />
      </div>
    </header>
  );
}
