import { describe, expect, test } from "bun:test";
import { getAvailableThemes, getTheme } from "./theme-config";

const NEW_THEME_NAMES = ["vesper", "folio", "ember"] as const;
const NEW_THEME_DESIGNS = {
  vesper: "technical",
  folio: "editorial",
  ember: "cozy",
} as const;
const MINIMUM_TEXT_CONTRAST = 4.5;
const MINIMUM_UI_CONTRAST = 3;
const ACTIVE_TEXT_OPACITY = 0.7;

// Pure function: parse a six-digit hex color into RGB channels.
const getRgbChannels = (hex: string): [number, number, number] => [
  Number.parseInt(hex.slice(1, 3), 16),
  Number.parseInt(hex.slice(3, 5), 16),
  Number.parseInt(hex.slice(5, 7), 16),
];

// Pure function: calculate WCAG relative luminance for a six-digit hex color.
const getLuminance = (hex: string): number => {
  const channels = getRgbChannels(hex).map((channel) => {
    const value = channel / 255;
    return value <= 0.040_45 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  const [red = 0, green = 0, blue = 0] = channels;
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
};

// Pure function: calculate the WCAG contrast ratio between two colors.
const getContrastRatio = (first: string, second: string): number => {
  const firstLuminance = getLuminance(first);
  const secondLuminance = getLuminance(second);
  const lighter = Math.max(firstLuminance, secondLuminance);
  const darker = Math.min(firstLuminance, secondLuminance);
  return (lighter + 0.05) / (darker + 0.05);
};

// Pure function: composite a translucent foreground over an opaque background.
const blendColors = (foreground: string, background: string, opacity: number): string => {
  const [foregroundRed, foregroundGreen, foregroundBlue] = getRgbChannels(foreground);
  const [backgroundRed, backgroundGreen, backgroundBlue] = getRgbChannels(background);
  const channels = [
    foregroundRed * opacity + backgroundRed * (1 - opacity),
    foregroundGreen * opacity + backgroundGreen * (1 - opacity),
    foregroundBlue * opacity + backgroundBlue * (1 - opacity),
  ];
  return `#${channels.map((channel) => Math.round(channel).toString(16).padStart(2, "0")).join("")}`;
};

describe("curated built-in themes", () => {
  test("registers each new theme", () => {
    const availableThemes = getAvailableThemes();

    for (const themeName of NEW_THEME_NAMES) {
      expect(availableThemes).toContain(themeName);
      expect(getTheme(themeName).design).toBe(NEW_THEME_DESIGNS[themeName]);
    }
  });

  for (const themeName of NEW_THEME_NAMES) {
    test(`${themeName} keeps text and controls readable`, () => {
      const theme = getTheme(themeName);
      const { colors } = theme;
      const isDark = getLuminance(colors.bg) < 0.5;
      const activeText = blendColors(
        isDark ? "#000000" : "#ffffff",
        colors.accent,
        ACTIVE_TEXT_OPACITY
      );

      expect(getContrastRatio(colors.fg, colors.bg)).toBeGreaterThanOrEqual(MINIMUM_TEXT_CONTRAST);
      expect(getContrastRatio(colors.fg, colors.sidebarBg)).toBeGreaterThanOrEqual(
        MINIMUM_TEXT_CONTRAST
      );
      expect(getContrastRatio(colors.fg, colors.codeBg)).toBeGreaterThanOrEqual(
        MINIMUM_TEXT_CONTRAST
      );
      expect(getContrastRatio(colors.accent, colors.bg)).toBeGreaterThanOrEqual(
        MINIMUM_TEXT_CONTRAST
      );
      expect(getContrastRatio(colors.headingColor ?? colors.fg, colors.bg)).toBeGreaterThanOrEqual(
        MINIMUM_TEXT_CONTRAST
      );
      expect(getContrastRatio(activeText, colors.accent)).toBeGreaterThanOrEqual(
        MINIMUM_TEXT_CONTRAST
      );
      expect(getContrastRatio(colors.fg, colors.highlightBg)).toBeGreaterThanOrEqual(
        MINIMUM_TEXT_CONTRAST
      );
      expect(getContrastRatio(colors.border, colors.bg)).toBeGreaterThanOrEqual(
        MINIMUM_UI_CONTRAST
      );
    });
  }
});
