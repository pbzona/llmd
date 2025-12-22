// Client-side highlights functionality

import { scrollToHighlight } from "./highlight-renderer";

// Types
type Highlight = {
  id: string;
  startOffset: number;
  endOffset: number;
  highlightedText: string;
  isStale: boolean;
  notes: string | null;
  createdAt: number;
};

// State
let highlights: Highlight[] = [];
let popup: HTMLElement | null = null;
let currentSelection: { text: string; range: Range } | null = null;
const openNotesPopups: Map<string, HTMLElement> = new Map();

// Initialize highlights on page load
export const initHighlights = (): void => {
  const contentArea = document.querySelector(".content");
  if (!contentArea) {
    return;
  }

  // Fetch existing highlights for this page
  fetchHighlights();

  // Listen for text selection
  document.addEventListener("mouseup", handleTextSelection);
  document.addEventListener("touchend", handleTextSelection);

  // Handle URL fragment for deep linking (e.g., #highlight-abc123)
  handleHighlightFragment();
};

// Handle URL fragment for deep linking to highlights
const handleHighlightFragment = (): void => {
  const hash = window.location.hash;
  if (!hash.startsWith("#highlight-")) {
    return;
  }

  const highlightId = hash.slice("#highlight-".length);
  if (!highlightId) {
    return;
  }

  // Wait for highlights to be rendered, then scroll
  setTimeout(() => {
    const success = scrollToHighlight(highlightId, "smooth");
    if (!success) {
      console.warn(`[highlights] Could not find highlight with ID: ${highlightId}`);
    }
  }, 100);
};

// Fetch highlights for current page and attach event handlers
const fetchHighlights = async (): Promise<void> => {
  try {
    const currentPath = window.location.pathname.replace("/view/", "");
    const response = await fetch(
      `/api/highlights/resource?path=${encodeURIComponent(currentPath)}`
    );

    if (!response.ok) {
      return;
    }

    const data = await response.json();
    highlights = data.highlights || [];

    // Attach click handlers to existing marks (rendered by server)
    attachHighlightHandlers();
  } catch (err) {
    console.error("[highlights] Failed to fetch highlights:", err);
  }
};

// Attach click handlers to existing highlight marks
const attachHighlightHandlers = (): void => {
  const contentArea = document.querySelector(".content");
  if (!contentArea) {
    return;
  }

  const marks = contentArea.querySelectorAll("mark.llmd-highlight");
  for (const mark of Array.from(marks)) {
    const highlightId = mark.getAttribute("data-highlight-id");
    if (!highlightId) {
      continue;
    }

    const highlight = highlights.find((h) => h.id === highlightId);
    if (!highlight) {
      continue;
    }

    mark.addEventListener("click", (e) => {
      e.stopPropagation();
      showNotesPopup(highlight, e as MouseEvent);
    });
  }
};

// Handle text selection
const handleTextSelection = (e: Event): void => {
  // Ignore events inside the popup
  const target = e.target as Node;
  if (popup?.contains(target)) {
    return;
  }

  const selection = window.getSelection();
  if (!selection || selection.isCollapsed) {
    hidePopup();
    return;
  }

  const selectedText = selection.toString().trim();
  if (!selectedText) {
    hidePopup();
    return;
  }

  // Make sure selection is within content area
  const contentArea = document.querySelector(".content");
  if (!contentArea) {
    return;
  }

  const range = selection.getRangeAt(0);

  // Check if selection spans multiple block elements
  // Get the closest block element for start and end
  const getBlockParent = (node: Node): Element | null => {
    let current = node.nodeType === Node.TEXT_NODE ? node.parentElement : (node as Element);
    while (current && current !== contentArea) {
      const tag = current.tagName?.toLowerCase();
      if (
        tag &&
        ["p", "h1", "h2", "h3", "h4", "h5", "h6", "li", "blockquote", "pre"].includes(tag)
      ) {
        return current;
      }
      current = current.parentElement;
    }
    return null;
  };

  const startBlock = getBlockParent(range.startContainer);
  const endBlock = getBlockParent(range.endContainer);

  if (startBlock !== endBlock) {
    hidePopup();
    return;
  }

  const container = range.commonAncestorContainer;
  const parentElement = container.nodeType === Node.TEXT_NODE ? container.parentElement : container;

  if (!(parentElement && contentArea.contains(parentElement))) {
    hidePopup();
    return;
  }

  // Store current selection
  currentSelection = {
    text: selectedText,
    range: range.cloneRange(),
  };

  // Show popup near selection
  showPopup(e as MouseEvent);
};

// Show highlight creation popup
const showPopup = (e: MouseEvent): void => {
  if (!popup) {
    popup = createPopup();
    document.body.appendChild(popup);
  }

  // Position popup near cursor
  const x = e.pageX;
  const y = e.pageY;

  popup.style.left = `${x}px`;
  popup.style.top = `${y - 50}px`;
  popup.style.display = "block";
};

// Hide popup
const hidePopup = (): void => {
  if (popup) {
    popup.style.display = "none";
  }
  currentSelection = null;
};

// Show notes popup when clicking on an existing highlight
const showNotesPopup = (highlight: Highlight, e: MouseEvent): void => {
  // If popup already exists for this highlight, close it instead
  const existingPopup = openNotesPopups.get(highlight.id);
  if (existingPopup) {
    existingPopup.remove();
    openNotesPopups.delete(highlight.id);
    return;
  }

  // Create a small popup to display notes
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
    notesPopup.remove();
    openNotesPopups.delete(highlight.id);
  });

  header.appendChild(title);
  header.appendChild(closeBtn);

  const content = document.createElement("div");
  content.style.cssText = "color: var(--fg); white-space: pre-wrap; word-wrap: break-word;";
  content.textContent = highlight.notes || "(No notes)";

  notesPopup.appendChild(header);
  notesPopup.appendChild(content);

  // Stop propagation on clicks inside popup
  notesPopup.addEventListener("click", (clickEvent) => {
    clickEvent.stopPropagation();
  });

  // Position near click
  notesPopup.style.left = `${e.pageX}px`;
  notesPopup.style.top = `${e.pageY + 10}px`;

  document.body.appendChild(notesPopup);

  // Track this popup
  openNotesPopups.set(highlight.id, notesPopup);

  // Close when clicking outside
  const closeOnClickOutside = (clickEvent: MouseEvent): void => {
    if (!notesPopup.contains(clickEvent.target as Node)) {
      notesPopup.remove();
      openNotesPopups.delete(highlight.id);
      document.removeEventListener("click", closeOnClickOutside);
    }
  };
  setTimeout(() => {
    document.addEventListener("click", closeOnClickOutside);
  }, 0);
};

// Create popup element with notes textarea
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
    <button class="highlight-create-btn" type="button">
      Create Highlight
    </button>
  `;

  // Add click handler for create button
  const btn = div.querySelector(".highlight-create-btn");
  if (btn) {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      await createHighlight();
    });
  }

  // Add click handler for close button
  const closeBtn = div.querySelector(".highlight-close-btn");
  if (closeBtn) {
    closeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      hidePopup();
    });
  }

  return div;
};

// Helper: calculate occurrence index of selection in document
const calculateOccurrenceIndex = (selectedText: string, range: Range): number => {
  const contentArea = document.querySelector(".content");
  if (!contentArea) {
    return 0;
  }

  // Get all text before the selection
  const preRange = document.createRange();
  preRange.selectNodeContents(contentArea);
  preRange.setEnd(range.startContainer, range.startOffset);
  const textBefore = preRange.toString();

  // Count how many times the selected text appears before this selection
  let count = 0;
  let searchPos = 0;
  while (true) {
    const found = textBefore.indexOf(selectedText, searchPos);
    if (found === -1) {
      break;
    }
    count += 1;
    searchPos = found + 1;
  }

  return count;
};

// Create highlight via API
const createHighlight = async (): Promise<void> => {
  if (!currentSelection) {
    return;
  }

  try {
    // Get the selected text
    const selectedText = currentSelection.text;
    const range = currentSelection.range;

    // Calculate which occurrence this is (for disambiguation)
    const occurrenceIndex = calculateOccurrenceIndex(selectedText, range);

    // Get notes from textarea
    const notesInput = popup?.querySelector(".highlight-notes-input") as HTMLTextAreaElement;
    const notes = notesInput?.value.trim() || undefined;

    // Send to API - server will calculate offsets from markdown source
    const currentPath = window.location.pathname.replace("/view/", "");
    const response = await fetch("/api/highlights", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        resourcePath: currentPath,
        highlightedText: selectedText,
        occurrenceIndex,
        notes,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error("[highlights] Server error:", error.error || "Failed to create highlight");
      return;
    }

    // Reload the page to show updated highlights
    window.location.reload();
  } catch (err) {
    console.error("[highlights] Failed to create highlight:", err);
  }
};
