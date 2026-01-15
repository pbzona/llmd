// Collapsible directories and table of contents

// Storage key for collapsed directories
const STORAGE_KEY = "llmd-nav-collapsed";

// Helper: get directory path from dir-group element
const getDirPath = (dirGroup: Element): string | null => {
  const path = dirGroup.getAttribute("data-dir-path");
  return path || null;
};

// Helper: save collapsed state to localStorage
const saveCollapsedState = () => {
  const collapsedDirs: string[] = [];
  const dirGroups = document.querySelectorAll(".dir-group.collapsed");

  for (const dirGroup of Array.from(dirGroups)) {
    const path = getDirPath(dirGroup);
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
    const dirGroups = document.querySelectorAll(".dir-group");

    for (const dirGroup of Array.from(dirGroups)) {
      const path = getDirPath(dirGroup);
      if (path && collapsedDirs.includes(path)) {
        dirGroup.classList.add("collapsed");
      }
    }
  } catch (err) {
    console.error("[collapsible] Failed to restore state:", err);
  }
};

// Initialize collapsible directories
const initCollapsibleDirectories = () => {
  const dirHeaders = document.querySelectorAll(".dir-group-header");

  for (const headerNode of Array.from(dirHeaders)) {
    const header = headerNode as HTMLElement;

    // Toggle collapsed state on click
    header.addEventListener("click", (e: Event) => {
      e.preventDefault();
      const dirGroup = header.closest(".dir-group");
      if (dirGroup) {
        dirGroup.classList.toggle("collapsed");
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

// Export initialization function
export const initCollapsible = (): void => {
  initCollapsibleDirectories();
  initCollapsibleToc();
};
