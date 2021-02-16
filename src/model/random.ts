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
