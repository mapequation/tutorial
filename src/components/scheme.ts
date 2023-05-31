export function schemeFromInterpolator(n: number, interpolator: (t: number) => string): string[] {
  const result = [];
  for (let i = 0; i < n; i++) {
    result.push(interpolator(i / (n - 1)));
  }
  return result;
}

const scheme = [
  "#EBC384",
  "#DFDDA2",
  "#B4CCDF",
  "#E68C6C",
]

const schemeAlt = [
  "#ECA770",
  "#ADB580",
  "#82A3C9",
  "#C2554A",
]

export { scheme, schemeAlt };
