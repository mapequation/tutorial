/**
 * Shared figure palette used across networks, links, and codebooks.
 */
export function schemeFromInterpolator(
  n: number,
  interpolator: (t: number) => string,
): string[] {
  const result = [];
  for (let i = 0; i < n; i++) {
    result.push(interpolator(i / (n - 1)));
  }
  return result;
}

function hexToRgb(hexColor: string) {
  const hex = hexColor.replace("#", "");
  const parsed = Number.parseInt(hex, 16);

  return {
    r: (parsed >> 16) & 255,
    g: (parsed >> 8) & 255,
    b: parsed & 255,
  };
}

function rgbToHex({
  r,
  g,
  b,
}: {
  r: number;
  g: number;
  b: number;
}) {
  return `#${[r, g, b]
    .map((value) =>
      Math.max(0, Math.min(255, Math.round(value)))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

export function darkenHexColor(color: string, amount = 0.22) {
  const from = hexToRgb(color);
  const clampedAmount = Math.max(0, Math.min(1, amount));

  return rgbToHex({
    r: from.r * (1 - clampedAmount),
    g: from.g * (1 - clampedAmount),
    b: from.b * (1 - clampedAmount),
  });
}

const allFigColors = [
  "#afb581",
  "#efab6a",
  "#e78c6e",
  "#838eab",
  "#c4c0d5",
  "#55c2ba",
  "#55a26d",
  "#ae8635",
  "#8acaf3",
  "#82d79e",
  "#a68679",
  "#a6aaef",
  "#419eb2",
  "#8aa29e",
  "#aacac2",
  "#ceaa9e",
  "#8a9a45",
  "#35a292",
  "#8a9275",
  "#75a6d7",
  "#d7be61",
  "#9eb6c6",
  "#86ba71",
  "#c29669",
  "#79b696",
  "#b2ce75",
  "#8e8ace",
  "#a6a2c2",
  "#c67551",
  "#69b6ca",
  "#d7be92",
  "#b2a24d",
  "#79d2df",
  "#aec2ef",
  "#aecaa6",
  "#79d7be",
  "#f3aa92",
  "#7596a2",
  "#9aae96",
  "#719a82",
  "#69aaaa",
  "#a28a5d",
  "#82a26d",
  "#aea282",
  "#d2a251",
  "#8ebaba",
  "#a6b65d",
  "#8aa2ba",
  "#7592ca",
  "#9a9a61",
] as const;

const prominentModuleColors = [
  "#efab6a",
  "#b2ce75",
  "#75a6d7",
  "#e78c6e",
  "#8e8ace",
  "#79d2df",
  "#ae8635",
  "#ceaa9e",
  "#79d7be",
] as const;

const figColors = [
  ...prominentModuleColors,
  ...allFigColors.filter(
    (color) =>
      !(prominentModuleColors as readonly string[]).includes(color),
  ),
] as const;

const scheme = [...figColors];
const schemeAlt = scheme.map((color) => darkenHexColor(color));

const neutralNodeColor = "#8aa29e";
const neutralNodeColorAlt = darkenHexColor(neutralNodeColor);
const neutralLinkColor = "#7596a2";
const isolatedModuleColor = "#8a9275";

export {
  figColors,
  isolatedModuleColor,
  neutralLinkColor,
  neutralNodeColor,
  neutralNodeColorAlt,
  scheme,
  schemeAlt,
};
