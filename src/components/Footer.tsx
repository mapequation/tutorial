import React from 'react';

export default function Footer() {
  return (
    <footer className="mt-96 h-52 py-10">
      <ul className="flex flex-col md:flex-row justify-center text-center divide-y md:divide-x md:divide-y-0 divide-gray-300">
        <li className="px-10 py-2">
          <a href="//mapequation.org">mapequation.org</a>
        </li>
        <li className="px-10 py-2">
          <a href="//www.mapequation.org/about.html">contact</a>
        </li>
        <li className="px-10 py-2">
          <a href="//github.com/mapequation">github</a>
        </li>
      </ul>
    </footer>
  );
}
