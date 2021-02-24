export function divide(xs: number[], numerator: number): number[] {
  for (let i = 0; i < xs.length; ++i) {
    xs[i] /= numerator;
  }

  return xs;
}

export function sum(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0.0);
}

export function normalize(xs: number[]): number[] {
  return divide(xs, sum(xs));
}

export function plogp(p: number): number {
  return p > 0 ? p * Math.log2(p) : 0;
}

export function entropy(ps: number[]): number {
  return normalize(ps).reduce((tot, p) => tot - plogp(p), 0.0);
}

/*
  Input: array of weights
  Output: random index of array
 */
export function weightedRandom(weights: number[]): number {
  let sum = weights.reduce((a, b) => a + b, 0.0);
  const r = Math.random() * sum;

  for (let i = 0; i < weights.length; ++i) {
    sum -= weights[i];
    if (sum < r) {
      return i;
    }
  }

  // should never happen
  return 0;
}
