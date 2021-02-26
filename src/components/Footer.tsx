import React from 'react';

export default function Footer() {
  return (
    <footer className="mt-96 h-52 py-10 border-t-4 border-gray-100">
      <ul className="flex flex-col text-center sm:flex-row justify-center gap-x-20">
        <li>
          <a href="//mapequation.org">mapequation.org</a>
        </li>
        <li>
          <a href="//www.mapequation.org/about.html">contact</a>
        </li>
        <li>
          <a href="//github.com/mapequation">github</a>
        </li>
      </ul>
    </footer>
  );
}
