// Client-side admin section collapsible functionality

const STORAGE_KEY = "llmd-admin-collapsed";

// Initialize admin toggle on page load
export const initAdminToggle = (): void => {
  const section = document.querySelector(".admin-section");
  const header = document.querySelector(".admin-header");

  if (!(section && header)) {
    return;
  }

  // Load saved state from localStorage
  const isCollapsed = localStorage.getItem(STORAGE_KEY) === "true";
  if (isCollapsed) {
    section.classList.add("collapsed");
  }

  // Add click handler to toggle
  header.addEventListener("click", () => {
    const collapsed = section.classList.toggle("collapsed");
    localStorage.setItem(STORAGE_KEY, collapsed.toString());
  });
};
