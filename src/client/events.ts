// Client-side event tracking

// Pure function: send event to server (fire-and-forget)
export const sendEvent = (
  type: "view" | "open",
  path: string,
  resourceType: "file" | "dir"
): void => {
  fetch("/api/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type, path, resourceType }),
  }).catch(() => {
    // Silently fail - analytics shouldn't break UX
  });
};

// Side effect: send "open" event for current directory
export const trackDirectoryOpen = (directory: string): void => {
  sendEvent("open", directory, "dir");
};

// Side effect: send "view" event for current file
export const trackFileView = (filePath: string): void => {
  sendEvent("view", filePath, "file");
};
