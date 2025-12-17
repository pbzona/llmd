// Central theme configuration for easy customization

export type ThemeColors = {
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
};

export type ThemeConfig = {
  light: ThemeColors;
  dark: ThemeColors;
};

// Color configuration - modify these to experiment with different palettes
export const THEME_CONFIG: ThemeConfig = {
  light: {
    bg: "#f7f4f0", // Warm neutral background
    fg: "#1a1a1a", // Dark text
    border: "#e4dfd8", // Warm beige border
    hover: "#eee9e3", // Slightly darker hover
    accent: "#0066cc", // Blue accent
    codeBg: "#eee9e3", // Warm code background
    sidebarBg: "#eee9e3", // Warm sidebar
    folderIcon: "#2563eb", // Blue folders
    fileIcon: "#f97316", // Orange files
  },
  dark: {
    bg: "#1a1a1a", // Dark background
    fg: "#e0e0e0", // Light text
    border: "#333", // Dark border
    hover: "#2a2a2a", // Lighter hover
    accent: "#4a9eff", // Light blue accent
    codeBg: "#2d2d2d", // Dark code background
    sidebarBg: "#151515", // Darker sidebar
    folderIcon: "#a78bfa", // Purple folders
    fileIcon: "#fbbf24", // Yellow files
  },
};

// Get colors for a specific theme
export const getThemeColors = (theme: "light" | "dark"): ThemeColors => THEME_CONFIG[theme];
