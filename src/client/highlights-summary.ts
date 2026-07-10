// Client-side highlights summary for markdown pages

import { scrollToHighlight } from "./highlight-renderer";

type SummaryHighlight = {
  id: string;
  highlightedText: string;
  isStale: boolean;
  notes: string | null;
  createdAt: number;
};

// Helper: format date
const formatDate = (timestamp: number): string => {
  const date = new Date(timestamp);
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

// Pure function: truncate text to max length
const truncateText = (text: string, maxLength: number): string =>
  text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;

// Build one summary list item using textContent (no HTML injection).
const buildSummaryItem = (h: SummaryHighlight): HTMLLIElement => {
  const li = document.createElement("li");
  li.className = "highlight-summary-item";
  li.dataset.highlightId = h.id;
  li.style.cssText =
    "margin: 8px 0; padding: 8px; background: var(--bg); border-radius: 4px; border-left: 3px solid var(--accent); cursor: pointer; transition: background 0.2s;";
  li.addEventListener("mouseover", () => {
    li.style.background = "var(--hover)";
  });
  li.addEventListener("mouseout", () => {
    li.style.background = "var(--bg)";
  });
  li.addEventListener("click", () => scrollToHighlight(h.id));

  const preview = document.createElement("div");
  if (h.isStale) {
    preview.style.cssText = "text-decoration: line-through; opacity: 0.5;";
  }
  preview.textContent = truncateText(h.highlightedText, 80);
  li.appendChild(preview);

  if (h.notes) {
    const note = document.createElement("div");
    note.style.cssText =
      "margin-top: 4px; padding: 6px; background: var(--sidebar-bg); border-radius: 3px; font-size: 11px; opacity: 0.8;";
    note.textContent = `Note: ${truncateText(h.notes, 60)}`;
    li.appendChild(note);
  }

  const meta = document.createElement("div");
  meta.style.cssText = "opacity: 0.5; font-size: 12px; margin-top: 4px;";
  meta.textContent = h.isStale ? `${formatDate(h.createdAt)} (stale)` : formatDate(h.createdAt);
  li.appendChild(meta);

  return li;
};

// Build the summary container for the given highlights.
const buildSummary = (highlights: SummaryHighlight[]): HTMLElement => {
  const summary = document.createElement("div");
  summary.className = "highlights-summary";

  const box = document.createElement("div");
  box.style.cssText =
    "background: var(--code-bg); border: 1px solid var(--border); border-radius: 8px; padding: 16px 20px; margin: 24px 0;";

  const heading = document.createElement("h3");
  heading.style.cssText =
    "font-size: 0.875rem; margin: 0 0 12px 0; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 700; opacity: 0.8;";
  heading.textContent = `Highlights (${highlights.length})`;
  box.appendChild(heading);

  const list = document.createElement("ul");
  list.style.cssText = "list-style: none; padding: 0; margin: 0; font-size: 14px;";
  for (const h of highlights) {
    list.appendChild(buildSummaryItem(h));
  }
  box.appendChild(list);

  const footer = document.createElement("div");
  footer.style.cssText =
    "margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--border);";
  const link = document.createElement("a");
  link.href = "/highlights";
  link.style.cssText =
    "color: var(--accent); text-decoration: none; font-size: 13px; font-weight: 500;";
  link.textContent = "View all highlights";
  footer.appendChild(link);
  box.appendChild(footer);

  summary.appendChild(box);
  return summary;
};

// Initialize highlights summary
export const initHighlightsSummary = (): void => {
  const contentArea = document.querySelector(".content");
  if (!contentArea) {
    return;
  }

  const pathname = window.location.pathname;
  if (!pathname.startsWith("/view/")) {
    return;
  }

  const filePath = pathname.slice(6); // Remove "/view/"

  fetch(`/api/highlights/resource?path=${encodeURIComponent(filePath)}`)
    .then((res) => res.json())
    .then((data) => {
      const highlights: SummaryHighlight[] = data.highlights || [];
      if (highlights.length === 0) {
        return;
      }

      const summary = buildSummary(highlights);

      // Insert summary before the first heading or at the start of content.
      const firstHeading = contentArea.querySelector("h1, h2");
      if (firstHeading) {
        firstHeading.parentNode?.insertBefore(summary, firstHeading);
      } else {
        contentArea.insertBefore(summary, contentArea.firstChild);
      }
    })
    .catch((err) => {
      console.error("Failed to load highlights summary:", err);
    });
};
