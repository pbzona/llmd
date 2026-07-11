// Client-side highlights: selection -> anchor creation, and fetch -> paint.

import { buildAnchor } from "../anchor";
import {
  canonicalOffset,
  getAnnotationRoot,
  getCanonicalText,
  paintHighlights,
  scrollToHighlight,
} from "./highlight-renderer";
import { renderHighlightsSummary } from "./highlights-summary";

type Highlight = {
  id: string;
  exact: string;
  prefix: string;
  suffix: string;
  notes: string | null;
  createdAt: number;
};

let highlights: Highlight[] = [];
let popup: HTMLElement | null = null;
let currentSelection: { start: number; end: number } | null = null;

type OpenPopup = { el: HTMLElement; onOutsideClick: (e: MouseEvent) => void };
const openNotesPopups = new Map<string, OpenPopup>();

// The relative resource path for the current view.
const currentResourcePath = (): string => window.location.pathname.replace("/view/", "");

// Initialize highlights on a markdown page.
export const initHighlights = (): void => {
  const root = getAnnotationRoot();
  if (!root) {
    return;
  }

  fetchAndRender();

  document.addEventListener("mouseup", handleTextSelection);
  handleHighlightFragment();
};

// Fetch highlights for the current page, paint them, and render the summary.
const fetchAndRender = async (): Promise<void> => {
  const root = getAnnotationRoot();
  if (!root) {
    return;
  }

  try {
    const response = await fetch(
      `/api/highlights/resource?path=${encodeURIComponent(currentResourcePath())}`
    );
    if (!response.ok) {
      return;
    }

    const data = await response.json();
    highlights = data.highlights || [];

    const { staleIds } = paintHighlights(root, highlights);
    attachHighlightHandlers(root);
    renderHighlightsSummary(
      highlights.map((h) => ({
        id: h.id,
        exact: h.exact,
        notes: h.notes,
        createdAt: h.createdAt,
        isStale: staleIds.has(h.id),
      }))
    );
  } catch (err) {
    console.error("[highlights] Failed to fetch highlights:", err);
  }
};

// Attach note popups to painted highlight marks.
const attachHighlightHandlers = (root: Element): void => {
  const marks = root.querySelectorAll("mark.llmd-highlight");
  for (const mark of Array.from(marks)) {
    const id = mark.getAttribute("data-highlight-id");
    const highlight = highlights.find((h) => h.id === id);
    if (!highlight) {
      continue;
    }
    mark.addEventListener("click", (e) => {
      e.stopPropagation();
      showNotesPopup(highlight, e as MouseEvent);
    });
  }
};

// Deep-link support: #highlight-<id>
const handleHighlightFragment = (): void => {
  const hash = window.location.hash;
  if (!hash.startsWith("#highlight-")) {
    return;
  }
  const id = hash.slice("#highlight-".length);
  if (id) {
    scrollToHighlight(id, "smooth");
  }
};

// Handle a text selection within the annotation root.
const handleTextSelection = (e: Event): void => {
  const target = e.target as Node;
  if (popup?.contains(target)) {
    return;
  }

  const root = getAnnotationRoot();
  const selection = window.getSelection();
  if (!(root && selection) || selection.isCollapsed) {
    hidePopup();
    return;
  }

  const range = selection.getRangeAt(0);
  const withinRoot = root.contains(range.startContainer) && root.contains(range.endContainer);
  if (!(withinRoot && selection.toString().trim())) {
    hidePopup();
    return;
  }

  const start = canonicalOffset(root, range.startContainer, range.startOffset);
  const end = canonicalOffset(root, range.endContainer, range.endOffset);
  currentSelection = { start: Math.min(start, end), end: Math.max(start, end) };

  showPopup(e as MouseEvent);
};

const showPopup = (e: MouseEvent): void => {
  if (!popup) {
    popup = createPopup();
    document.body.appendChild(popup);
  }
  popup.style.left = `${e.pageX}px`;
  popup.style.top = `${e.pageY - 50}px`;
  popup.style.display = "block";
};

const hidePopup = (): void => {
  if (popup) {
    popup.style.display = "none";
  }
  currentSelection = null;
};

// Build the "Add highlight" popup.
const createPopup = (): HTMLElement => {
  const div = document.createElement("div");
  div.className = "highlight-popup";
  div.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
      <span style="font-size: 13px; font-weight: 500; color: var(--fg);">Add Highlight</span>
      <button class="highlight-close-btn" type="button" style="background: none; border: none; color: var(--fg); cursor: pointer; padding: 0; font-size: 18px; line-height: 1; opacity: 0.7;">&times;</button>
    </div>
    <textarea
      class="highlight-notes-input"
      placeholder="Add a note (optional)"
      rows="2"
      style="width: 100%; padding: 8px; border: 1px solid var(--border); border-radius: 4px; background: var(--bg); color: var(--fg); font-size: 13px; resize: vertical; margin-bottom: 8px; font-family: inherit;"
    ></textarea>
    <button class="highlight-create-btn" type="button">Create Highlight</button>
  `;

  div.querySelector(".highlight-create-btn")?.addEventListener("click", (e) => {
    e.stopPropagation();
    createHighlight();
  });
  div.querySelector(".highlight-close-btn")?.addEventListener("click", (e) => {
    e.stopPropagation();
    hidePopup();
  });

  return div;
};

// Create a highlight from the current selection via the API.
const createHighlight = async (): Promise<void> => {
  const root = getAnnotationRoot();
  if (!(root && currentSelection)) {
    return;
  }

  const canonical = getCanonicalText(root);
  const anchor = buildAnchor(canonical, currentSelection.start, currentSelection.end);
  const notesInput = popup?.querySelector(".highlight-notes-input") as HTMLTextAreaElement | null;
  const notes = notesInput?.value.trim() || undefined;

  try {
    const response = await fetch("/api/highlights", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resourcePath: currentResourcePath(), ...anchor, notes }),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      console.error("[highlights] Server error:", error.error ?? "Failed to create highlight");
      return;
    }
    window.location.reload();
  } catch (err) {
    console.error("[highlights] Failed to create highlight:", err);
  }
};

// Close an open notes popup and remove its outside-click listener.
const closeNotesPopup = (highlightId: string): void => {
  const entry = openNotesPopups.get(highlightId);
  if (!entry) {
    return;
  }
  entry.el.remove();
  document.removeEventListener("click", entry.onOutsideClick);
  openNotesPopups.delete(highlightId);
};

// Show the notes popup for an existing highlight.
const showNotesPopup = (highlight: Highlight, e: MouseEvent): void => {
  if (openNotesPopups.has(highlight.id)) {
    closeNotesPopup(highlight.id);
    return;
  }

  const notesPopup = document.createElement("div");
  notesPopup.className = "highlight-notes-popup";
  notesPopup.style.cssText = `
    position: absolute;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 12px;
    max-width: 300px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    z-index: 10000;
    font-size: 13px;
    line-height: 1.5;
  `;

  const header = document.createElement("div");
  header.style.cssText =
    "display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;";

  const title = document.createElement("span");
  title.textContent = "Highlight Notes";
  title.style.cssText = "font-weight: 600; color: var(--fg);";

  const closeBtn = document.createElement("button");
  closeBtn.textContent = "×";
  closeBtn.style.cssText =
    "background: none; border: none; color: var(--fg); cursor: pointer; padding: 0; font-size: 18px; line-height: 1; opacity: 0.7;";
  closeBtn.addEventListener("click", (clickEvent) => {
    clickEvent.stopPropagation();
    closeNotesPopup(highlight.id);
  });

  header.appendChild(title);
  header.appendChild(closeBtn);

  const content = document.createElement("div");
  content.style.cssText = "color: var(--fg); white-space: pre-wrap; word-wrap: break-word;";
  content.textContent = highlight.notes || "(No notes)";

  notesPopup.appendChild(header);
  notesPopup.appendChild(content);
  notesPopup.addEventListener("click", (clickEvent) => clickEvent.stopPropagation());

  notesPopup.style.left = `${e.pageX}px`;
  notesPopup.style.top = `${e.pageY + 10}px`;
  document.body.appendChild(notesPopup);

  const onOutsideClick = (clickEvent: MouseEvent): void => {
    if (!notesPopup.contains(clickEvent.target as Node)) {
      closeNotesPopup(highlight.id);
    }
  };
  openNotesPopups.set(highlight.id, { el: notesPopup, onOutsideClick });
  setTimeout(() => document.addEventListener("click", onOutsideClick), 0);
};
