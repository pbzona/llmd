// Integration tests for the HTTP server (routing + security).

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { scanMarkdownFiles } from "./scanner";
import { getServerUrl, type ServerHandle, startServer } from "./server";
import type { Config } from "./types";

let server: ServerHandle;
let baseUrl: string;
let docsDir: string;
let dataDir: string;
const previousXdg = process.env.XDG_DATA_HOME;
const previousEvents = process.env.LLMD_ENABLE_EVENTS;

beforeAll(async () => {
  const root = mkdtempSync(join(tmpdir(), "llmd-http-"));
  docsDir = join(root, "docs");
  dataDir = join(root, "data");
  mkdirSync(docsDir, { recursive: true });

  // Isolate the analytics/highlights DB from the real user database.
  process.env.XDG_DATA_HOME = dataDir;
  process.env.LLMD_ENABLE_EVENTS = "true";

  writeFileSync(join(docsDir, "readme.md"), "# Hello\n\nThe quick brown fox.\n");
  writeFileSync(join(docsDir, "my file.md"), "# Spaced\n\ncontent\n");

  const config: Config = {
    directory: docsDir,
    port: 0,
    theme: "dark",
    open: false,
    watch: false,
    treeDepth: 5,
  };

  const files = await scanMarkdownFiles(docsDir, config.treeDepth);
  server = await startServer(config, files);
  baseUrl = getServerUrl(server);
});

afterAll(async () => {
  await server.stop();
  if (previousXdg === undefined) {
    Reflect.deleteProperty(process.env, "XDG_DATA_HOME");
  } else {
    process.env.XDG_DATA_HOME = previousXdg;
  }
  if (previousEvents === undefined) {
    Reflect.deleteProperty(process.env, "LLMD_ENABLE_EVENTS");
  } else {
    process.env.LLMD_ENABLE_EVENTS = previousEvents;
  }
  rmSync(dataDir, { recursive: true, force: true });
});

describe("Server routing", () => {
  test("serves the index page", async () => {
    const res = await fetch(`${baseUrl}/`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
  });

  test("serves a markdown view", async () => {
    const res = await fetch(`${baseUrl}/view/readme.md`);
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain("Hello");
  });

  test("decodes percent-encoded view paths (spaces)", async () => {
    const res = await fetch(`${baseUrl}/view/my%20file.md`);
    expect(res.status).toBe(200);
  });

  test("serves the inlined favicon", async () => {
    const res = await fetch(`${baseUrl}/_favicon`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/svg+xml");
  });

  test("returns 404 for unknown routes", async () => {
    const res = await fetch(`${baseUrl}/nope`);
    expect(res.status).toBe(404);
  });
});

describe("Server security", () => {
  test("rejects path traversal on /api/markdown/raw", async () => {
    const res = await fetch(`${baseUrl}/api/markdown/raw?path=../../../../etc/passwd`);
    expect(res.status).toBe(403);
  });

  test("rejects cross-origin API requests", async () => {
    const res = await fetch(`${baseUrl}/api/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "http://evil.example.com" },
      body: JSON.stringify({ type: "view", path: "readme.md", resourceType: "file" }),
    });
    expect(res.status).toBe(403);
  });
});

describe("Highlights API", () => {
  test("full create -> read -> delete lifecycle", async () => {
    const create = await fetch(`${baseUrl}/api/highlights`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resourcePath: "readme.md", highlightedText: "brown fox" }),
    });
    expect(create.status).toBe(201);
    const { id } = (await create.json()) as { id: string };
    expect(id).toBeTruthy();

    const list = await fetch(
      `${baseUrl}/api/highlights/resource?path=${encodeURIComponent("readme.md")}`
    );
    expect(list.status).toBe(200);
    const listed = (await list.json()) as { highlights: Array<{ id: string }> };
    expect(listed.highlights.some((h) => h.id === id)).toBe(true);

    // Deleting a non-existent id returns 404 (off-by-one regression guard).
    const missing = await fetch(`${baseUrl}/api/highlights/does-not-exist`, { method: "DELETE" });
    expect(missing.status).toBe(404);

    // Deleting the real id succeeds and actually removes it.
    const del = await fetch(`${baseUrl}/api/highlights/${id}`, { method: "DELETE" });
    expect(del.status).toBe(204);

    const after = await fetch(
      `${baseUrl}/api/highlights/resource?path=${encodeURIComponent("readme.md")}`
    );
    const remaining = (await after.json()) as { highlights: unknown[] };
    expect(remaining.highlights).toHaveLength(0);
  });
});
