#!/usr/bin/env bun

// Main entrypoint

import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { openBrowser } from "./src/browser";
import { createConfig, parseCli, validateConfig } from "./src/cli";
import {
  cleanupOldEvents,
  clearDatabase,
  disableAnalytics,
  enableAnalytics,
  getDatabaseStats,
  openDatabase,
  saveThemePreferences,
} from "./src/events";
import { getRelativePath, scanMarkdownFiles } from "./src/scanner";
import { getServerUrl, startServer } from "./src/server";
import { printSplash } from "./src/splash";
import type { Config, ParsedArgs } from "./src/types";

// Delay before opening the browser, to let the server finish binding.
const BROWSER_OPEN_DELAY_MS = 300;

// Pure function: determine the initial URL to open based on config
const computeInitialUrl = (baseUrl: string, config: Config): string => {
  if (config.openToAnalytics) {
    return `${baseUrl}/analytics`;
  }
  if (config.initialFile) {
    return `${baseUrl}/view/${getRelativePath(config.initialFile, config.directory)}`;
  }
  return baseUrl;
};

// Side effect: scan, start the server, open the browser, and wire shutdown.
const runServer = async (config: Config): Promise<void> => {
  console.log(`→ Scanning ${config.directory}...`);
  const files = await scanMarkdownFiles(config.directory, config.treeDepth);
  console.log(`✓ Found ${files.length} markdown file${files.length === 1 ? "" : "s"}\n`);

  const server = await startServer(config, files);
  const url = getServerUrl(server);
  const initialUrl = computeInitialUrl(url, config);

  console.log(`▸ Server running at ${url}`);
  console.log(`  Theme: ${config.theme}`);
  if (config.openToAnalytics) {
    console.log("  Opening: Analytics");
  } else if (config.initialFile) {
    console.log(`  Opening: ${getRelativePath(config.initialFile, config.directory)}`);
  }
  console.log("\n  Press Ctrl+C to stop\n");

  if (config.open) {
    await new Promise((resolve) => setTimeout(resolve, BROWSER_OPEN_DELAY_MS));
    openBrowser(initialUrl);
  }

  process.on("SIGINT", () => {
    console.log("\n\n✓ Shutting down...");
    server.stop().finally(() => process.exit(0));
  });
};

// Side effect: Clone or update llmd repo and launch server
const handleDocsCommand = async (flags: ParsedArgs["flags"]): Promise<void> => {
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

  // Start the docs server while preserving options parsed alongside the command.
  const config = createConfig({ path: docsPath, flags });
  validateConfig(config);
  saveThemePreferences(config.theme);
  await runServer(config);
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
const handleArchiveList = async (): Promise<void> => {
  const { listArchiveFiles } = await import("./src/highlights");
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
const handleArchiveShow = async (searchPath: string): Promise<void> => {
  const { getArchiveFileDetails } = await import("./src/highlights");
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
  const { listArchiveFiles, clearArchive } = await import("./src/highlights");
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
  const { basename, resolve: resolvePath } = await import("node:path");

  const absolutePath = resolvePath(directoryPath);
  console.log(`→ Exporting highlights from ${absolutePath}...\n`);

  const { db } = openDatabase();

  try {
    const highlights = getHighlightsByDirectory(db, absolutePath);

    if (highlights.length === 0) {
      console.log("✗ No highlights found in this directory\n");
      return;
    }

    const dateStr = new Date().toISOString().replace(/[:.]/g, "-").split("T")[0];
    const filename = `${basename(absolutePath)}-${dateStr}.md`;

    const content = generateMarkdownExport(highlights, absolutePath);
    const exportPath = writeMarkdownExport(content, filename);

    console.log(`✓ Exported ${highlights.length} highlight${highlights.length === 1 ? "" : "s"}`);
    console.log(`  File: ${exportPath}\n`);
  } finally {
    db.close();
  }
};

// Main async function
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

    if (result.type === "db-check") {
      await handleDbCheck();
      process.exit(0);
    }

    if (result.type === "db-cleanup") {
      handleDbCleanup(result.days);
      process.exit(0);
    }

    if (result.type === "db-clear") {
      await handleDbClear();
      process.exit(0);
    }

    if (result.type === "docs") {
      await handleDocsCommand(result.flags);
      // Keep process running - runServer sets up the SIGINT handler
      return;
    }

    if (result.type === "archive-list") {
      await handleArchiveList();
      process.exit(0);
    }

    if (result.type === "archive-show") {
      await handleArchiveShow(result.path);
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

    // Must be config type: save preferences and run the server
    const config = result.config;
    saveThemePreferences(config.theme);
    await runServer(config);
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
