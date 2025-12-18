// Collapsible directories and table of contents

// Storage key for collapsed directories
const STORAGE_KEY = "llmd-nav-collapsed";

// Regex for removing trailing slashes (top-level to avoid recreation)
const TRAILING_SLASH = /\/$/;

// Helper: extract directory name from a dir-item element
const getDirName = (dirItem: Element): string | null => {
  const dirLabel = dirItem.querySelector(":scope > .dir-label");
  if (!dirLabel) {
    return null;
  }
  const spans = Array.from(dirLabel.querySelectorAll("span"));
  if (spans.length === 0) {
    return null;
  }
  // biome-ignore lint/style/noNonNullAssertion: Length check above ensures element exists
  // biome-ignore lint/style/useAtIndex: TypeScript target doesn't support .at() method
  const textSpan = spans[spans.length - 1]!;
  if (!textSpan.textContent) {
    return null;
  }
  return textSpan.textContent.replace(TRAILING_SLASH, "");
};

// Helper: get directory path from dir-item element
const getDirPath = (dirItem: Element): string | null => {
  const parts: string[] = [];
  let current: Element | null = dirItem;

  while (current) {
    const dirName = getDirName(current);
    if (dirName) {
      parts.unshift(dirName);
    }
    const parentElement = current.parentElement;
    current = parentElement ? parentElement.closest(".dir-item") : null;
  }

  return parts.length > 0 ? parts.join("/") : null;
};

// Helper: save collapsed state to localStorage
const saveCollapsedState = () => {
  const collapsedDirs: string[] = [];
  const dirItems = document.querySelectorAll(".dir-item.collapsed");

  for (const dirItem of Array.from(dirItems)) {
    const path = getDirPath(dirItem);
    if (path) {
      collapsedDirs.push(path);
    }
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(collapsedDirs));
};

// Helper: restore collapsed state from localStorage
const restoreCollapsedState = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) {
      return;
    }

    const collapsedDirs: string[] = JSON.parse(saved);
    const dirItems = document.querySelectorAll(".dir-item");

    for (const dirItem of Array.from(dirItems)) {
      const path = getDirPath(dirItem);
      if (path && collapsedDirs.includes(path)) {
        dirItem.classList.add("collapsed");
      }
    }
  } catch (err) {
    console.error("[collapsible] Failed to restore state:", err);
  }
};

// Initialize collapsible directories
const initCollapsibleDirectories = () => {
  const dirLabels = document.querySelectorAll(".dir-label");

  for (const labelNode of Array.from(dirLabels)) {
    const label = labelNode as HTMLElement;
    // Add chevron icon to directory labels
    const chevron = document.createElement("span");
    chevron.className = "dir-chevron";
    chevron.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>`;
    label.insertBefore(chevron, label.firstChild);

    // Make directory label clickable
    label.style.cursor = "pointer";

    // Toggle collapsed state on click
    label.addEventListener("click", (e: Event) => {
      e.preventDefault();
      const dirItem = label.closest(".dir-item");
      if (dirItem) {
        dirItem.classList.toggle("collapsed");
        saveCollapsedState();
      }
    });
  }

  // Restore collapsed state after DOM setup
  restoreCollapsedState();
};

// Initialize collapsible table of contents
const initCollapsibleToc = () => {
  const toc = document.querySelector(".toc");
  if (!toc) {
    return;
  }

  const tocHeader = toc.querySelector("h3");
  if (!tocHeader) {
    return;
  }

  // Add chevron icon
  const chevron = document.createElement("span");
  chevron.className = "toc-chevron";
  chevron.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>`;
  tocHeader.style.cursor = "pointer";
  tocHeader.insertBefore(chevron, tocHeader.firstChild);

  // TOC starts collapsed by default (class is already in HTML)
  // Toggle collapsed state on click
  tocHeader.addEventListener("click", () => {
    toc.classList.toggle("collapsed");
  });
};

// Initialize on page load
if (typeof window !== "undefined") {
  window.addEventListener("DOMContentLoaded", () => {
    initCollapsibleDirectories();
    initCollapsibleToc();
  });
}
