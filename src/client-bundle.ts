// Bundle client-side scripts
// This file bundles all client-side code and can be served as /client.js

import { initAdminToggle } from "./client/admin-toggle";
import { initCollapsible } from "./client/collapsible";
import "./client/copy-button";
import { trackDirectoryOpen, trackFileView } from "./client/events";
import { initFileWatcher } from "./client/file-watcher";
import { initHighlights } from "./client/highlights";
import { initHighlightsSummary } from "./client/highlights-summary";
import "./client/sidebar-resize";

// Expose event tracking functions on window (invoked by inline page scripts)
// biome-ignore lint/suspicious/noExplicitAny: Need to extend window global
(window as any).trackDirectoryOpen = trackDirectoryOpen;
// biome-ignore lint/suspicious/noExplicitAny: Need to extend window global
(window as any).trackFileView = trackFileView;

// Initialize admin toggle on all pages
initAdminToggle();

// Initialize collapsible sections
initCollapsible();

// Connect the live-reload watcher when the page opted in
initFileWatcher();

// Initialize highlights on markdown pages
if (document.querySelector(".content")) {
  initHighlights();
  initHighlightsSummary();
}

console.log("[llmd] Client initialized");
