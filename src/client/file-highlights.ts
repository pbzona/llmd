// Show highlight indicators on files in sidebar navigation

export const initFileHighlightIndicators = async (): Promise<void> => {
  try {
    // Get the current directory from the page
    const currentPath = window.location.pathname.replace("/view/", "");
    const currentDir = currentPath.includes("/")
      ? currentPath.substring(0, currentPath.lastIndexOf("/"))
      : "";

    // Fetch all highlights for the current directory
    const response = await fetch(
      `/api/highlights/directory?path=${encodeURIComponent(currentDir || ".")}`
    );

    if (!response.ok) {
      return;
    }

    const data = await response.json();
    const highlights = data.highlights || [];

    // Group highlights by file path
    const filePathsWithHighlights = new Set<string>();
    for (const highlight of highlights) {
      filePathsWithHighlights.add(highlight.resourcePath);
    }

    // Fill the file icon for files that have highlights
    const fileLinks = document.querySelectorAll("a[data-file-path]");
    for (const link of Array.from(fileLinks)) {
      const filePath = link.getAttribute("data-file-path");
      if (filePath && filePathsWithHighlights.has(filePath)) {
        const fileIcon = link.querySelector(".file-icon svg");
        if (fileIcon) {
          // Fill the icon to indicate highlights
          fileIcon.setAttribute("fill", "var(--accent)");
          fileIcon.setAttribute("fill-opacity", "0.3");
        }
      }
    }
  } catch (err) {
    console.error("[file-highlights] Failed to load highlight indicators:", err);
  }
};

// Initialize on page load
if (typeof window !== "undefined") {
  window.addEventListener("DOMContentLoaded", () => {
    initFileHighlightIndicators();
  });
}
