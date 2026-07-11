// Highlights service for managing text selections and file backups

import { createHash, randomUUID } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join } from "node:path";
import type { DatabaseHandle } from "./types";

// Pure function: generate UUID v4
const generateId = (): string => randomUUID();

// Pure function: compute SHA-256 hash of file content
export const computeFileHash = (content: string): string =>
  createHash("sha256").update(content, "utf8").digest("hex");

// Pure function: resolve cache directory path using XDG_CACHE_HOME or fallback
export const resolveCacheDirectory = (): string => {
  const xdgCacheHome = process.env.XDG_CACHE_HOME;
  const baseDir = xdgCacheHome || join(homedir(), ".cache");
  const llmdCacheDir = join(baseDir, "llmd", "file-backups");

  return llmdCacheDir;
};

// Side effect: ensure cache directory exists
const ensureCacheDirectory = (): string => {
  const cacheDir = resolveCacheDirectory();

  if (!existsSync(cacheDir)) {
    mkdirSync(cacheDir, { recursive: true });
  }

  return cacheDir;
};

// Side effect: backup file to cache directory
// Returns the backup file path
export const backupFile = (filePath: string, resourceId: string, timestamp: number): string => {
  const cacheDir = ensureCacheDirectory();
  const fileName = basename(filePath);
  const backupFileName = `${resourceId}_${timestamp}_${fileName}`;
  const backupPath = join(cacheDir, backupFileName);

  copyFileSync(filePath, backupPath);

  return backupPath;
};

// Current highlights schema version. Bump this when the highlights table
// shape changes; the migration below recreates the table (highlight data is
// disposable across the anchor-model rewrite).
const HIGHLIGHTS_SCHEMA_VERSION = 2;

// Side effect: initialize highlights schema in database (with migrations).
export const initializeHighlightsSchema = (db: DatabaseHandle): void => {
  // content_hash / backup_path live on the resources table for file backups.
  try {
    db.exec("ALTER TABLE resources ADD COLUMN content_hash TEXT;");
  } catch {
    // Column already exists - ignore.
  }
  try {
    db.exec("ALTER TABLE resources ADD COLUMN backup_path TEXT;");
  } catch {
    // Column already exists - ignore.
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      version INTEGER NOT NULL
    );
  `);

  const row = db.prepare("SELECT version FROM schema_version WHERE id = 1").get() as
    | { version: number }
    | undefined;
  const currentVersion = row?.version ?? 0;

  if (currentVersion < HIGHLIGHTS_SCHEMA_VERSION) {
    // Recreate the highlights table on the text-quote anchor model.
    db.exec("DROP TABLE IF EXISTS highlights;");
    db.exec(`
      CREATE TABLE highlights (
        id TEXT PRIMARY KEY,
        resource_id TEXT NOT NULL,
        exact TEXT NOT NULL,
        prefix TEXT NOT NULL DEFAULT '',
        suffix TEXT NOT NULL DEFAULT '',
        notes TEXT,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (resource_id) REFERENCES resources(id) ON DELETE CASCADE
      );
    `);
    db.exec("CREATE INDEX IF NOT EXISTS idx_highlights_resource_id ON highlights(resource_id);");
    db.prepare("INSERT OR REPLACE INTO schema_version (id, version) VALUES (1, ?)").run(
      HIGHLIGHTS_SCHEMA_VERSION
    );
  }
};

// Pure function: get directory path from file path
export const getDirectoryPath = (filePath: string): string => dirname(filePath);

// Pure function: escape LIKE wildcards so a directory path is matched literally
const escapeLike = (value: string): string => value.replace(/[\\%_]/g, (char) => `\\${char}`);

// Pure function: build a [equalsParam, likeParam] pair matching a directory and
// everything beneath it, without prefix-collision (e.g. /docs vs /docs2).
const directoryMatchParams = (directoryPath: string): [string, string] => [
  directoryPath,
  `${escapeLike(directoryPath)}/%`,
];

// A stored highlight anchored by text-quote selector.
export type StoredHighlight = {
  id: string;
  exact: string;
  prefix: string;
  suffix: string;
  notes: string | null;
  createdAt: number;
};

// A stored highlight together with its owning resource path.
export type DirectoryHighlight = StoredHighlight & {
  resourceId: string;
  resourcePath: string;
};

// Side effect: create a text-quote-anchored highlight. Returns the new id.
export const createHighlight = (params: {
  db: DatabaseHandle;
  resourceId: string;
  exact: string;
  prefix: string;
  suffix: string;
  notes?: string;
}): string => {
  const highlightId = generateId();
  const stmt = params.db.prepare(`
    INSERT INTO highlights (id, resource_id, exact, prefix, suffix, notes, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    highlightId,
    params.resourceId,
    params.exact,
    params.prefix,
    params.suffix,
    params.notes || null,
    Date.now()
  );

  return highlightId;
};

// Side effect: get highlights for a resource
export const getHighlightsByResource = (
  db: DatabaseHandle,
  resourceId: string
): StoredHighlight[] => {
  const stmt = db.prepare(`
    SELECT id, exact, prefix, suffix, notes, created_at
    FROM highlights
    WHERE resource_id = ?
    ORDER BY created_at ASC
  `);

  const results = stmt.all(resourceId) as Array<{
    id: string;
    exact: string;
    prefix: string;
    suffix: string;
    notes: string | null;
    created_at: number;
  }>;

  return results.map((row) => ({
    id: row.id,
    exact: row.exact,
    prefix: row.prefix,
    suffix: row.suffix,
    notes: row.notes,
    createdAt: row.created_at,
  }));
};

// Side effect: get highlights for a directory
export const getHighlightsByDirectory = (
  db: DatabaseHandle,
  directoryPath: string
): DirectoryHighlight[] => {
  const stmt = db.prepare(`
    SELECT h.id, h.resource_id, r.path as resource_path,
           h.exact, h.prefix, h.suffix, h.notes, h.created_at
    FROM highlights h
    JOIN resources r ON h.resource_id = r.id
    WHERE r.path = ? OR r.path LIKE ? ESCAPE '\\'
    ORDER BY h.created_at DESC
  `);

  const results = stmt.all(...directoryMatchParams(directoryPath)) as Array<{
    id: string;
    resource_id: string;
    resource_path: string;
    exact: string;
    prefix: string;
    suffix: string;
    notes: string | null;
    created_at: number;
  }>;

  return results.map((row) => ({
    id: row.id,
    resourceId: row.resource_id,
    resourcePath: row.resource_path,
    exact: row.exact,
    prefix: row.prefix,
    suffix: row.suffix,
    notes: row.notes,
    createdAt: row.created_at,
  }));
};

// Side effect: delete highlight. Returns the number of rows deleted.
export const deleteHighlight = (db: DatabaseHandle, highlightId: string): number => {
  const stmt = db.prepare("DELETE FROM highlights WHERE id = ?");
  const result = stmt.run(highlightId);
  return result?.changes ?? 0;
};

// Side effect: update resource with content hash and backup path
export const updateResourceBackup = (
  db: DatabaseHandle,
  resourceId: string,
  contentHash: string,
  backupPath: string
): void => {
  const stmt = db.prepare(`
    UPDATE resources 
    SET content_hash = ?, backup_path = ?
    WHERE id = ?
  `);

  stmt.run(contentHash, backupPath, resourceId);
};

// Side effect: get resource by path
export const getResourceByPath = (
  db: DatabaseHandle,
  path: string
): {
  id: string;
  path: string;
  type: string;
  contentHash: string | null;
  backupPath: string | null;
  createdAt: number;
} | null => {
  const stmt = db.prepare(`
    SELECT id, path, type, content_hash, backup_path, created_at
    FROM resources
    WHERE path = ?
  `);

  const result = stmt.get(path) as
    | {
        id: string;
        path: string;
        type: string;
        content_hash: string | null;
        backup_path: string | null;
        created_at: number;
      }
    | undefined;

  if (!result) {
    return null;
  }

  return {
    id: result.id,
    path: result.path,
    type: result.type,
    contentHash: result.content_hash,
    backupPath: result.backup_path,
    createdAt: result.created_at,
  };
};

// Side effect: check if directory has highlights
export const directoryHasHighlights = (db: DatabaseHandle, directoryPath: string): boolean => {
  const stmt = db.prepare(`
    SELECT COUNT(*) as count
    FROM highlights h
    JOIN resources r ON h.resource_id = r.id
    WHERE r.path = ? OR r.path LIKE ? ESCAPE '\\'
  `);

  const result = stmt.get(...directoryMatchParams(directoryPath)) as { count: number };
  return result.count > 0;
};

// Pure function: format timestamp as ISO date string
const formatIsoDate = (timestamp: number): string => new Date(timestamp).toISOString();

// Pure function: generate markdown export content from highlights
export const generateMarkdownExport = (
  highlights: Array<{
    resourcePath: string;
    exact: string;
    notes: string | null;
    createdAt: number;
  }>,
  directoryPath: string
): string => {
  const timestamp = formatIsoDate(Date.now());
  const header = `# Highlights Export\n\n**Directory:** ${directoryPath}\n**Exported:** ${timestamp}\n**Total Highlights:** ${highlights.length}\n\n---\n\n`;

  const highlightBlocks = highlights
    .map((h) => {
      const fileName = basename(h.resourcePath);
      const date = formatIsoDate(h.createdAt);
      const notesSection = h.notes ? `\n\n**Note:**\n${h.notes}\n` : "";

      return `## ${fileName}\n\n**Created:** ${date}\n\n> ${h.exact}${notesSection}`;
    })
    .join("\n\n---\n\n");

  return header + highlightBlocks;
};

// Side effect: write markdown export to file
// Returns the absolute path of the written file
export const writeMarkdownExport = (content: string, filename: string): string => {
  const { ensureExportsDirectory } = require("./config");
  const { writeFileSync } = require("node:fs");

  const exportsDir = ensureExportsDirectory();
  const filePath = join(exportsDir, filename);

  writeFileSync(filePath, content, "utf-8");

  return filePath;
};

// Archive management functions

// Side effect: list all backup files in the archive
export const listArchiveFiles = (): Array<{
  path: string;
  size: number;
  mtime: number;
  resourceId: string;
  timestamp: number;
  originalName: string;
}> => {
  const { readdirSync, statSync } = require("node:fs");
  const cacheDir = resolveCacheDirectory();

  if (!existsSync(cacheDir)) {
    return [];
  }

  const files = readdirSync(cacheDir) as string[];

  return files
    .filter((file: string) => file.endsWith(".md"))
    .map((file: string) => {
      const filePath = join(cacheDir, file);
      const stats = statSync(filePath);

      // Parse filename: {resourceId}_{timestamp}_{originalName}
      const parts = file.split("_");
      const resourceId = parts[0] || "";
      const timestamp = Number.parseInt(parts[1] || "0", 10);
      const originalName = parts.slice(2).join("_");

      return {
        path: filePath,
        size: stats.size,
        mtime: stats.mtimeMs,
        resourceId,
        timestamp,
        originalName,
      };
    })
    .sort((a, b) => b.mtime - a.mtime); // Most recent first
};

// Side effect: get details for a specific backup file
export const getArchiveFileDetails = (
  searchPath: string
): {
  path: string;
  size: number;
  mtime: number;
  resourceId: string;
  timestamp: number;
  originalName: string;
  content: string;
} | null => {
  const { readFileSync } = require("node:fs");
  const allFiles = listArchiveFiles();

  // Find file by original name or resource ID
  const file = allFiles.find(
    (f) => f.originalName === searchPath || f.resourceId === searchPath || f.path === searchPath
  );

  if (!file) {
    return null;
  }

  const content = readFileSync(file.path, "utf-8") as string;

  return {
    ...file,
    content,
  };
};

// Side effect: clear all backup files from the archive
export const clearArchive = (): { deletedCount: number; freedBytes: number } => {
  const { rmSync } = require("node:fs");
  const files = listArchiveFiles();
  const freedBytes = files.reduce((sum, file) => sum + file.size, 0);
  const deletedCount = files.length;

  // Delete each file
  for (const file of files) {
    rmSync(file.path);
  }

  return { deletedCount, freedBytes };
};
