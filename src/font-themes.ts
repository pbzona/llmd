// Font theme definitions and loading

export type FontTheme = {
  name: string;
  body: string;
  heading: string;
  code: string;
  fonts: FontDefinition[];
};

export type FontDefinition = {
  family: string;
  weight: number;
  file: string;
};

// Font theme registry
export const FONT_THEMES: Record<string, FontTheme> = {
  system: {
    name: "System",
    body: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    heading:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    code: '"SF Mono", Monaco, "Cascadia Code", "Roboto Mono", Consolas, monospace',
    fonts: [], // System fonts, no files to load
  },
  modern: {
    name: "Modern",
    body: "Inter, sans-serif",
    heading: "Inter, sans-serif",
    code: "JetBrains Mono, monospace",
    fonts: [
      { family: "Inter", weight: 400, file: "inter/inter-regular.woff2" },
      { family: "Inter", weight: 700, file: "inter/inter-bold.woff2" },
      {
        family: "JetBrains Mono",
        weight: 400,
        file: "jetbrains-mono/jetbrains-mono-regular.woff2",
      },
      { family: "JetBrains Mono", weight: 700, file: "jetbrains-mono/jetbrains-mono-bold.woff2" },
    ],
  },
  editorial: {
    name: "Editorial",
    body: "Lora, Georgia, serif",
    heading: "Inter, sans-serif",
    code: "JetBrains Mono, monospace",
    fonts: [
      { family: "Lora", weight: 400, file: "lora/lora-regular.woff2" },
      { family: "Lora", weight: 700, file: "lora/lora-bold.woff2" },
      { family: "Inter", weight: 400, file: "inter/inter-regular.woff2" },
      { family: "Inter", weight: 700, file: "inter/inter-bold.woff2" },
      {
        family: "JetBrains Mono",
        weight: 400,
        file: "jetbrains-mono/jetbrains-mono-regular.woff2",
      },
      { family: "JetBrains Mono", weight: 700, file: "jetbrains-mono/jetbrains-mono-bold.woff2" },
    ],
  },
};

// Generate @font-face CSS rules for a theme
export const generateFontFaces = (themeName: string): string => {
  const theme = FONT_THEMES[themeName];
  if (!theme || theme.fonts.length === 0) {
    return "";
  }

  return theme.fonts
    .map(
      (font) => `
    @font-face {
      font-family: '${font.family}';
      src: url('/_fonts/${font.file}') format('woff2');
      font-weight: ${font.weight};
      font-style: normal;
      font-display: swap;
    }`
    )
    .join("\n");
};

// Get font families for CSS
export const getFontFamilies = (
  themeName: string
): { body: string; heading: string; code: string } => {
  const theme = (FONT_THEMES[themeName] || FONT_THEMES.system) as FontTheme;
  return {
    body: theme.body,
    heading: theme.heading,
    code: theme.code,
  };
};
