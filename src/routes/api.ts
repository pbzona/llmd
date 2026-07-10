// API routes handler

import type { IncomingMessage, ServerResponse } from "node:http";
import { isLocalRequest, parseJsonBody, resolveSafePath, sendJson, sendText } from "../http-utils";
import type { Config, EventService } from "../types";
import {
  handleCreateHighlight,
  handleDeleteHighlight,
  handleGetDirectoryHighlights,
  handleGetResourceHighlights,
} from "./highlights";

// Prefix for highlight-scoped routes (used for ID extraction).
const HIGHLIGHTS_PREFIX = "/api/highlights/";

// Context for route handlers (also the public entry-point argument)
export type RouteContext = {
  req: IncomingMessage;
  res: ServerResponse;
  pathname: string;
  url: URL;
  config: Config;
  eventService: EventService | null;
};

// Handle events API routes
const handleEventsRoute = async (ctx: RouteContext): Promise<boolean> => {
  if (ctx.pathname !== "/api/events" || ctx.req.method !== "POST") {
    return false;
  }

  if (!ctx.eventService) {
    sendText(ctx.res, 501, "Events disabled");
    return true;
  }

  try {
    const body = (await parseJsonBody(ctx.req)) as {
      type: "view" | "open";
      path: string;
      resourceType: "file" | "dir";
    };

    // Only record events for resources inside the served directory.
    const absolutePath = resolveSafePath(ctx.config.directory, body.path);
    if (absolutePath) {
      ctx.eventService.recordEvent(body.type, absolutePath, body.resourceType);
    }
    sendJson(ctx.res, 204, {});
    return true;
  } catch (err) {
    console.error("[events] Failed to record event:", err);
    sendText(ctx.res, 400, "Invalid request");
    return true;
  }
};

// Handle analytics API routes
const handleAnalyticsRoute = async (ctx: RouteContext): Promise<boolean> => {
  // Analytics data endpoint
  if (ctx.pathname === "/api/analytics" && ctx.req.method === "GET") {
    if (!ctx.eventService) {
      sendJson(ctx.res, 501, { error: "Events disabled" });
      return true;
    }

    try {
      const directory = ctx.url.searchParams.get("directory") || undefined;
      const analytics = await ctx.eventService.getAnalytics(directory);
      sendJson(ctx.res, 200, analytics);
      return true;
    } catch (err) {
      console.error("[events] Failed to get analytics:", err);
      sendJson(ctx.res, 500, { error: "Failed to get analytics" });
      return true;
    }
  }

  // Analytics timeseries endpoint
  if (ctx.pathname === "/api/analytics/timeseries" && ctx.req.method === "GET") {
    if (!ctx.eventService) {
      sendJson(ctx.res, 501, { error: "Events disabled" });
      return true;
    }

    try {
      const directory = ctx.url.searchParams.get("directory");
      const days = Number.parseInt(ctx.url.searchParams.get("days") || "7", 10);
      const timeSeries = await ctx.eventService.getActivityTimeSeries(directory, days);
      sendJson(ctx.res, 200, timeSeries);
      return true;
    } catch (err) {
      console.error("[events] Failed to get timeseries:", err);
      sendJson(ctx.res, 500, { error: "Failed to get timeseries" });
      return true;
    }
  }

  return false;
};

// Handle markdown API routes
const handleMarkdownRoute = async (ctx: RouteContext): Promise<boolean> => {
  if (!ctx.pathname.startsWith("/api/markdown")) {
    return false;
  }

  // Get raw markdown content (constrained to the served directory)
  if (ctx.pathname === "/api/markdown/raw" && ctx.req.method === "GET") {
    const markdownPath = ctx.url.searchParams.get("path");
    if (!markdownPath) {
      sendText(ctx.res, 400, "Missing path parameter");
      return true;
    }

    const absolutePath = resolveSafePath(ctx.config.directory, markdownPath);
    if (!absolutePath) {
      sendText(ctx.res, 403, "Path outside served directory");
      return true;
    }

    try {
      const { readFile } = await import("node:fs/promises");
      const content = await readFile(absolutePath, "utf-8");
      sendJson(ctx.res, 200, { content });
    } catch {
      sendText(ctx.res, 404, "File not found");
    }
    return true;
  }

  return false;
};

// Handle highlights API routes
const handleHighlightsRoute = async (ctx: RouteContext): Promise<boolean> => {
  if (!ctx.pathname.startsWith("/api/highlights")) {
    return false;
  }

  if (!ctx.eventService) {
    sendText(ctx.res, 501, "Events disabled");
    return true;
  }

  const db = ctx.eventService.getDatabase();

  // Create highlight
  if (ctx.pathname === "/api/highlights" && ctx.req.method === "POST") {
    await handleCreateHighlight(ctx.req, ctx.res, { config: ctx.config, db });
    return true;
  }

  // Get highlights by resource
  if (ctx.pathname === "/api/highlights/resource" && ctx.req.method === "GET") {
    handleGetResourceHighlights(ctx.res, { config: ctx.config, db }, ctx.url);
    return true;
  }

  // Get highlights by directory
  if (ctx.pathname === "/api/highlights/directory" && ctx.req.method === "GET") {
    handleGetDirectoryHighlights(ctx.res, { config: ctx.config, db }, ctx.url);
    return true;
  }

  // Delete highlight
  if (ctx.pathname.startsWith(HIGHLIGHTS_PREFIX) && ctx.req.method === "DELETE") {
    const highlightId = ctx.pathname.slice(HIGHLIGHTS_PREFIX.length);
    if (!highlightId || highlightId.includes("/")) {
      sendText(ctx.res, 400, "Invalid highlight ID");
      return true;
    }

    handleDeleteHighlight(ctx.res, { config: ctx.config, db }, highlightId);
    return true;
  }

  return false;
};

// Main API router - dispatches to specific route handlers
export const handleApiRoute = async (ctx: RouteContext): Promise<boolean> => {
  if (!ctx.pathname.startsWith("/api/")) {
    return false;
  }

  // Reject cross-origin / non-loopback requests (DNS-rebinding + CSRF guard).
  if (!isLocalRequest(ctx.req)) {
    sendText(ctx.res, 403, "Forbidden");
    return true;
  }

  // Try each route handler
  if (await handleEventsRoute(ctx)) {
    return true;
  }
  if (await handleAnalyticsRoute(ctx)) {
    return true;
  }
  if (await handleMarkdownRoute(ctx)) {
    return true;
  }
  return handleHighlightsRoute(ctx);
};
