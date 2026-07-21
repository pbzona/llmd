// HTML template generation

import { escapeAttr, escapeHtml, scriptValue } from "./escape";
import { getTheme, type Theme, type ThemeDesign } from "./theme-config";
import type { Config, MarkdownFile } from "./types";

// Pure function: percent-encode a relative path for use in a /view/ URL,
// preserving "/" separators.
const encodePath = (path: string): string => path.split("/").map(encodeURIComponent).join("/");

// Light/dark dependent CSS values, resolved once per theme instead of via
// inline ternaries throughout the stylesheet.
type UiPalette = {
  c333: string;
  c444: string;
  c555: string;
  scrollbar333: string;
  scrollbar444: string;
  activeText: string;
  adminHover: string;
  adminListHover: string;
  dim: string;
  copyText: string;
  muted: string;
  tocHead: string;
  contrast: string;
  flashEnd: string;
};

const DARK_PALETTE: UiPalette = {
  c333: "#333",
  c444: "#444",
  c555: "#555",
  scrollbar333: "#333 transparent",
  scrollbar444: "#444 transparent",
  activeText: "rgba(0, 0, 0, 0.7)",
  adminHover: "rgba(255, 255, 255, 0.04)",
  adminListHover: "rgba(255, 255, 255, 0.08)",
  dim: "#a0a0a0",
  copyText: "#000000",
  muted: "#c0c0c0",
  tocHead: "#b3b3b3",
  contrast: "#000",
  flashEnd: "rgba(255, 220, 0, 0.25)",
};

const LIGHT_PALETTE: UiPalette = {
  c333: "#ddd",
  c444: "#ccc",
  c555: "#bbb",
  scrollbar333: "#ddd transparent",
  scrollbar444: "#ccc transparent",
  activeText: "rgba(255, 255, 255, 0.7)",
  adminHover: "rgba(0, 0, 0, 0.04)",
  adminListHover: "rgba(0, 0, 0, 0.08)",
  dim: "#666",
  copyText: "#ffffff",
  muted: "#666",
  tocHead: "#666",
  contrast: "#fff",
  flashEnd: "rgba(255, 235, 59, 0.35)",
};

// Pure function: add a cohesive component system while leaving legacy themes untouched.
const getDesignStyles = (design: ThemeDesign | undefined, fonts: Theme["fonts"]): string => {
  switch (design) {
    case "technical":
      return `
    body[data-design="technical"] {
      font-size: 15px;
      line-height: 1.65;
    }

    body[data-design="technical"] .sidebar {
      width: 260px;
    }

    body[data-design="technical"] .sidebar-header {
      padding: 16px;
    }

    body[data-design="technical"] .sidebar-header h1 {
      font-family: ${fonts.code};
      font-size: 0.9375rem;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    body[data-design="technical"] .sidebar-nav {
      gap: 0;
      padding: 8px;
    }

    body[data-design="technical"] .sidebar-nav .dir-group {
      margin: 3px 0;
    }

    body[data-design="technical"] .sidebar-nav .dir-group-header,
    body[data-design="technical"] .sidebar-nav a {
      border-radius: 2px;
      padding: 6px 8px;
    }

    body[data-design="technical"] .sidebar-nav a.active {
      background: color-mix(in srgb, var(--accent) 9%, transparent);
      box-shadow: inset 2px 0 0 var(--accent);
      color: var(--accent);
    }

    body[data-design="technical"] .sidebar-nav a.active svg {
      color: var(--accent);
    }

    body[data-design="technical"] .main {
      padding: 48px clamp(32px, 6vw, 88px);
    }

    body[data-design="technical"] .container {
      max-width: 920px;
    }

    body[data-design="technical"] .file-metadata {
      margin-bottom: 32px;
      padding: 8px 0;
      background: transparent;
      border-width: 0 0 1px;
      border-radius: 0;
    }

    body[data-design="technical"] .file-path {
      color: var(--accent);
      font-size: 0.75rem;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    body[data-design="technical"] .content h1,
    body[data-design="technical"] .content h2,
    body[data-design="technical"] .content h3,
    body[data-design="technical"] .content h4,
    body[data-design="technical"] .content h5,
    body[data-design="technical"] .content h6 {
      font-weight: 700;
      letter-spacing: -0.035em;
    }

    body[data-design="technical"] .content h1 {
      margin-top: 1.5rem;
      font-size: 2.8rem;
    }

    body[data-design="technical"] .content h2 {
      padding-bottom: 0.45rem;
      border-bottom: 1px solid var(--border);
      font-size: 1.8rem;
    }

    body[data-design="technical"] .content h3 {
      font-size: 1.35rem;
    }

    body[data-design="technical"] .content p,
    body[data-design="technical"] .content ul,
    body[data-design="technical"] .content ol {
      max-width: 72ch;
    }

    body[data-design="technical"] .toc {
      margin: 24px 0 40px;
      padding: 12px 0;
      background: transparent;
      border-width: 1px 0;
      border-radius: 0;
    }

    body[data-design="technical"] .content pre {
      padding: 1rem;
      border-radius: 3px;
      box-shadow: inset 0 1px 0 color-mix(in srgb, var(--fg) 5%, transparent);
      font-size: 0.875rem;
    }

    body[data-design="technical"] .content p code {
      border-radius: 2px;
    }

    body[data-design="technical"] .content blockquote {
      border-left-width: 2px;
      font-style: normal;
    }

    body[data-design="technical"] .content table {
      font-size: 0.9rem;
    }

    @media (max-width: 768px) {
      body[data-design="technical"] .content h1 { font-size: 2.25rem; }
    }
  `;
    case "editorial":
      return `
    body[data-design="editorial"] {
      font-size: 18px;
      line-height: 1.82;
    }

    body[data-design="editorial"] .sidebar {
      width: 248px;
    }

    body[data-design="editorial"] .sidebar-header {
      padding: 26px 22px;
    }

    body[data-design="editorial"] .sidebar-header h1 {
      font-family: ${fonts.body};
      font-size: 1.25rem;
      letter-spacing: 0;
    }

    body[data-design="editorial"] .sidebar-nav {
      gap: 0;
      padding: 16px 12px;
    }

    body[data-design="editorial"] .sidebar-nav .dir-group-header,
    body[data-design="editorial"] .sidebar-nav a {
      border-radius: 0;
      padding: 7px 8px;
      font-size: 0.9375rem;
    }

    body[data-design="editorial"] .sidebar-nav a.active {
      background: transparent;
      box-shadow: none;
      color: var(--accent);
    }

    body[data-design="editorial"] .sidebar-nav a.active span {
      text-decoration: underline;
      text-decoration-thickness: 2px;
      text-underline-offset: 4px;
    }

    body[data-design="editorial"] .sidebar-nav a.active svg {
      color: var(--accent);
    }

    body[data-design="editorial"] .main {
      padding: 72px clamp(40px, 8vw, 120px);
    }

    body[data-design="editorial"] .container {
      max-width: 700px;
    }

    body[data-design="editorial"] .file-metadata {
      margin-bottom: 52px;
      padding: 10px 0;
      background: transparent;
      border-width: 1px 0;
      border-radius: 0;
      text-align: center;
    }

    body[data-design="editorial"] .file-path {
      font-size: 0.6875rem;
      letter-spacing: 0.14em;
      text-transform: uppercase;
    }

    body[data-design="editorial"] .content h1,
    body[data-design="editorial"] .content h2,
    body[data-design="editorial"] .content h3,
    body[data-design="editorial"] .content h4,
    body[data-design="editorial"] .content h5,
    body[data-design="editorial"] .content h6 {
      line-height: 1.12;
      font-weight: 600;
      letter-spacing: -0.035em;
    }

    body[data-design="editorial"] .content h1 {
      margin: 1.5rem 0 1.4rem;
      font-size: 3.4rem;
    }

    body[data-design="editorial"] .content h2 {
      margin-top: 3.25rem;
      font-size: 2.25rem;
    }

    body[data-design="editorial"] .content h3 {
      margin-top: 2.5rem;
      font-size: 1.55rem;
    }

    body[data-design="editorial"] .content p,
    body[data-design="editorial"] .content ul,
    body[data-design="editorial"] .content ol {
      max-width: 60ch;
    }

    body[data-design="editorial"] .content p {
      margin: 1.5rem 0;
    }

    body[data-design="editorial"] .toc {
      margin: 32px 0 52px;
      padding: 18px 0;
      background: transparent;
      border-width: 1px 0;
      border-radius: 0;
    }

    body[data-design="editorial"] .toc h3 {
      font-family: ${fonts.heading};
    }

    body[data-design="editorial"] .content pre {
      margin: 2.25rem 0;
      padding: 1.5rem;
      border-radius: 0;
      border-left: 4px solid var(--accent);
      box-shadow: 6px 6px 0 color-mix(in srgb, var(--border) 38%, transparent);
      font-size: 0.8125rem;
    }

    body[data-design="editorial"] .content p code {
      border-radius: 0;
    }

    body[data-design="editorial"] .content blockquote {
      margin: 2.25rem 0;
      padding: 1.25rem 0;
      border-width: 1px 0;
      border-style: solid;
      border-color: var(--border);
      font-size: 1.08em;
    }

    body[data-design="editorial"] .content th {
      font-family: ${fonts.heading};
      font-size: 0.8rem;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }

    body[data-design="editorial"] .content img {
      border-radius: 0;
    }

    @media (max-width: 768px) {
      body[data-design="editorial"] { font-size: 17px; }
      body[data-design="editorial"] .file-metadata { margin-bottom: 36px; }
      body[data-design="editorial"] .content h1 { font-size: 2.65rem; }
    }
  `;
    case "cozy":
      return `
    body[data-design="cozy"] {
      font-size: 17px;
      line-height: 1.78;
    }

    body[data-design="cozy"] .sidebar {
      width: 300px;
    }

    body[data-design="cozy"] .sidebar-header {
      padding: 24px;
    }

    body[data-design="cozy"] .sidebar-header h1 {
      font-family: ${fonts.heading};
      font-size: 1.25rem;
      letter-spacing: -0.02em;
    }

    body[data-design="cozy"] .sidebar-nav {
      gap: 4px;
      padding: 16px 12px;
    }

    body[data-design="cozy"] .sidebar-nav .dir-group-header,
    body[data-design="cozy"] .sidebar-nav a {
      border-radius: 999px;
      padding: 9px 12px;
    }

    body[data-design="cozy"] .sidebar-nav a.active {
      box-shadow: 0 7px 20px color-mix(in srgb, var(--accent) 20%, transparent);
    }

    body[data-design="cozy"] .main {
      padding: 56px clamp(36px, 7vw, 100px);
      background: radial-gradient(
        circle at 80% 0%,
        color-mix(in srgb, var(--accent) 5%, transparent),
        transparent 34rem
      );
    }

    body[data-design="cozy"] .container {
      max-width: 780px;
    }

    body[data-design="cozy"] .file-metadata {
      margin-bottom: 40px;
      padding: 12px 16px;
      border-radius: 14px;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.12);
    }

    body[data-design="cozy"] .content h1,
    body[data-design="cozy"] .content h2,
    body[data-design="cozy"] .content h3,
    body[data-design="cozy"] .content h4,
    body[data-design="cozy"] .content h5,
    body[data-design="cozy"] .content h6 {
      line-height: 1.16;
      letter-spacing: -0.03em;
    }

    body[data-design="cozy"] .content h1 {
      margin: 1.75rem 0 1.25rem;
      font-size: 3.1rem;
    }

    body[data-design="cozy"] .content h2 {
      margin-top: 2.75rem;
      font-size: 2.2rem;
    }

    body[data-design="cozy"] .content h3 {
      margin-top: 2.25rem;
      font-size: 1.55rem;
    }

    body[data-design="cozy"] .content p,
    body[data-design="cozy"] .content ul,
    body[data-design="cozy"] .content ol {
      max-width: 64ch;
    }

    body[data-design="cozy"] .toc {
      margin: 28px 0 44px;
      padding: 20px 24px;
      border-radius: 16px;
      box-shadow: 0 12px 32px rgba(0, 0, 0, 0.14);
    }

    body[data-design="cozy"] .content pre {
      margin: 2rem 0;
      padding: 1.5rem;
      border-radius: 14px;
      box-shadow: 0 14px 36px rgba(0, 0, 0, 0.16);
    }

    body[data-design="cozy"] .content p code {
      border-radius: 6px;
    }

    body[data-design="cozy"] .content blockquote {
      margin: 2rem 0;
      padding: 1rem 1.25rem;
      background: var(--sidebar-bg);
      border-left-width: 3px;
      border-radius: 0 12px 12px 0;
      font-style: normal;
    }

    body[data-design="cozy"] .content img {
      border-radius: 16px;
    }

    @media (max-width: 768px) {
      body[data-design="cozy"] { font-size: 16px; }
      body[data-design="cozy"] .content h1 { font-size: 2.5rem; }
    }
  `;
    default:
      return "";
  }
};

// Pure function: generate embedded CSS
const getStyles = (themeName: string): string => {
  const theme = getTheme(themeName);
  const colors = theme.colors;
  const fontFamilies = theme.fonts;
  // Determine if theme is dark based on background brightness
  const isDark = Number.parseInt(colors.bg.replace("#", ""), 16) < 0x80_80_80;
  const p = isDark ? DARK_PALETTE : LIGHT_PALETTE;

  return `
    
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    :root {
      --bg: ${colors.bg};
      --fg: ${colors.fg};
      --border: ${colors.border};
      --hover: ${colors.hover};
      --accent: ${colors.accent};
      --code-bg: ${colors.codeBg};
      --sidebar-bg: ${colors.sidebarBg};
      --highlight-bg: ${colors.highlightBg};
      --highlight-stale-bg: ${colors.highlightStaleBg};
      --heading-color: ${colors.headingColor || colors.fg};
    }
    
    body {
      font-family: ${fontFamilies.body};
      font-size: 16px;
      line-height: 1.7;
      color: var(--fg);
      background: var(--bg);
      display: flex;
      min-height: 100vh;
      position: relative;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }
    
    .sidebar {
      width: 280px;
      background: var(--sidebar-bg);
      border-right: 1px solid var(--border);
      overflow-y: auto;
      flex-shrink: 0;
      position: relative;
    }
    
    .sidebar::-webkit-scrollbar {
      width: 8px;
    }
    
    .sidebar::-webkit-scrollbar-track {
      background: transparent;
    }
    
    .sidebar::-webkit-scrollbar-thumb {
      background: ${p.c333};
      border-radius: 4px;
    }
    
    .sidebar::-webkit-scrollbar-thumb:hover {
      background: ${p.c444};
    }
    
    .sidebar {
      scrollbar-width: thin;
      scrollbar-color: ${p.scrollbar333};
    }
    
    .sidebar-resize-handle {
      position: absolute;
      top: 0;
      right: 0;
      width: 4px;
      height: 100%;
      cursor: ew-resize;
      background: transparent;
      transition: background 0.2s;
    }
    
    .sidebar-resize-handle:hover {
      background: var(--accent);
    }
    
    .sidebar-header {
      padding: 20px;
      border-bottom: 1px solid var(--border);
    }
    
    .sidebar-header h1 {
      font-size: 1.25rem;
      font-weight: 700;
      letter-spacing: -0.01em;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    .sidebar-header h1 svg {
      width: 20px;
      height: 20px;
      flex-shrink: 0;
    }
    
    .sidebar-nav {
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .sidebar-nav ul {
      list-style: none;
    }

    .sidebar-nav li {
      margin: 2px 0;
    }

    /* Directory group styles */
    .sidebar-nav .dir-group {
      margin: 6px 0;
    }

    .sidebar-nav .dir-group.collapsed > .dir-group-content {
      display: none;
    }

    .sidebar-nav .dir-group-header {
      padding: 7px 8px 7px 6px;
      font-size: 0.9375rem;
      font-weight: 600;
      color: var(--fg);
      text-transform: none;
      display: flex;
      align-items: center;
      gap: 8px;
      letter-spacing: 0.01em;
      border-radius: 6px;
      transition: background 0.15s;
      cursor: pointer;
      user-select: none;
    }

    .sidebar-nav .dir-group-header:hover {
      background: var(--hover);
    }

    .sidebar-nav .dir-group-content {
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding-top: 2px;
    }

    .dir-chevron {
      display: inline-flex;
      transition: transform 0.2s;
      flex-shrink: 0;
      opacity: 0.6;
    }

    .dir-group.collapsed .dir-chevron {
      transform: rotate(-90deg);
    }

    .dir-chevron svg {
      width: 16px;
      height: 16px;
    }

    .sidebar-nav .dir-group-header span,
    .sidebar-nav a span {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .sidebar-nav .dir-group-header svg {
      width: 18px;
      height: 18px;
      flex-shrink: 0;
      color: ${colors.folderIcon};
      stroke: currentColor;
    }
    
    .sidebar-nav a {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 7px 8px 7px 6px;
      color: var(--fg);
      text-decoration: none;
      border-radius: 6px;
      font-size: 0.9375rem;
      transition: background 0.15s;
      line-height: 1.4;
    }

    .sidebar-nav a svg {
      width: 18px;
      height: 18px;
      flex-shrink: 0;
      color: ${colors.fileIcon};
      stroke: currentColor;
    }

    .sidebar-nav a:hover {
      background: var(--hover);
    }

    .sidebar-nav a.active {
      background: var(--accent);
      color: ${p.activeText};
      font-weight: 600;
    }
    
    /* Admin Section */
    .admin-header:hover {
      background: ${p.adminHover};
    }
    
    .admin-section.collapsed .admin-list {
      max-height: 0;
      overflow: hidden;
      margin: 0;
      opacity: 0;
    }
    
    .admin-section.collapsed .admin-toggle {
      transform: rotate(-90deg);
    }
    
    .admin-list a:hover {
      background: ${p.adminListHover};
    }
    
    .main {
      flex: 1;
      overflow-y: auto;
      padding: 40px;
    }
    
    .container {
      max-width: 800px;
      margin: 0 auto;
    }

    .file-metadata {
      margin-bottom: 24px;
      padding: 10px 14px;
      background: var(--sidebar-bg);
      border: 1px solid var(--border);
      border-radius: 6px;
    }

    .file-path {
      font-family: ${fontFamilies.code};
      font-size: 0.8125rem;
      color: ${p.dim};
      opacity: 0.85;
    }

    .content h1, .content h2, .content h3, .content h4, .content h5, .content h6 {
      font-family: ${fontFamilies.heading};
      font-weight: 700;
      line-height: 1.3;
      letter-spacing: -0.02em;
      color: var(--heading-color);
    }
    
    .content h1 { 
      font-size: 2.5rem;
      margin: 2.5rem 0 1rem;
      font-weight: 800;
    }
    .content h2 { 
      font-size: 2rem;
      margin: 2rem 0 0.875rem;
    }
    .content h3 { 
      font-size: 1.5rem;
      margin: 1.75rem 0 0.75rem;
    }
    .content h4 { 
      font-size: 1.25rem;
      margin: 1.5rem 0 0.625rem;
    }
    .content h5 { 
      font-size: 1.125rem;
      margin: 1.25rem 0 0.5rem;
    }
    .content h6 { 
      font-size: 1rem;
      margin: 1rem 0 0.5rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    
    .content p { 
      margin: 1.25rem 0;
      max-width: 65ch;
    }
    .content ul, .content ol { 
      margin: 1.25rem 0;
      padding-left: 1.75rem;
      max-width: 65ch;
    }
    .content li { 
      margin: 0.35rem 0;
      line-height: 1.6;
    }
    
    .content a {
      color: var(--accent);
      text-decoration: none;
    }
    
    .content a:hover {
      text-decoration: underline;
    }
    
    .content pre {
      background: var(--code-bg);
      padding: 1.25rem;
      border-radius: 0.5rem;
      overflow-x: auto;
      margin: 1.5rem 0;
      border: 1px solid var(--border);
      position: relative;
      line-height: 1.6;
      font-size: 0.9375rem;
    }
    
    .copy-button {
      position: absolute;
      top: 8px;
      right: 8px;
      padding: 4px 12px;
      font-size: 12px;
      background: var(--accent);
      color: ${p.copyText};
      border: none;
      border-radius: 4px;
      cursor: pointer;
      opacity: 0;
      transition: opacity 0.2s;
      font-weight: 600;
    }
    
    .content pre:hover .copy-button {
      opacity: 1;
    }
    
    .copy-button:hover {
      opacity: 1 !important;
      filter: brightness(1.1);
    }
    
    .copy-button.copied {
      background: #22c55e;
    }
    
    .content code {
      font-family: ${fontFamilies.code};
      font-size: 0.875em;
      font-variant-ligatures: none;
    }
    
    .content p code {
      background: var(--code-bg);
      padding: 0.125rem 0.375rem;
      border-radius: 0.25rem;
      font-size: 0.875em;
      border: 1px solid var(--border);
    }
    
    .content blockquote {
      border-left: 4px solid var(--accent);
      padding-left: 1.25rem;
      margin: 1.5rem 0;
      color: ${p.muted};
      font-style: italic;
      max-width: 65ch;
    }
    
    .content blockquote p {
      margin: 0.75rem 0;
    }
    
    .content table {
      border-collapse: collapse;
      width: 100%;
      margin: 16px 0;
    }
    
    .content th, .content td {
      border: 1px solid var(--border);
      padding: 10px 14px;
      text-align: left;
    }
    
    .content th {
      background: var(--sidebar-bg);
      font-weight: 600;
    }
    
    .content img {
      max-width: 100%;
      height: auto;
      border-radius: 8px;
      margin: 16px 0;
    }
    
    .toc {
      background: var(--sidebar-bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 16px 20px;
      margin: 24px 0;
      overflow: hidden;
    }
    
    .toc ul {
      max-height: 400px;
      overflow-y: auto;
      opacity: 1;
      transition: max-height 0.3s ease-out, opacity 0.2s ease-out, margin 0.2s;
      margin: 0 -16px 0 0;
      padding: 0 16px 0 0;
    }
    
    .toc ul::-webkit-scrollbar {
      width: 6px;
    }
    
    .toc ul::-webkit-scrollbar-track {
      background: transparent;
    }
    
    .toc ul::-webkit-scrollbar-thumb {
      background: ${p.c444};
      border-radius: 3px;
    }
    
    .toc ul::-webkit-scrollbar-thumb:hover {
      background: ${p.c555};
    }
    
    .toc ul {
      scrollbar-width: thin;
      scrollbar-color: ${p.scrollbar444};
    }
    
    .toc.collapsed ul {
      max-height: 0;
      opacity: 0;
      overflow: hidden;
    }
    
    .toc h3 {
      font-size: 0.875rem;
      margin: 0 0 12px 0;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      font-weight: 700;
      color: ${p.tocHead};
      display: flex;
      align-items: center;
      gap: 6px;
      transition: margin 0.2s;
    }
    
    .toc.collapsed h3 {
      margin-bottom: 0;
    }
    
    .toc-chevron {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      transition: transform 0.2s;
      opacity: 0.6;
      transform-origin: center center;
    }
    
    .toc.collapsed .toc-chevron {
      transform: rotate(-90deg);
    }
    
    .toc-chevron svg {
      width: 16px;
      height: 16px;
      display: block;
    }
    
    .toc ul {
      list-style: none;
      padding-left: 0;
    }
    
    .toc li {
      margin: 6px 0;
    }
    
    .toc a {
      color: var(--fg);
      text-decoration: none;
    }
    
    .toc a:hover {
      color: var(--accent);
    }
    
    .toc .toc-level-1 { padding-left: 0; }
    .toc .toc-level-2 { padding-left: 16px; }
    .toc .toc-level-3 { padding-left: 32px; }
    .toc .toc-level-4 { padding-left: 48px; }
    
    .error {
      padding: 60px 20px;
      text-align: center;
    }
    
    .error h1 {
      font-size: 48px;
      margin-bottom: 16px;
    }
    
    .error p {
      font-size: 18px;
      color: ${p.muted};
    }
    
    /* Highlights */
    .llmd-highlight {
      background: color-mix(in srgb, var(--highlight-bg) 100%, transparent);
      border-bottom: 2px solid color-mix(in srgb, var(--highlight-bg) 60%, ${p.contrast});
      cursor: pointer;
      transition: background 0.2s;
    }
    
    .llmd-highlight:hover {
      background: color-mix(in srgb, var(--highlight-bg) 35%, transparent);
    }
    
    .llmd-highlight-stale {
      background: color-mix(in srgb, var(--highlight-stale-bg) 20%, transparent);
      border-bottom: 2px solid color-mix(in srgb, var(--highlight-stale-bg) 60%, ${p.contrast});
      border-style: dashed;
    }
    
    .highlight-popup {
      position: absolute;
      z-index: 1000;
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: 6px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      padding: 12px;
      display: none;
      min-width: 300px;
    }
    
    .highlight-create-btn {
      background: var(--accent);
      color: white;
      border: none;
      padding: 8px 16px;
      border-radius: 4px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      white-space: nowrap;
      transition: opacity 0.2s;
    }
    
    .highlight-create-btn:hover {
      opacity: 0.9;
    }
    
    .highlight-create-btn:active {
      transform: translateY(1px);
    }
    
    /* Highlight flash animation for scroll-to */
    @keyframes highlight-flash {
      0% { background: var(--accent); }
      100% { background: ${p.flashEnd}; }
    }
    
    .highlight-flash {
      animation: highlight-flash 1s ease-out;
    }

    ${getDesignStyles(theme.design, fontFamilies)}

    @media (max-width: 768px) {
      body { flex-direction: column; }
      .sidebar { width: 100%; border-right: none; border-bottom: 1px solid var(--border); }
      .main { padding: 20px; }
      body[data-design] .sidebar { width: 100%; }
      body[data-design] .main { padding: 20px; }
    }
  `;
};

// Type for flat directory grouping
type DirectoryGroup = {
  directoryPath: string; // e.g., "docs" or "" for root
  directoryName: string; // e.g., "docs" or displayed name for root
  files: MarkdownFile[];
};

// Pure function: group files by their immediate parent directory
const groupFilesByDirectory = (files: MarkdownFile[]): DirectoryGroup[] => {
  const groupMap = new Map<string, MarkdownFile[]>();

  // Group files by their immediate parent directory
  for (const file of files) {
    const lastSlashIndex = file.path.lastIndexOf("/");
    const parentDir = lastSlashIndex === -1 ? "" : file.path.slice(0, lastSlashIndex);

    if (!groupMap.has(parentDir)) {
      groupMap.set(parentDir, []);
    }
    groupMap.get(parentDir)?.push(file);
  }

  // Convert map to array of DirectoryGroup objects
  const groups: DirectoryGroup[] = [];
  for (const [dirPath, dirFiles] of groupMap.entries()) {
    // Sort files alphabetically within each group
    const sortedFiles = [...dirFiles].sort((a, b) => a.name.localeCompare(b.name));

    // Extract directory name from full path (up to 2 levels)
    let dirName = "";
    if (dirPath !== "") {
      const segments = dirPath.split("/");
      dirName = segments.slice(-2).join("/");
    }

    groups.push({
      directoryPath: dirPath,
      directoryName: dirName,
      files: sortedFiles,
    });
  }

  // Sort groups: root first, then alphabetically by path
  groups.sort((a, b) => {
    if (a.directoryPath === "") {
      return -1;
    }
    if (b.directoryPath === "") {
      return 1;
    }
    return a.directoryPath.localeCompare(b.directoryPath);
  });

  return groups;
};

// SVG icons (from Lucide, MIT licensed)
const FOLDER_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/></svg>`;

const FILE_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z"/><path d="M14 2v5a1 1 0 0 0 1 1h5"/></svg>`;

const ANALYTICS_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="M18 17l-4-4-4 4-4-4"/></svg>`;

const HIGHLIGHTS_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 11-6 6v3h9l3-3"/><path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4"/></svg>`;

const CHEVRON_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>`;

// Pure function: render a single file navigation link
const renderFileLink = (
  file: MarkdownFile,
  currentPath: string | undefined,
  indent: string
): string => {
  const activeClass = currentPath === file.path ? "active" : "";
  return `${indent}<a href="/view/${encodePath(file.path)}" class="nav-link-file ${activeClass}" data-file-path="${escapeAttr(file.path)}">${FILE_ICON}<span>${escapeHtml(file.name)}</span></a>\n`;
};

// Pure function: render a collapsible directory group with its files
const renderDirectoryGroup = (group: DirectoryGroup, currentPath?: string): string => {
  const files = group.files.map((file) => renderFileLink(file, currentPath, "    ")).join("");
  return `<div class="dir-group" data-dir-path="${escapeAttr(group.directoryPath)}">
  <div class="dir-group-header">
    <span class="dir-chevron">${CHEVRON_ICON}</span>
    ${FOLDER_ICON}
    <span>${escapeHtml(group.directoryName)}</span>
  </div>
  <div class="dir-group-content">
${files}  </div>
</div>
`;
};

// Pure function: render flat sidebar with directory groups
const renderFlatSidebar = (groups: DirectoryGroup[], currentPath?: string): string =>
  groups
    .map((group) =>
      group.directoryPath === ""
        ? group.files.map((file) => renderFileLink(file, currentPath, "")).join("")
        : renderDirectoryGroup(group, currentPath)
    )
    .join("");

// Pure function: generate admin section (collapsible)
const generateAdminSection = (): string => `
  <div class="admin-section" style="padding: 12px 12px 8px 12px; border-bottom: 1px solid var(--border);">
    <div class="admin-header" style="display: flex; align-items: center; justify-content: space-between; cursor: pointer; padding: 4px 6px; border-radius: 6px; transition: background 0.15s; user-select: none;">
      <div style="font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 700; opacity: 0.5;">
        Admin
      </div>
      <svg class="admin-toggle" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="opacity: 0.5; transition: transform 0.2s;">
        <polyline points="6 9 12 15 18 9"></polyline>
      </svg>
    </div>
    <ul class="admin-list" style="list-style: none; padding: 0; margin: 8px 0 0 0; transition: all 0.2s;">
      <li>
        <a href="/analytics" class="depth-0" style="display: flex; align-items: center; gap: 8px; padding: 7px 8px 7px 6px; color: var(--fg); text-decoration: none; border-radius: 6px; font-size: 0.9375rem; transition: background 0.15s;">
          ${ANALYTICS_ICON}
          <span>Analytics</span>
        </a>
      </li>
      <li>
        <a href="/highlights" class="depth-0" style="display: flex; align-items: center; gap: 8px; padding: 7px 8px 7px 6px; color: var(--fg); text-decoration: none; border-radius: 6px; font-size: 0.9375rem; transition: background 0.15s;">
          ${HIGHLIGHTS_ICON}
          <span>Highlights</span>
        </a>
      </li>
    </ul>
  </div>
`;

// Pure function: generate file tree sidebar HTML
const generateSidebar = (files: MarkdownFile[], currentPath?: string): string => {
  const adminSection = generateAdminSection();

  if (files.length === 0) {
    return `<div class="sidebar-nav">
      ${adminSection}
      <p style="padding: 12px; color: #b3b3b3;">No markdown files found</p>
    </div>`;
  }

  const groups = groupFilesByDirectory(files);
  const items = renderFlatSidebar(groups, currentPath);

  return `<nav class="sidebar-nav">
    ${adminSection}
    ${items}
  </nav>`;
};

// Pure function: generate font import link tag for Google Fonts
const generateFontImport = (themeName: string): string => {
  const theme = getTheme(themeName);
  const googleFontsUrl = theme.fonts.googleFontsUrl;

  if (!googleFontsUrl) {
    return ""; // System fonts only
  }

  return `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="${googleFontsUrl}" rel="stylesheet">`;
};

// Options for base layout
type LayoutOptions = {
  content: string;
  title: string;
  theme: string; // Theme name (built-in or custom, includes colors + fonts)
  files: MarkdownFile[];
  currentPath?: string;
  clientScript?: string;
  watchEnabled?: boolean;
  watchFile?: string;
};

// Pure function: base HTML layout (exported for analytics template)
export const baseLayout = (options: LayoutOptions): string => {
  const { content, title, theme, files, currentPath, clientScript, watchEnabled, watchFile } =
    options;

  const watchAttr = watchEnabled && watchFile ? ` data-watch-file="${escapeAttr(watchFile)}"` : "";

  const fontImport = generateFontImport(theme);
  const themeConfig = getTheme(theme);
  const designAttr = themeConfig.design ? ` data-design="${escapeAttr(themeConfig.design)}"` : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)} - llmd</title>
  <link rel="icon" type="image/svg+xml" href="/_favicon">
  ${fontImport}
  <style>${getStyles(theme)}</style>
</head>
<body${watchAttr}${designAttr}>
  <aside class="sidebar">
    <div class="sidebar-header">
      <h1>
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
          <defs>
            <linearGradient id="logoGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" style="stop-color:#60a5fa;stop-opacity:1" />
              <stop offset="100%" style="stop-color:#2563eb;stop-opacity:1" />
            </linearGradient>
          </defs>
          <path d="M16 6 L16 20 M16 20 L10 14 M16 20 L22 14" 
                stroke="url(#logoGrad)" 
                stroke-width="3" 
                stroke-linecap="round" 
                stroke-linejoin="round" 
                fill="none"/>
        </svg>
        llmd
      </h1>
    </div>
    ${generateSidebar(files, currentPath)}
  </aside>
  <main class="main">
    <div class="container">
      ${content}
    </div>
  </main>
  ${clientScript || ""}
</body>
</html>`;
};

// Public function: generate directory index page
export const generateIndexPage = (
  files: MarkdownFile[],
  config: Config,
  clientScript?: string
): string => {
  const asciiArt = `<pre style="font-family: monospace; font-size: 14px; line-height: 1.4; margin: 0 0 32px 0; white-space: pre;"><span style="color: #60a5fa;">dP dP                  dP</span>
<span style="color: #60a5fa;">88 88                  88</span>
<span style="color: #3b82f6;">88 88 88d8b.d8b. .d888b88</span>
<span style="color: #3b82f6;">88 88 88'\`88'\`88 88'  \`88</span>
<span style="color: #2563eb;">88 88 88  88  88 88.  .88</span>
<span style="color: #1d4ed8;">dP dP dP  dP  dP \`88888P8</span></pre>`;

  // Get top 3-4 files from root directory (depth 0)
  const rootFiles = files.filter((f) => f.depth === 0).slice(0, 4);
  const isDark = config.theme === "dark";
  const fileList =
    rootFiles.length > 0
      ? `<div style="margin-top: 24px; text-align: left; display: inline-block;">
         <ul style="list-style: none; padding: 0; margin: 0; font-size: 13px;">
           ${rootFiles
             .map(
               (f) => `<li style="margin: 6px 0;">
             <a href="/view/${encodePath(f.path)}" style="color: ${isDark ? "#a0a0a0" : "#666"}; text-decoration: none; display: flex; align-items: center; gap: 6px; transition: color 0.15s;">
               <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="opacity: 0.6;">
                 <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                 <polyline points="14 2 14 8 20 8"></polyline>
               </svg>
               ${escapeHtml(f.name)}
             </a>
           </li>`
             )
             .join("")}
         </ul>
       </div>`
      : "";

  const content =
    files.length > 0
      ? `<div style="display: flex; align-items: center; justify-content: center; min-height: 100%; padding: 80px 40px 40px 40px;">
         <div style="text-align: center;">
           ${asciiArt}
           <p style="color: var(--fg); opacity: 0.5; font-size: 13px; margin: 0;">
             ${files.length} file${files.length === 1 ? "" : "s"}
           </p>
           ${fileList}
         </div>
       </div>`
      : `<div style="display: flex; align-items: center; justify-content: center; min-height: 100%; padding: 80px 40px 40px 40px;">
         <div style="text-align: center;">
           ${asciiArt}
           <p style="color: var(--fg); opacity: 0.5; font-size: 13px; margin: 0;">
             No markdown files found
           </p>
         </div>
       </div>`;

  // Add event tracking script
  const trackingScript = `<script>window.addEventListener('load', () => window.trackDirectoryOpen?.(${scriptValue(config.directory)}));</script>`;

  return baseLayout({
    content,
    title: "Home",
    theme: config.theme,
    files,
    clientScript: (clientScript || "") + trackingScript,
  });
};

// Options for markdown page generation
type MarkdownPageOptions = {
  html: string;
  toc: string;
  fileName: string;
  files: MarkdownFile[];
  config: Config;
  currentPath: string;
  clientScript?: string;
};

// Public function: generate markdown view page
export const generateMarkdownPage = (options: MarkdownPageOptions): string => {
  const { html, toc, fileName, files, config, currentPath, clientScript } = options;
  const content = `<div class="file-metadata">
    <span class="file-path">${escapeHtml(currentPath)}</span>
  </div>
  <div class="content">
    ${toc}
    <div class="markdown-body">
    ${html}
    </div>
  </div>`;

  // Add event tracking script (send absolute path)
  const absolutePath = `${config.directory}/${currentPath}`;
  const trackingScript = `<script>window.addEventListener('load', () => window.trackFileView?.(${scriptValue(absolutePath)}));</script>`;

  return baseLayout({
    content,
    title: fileName,
    theme: config.theme,
    files,
    currentPath,
    clientScript: (clientScript || "") + trackingScript,
    watchEnabled: config.watch,
    watchFile: currentPath,
  });
};

// Options for error page generation
type ErrorPageOptions = {
  errorCode: number;
  message: string;
  files: MarkdownFile[];
  config: Config;
  clientScript?: string;
};

// Public function: generate error page
export const generateErrorPage = (options: ErrorPageOptions): string => {
  const { errorCode, message, files, config, clientScript } = options;
  const content = `<div class="error">
    <h1>${errorCode}</h1>
    <p>${escapeHtml(message)}</p>
  </div>`;

  return baseLayout({
    content,
    title: `Error ${errorCode}`,
    theme: config.theme,
    files,
    clientScript,
  });
};
