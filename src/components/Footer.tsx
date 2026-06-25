import { HTMLProps } from "react";

/**
 * Small link item in a footer navigation list.
 */
const ListLink = ({ children, ...props }: HTMLProps<HTMLAnchorElement>) => (
  <li>
    <a className="inline-block px-10 py-2 hover:text-gray-600" {...props}>
      {children}
    </a>
  </li>
);

/**
 * Site footer component. Displays links to mapequation.org, contact page,
 * and GitHub.
 */
export default function Footer() {
  return (
    <footer className="mt-96 h-52 py-10">
      <ul className="flex flex-col md:flex-row justify-center text-center divide-y md:divide-x md:divide-y-0 divide-gray-300">
        <ListLink href="//mapequation.org">mapequation.org</ListLink>
        <ListLink href="//mapequation.org/about.html">contact</ListLink>
        <ListLink href="//github.com/mapequation">github</ListLink>
      </ul>
    </footer>
  );
}
