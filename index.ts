#!/usr/bin/env bun

// Main entrypoint

import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { openBrowser } from "./src/browser";
import { parseCli } from "./src/cli";
import {
  cleanupOldEvents,
  clearDatabase,
  disableAnalytics,
  disableHighlights,
  enableAnalytics,
  enableHighlights,
  getDatabaseStats,
  saveThemePreferences,
} from "./src/events";
import { getRelativePath, scanMarkdownFiles } from "./src/scanner";
import { getServerUrl, startServer } from "./src/server";
import { printSplash } from "./src/splash";

// Side effect: Clone or update llmd repo and launch server
const handleDocsCommand = async (): Promise<void> => {
  const REPO_URL = "https://github.com/pbzona/llmd";

  // Determine data directory (XDG_DATA_HOME or ~/.local/share)
  const xdgDataHome = process.env.XDG_DATA_HOME;
  const dataDir = xdgDataHome || join(homedir(), ".local", "share");
  const docsPath = join(dataDir, "llmd-docs");

  console.log("→ Preparing llmd documentation...\n");

  // Clone if doesn't exist, otherwise pull latest changes
  if (existsSync(docsPath)) {
    console.log(`→ Updating cached documentation at ${docsPath}...`);
    try {
      execSync("git pull --rebase", { cwd: docsPath, stdio: "inherit" });
      console.log("✓ Documentation updated\n");
    } catch (_error) {
      console.log("  Warning: Could not update docs, using cached version\n");
    }
  } else {
    console.log(`→ Cloning llmd repository to ${docsPath}...`);
    try {
      execSync(`git clone ${REPO_URL} "${docsPath}"`, { stdio: "inherit" });
      console.log("✓ Repository cloned successfully\n");
    } catch (error) {
      throw new Error(
        `Failed to clone repository: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  // Start server with docs path
  const result = parseCli([docsPath, "--open"]);
  if (result.type !== "config") {
    throw new Error("Unexpected result from parseCli");
  }

  const config = result.config;

  // Scan and start server
  const files = await scanMarkdownFiles(config.directory, config.treeDepth);
  const server = await startServer(config, files);
  const url = getServerUrl(server);

  let initialUrl = url;
  if (config.initialFile) {
    const relativePath = getRelativePath(config.initialFile, config.directory);
    initialUrl = `${url}/view/${relativePath}`;
  }

  console.log(`▸ Server running at ${url}`);
  console.log(`  Theme: ${config.theme}`);
  console.log("\n  Press Ctrl+C to stop\n");

  if (config.open) {
    await new Promise((resolve) => setTimeout(resolve, 300));
    openBrowser(initialUrl);
  }

  // Handle graceful shutdown
  process.on("SIGINT", () => {
    console.log("\n\n✓ Shutting down...");
    server.stop();
    process.exit(0);
  });
};

// Side effect: Handle db check command
const handleDbCheck = async (): Promise<void> => {
  console.log("→ Checking database...\n");
  const stats = await getDatabaseStats();

  console.log("Database Statistics:");
  console.log(`  Location: ${stats.databasePath}`);
  console.log(`  Size: ${stats.fileSizeMB} MB (${stats.fileSizeBytes.toLocaleString()} bytes)`);
  console.log(`  Resources: ${stats.totalResources.toLocaleString()}`);
  console.log(`  Events: ${stats.totalEvents.toLocaleString()}`);

  if (stats.oldestEventTimestamp) {
    const oldestDate = new Date(stats.oldestEventTimestamp);
    console.log(`  Oldest event: ${oldestDate.toLocaleString()}`);
  }

  if (stats.newestEventTimestamp) {
    const newestDate = new Date(stats.newestEventTimestamp);
    console.log(`  Newest event: ${newestDate.toLocaleString()}`);
  }

  console.log();
};

// Side effect: Handle db cleanup command
const handleDbCleanup = (days: number): void => {
  console.log(`→ Cleaning up events older than ${days} days...\n`);
  const result = cleanupOldEvents(days);

  console.log("Cleanup Results:");
  console.log(`  Deleted events: ${result.deletedEvents.toLocaleString()}`);
  console.log(`  Deleted resources: ${result.deletedResources.toLocaleString()}`);
  console.log();
};

// Side effect: Handle db clear command
const handleDbClear = async (): Promise<void> => {
  console.log("⚠️  This will delete ALL analytics data (events and resources).");
  console.log("   This action cannot be undone.\n");

  // Read user confirmation from stdin
  const readline = await import("node:readline");
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const answer = await new Promise<string>((resolve) => {
    rl.question("   Type 'yeah really plz delete' to confirm: ", (ans) => {
      rl.close();
      resolve(ans);
    });
  });

  if (answer === "yeah really plz delete") {
    console.log("\n→ Clearing all analytics data...\n");
    clearDatabase();
    console.log("✓ Database cleared\n");
  } else {
    console.log("\n✗ Cancelled\n");
  }
};

// Side effect: Handle archive list command
const handleArchiveList = (): void => {
  const { listArchiveFiles } = require("./src/highlights");
  const files = listArchiveFiles();

  if (files.length === 0) {
    console.log("No backup files in archive\n");
    return;
  }

  console.log(`Archive: ${files.length} backup file${files.length === 1 ? "" : "s"}\n`);

  for (const file of files) {
    const date = new Date(file.mtime).toLocaleString();
    const sizeMB = (file.size / 1024).toFixed(1);
    console.log(`  ${file.originalName}`);
    console.log(`    Modified: ${date}`);
    console.log(`    Size: ${sizeMB} KB`);
    console.log(`    Resource ID: ${file.resourceId.slice(0, 8)}...`);
    console.log();
  }
};

// Side effect: Handle archive show command
const handleArchiveShow = (searchPath: string): void => {
  const { getArchiveFileDetails } = require("./src/highlights");
  const details = getArchiveFileDetails(searchPath);

  if (!details) {
    console.error(`✗ No backup file found for: ${searchPath}\n`);
    process.exit(1);
  }

  const date = new Date(details.mtime).toLocaleString();
  const created = new Date(details.timestamp).toLocaleString();
  const sizeMB = (details.size / 1024).toFixed(1);

  console.log("\nBackup File Details:\n");
  console.log(`  Original Name: ${details.originalName}`);
  console.log(`  Created: ${created}`);
  console.log(`  Modified: ${date}`);
  console.log(`  Size: ${sizeMB} KB`);
  console.log(`  Resource ID: ${details.resourceId}`);
  console.log(`  Path: ${details.path}`);
  console.log("\nContent Preview (first 500 characters):\n");
  console.log(details.content.slice(0, 500));
  if (details.content.length > 500) {
    console.log("\n...(truncated)");
  }
  console.log();
};

// Side effect: Handle archive clear command
const handleArchiveClear = async (): Promise<void> => {
  const { listArchiveFiles, clearArchive } = require("./src/highlights");
  const files = listArchiveFiles();

  if (files.length === 0) {
    console.log("Archive is already empty\n");
    return;
  }

  console.log(`⚠️  This will delete ${files.length} backup file${files.length === 1 ? "" : "s"}.`);
  console.log("   This action cannot be undone.\n");

  const readline = await import("node:readline");
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const answer = await new Promise<string>((resolve) => {
    rl.question("   Type 'yes' to confirm: ", (ans) => {
      rl.close();
      resolve(ans);
    });
  });

  if (answer === "yes") {
    console.log("\n→ Clearing archive...\n");
    const result = clearArchive();
    const freedMB = (result.freedBytes / (1024 * 1024)).toFixed(2);
    console.log(`✓ Deleted ${result.deletedCount} file${result.deletedCount === 1 ? "" : "s"}`);
    console.log(`  Freed ${freedMB} MB\n`);
  } else {
    console.log("\n✗ Cancelled\n");
  }
};

// Side effect: Handle export command
const handleExport = async (directoryPath: string): Promise<void> => {
  const { getHighlightsByDirectory, generateMarkdownExport, writeMarkdownExport } = await import(
    "./src/highlights"
  );
  const { basename, resolve: resolvePath, join: joinPath } = await import("node:path");
  const { homedir: getHomedir } = await import("node:os");

  // Resolve the path
  const absolutePath = resolvePath(directoryPath);

  console.log(`→ Exporting highlights from ${absolutePath}...\n`);

  // Resolve database path (same logic as events.ts)
  const xdgDataHome = process.env.XDG_DATA_HOME;
  const baseDir = xdgDataHome || joinPath(getHomedir(), ".local", "share");
  const dbPath = joinPath(baseDir, "llmd", "llmd.db");

  // Open database
  const createDatabase = (path: string) => {
    if (typeof Bun !== "undefined" && (globalThis as any).Bun) {
      const { Database } = require("bun:sqlite");
      return new Database(path);
    }
    const LibSQL = require("libsql");
    return new LibSQL(path);
  };

  const db = createDatabase(dbPath);

  try {
    // Get highlights
    const highlights = getHighlightsByDirectory(db, absolutePath);

    if (highlights.length === 0) {
      console.log("✗ No highlights found in this directory\n");
      db.close();
      return;
    }

    // Generate filename
    const dateStr = new Date().toISOString().replace(/[:.]/g, "-").split("T")[0];
    const dirName = basename(absolutePath);
    const filename = `${dirName}-${dateStr}.md`;

    // Generate and write export
    const content = generateMarkdownExport(highlights, absolutePath);
    const exportPath = writeMarkdownExport(content, filename);

    console.log(`✓ Exported ${highlights.length} highlight${highlights.length === 1 ? "" : "s"}`);
    console.log(`  File: ${exportPath}\n`);
  } finally {
    db.close();
  }
};

// Main async function
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: CLI coordination requires branching
const main = async () => {
  try {
    // Print splash
    printSplash();
    console.log();

    // Parse CLI arguments
    const result = parseCli(process.argv.slice(2));

    // Handle different result types
    if (result.type === "exit") {
      process.exit(0);
    }

    if (result.type === "analytics-enable") {
      enableAnalytics();
      process.exit(0);
    }

    if (result.type === "analytics-disable") {
      disableAnalytics();
      process.exit(0);
    }

    if (result.type === "highlights-enable") {
      enableHighlights();
      process.exit(0);
    }

    if (result.type === "highlights-disable") {
      disableHighlights();
      process.exit(0);
    }

    if (result.type === "db-check") {
      await handleDbCheck();
      process.exit(0);
    }

    if (result.type === "db-cleanup") {
      await handleDbCleanup(result.days);
      process.exit(0);
    }

    if (result.type === "db-clear") {
      await handleDbClear();
      process.exit(0);
    }

    if (result.type === "docs") {
      await handleDocsCommand();
      // Keep process running - handleDocsCommand sets up SIGINT handler
      return;
    }

    if (result.type === "archive-list") {
      handleArchiveList();
      process.exit(0);
    }

    if (result.type === "archive-show") {
      handleArchiveShow(result.path);
      process.exit(0);
    }

    if (result.type === "archive-clear") {
      await handleArchiveClear();
      process.exit(0);
    }

    if (result.type === "export") {
      await handleExport(result.path);
      process.exit(0);
    }

    // Must be config type
    const config = result.config;

    // Save theme preferences for next time
    saveThemePreferences(config.theme);

    // Scan for markdown files
    console.log(`→ Scanning ${config.directory}...`);
    const files = await scanMarkdownFiles(config.directory, config.treeDepth);
    console.log(`✓ Found ${files.length} markdown file${files.length === 1 ? "" : "s"}\n`);

    // Start server
    const server = await startServer(config, files);
    const url = getServerUrl(server);

    // Determine initial URL (open to specific file or analytics if requested)
    let initialUrl = url;
    if (config.openToAnalytics) {
      initialUrl = `${url}/analytics`;
    } else if (config.initialFile) {
      const relativePath = getRelativePath(config.initialFile, config.directory);
      initialUrl = `${url}/view/${relativePath}`;
    }

    console.log(`▸ Server running at ${url}`);
    console.log(`  Theme: ${config.theme}`);

    if (config.openToAnalytics) {
      console.log("  Opening: Analytics");
    } else if (config.initialFile) {
      const relativePath = getRelativePath(config.initialFile, config.directory);
      console.log(`  Opening: ${relativePath}`);
    }

    console.log("\n  Press Ctrl+C to stop\n");

    // Open browser if requested (with a small delay to let server fully start)
    if (config.open) {
      await new Promise((resolve) => setTimeout(resolve, 300));
      openBrowser(initialUrl);
    }

    // Handle graceful shutdown
    process.on("SIGINT", () => {
      console.log("\n\n✓ Shutting down...");
      server.stop();
      process.exit(0);
    });
  } catch (error) {
    if (error instanceof Error) {
      console.error(`\n✗ Error: ${error.message}\n`);
    } else {
      console.error("\n✗ Unknown error occurred\n");
    }
    process.exit(1);
  }
};

// Run main
main();
