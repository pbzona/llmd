// Highlights page template generation

import { escapeAttr, escapeHtml } from "./escape";
import { baseLayout } from "./template";
import type { Config, MarkdownFile } from "./types";

// A highlight record as displayed on the highlights page.
export type HighlightView = {
  id: string;
  resourcePath: string;
  exact: string;
  isStale: boolean;
  notes: string | null;
  createdAt: number;
};

// Options for highlights page generation
type HighlightsPageOptions = {
  directory: string;
  config: Config;
  files: MarkdownFile[];
  clientScript?: string;
  highlights: HighlightView[];
};

// Pure function: percent-encode a relative path for a /view/ URL
const encodePath = (path: string): string => path.split("/").map(encodeURIComponent).join("/");

// Helper: format date
const formatDate = (timestamp: number): string => {
  const date = new Date(timestamp);
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

// Helper: extract file name from path
const getFileName = (path: string): string => {
  const parts = path.split("/");
  return parts.at(-1) ?? path;
};

// Helper: make path relative to directory
const getRelativePath = (absolutePath: string, directory: string): string =>
  absolutePath.startsWith(directory) ? absolutePath.slice(directory.length + 1) : absolutePath;

// Helper: render a single highlight card
const renderHighlightCard = (h: HighlightView, directory: string): string => {
  const fileName = escapeHtml(getFileName(h.resourcePath));
  const relativePath = getRelativePath(h.resourcePath, directory);
  const staleClass = h.isStale ? "highlight-card-stale" : "";
  const staleBadge = h.isStale
    ? '<span style="display: inline-block; padding: 2px 8px; background: rgba(244, 67, 54, 0.2); border: 1px solid rgba(244, 67, 54, 0.4); border-radius: 4px; font-size: 11px; font-weight: 600; color: #f44336; text-transform: uppercase; margin-left: 8px;">Stale</span>'
    : "";

  const staleWarning = h.isStale
    ? `<div style="padding: 12px; background: rgba(244, 67, 54, 0.1); border: 1px solid rgba(244, 67, 54, 0.3); border-radius: 6px; margin-top: 12px; font-size: 13px; line-height: 1.5;">
        <strong style="color: #f44336;">This highlight is stale</strong><br>
        The file has changed since this highlight was created, so it is no longer shown inline in the document.
      </div>`
    : "";

  const notesBlock = h.notes
    ? `<div style="margin-top: 12px; padding: 12px; background: var(--sidebar-bg); border-radius: 4px; border-left: 3px solid var(--border);">
        <div style="opacity: 0.6; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px;">Note</div>
        <div style="font-size: 13px; line-height: 1.5; white-space: pre-wrap;">${escapeHtml(h.notes)}</div>
      </div>`
    : "";

  return `
    <div class="highlight-card ${staleClass}" style="padding: 20px; background: var(--code-bg); border: 1px solid var(--border); border-radius: 8px; margin-bottom: 16px; transition: border-color 0.2s;">
      <div style="margin-bottom: 12px;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
          <a href="/view/${escapeAttr(encodePath(relativePath))}" style="color: var(--accent); text-decoration: none; font-weight: 600; font-size: 14px;">
            ${fileName}
          </a>
          ${staleBadge}
        </div>
        <div style="opacity: 0.5; font-size: 12px;">
          Created ${formatDate(h.createdAt)}
        </div>
      </div>
      <div style="padding: 16px; background: var(--bg); border-left: 3px solid var(--accent); border-radius: 4px; font-size: 14px; line-height: 1.6;">
        ${escapeHtml(h.exact)}
      </div>
      ${notesBlock}
      ${staleWarning}
      <div style="margin-top: 12px; display: flex; gap: 8px;">
        <button
          class="delete-highlight-btn"
          data-highlight-id="${escapeAttr(h.id)}"
          style="padding: 6px 12px; background: transparent; color: var(--fg); border: 1px solid var(--border); border-radius: 4px; font-size: 12px; font-weight: 500; cursor: pointer; opacity: 0.7; transition: opacity 0.2s;"
        >
          Delete
        </button>
      </div>
    </div>
  `;
};

// Helper: generate highlights content
const generateHighlightsContent = (highlights: HighlightView[], directory: string): string => {
  if (highlights.length === 0) {
    return `
      <div style="padding: 60px 20px; text-align: center;">
        <p style="opacity: 0.6; font-size: 16px;">No highlights found in this directory</p>
      </div>
    `;
  }

  const cards = highlights.map((h) => renderHighlightCard(h, directory)).join("");

  return `
    <div style="padding: 40px; max-width: 900px; margin: 0 auto;">
      <div style="margin-bottom: 32px;">
        <h1 style="font-size: 2rem; font-weight: 700; margin-bottom: 8px;">Highlights</h1>
        <p style="opacity: 0.6; font-size: 14px;">${highlights.length} highlight${highlights.length === 1 ? "" : "s"} in this directory</p>
      </div>

      ${cards}
    </div>
  `;
};

// Inline delete handler for the highlights page (this page does not load the
// markdown-view client behaviours, so the handler is scoped here).
const DELETE_SCRIPT = `
  <script>
    document.addEventListener('click', async (e) => {
      const target = e.target;
      if (!target.classList.contains('delete-highlight-btn')) return;
      const highlightId = target.getAttribute('data-highlight-id');
      if (!confirm('Delete this highlight?')) return;
      try {
        const res = await fetch('/api/highlights/' + encodeURIComponent(highlightId), { method: 'DELETE' });
        if (res.ok) {
          location.reload();
        } else {
          alert('Failed to delete highlight');
        }
      } catch (err) {
        console.error('Failed to delete highlight:', err);
        alert('Failed to delete highlight');
      }
    });
  </script>
`;

// Public function: generate highlights page
export const generateHighlightsPage = (options: HighlightsPageOptions): string => {
  const { directory, config, files, clientScript, highlights } = options;
  const content = generateHighlightsContent(highlights, directory);

  return baseLayout({
    content,
    title: "Highlights",
    theme: config.theme,
    files,
    clientScript: (clientScript || "") + DELETE_SCRIPT,
  });
};
