// File watching functionality (functional style)

import { type FSWatcher, watch } from "node:fs";
import { join } from "node:path";
import type { WebSocket } from "ws";

// Type for tracking watched files and their subscribers
export type WatchedFile = {
  path: string;
  watcher: FSWatcher;
  subscribers: Set<WebSocket & { files?: Set<string> }>;
};

// Map of file paths to their watchers and subscribers
const watchedFiles = new Map<string, WatchedFile>();

// Debounce map to avoid rapid reload triggers
const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();
const DEBOUNCE_DELAY = 300; // ms

// Pure function: create debounced callback
const createDebouncedCallback =
  (filePath: string, callback: () => void): (() => void) =>
  () => {
    const existingTimer = debounceTimers.get(filePath);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const timer = setTimeout(() => {
      callback();
      debounceTimers.delete(filePath);
    }, DEBOUNCE_DELAY);

    debounceTimers.set(filePath, timer);
  };

// Side effect: broadcast a reload message to all subscribers of a file
const broadcastReload = (relativePath: string): void => {
  const watched = watchedFiles.get(relativePath);
  if (!watched) {
    return;
  }

  console.log(
    `[watcher] File changed: ${relativePath}, notifying ${watched.subscribers.size} subscriber(s)`
  );

  for (const ws of watched.subscribers) {
    try {
      ws.send(JSON.stringify({ type: "reload", file: relativePath }));
    } catch (err) {
      console.error("[watcher] Failed to send reload message:", err);
    }
  }
};

// Forward declaration for re-arming after atomic saves
let reArmWatcher: (rootDir: string, relativePath: string) => void;

// Side effect: create an fs watcher for a file
const createWatcher = (rootDir: string, relativePath: string): FSWatcher => {
  const fullPath = join(rootDir, relativePath);
  const debouncedBroadcast = createDebouncedCallback(relativePath, () =>
    broadcastReload(relativePath)
  );

  const watcher = watch(fullPath, (eventType) => {
    debouncedBroadcast();

    // Editors that save atomically emit "rename": the file is replaced, so the
    // existing watch is now bound to a stale inode and must be re-established.
    if (eventType === "rename") {
      reArmWatcher(rootDir, relativePath);
    }
  });

  watcher.on("error", (error) => {
    console.error(`[watcher] Error watching ${relativePath}:`, error);
  });

  return watcher;
};

// Side effect: re-establish a watch on the same path (after an atomic save)
reArmWatcher = (rootDir: string, relativePath: string): void => {
  const watched = watchedFiles.get(relativePath);
  if (!watched) {
    return;
  }

  watched.watcher.close();
  try {
    watched.watcher = createWatcher(rootDir, relativePath);
  } catch (err) {
    // File may have been deleted; leave it unwatched until re-subscribed.
    console.error(`[watcher] Failed to re-arm watch for ${relativePath}:`, err);
  }
};

// Side effect: start watching a file
export const watchFile = (
  rootDir: string,
  relativePath: string,
  subscriber: WebSocket & { files?: Set<string> }
): void => {
  const existing = watchedFiles.get(relativePath);
  if (existing) {
    existing.subscribers.add(subscriber);
    console.log(
      `[watcher] Added subscriber to ${relativePath} (${existing.subscribers.size} total)`
    );
    return;
  }

  console.log(`[watcher] Starting watch for ${relativePath}`);
  const watcher = createWatcher(rootDir, relativePath);
  watchedFiles.set(relativePath, {
    path: relativePath,
    watcher,
    subscribers: new Set([subscriber]),
  });
};

// Side effect: stop watching a file for a specific subscriber
export const unwatchFile = (
  relativePath: string,
  subscriber: WebSocket & { files?: Set<string> }
): void => {
  const watched = watchedFiles.get(relativePath);
  if (!watched) {
    return;
  }

  watched.subscribers.delete(subscriber);
  console.log(
    `[watcher] Removed subscriber from ${relativePath} (${watched.subscribers.size} remaining)`
  );

  // If no more subscribers, stop watching
  if (watched.subscribers.size === 0) {
    console.log(`[watcher] Stopping watch for ${relativePath}`);
    watched.watcher.close();
    watchedFiles.delete(relativePath);

    const timer = debounceTimers.get(relativePath);
    if (timer) {
      clearTimeout(timer);
      debounceTimers.delete(relativePath);
    }
  }
};

// Side effect: cleanup all watchers (on server shutdown)
export const cleanupAllWatchers = (): void => {
  console.log(`[watcher] Cleaning up ${watchedFiles.size} watcher(s)`);

  for (const watched of watchedFiles.values()) {
    watched.watcher.close();
  }
  watchedFiles.clear();

  for (const timer of debounceTimers.values()) {
    clearTimeout(timer);
  }
  debounceTimers.clear();
};
