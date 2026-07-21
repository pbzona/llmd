// Central theme configuration for easy customization

import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const THEME_DESIGNS = ["technical", "editorial", "cozy"] as const;

export type ThemeDesign = (typeof THEME_DESIGNS)[number];

export type Theme = {
  // Optional component styling; omitted themes retain the original UI
  design?: ThemeDesign;
  // Color configuration
  colors: {
    bg: string;
    fg: string;
    border: string;
    hover: string;
    accent: string;
    codeBg: string;
    sidebarBg: string;
    // Icon colors
    folderIcon: string;
    fileIcon: string;
    // Highlight colors (borders will be derived using relative CSS colors)
    highlightBg: string; // Background color for valid highlights
    highlightStaleBg: string; // Background color for stale highlights
    // Heading color (optional, defaults to fg if not specified)
    headingColor?: string;
  };
  // Font configuration
  fonts: {
    body: string;
    heading: string;
    code: string;
    googleFontsUrl?: string; // Optional Google Fonts CSS import
  };
  // Code syntax highlighting theme (Shiki theme name)
  // Common options: "github-dark", "github-light", "nord", "dracula", "monokai", "solarized-light", "solarized-dark"
  // If not specified, defaults to "github-dark" for dark themes and "github-light" for light themes
  codeTheme?: string;
};

// Built-in themes (colors + fonts paired together)
const BUILT_IN_THEMES: Record<string, Theme> = {
  // Original dark theme with sans-serif fonts
  dark: {
    colors: {
      bg: "#1a1a1a",
      fg: "#e0e0e0",
      border: "#333",
      hover: "#2a2a2a",
      accent: "#4a9eff",
      codeBg: "#2d2d2d",
      sidebarBg: "#151515",
      folderIcon: "#a78bfa",
      fileIcon: "#fbbf24",
      highlightBg: "#ffdc00",
      highlightStaleBg: "#ff5252",
      headingColor: "#ffffff",
    },
    fonts: {
      body: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      heading:
        '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      code: '"SF Mono", Monaco, "Cascadia Code", "Roboto Mono", Consolas, monospace',
    },
    codeTheme: "github-dark",
  },
  // Original light theme with serif fonts
  light: {
    colors: {
      bg: "#f7f4f0",
      fg: "#1a1a1a",
      border: "#e4dfd8",
      hover: "#eee9e3",
      accent: "#0066cc",
      codeBg: "#eee9e3",
      sidebarBg: "#eee9e3",
      folderIcon: "#2563eb",
      fileIcon: "#f97316",
      highlightBg: "#ffeb3b",
      highlightStaleBg: "#ffcdd2",
      headingColor: "#000000",
    },
    fonts: {
      body: "Georgia, 'Times New Roman', Times, serif",
      heading: "Georgia, 'Times New Roman', Times, serif",
      code: '"Courier New", Courier, monospace',
    },
    codeTheme: "github-light",
  },
  // Nord-inspired theme with modern fonts
  nord: {
    colors: {
      bg: "#2e3440",
      fg: "#d8dee9",
      border: "#3b4252",
      hover: "#434c5e",
      accent: "#88c0d0", // Lighter Nord frost color for better contrast
      codeBg: "#3b4252",
      sidebarBg: "#2e3440",
      folderIcon: "#81a1c1",
      fileIcon: "#ebcb8b",
      highlightBg: "#ebcb8b", // Nord yellow
      highlightStaleBg: "#bf616a", // Nord red
      headingColor: "#eceff4", // Nord snow storm
    },
    fonts: {
      body: '"Inter", sans-serif',
      heading: '"Inter", sans-serif',
      code: '"JetBrains Mono", monospace',
      googleFontsUrl:
        "https://fonts.googleapis.com/css2?family=Inter:wght@400;700&family=JetBrains+Mono:wght@400;700&display=swap",
    },
    codeTheme: "nord",
  },
  // Dracula-inspired theme with future fonts
  dracula: {
    colors: {
      bg: "#282a36",
      fg: "#f8f8f2",
      border: "#44475a",
      hover: "#44475a",
      accent: "#ff79c6",
      codeBg: "#44475a",
      sidebarBg: "#21222c",
      folderIcon: "#bd93f9",
      fileIcon: "#ffb86c",
      highlightBg: "#f1fa8c", // Dracula yellow
      highlightStaleBg: "#ff5555", // Dracula red
      headingColor: "#bd93f9", // Dracula purple
    },
    fonts: {
      body: '"Space Grotesk", sans-serif',
      heading: '"Space Mono", monospace',
      code: '"Space Mono", monospace',
      googleFontsUrl:
        "https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Space+Grotesk:wght@400;700&display=swap",
    },
    codeTheme: "dracula",
  },
  // Solarized Light with literary fonts
  solarized: {
    colors: {
      bg: "#fdf6e3",
      fg: "#073642", // base02 - darkest gray for maximum contrast
      border: "#93a1a1", // base1 for visible borders
      hover: "#eee8d5",
      accent: "#1d6db8", // Even darker blue for WCAG AA compliance
      codeBg: "#eee8d5",
      sidebarBg: "#eee8d5",
      folderIcon: "#859900", // Green
      fileIcon: "#dc322f", // Red for better contrast than orange
      highlightBg: "#b58900", // Solarized yellow
      highlightStaleBg: "#dc322f", // Solarized red
      headingColor: "#002b36", // Solarized base03 - darkest
    },
    fonts: {
      body: "Newsreader, serif",
      heading: "Spectral, serif",
      code: '"Geist Mono", monospace',
      googleFontsUrl:
        "https://fonts.googleapis.com/css2?family=Spectral:wght@400;700&family=Newsreader:wght@400;700&family=Geist+Mono:wght@400;700&display=swap",
    },
    codeTheme: "solarized-light",
  },
  // Monokai-inspired theme with monospace fonts
  monokai: {
    colors: {
      bg: "#272822",
      fg: "#f8f8f2",
      border: "#3e3d32",
      hover: "#3e3d32",
      accent: "#ae81ff",
      codeBg: "#3e3d32",
      sidebarBg: "#1e1f1c",
      folderIcon: "#a6e22e",
      fileIcon: "#fd971f",
      highlightBg: "#e6db74", // Monokai yellow
      highlightStaleBg: "#f92672", // Monokai pink/red
      headingColor: "#a6e22e", // Monokai green
    },
    fonts: {
      body: '"SF Mono", Monaco, "Cascadia Code", "Roboto Mono", Consolas, monospace',
      heading: '"SF Mono", Monaco, "Cascadia Code", "Roboto Mono", Consolas, monospace',
      code: '"SF Mono", Monaco, "Cascadia Code", "Roboto Mono", Consolas, monospace',
    },
    codeTheme: "monokai",
  },
  mindful: {
    colors: {
      bg: "#3a2732",
      fg: "#fff4eb",
      border: "#FFE2C7bb",
      hover: "#644957",
      accent: "#5A4e8f",
      codeBg: "#35212B",
      sidebarBg: "#35212B",
      folderIcon: "#FD8B60",
      fileIcon: "#59BBC2",
      highlightBg: "#59BBC2",
      highlightStaleBg: "#FD8B60",
      headingColor: "#FD8B60",
    },
    fonts: {
      body: '"SF Mono", Monaco, "Cascadia Code", "Roboto Mono", Consolas, monospace',
      heading: '"SF Mono", Monaco, "Cascadia Code", "Roboto Mono", Consolas, monospace',
      code: '"SF Mono", Monaco, "Cascadia Code", "Roboto Mono", Consolas, monospace',
    },
  },
  // Deep blue-black theme with soft, low-glare contrast
  vesper: {
    design: "technical",
    colors: {
      bg: "#111719",
      fg: "#d9e2df",
      border: "#566864",
      hover: "#202b2c",
      accent: "#79c7b7",
      codeBg: "#192123",
      sidebarBg: "#0d1214",
      folderIcon: "#d3a76d",
      fileIcon: "#82b9da",
      highlightBg: "#315b55",
      highlightStaleBg: "#653842",
      headingColor: "#f1f5f2",
    },
    fonts: {
      body: '"Manrope", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      heading: '"Manrope", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      code: '"IBM Plex Mono", "SFMono-Regular", Consolas, monospace',
      googleFontsUrl:
        "https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=Manrope:wght@400;500;600;700;800&display=swap",
    },
    codeTheme: "github-dark",
  },
  // Warm editorial theme inspired by uncoated paper and letterpress ink
  folio: {
    design: "editorial",
    colors: {
      bg: "#f6f1e7",
      fg: "#2c2924",
      border: "#948a7b",
      hover: "#e9e1d4",
      accent: "#933529",
      codeBg: "#eee6d8",
      sidebarBg: "#ebe3d5",
      folderIcon: "#76591e",
      fileIcon: "#933529",
      highlightBg: "#f0d58c",
      highlightStaleBg: "#edb6aa",
      headingColor: "#171713",
    },
    fonts: {
      body: '"Source Serif 4", Georgia, "Times New Roman", serif',
      heading: '"DM Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      code: '"IBM Plex Mono", "SFMono-Regular", Consolas, monospace',
      googleFontsUrl:
        "https://fonts.googleapis.com/css2?family=DM+Sans:wght@500;600;700&family=IBM+Plex+Mono:wght@400;500;600&family=Source+Serif+4:wght@400;600;700&display=swap",
    },
    codeTheme: "github-light",
  },
  // Warm low-light theme designed for comfortable evening reading
  ember: {
    design: "cozy",
    colors: {
      bg: "#1c1714",
      fg: "#eadfce",
      border: "#756152",
      hover: "#332822",
      accent: "#e0a46a",
      codeBg: "#251e1a",
      sidebarBg: "#15110f",
      folderIcon: "#c4a36a",
      fileIcon: "#d27d62",
      highlightBg: "#574226",
      highlightStaleBg: "#59302f",
      headingColor: "#f4d5a6",
    },
    fonts: {
      body: '"IBM Plex Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      heading: '"Fraunces", Georgia, "Times New Roman", serif',
      code: '"IBM Plex Mono", "SFMono-Regular", Consolas, monospace',
      googleFontsUrl:
        "https://fonts.googleapis.com/css2?family=Fraunces:wght@600;700&family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600&display=swap",
    },
    codeTheme: "monokai",
  },
};

// Required properties for a valid custom theme
const REQUIRED_COLOR_PROPS = [
  "bg",
  "fg",
  "border",
  "hover",
  "accent",
  "codeBg",
  "sidebarBg",
  "folderIcon",
  "fileIcon",
  "highlightBg",
  "highlightStaleBg",
];
const REQUIRED_FONT_PROPS = ["body", "heading", "code"];
const LEGACY_THEME_CONFIG_KEYS = new Set(["colorThemes", "fontThemes"]);

// Pure function: identify config metadata and containers that are not unified themes.
const isNonThemeConfigKey = (name: string): boolean =>
  name.startsWith("_") || LEGACY_THEME_CONFIG_KEYS.has(name);

// Pure function: validate a single custom theme, logging why it was skipped.
const validateTheme = (name: string, theme: unknown): Theme | null => {
  if (typeof theme !== "object" || theme === null) {
    console.warn(`[llmd] Skipping invalid theme: ${name}`);
    return null;
  }

  const t = theme as Record<string, unknown>;
  const colors = t.colors as Record<string, unknown> | undefined;
  const fonts = t.fonts as Record<string, unknown> | undefined;

  if (!colors || REQUIRED_COLOR_PROPS.some((prop) => typeof colors[prop] !== "string")) {
    console.warn(`[llmd] Skipping theme with missing/incomplete colors: ${name}`);
    return null;
  }

  if (!fonts || REQUIRED_FONT_PROPS.some((prop) => typeof fonts[prop] !== "string")) {
    console.warn(`[llmd] Skipping theme with missing/incomplete fonts: ${name}`);
    return null;
  }

  if (fonts.googleFontsUrl !== undefined && typeof fonts.googleFontsUrl !== "string") {
    console.warn(`[llmd] Skipping theme with invalid googleFontsUrl: ${name}`);
    return null;
  }

  if (
    t.design !== undefined &&
    (typeof t.design !== "string" || !THEME_DESIGNS.includes(t.design as ThemeDesign))
  ) {
    console.warn(`[llmd] Skipping theme with invalid design: ${name}`);
    return null;
  }

  return theme as Theme;
};

// Pure function: filter metadata and validate user-defined theme entries.
export const validateCustomThemes = (
  customThemes: Record<string, unknown>
): Record<string, Theme> => {
  const validatedThemes: Record<string, Theme> = {};

  for (const [name, theme] of Object.entries(customThemes)) {
    if (isNonThemeConfigKey(name)) {
      continue;
    }

    const validated = validateTheme(name, theme);
    if (validated) {
      validatedThemes[name] = validated;
    }
  }

  return validatedThemes;
};

// Load custom themes from unified config file
const loadCustomThemes = (): Record<string, Theme> => {
  // Check XDG_CONFIG_HOME first, fallback to ~/.config
  const xdgConfig = process.env.XDG_CONFIG_HOME;
  const configDir = xdgConfig ? join(xdgConfig, "llmd") : join(homedir(), ".config", "llmd");
  const themesPath = join(configDir, "themes.json");

  if (!existsSync(themesPath)) {
    return {};
  }

  try {
    const config = JSON.parse(readFileSync(themesPath, "utf-8"));
    // Support unified themes in themes.json
    const customThemes = config.themes || config;

    if (typeof customThemes !== "object" || customThemes === null) {
      console.warn(`[llmd] Invalid themes.json format at ${themesPath}`);
      return {};
    }

    return validateCustomThemes(customThemes as Record<string, unknown>);
  } catch (error) {
    console.warn(`[llmd] Failed to load custom themes from ${themesPath}:`, error);
    return {};
  }
};

// Combine built-in and custom themes
let allThemes: Record<string, Theme> | null = null;

const getAllThemes = (): Record<string, Theme> => {
  if (!allThemes) {
    const customThemes = loadCustomThemes();
    allThemes = { ...BUILT_IN_THEMES, ...customThemes };
  }
  return allThemes;
};

// Get theme (colors + fonts)
export const getTheme = (themeName: string): Theme => {
  const themes = getAllThemes();
  const theme = themes[themeName];

  if (!theme) {
    throw new Error(
      `Theme "${themeName}" not found. Available themes: ${Object.keys(themes).join(", ")}`
    );
  }

  return theme;
};

// Get list of available theme names
export const getAvailableThemes = (): string[] => Object.keys(getAllThemes());

// Check if a theme exists
export const themeExists = (themeName: string): boolean => themeName in getAllThemes();
