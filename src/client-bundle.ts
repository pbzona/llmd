// Bundle client-side scripts
// This file bundles all client-side code and can be served as /client.js

import "./client/collapsible";
import "./client/copy-button";
import "./client/file-watcher";
import "./client/sidebar-resize";
import { trackDirectoryOpen, trackFileView } from "./client/events";

// Expose event tracking functions on window
// biome-ignore lint/suspicious/noExplicitAny: Need to extend window global
(window as any).trackDirectoryOpen = trackDirectoryOpen;
// biome-ignore lint/suspicious/noExplicitAny: Need to extend window global
(window as any).trackFileView = trackFileView;

console.log("[llmd] Client initialized");
