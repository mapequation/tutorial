/**
 * In-place division: divide all elements of an array by a scalar.
 */
export function divide(xs: number[], numerator: number): number[] {
  for (let i = 0; i < xs.length; ++i) {
    xs[i] /= numerator;
  }

  return xs;
}

/**
 * Sum of all elements in an array.
 */
export function sum(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0.0);
}

/**
 * Normalize an array to sum to 1 (probability distribution).
 */
export function normalize(xs: number[]): number[] {
  return divide(xs, sum(xs));
}

/**
 * Compute p * log2(p). Returns 0 if p <= 0 to avoid NaN.
 * Used in entropy calculations.
 */
export function plogp(p: number): number {
  return p > 0 ? p * Math.log2(p) : 0;
}

/**
 * Shannon entropy of a probability distribution.
 */
export function entropy(ps: number[]): number {
  return normalize(ps).reduce((tot, p) => tot - plogp(p), 0.0);
}

/**
 * Sample a random index from an array using the given weights as probabilities.
 * Weights need not be normalized.
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
