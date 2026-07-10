// HTML/script escaping helpers for safe interpolation into templates.
// llmd is a local tool, but rendered documents and filesystem names are
// attacker-influenced (LLM-generated content), so all interpolated values
// must be escaped at the sink.

// Pure function: escape text for use in HTML body content or attributes.
export const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

// Pure function: escape a value for use inside a double-quoted HTML attribute.
export const escapeAttr = (value: string): string => escapeHtml(value);

// Pure function: encode a value for safe embedding inside an inline <script>.
// Produces a quoted JS string literal and neutralizes sequences that could
// break out of the literal or close the script element.
export const scriptValue = (value: string): string =>
  JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
