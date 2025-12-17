// Syntax highlighting with Shiki (functional style)

import { type BundledLanguage, codeToHtml } from "shiki";

// Pure function: detect language from code fence or auto-detect
const detectLanguage = (lang: string | undefined): BundledLanguage | "plaintext" => {
  if (!lang) {
    return "plaintext";
  }

  // Normalize common aliases
  const langLower = lang.toLowerCase();
  const aliases: Record<string, BundledLanguage> = {
    js: "javascript",
    ts: "typescript",
    py: "python",
    sh: "bash",
    yml: "yaml",
    rs: "rust",
    rb: "ruby",
    cs: "csharp",
    "c++": "cpp",
  };

  const normalized = aliases[langLower] || langLower;

  // Common languages we want to support
  const validLangs: BundledLanguage[] = [
    "javascript",
    "typescript",
    "jsx",
    "tsx",
    "json",
    "html",
    "css",
    "scss",
    "python",
    "rust",
    "go",
    "java",
    "c",
    "cpp",
    "csharp",
    "php",
    "ruby",
    "swift",
    "kotlin",
    "bash",
    "shell",
    "sql",
    "yaml",
    "toml",
    "markdown",
    "xml",
    "dockerfile",
  ];

  return validLangs.includes(normalized as BundledLanguage)
    ? (normalized as BundledLanguage)
    : "plaintext";
};

// Pure function: highlight code with Shiki
export const highlightCode = async (
  code: string,
  lang: string | undefined,
  theme: "light" | "dark"
): Promise<string> => {
  try {
    const language = detectLanguage(lang);
    const shikiTheme = theme === "light" ? "github-light" : "github-dark";

    // Use Shiki's codeToHtml directly
    const html = await codeToHtml(code, {
      lang: language,
      theme: shikiTheme,
    });

    return html;
  } catch (error) {
    console.error("Syntax highlighting failed:", error);
    // Fallback to plain text
    const escaped = code.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    return `<pre><code>${escaped}</code></pre>`;
  }
};
