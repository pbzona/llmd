// Highlights page template generation

import { getHighlightsByDirectory } from "./highlights";
import { baseLayout } from "./template";
import type { Config, MarkdownFile } from "./types";

// Options for highlights page generation
type HighlightsPageOptions = {
  directory: string;
  config: Config;
  files: MarkdownFile[];
  clientScript?: string;
  // biome-ignore lint/suspicious/noExplicitAny: Runtime compatibility layer
  db: any;
};

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
  // biome-ignore lint/style/useAtIndex: Need array access for Node.js compatibility
  const lastPart = parts.length > 0 ? parts[parts.length - 1] : undefined;
  return lastPart ?? path;
};

// Helper: make path relative to directory
const getRelativePath = (absolutePath: string, directory: string): string => {
  if (absolutePath.startsWith(directory)) {
    return absolutePath.slice(directory.length + 1);
  }
  return absolutePath;
};

// Helper: generate highlights content
const generateHighlightsContent = (
  highlights: Array<{
    id: string;
    resourcePath: string;
    startOffset: number;
    endOffset: number;
    highlightedText: string;
    isStale: boolean;
    notes: string | null;
    createdAt: number;
    updatedAt: number;
  }>,
  directory: string
): string => {
  if (highlights.length === 0) {
    return `
      <div style="padding: 60px 20px; text-align: center;">
        <p style="opacity: 0.6; font-size: 16px;">No highlights found in this directory</p>
      </div>
    `;
  }

  const highlightCards = highlights
    .map((h) => {
      const fileName = getFileName(h.resourcePath);
      const relativePath = getRelativePath(h.resourcePath, directory);
      const staleClass = h.isStale ? "highlight-card-stale" : "";
      const staleBadge = h.isStale
        ? '<span style="display: inline-block; padding: 2px 8px; background: rgba(244, 67, 54, 0.2); border: 1px solid rgba(244, 67, 54, 0.4); border-radius: 4px; font-size: 11px; font-weight: 600; color: #f44336; text-transform: uppercase; margin-left: 8px;">Stale</span>'
        : "";

      const staleWarning = h.isStale
        ? `<div style="padding: 12px; background: rgba(244, 67, 54, 0.1); border: 1px solid rgba(244, 67, 54, 0.3); border-radius: 6px; margin-top: 12px; font-size: 13px; line-height: 1.5;">
            <strong style="color: #f44336;">⚠️ This highlight is stale</strong><br>
            The file has been modified since this highlight was created. The text may have moved or been deleted.
            <div style="margin-top: 8px;">
              <button 
                class="restore-btn" 
                data-highlight-id="${h.id}"
                style="padding: 6px 12px; background: var(--accent); color: white; border: none; border-radius: 4px; font-size: 12px; font-weight: 500; cursor: pointer; margin-right: 8px;"
              >
                Restore Original File
              </button>
            </div>
          </div>`
        : "";

      return `
        <div class="highlight-card ${staleClass}" style="padding: 20px; background: var(--code-bg); border: 1px solid var(--border); border-radius: 8px; margin-bottom: 16px; transition: border-color 0.2s;">
          <div style="margin-bottom: 12px;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
              <a href="/view/${relativePath}" style="color: var(--accent); text-decoration: none; font-weight: 600; font-size: 14px;">
                📄 ${fileName}
              </a>
              ${staleBadge}
            </div>
            <div style="opacity: 0.5; font-size: 12px;">
              Created ${formatDate(h.createdAt)}
            </div>
          </div>
          <div style="padding: 16px; background: var(--bg); border-left: 3px solid var(--accent); border-radius: 4px; font-size: 14px; line-height: 1.6;">
            ${h.highlightedText}
          </div>
          ${
            h.notes
              ? `<div style="margin-top: 12px; padding: 12px; background: var(--sidebar-bg); border-radius: 4px; border-left: 3px solid var(--border);">
                  <div style="opacity: 0.6; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px;">Note</div>
                  <div style="font-size: 13px; line-height: 1.5; white-space: pre-wrap;">${h.notes}</div>
                </div>`
              : ""
          }
          ${staleWarning}
          <div style="margin-top: 12px; display: flex; gap: 8px;">
            <button 
              class="delete-highlight-btn" 
              data-highlight-id="${h.id}"
              style="padding: 6px 12px; background: transparent; color: var(--fg); border: 1px solid var(--border); border-radius: 4px; font-size: 12px; font-weight: 500; cursor: pointer; opacity: 0.7; transition: opacity 0.2s;"
            >
              Delete
            </button>
          </div>
        </div>
      `;
    })
    .join("");

  return `
    <div style="padding: 40px; max-width: 900px; margin: 0 auto;">
      <div style="margin-bottom: 32px;">
        <h1 style="font-size: 2rem; font-weight: 700; margin-bottom: 8px;">Highlights</h1>
        <p style="opacity: 0.6; font-size: 14px;">${highlights.length} highlight${highlights.length === 1 ? "" : "s"} in this directory</p>
      </div>

      ${highlightCards}
    </div>
  `;
};

// Public function: generate highlights page
export const generateHighlightsPage = (options: HighlightsPageOptions): string => {
  const { directory, config, files, clientScript, db } = options;

  // Get highlights for directory
  const highlights = getHighlightsByDirectory(db, directory);

  const content = generateHighlightsContent(highlights, directory);

  // Add client-side script for delete and restore buttons
  const highlightsScript = `
    <script>
      // Delete highlight
      document.addEventListener('click', async (e) => {
        const target = e.target;
        if (target.classList.contains('delete-highlight-btn')) {
          const highlightId = target.getAttribute('data-highlight-id');
          if (!confirm('Delete this highlight?')) return;
          
          try {
            const res = await fetch('/api/highlights/' + highlightId, {
              method: 'DELETE'
            });
            
            if (res.ok) {
              location.reload();
            } else {
              alert('Failed to delete highlight');
            }
          } catch (err) {
            console.error('Failed to delete highlight:', err);
            alert('Failed to delete highlight');
          }
        }
      });

      // Restore file
      document.addEventListener('click', async (e) => {
        const target = e.target;
        if (target.classList.contains('restore-btn')) {
          const highlightId = target.getAttribute('data-highlight-id');
          
          const useTimestamp = confirm(
            'How would you like to restore the file?\\n\\n' +
            'OK = Create timestamped copy (safe, keeps current file)\\n' +
            'Cancel = Replace current file (overwrites changes)'
          );
          
          try {
            const res = await fetch('/api/highlights/' + highlightId + '/restore', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ useTimestamp })
            });
            
            if (res.ok) {
              const data = await res.json();
              alert('File restored to: ' + data.restoredPath);
              location.reload();
            } else {
              alert('Failed to restore file');
            }
          } catch (err) {
            console.error('Failed to restore file:', err);
            alert('Failed to restore file');
          }
        }
      });
    </script>
  `;

  return baseLayout({
    content,
    title: "Highlights",
    theme: config.theme,
    files,
    clientScript: (clientScript || "") + highlightsScript,
  });
};
