// API routes for highlights management

import { readFileSync } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import {
  backupFile,
  computeFileHash,
  createHighlight,
  deleteHighlight,
  getHighlightsByDirectory,
  getHighlightsByResource,
  getResourceByPath,
  updateResourceBackup,
} from "../highlights";
import { parseJsonBody, resolveSafePath, sendJson } from "../http-utils";
import type { Config, DatabaseHandle } from "../types";

// Context object for route handlers
type RouteContext = {
  config: Config;
  db: DatabaseHandle;
};

// Side effect: back up a file the first time it gains a highlight, so an
// original copy is retained in the archive (`llmd archive`).
const backupOnFirstHighlight = (
  ctx: RouteContext,
  resource: { id: string; backupPath: string | null },
  absolutePath: string
): void => {
  if (resource.backupPath) {
    return;
  }
  try {
    const contentHash = computeFileHash(readFileSync(absolutePath, "utf-8"));
    const backupPath = backupFile(absolutePath, resource.id, Date.now());
    updateResourceBackup(ctx.db, resource.id, contentHash, backupPath);
  } catch (err) {
    // Backup is best-effort; never block highlight creation on it.
    console.error("[highlights] Failed to back up file:", err);
  }
};

// POST /api/highlights - Create a new text-quote-anchored highlight
export const handleCreateHighlight = async (
  req: IncomingMessage,
  res: ServerResponse,
  ctx: RouteContext
): Promise<void> => {
  try {
    const body = (await parseJsonBody(req)) as {
      resourcePath: string;
      exact: string;
      prefix?: string;
      suffix?: string;
      notes?: string;
    };

    if (!(body.resourcePath && body.exact)) {
      sendJson(res, 400, { error: "Missing required fields (resourcePath, exact)" });
      return;
    }

    const absolutePath = resolveSafePath(ctx.config.directory, body.resourcePath);
    if (!absolutePath) {
      sendJson(res, 403, { error: "Path outside served directory" });
      return;
    }

    const resource = getResourceByPath(ctx.db, absolutePath);
    if (!resource) {
      sendJson(res, 404, { error: "Resource not found" });
      return;
    }

    backupOnFirstHighlight(ctx, resource, absolutePath);

    const highlightId = createHighlight({
      db: ctx.db,
      resourceId: resource.id,
      exact: body.exact,
      prefix: body.prefix ?? "",
      suffix: body.suffix ?? "",
      notes: body.notes,
    });

    sendJson(res, 201, { id: highlightId });
  } catch (err) {
    console.error("[highlights] Failed to create highlight:", err);
    sendJson(res, 500, { error: "Failed to create highlight" });
  }
};

// GET /api/highlights/resource?path=... - Get highlights for a resource.
// Read-only: never mutates highlight data. The client resolves anchors against
// the rendered document and paints them.
export const handleGetResourceHighlights = (
  res: ServerResponse,
  ctx: RouteContext,
  url: URL
): void => {
  try {
    const resourcePath = url.searchParams.get("path");
    if (!resourcePath) {
      sendJson(res, 400, { error: "Missing path parameter" });
      return;
    }

    const absolutePath = resolveSafePath(ctx.config.directory, resourcePath);
    if (!absolutePath) {
      sendJson(res, 403, { error: "Path outside served directory" });
      return;
    }

    const resource = getResourceByPath(ctx.db, absolutePath);
    if (!resource) {
      sendJson(res, 200, { highlights: [] });
      return;
    }

    sendJson(res, 200, { highlights: getHighlightsByResource(ctx.db, resource.id) });
  } catch (err) {
    console.error("[highlights] Failed to get resource highlights:", err);
    sendJson(res, 500, { error: "Failed to get resource highlights" });
  }
};

// GET /api/highlights/directory?path=... - Get highlights for a directory
export const handleGetDirectoryHighlights = (
  res: ServerResponse,
  ctx: RouteContext,
  url: URL
): void => {
  try {
    const directoryPath = url.searchParams.get("path") ?? ctx.config.directory;

    const absolutePath = resolveSafePath(ctx.config.directory, directoryPath);
    if (!absolutePath) {
      sendJson(res, 403, { error: "Path outside served directory" });
      return;
    }

    sendJson(res, 200, { highlights: getHighlightsByDirectory(ctx.db, absolutePath) });
  } catch (err) {
    console.error("[highlights] Failed to get directory highlights:", err);
    sendJson(res, 500, { error: "Failed to get directory highlights" });
  }
};

// DELETE /api/highlights/:id - Delete a highlight
export const handleDeleteHighlight = (
  res: ServerResponse,
  ctx: RouteContext,
  highlightId: string
): void => {
  try {
    if (deleteHighlight(ctx.db, highlightId) === 0) {
      sendJson(res, 404, { error: "Highlight not found" });
      return;
    }
    sendJson(res, 204, {});
  } catch (err) {
    console.error("[highlights] Failed to delete highlight:", err);
    sendJson(res, 500, { error: "Failed to delete highlight" });
  }
};
