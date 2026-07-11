import { describe, expect, test } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  backupFile,
  computeFileHash,
  createHighlight,
  deleteHighlight,
  directoryHasHighlights,
  getDirectoryPath,
  getHighlightsByDirectory,
  getHighlightsByResource,
  getResourceByPath,
  initializeHighlightsSchema,
  resolveCacheDirectory,
  updateResourceBackup,
} from "./highlights";
import type { DatabaseHandle } from "./types";

// Helper: create in-memory database for testing
const createTestDatabase = (): DatabaseHandle => {
  const { Database } = require("bun:sqlite");
  const db = new Database(":memory:");

  db.exec("PRAGMA foreign_keys = ON");
  db.exec(`
    CREATE TABLE resources (
      id TEXT PRIMARY KEY,
      path TEXT UNIQUE NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('file', 'dir')),
      created_at INTEGER NOT NULL,
      content_hash TEXT,
      backup_path TEXT
    );
  `);

  initializeHighlightsSchema(db);
  return db;
};

// Helper: insert test resource
const insertTestResource = (db: DatabaseHandle, id: string, path: string, type: string): void => {
  const stmt = db.prepare("INSERT INTO resources (id, path, type, created_at) VALUES (?, ?, ?, ?)");
  stmt.run(id, path, type, Date.now());
};

const anchorFor = (exact: string) => ({ exact, prefix: "", suffix: "" });

describe("computeFileHash", () => {
  test("generates consistent SHA-256 hash", () => {
    const hash1 = computeFileHash("Hello, world!");
    const hash2 = computeFileHash("Hello, world!");
    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64);
  });

  test("generates different hashes for different content", () => {
    expect(computeFileHash("Hello, world!")).not.toBe(computeFileHash("Hello, World!"));
  });
});

describe("resolveCacheDirectory", () => {
  test("returns path with llmd/file-backups subdirectory", () => {
    const cacheDir = resolveCacheDirectory();
    expect(cacheDir).toContain("llmd");
    expect(cacheDir).toContain("file-backups");
  });
});

describe("getDirectoryPath", () => {
  test("returns directory path from file path", () => {
    expect(getDirectoryPath("/Users/test/docs/guide.md")).toBe("/Users/test/docs");
  });
});

describe("schema migration", () => {
  test("initializes a fresh highlights table at the current version", () => {
    const db = createTestDatabase();
    const version = db.prepare("SELECT version FROM schema_version WHERE id = 1").get() as {
      version: number;
    };
    expect(version.version).toBe(2);
  });

  test("drops and recreates a legacy offset-based highlights table", () => {
    const { Database } = require("bun:sqlite");
    const db = new Database(":memory:") as DatabaseHandle;
    db.exec("PRAGMA foreign_keys = ON");
    db.exec(`
      CREATE TABLE resources (
        id TEXT PRIMARY KEY, path TEXT UNIQUE NOT NULL,
        type TEXT NOT NULL, created_at INTEGER NOT NULL
      );
    `);
    // Legacy table with the old offset columns and a row.
    db.exec(`
      CREATE TABLE highlights (
        id TEXT PRIMARY KEY, resource_id TEXT NOT NULL,
        start_offset INTEGER, end_offset INTEGER, highlighted_text TEXT
      );
    `);
    db.prepare("INSERT INTO highlights (id, resource_id) VALUES ('x', 'y')").run();

    initializeHighlightsSchema(db);

    // New schema: legacy data dropped, `exact` column present.
    const count = db.prepare("SELECT COUNT(*) as c FROM highlights").get() as { c: number };
    expect(count.c).toBe(0);
    insertTestResource(db, "r1", "/f.md", "file");
    const id = createHighlight({ db, resourceId: "r1", exact: "hi", prefix: "", suffix: "" });
    expect(getHighlightsByResource(db, "r1")[0]?.id).toBe(id);
  });
});

describe("highlight CRUD", () => {
  test("creates and reads a highlight by resource", () => {
    const db = createTestDatabase();
    insertTestResource(db, "resource-1", "/test/file.md", "file");

    const id = createHighlight({
      db,
      resourceId: "resource-1",
      exact: "brown fox",
      prefix: "quick ",
      suffix: " jumps",
      notes: "a note",
    });
    expect(typeof id).toBe("string");

    const highlights = getHighlightsByResource(db, "resource-1");
    expect(highlights).toHaveLength(1);
    expect(highlights[0]?.exact).toBe("brown fox");
    expect(highlights[0]?.prefix).toBe("quick ");
    expect(highlights[0]?.suffix).toBe(" jumps");
    expect(highlights[0]?.notes).toBe("a note");
  });

  test("getHighlightsByDirectory scopes to the directory subtree", () => {
    const db = createTestDatabase();
    insertTestResource(db, "r1", "/test/docs/file1.md", "file");
    insertTestResource(db, "r2", "/test/docs/file2.md", "file");
    insertTestResource(db, "r3", "/other/file3.md", "file");
    createHighlight({ db, resourceId: "r1", ...anchorFor("one") });
    createHighlight({ db, resourceId: "r2", ...anchorFor("two") });
    createHighlight({ db, resourceId: "r3", ...anchorFor("three") });

    const highlights = getHighlightsByDirectory(db, "/test/docs");
    expect(highlights).toHaveLength(2);
    expect(highlights.some((h) => h.exact === "three")).toBe(false);
  });

  test("does not match sibling directories with a shared prefix", () => {
    const db = createTestDatabase();
    insertTestResource(db, "r1", "/test/docs/a.md", "file");
    insertTestResource(db, "r2", "/test/docs-archive/b.md", "file");
    createHighlight({ db, resourceId: "r1", ...anchorFor("keep") });
    createHighlight({ db, resourceId: "r2", ...anchorFor("skip") });

    const highlights = getHighlightsByDirectory(db, "/test/docs");
    expect(highlights).toHaveLength(1);
    expect(highlights[0]?.exact).toBe("keep");
  });

  test("deleteHighlight removes the row and reports the count", () => {
    const db = createTestDatabase();
    insertTestResource(db, "resource-1", "/test/file.md", "file");
    const id = createHighlight({ db, resourceId: "resource-1", ...anchorFor("text") });

    expect(deleteHighlight(db, id)).toBe(1);
    expect(getHighlightsByResource(db, "resource-1")).toHaveLength(0);
  });

  test("deleteHighlight returns 0 when the highlight does not exist", () => {
    const db = createTestDatabase();
    expect(deleteHighlight(db, "does-not-exist")).toBe(0);
  });

  test("directoryHasHighlights reflects presence", () => {
    const db = createTestDatabase();
    insertTestResource(db, "r1", "/test/docs/file.md", "file");
    createHighlight({ db, resourceId: "r1", ...anchorFor("x") });

    expect(directoryHasHighlights(db, "/test/docs")).toBe(true);
    expect(directoryHasHighlights(db, "/other")).toBe(false);
  });

  test("updateResourceBackup stores hash and backup path", () => {
    const db = createTestDatabase();
    insertTestResource(db, "resource-1", "/test/file.md", "file");
    updateResourceBackup(db, "resource-1", "newhash123", "/backup/path.md");

    const resource = getResourceByPath(db, "/test/file.md");
    expect(resource?.contentHash).toBe("newhash123");
    expect(resource?.backupPath).toBe("/backup/path.md");
  });

  test("getResourceByPath returns null for a missing resource", () => {
    const db = createTestDatabase();
    expect(getResourceByPath(db, "/nonexistent.md")).toBeNull();
  });
});

describe("file operations", () => {
  test("backupFile creates a backup in the cache directory", () => {
    const testDir = join(tmpdir(), `llmd-test-${Date.now()}`);
    const testFile = join(testDir, "test.md");
    try {
      mkdirSync(testDir, { recursive: true });
      writeFileSync(testFile, "Test content");

      const backupPath = backupFile(testFile, "resource-123", 1_234_567_890);
      expect(backupPath).toContain("resource-123");
      expect(backupPath).toContain("1234567890");
      expect(backupPath).toContain("test.md");
    } finally {
      rmSync(testDir, { recursive: true, force: true });
    }
  });
});
