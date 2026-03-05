/**
 * Utility to generate a color scheme by sampling an interpolator function.
 * Useful for creating gradients or continuous palettes.
 */
export function schemeFromInterpolator(n: number, interpolator: (t: number) => string): string[] {
  const result = [];
  for (let i = 0; i < n; i++) {
    result.push(interpolator(i / (n - 1)));
  }
  return result;
}

// Primary color scheme for modules and visual elements.
// This palette is designed to be distinguishable for colorblind individuals,
// including those with protanopia (red-green) and deuteranopia color blindness.
// Based on the Okabe-Ito colorblind-safe palette and tested combinations.
const scheme = [
  "#E69F00",  // Orange
  "#56B4E9",  // Sky Blue
  "#009E73",  // Green
  "#F0E442",  // Yellow
  "#0072B2",  // Blue
  "#D55E00",  // Vermillion (Red-Orange)
  "#CC79A7",  // Reddish Purple
  "#999999",  // Gray
]

// Alternate (higher contrast) color scheme used for highlights and active states.
const schemeAlt = [
  "#D9A530",  // Darker Orange
  "#2E8B9E",  // Darker Sky Blue
  "#006B55",  // Darker Green
  "#C4B91D",  // Darker Yellow
  "#004E8A",  // Darker Blue
  "#A23E00",  // Darker Vermillion
  "#9D5A7A",  // Darker Reddish Purple
  "#666666",  // Darker Gray
]

export { scheme, schemeAlt };
