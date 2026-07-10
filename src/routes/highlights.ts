// API routes for highlights management

import { readFileSync } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import {
  backupFile,
  computeFileHash,
  createHighlight,
  deleteHighlight,
  findTextOffset,
  getHighlightsByDirectory,
  getHighlightsByResource,
  getResourceByPath,
  markHighlightStale,
  markStaleHighlights,
  updateResourceBackup,
} from "../highlights";
import { parseJsonBody, resolveSafePath, sendJson } from "../http-utils";
import type { Config, DatabaseHandle } from "../types";

// Context object for route handlers
type RouteContext = {
  config: Config;
  db: DatabaseHandle;
};

// Pure function: check whether two strings differ only in whitespace
const differsOnlyByWhitespace = (a: string, b: string): boolean => {
  const normalize = (text: string): string => text.replace(/\s+/g, " ").trim();
  return normalize(a) === normalize(b);
};

// POST /api/highlights - Create a new highlight
export const handleCreateHighlight = async (
  req: IncomingMessage,
  res: ServerResponse,
  ctx: RouteContext
): Promise<void> => {
  try {
    const body = (await parseJsonBody(req)) as {
      resourcePath: string;
      highlightedText: string;
      occurrenceIndex?: number;
      notes?: string;
    };

    // Validate required fields
    if (!(body.resourcePath && body.highlightedText)) {
      sendJson(res, 400, { error: "Missing required fields" });
      return;
    }

    // Constrain the resource path to the served directory
    const absolutePath = resolveSafePath(ctx.config.directory, body.resourcePath);
    if (!absolutePath) {
      sendJson(res, 403, { error: "Path outside served directory" });
      return;
    }

    // Get resource
    const resource = getResourceByPath(ctx.db, absolutePath);
    if (!resource) {
      sendJson(res, 404, { error: "Resource not found" });
      return;
    }

    // Read file content (markdown source) and compute hash
    const fileContent = readFileSync(absolutePath, "utf-8");
    const contentHash = computeFileHash(fileContent);

    // Calculate offsets from the markdown source with occurrence index
    const occurrenceIndex = body.occurrenceIndex ?? 0;
    const offsets = findTextOffset(fileContent, body.highlightedText, occurrenceIndex);

    if (!offsets) {
      sendJson(res, 400, {
        error:
          "Could not locate text in source file. Text may not exist at the specified occurrence.",
      });
      return;
    }

    // Determine staleness: text found but not an exact substring match
    const extractedText = fileContent.slice(offsets.startOffset, offsets.endOffset);
    const isStale =
      extractedText !== body.highlightedText &&
      !differsOnlyByWhitespace(extractedText, body.highlightedText);

    // Create backup if this is the first highlight for this resource
    if (!resource.backupPath) {
      const backupPath = backupFile(absolutePath, resource.id, Date.now());
      updateResourceBackup(ctx.db, resource.id, contentHash, backupPath);
    }

    // Create highlight with offsets calculated from markdown source
    const highlightId = createHighlight({
      db: ctx.db,
      resourceId: resource.id,
      startOffset: offsets.startOffset,
      endOffset: offsets.endOffset,
      highlightedText: body.highlightedText,
      contentHash,
      notes: body.notes,
    });

    if (isStale) {
      markHighlightStale(ctx.db, highlightId);
    }

    sendJson(res, 201, { id: highlightId, isStale });
  } catch (err) {
    console.error("[highlights] Failed to create highlight:", err);
    sendJson(res, 500, { error: "Failed to create highlight" });
  }
};

// GET /api/highlights/resource?path=... - Get highlights for a resource
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
      sendJson(res, 404, { error: "Resource not found" });
      return;
    }

    // Non-destructive: mark highlights stale when the file has changed.
    // Reads never delete user data; cleanup is an explicit action.
    try {
      const fileContent = readFileSync(absolutePath, "utf-8");
      markStaleHighlights(ctx.db, resource.id, fileContent);
    } catch {
      // File temporarily unreadable (e.g. mid atomic-save) - leave highlights as-is.
    }

    const highlights = getHighlightsByResource(ctx.db, resource.id);
    sendJson(res, 200, { highlights });
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

    const highlights = getHighlightsByDirectory(ctx.db, absolutePath);
    sendJson(res, 200, { highlights });
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
    const deletedCount = deleteHighlight(ctx.db, highlightId);
    if (deletedCount === 0) {
      sendJson(res, 404, { error: "Highlight not found" });
      return;
    }
    sendJson(res, 204, {});
  } catch (err) {
    console.error("[highlights] Failed to delete highlight:", err);
    sendJson(res, 500, { error: "Failed to delete highlight" });
  }
};
