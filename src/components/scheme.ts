import { schemePastel2, schemeSet2 } from "d3";

const scheme = schemePastel2 as string[];
const schemeAlt = schemeSet2 as string[];

export function schemeFromInterpolator(n: number, interpolator: (t: number) => string): string[] {
  const result = [];
  for (let i = 0; i < n; i++) {
    result.push(interpolator(i / (n - 1)));
  }
  return result;
}

export { scheme, schemeAlt };
