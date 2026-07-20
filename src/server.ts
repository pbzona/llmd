// HTTP server using Node.js http + ws

import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { Socket } from "node:net";
import type { WebSocket } from "ws";
import { WebSocketServer } from "ws";
import {
  getClientScript,
  getClientScriptTag,
  getClientScriptTagExternal,
  hasSourceMaps,
} from "./client-assets";
import { initEventService } from "./events";
import { resolveSafePath, sendResponse, sendText } from "./http-utils";
import { processMarkdown } from "./markdown";
import { handleApiRoute } from "./routes/api";
import { generateErrorPage, generateIndexPage, generateMarkdownPage } from "./template";
import { getTheme } from "./theme-config";
import type { Config, EventService, MarkdownFile } from "./types";
import { cleanupAllWatchers, unwatchFile, watchFile } from "./watcher";

// Inlined favicon so it ships with the single-file bundle (no fs dependency).
const FAVICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><defs><linearGradient id="blueGrad" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" style="stop-color:#60a5fa;stop-opacity:1"/><stop offset="100%" style="stop-color:#2563eb;stop-opacity:1"/></linearGradient></defs><path d="M16 6 L16 20 M16 20 L10 14 M16 20 L22 14" stroke="url(#blueGrad)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>`;

// A running server instance with a consistent public API.
export type ServerHandle = {
  hostname: string;
  port: number;
  stop: () => Promise<void>;
};

// WebSocket augmented with the set of files a client is watching.
type WatchSocket = WebSocket & { files?: Set<string> };

// Pure function: create HTML response headers with cache control
const htmlHeaders = (): Record<string, string> => ({
  "Content-Type": "text/html",
  "Cache-Control": "no-cache, no-store, must-revalidate",
  Pragma: "no-cache",
  Expires: "0",
});

// Pure function: parse and decode a /view/ URL path to a relative file path
const parseViewPath = (pathname: string): string | null => {
  if (!pathname.startsWith("/view/")) {
    return null;
  }

  let filePath: string;
  try {
    filePath = decodeURIComponent(pathname.slice(6)); // Remove "/view/"
  } catch {
    return null; // Malformed percent-encoding
  }

  return filePath.endsWith(".md") ? filePath : null;
};

// Side effect: read a markdown file constrained to the served directory.
// Returns null when the path escapes the root or the file cannot be read.
const readMarkdownFile = async (rootDir: string, relativePath: string): Promise<string | null> => {
  const fullPath = resolveSafePath(rootDir, relativePath);
  if (!fullPath) {
    return null;
  }

  try {
    return await readFile(fullPath, "utf-8");
  } catch {
    return null;
  }
};

// Helper: resolve the Shiki code theme for the active UI theme
const resolveCodeTheme = (config: Config): string => {
  const theme = getTheme(config.theme);
  if (theme.codeTheme) {
    return theme.codeTheme;
  }
  return config.theme === "light" || config.theme === "solarized" ? "github-light" : "github-dark";
};

// Helper: handle markdown file view. Serves clean HTML; highlights are
// resolved and painted on the client against the rendered document.
const handleMarkdownView = async (params: {
  viewPath: string;
  config: Config;
  files: MarkdownFile[];
  clientScript: string;
  res: ServerResponse;
}): Promise<void> => {
  const { viewPath, config, files, clientScript, res } = params;
  const markdown = await readMarkdownFile(config.directory, viewPath);

  if (markdown === null) {
    const html = generateErrorPage({
      errorCode: 404,
      message: `File not found: ${viewPath}`,
      files,
      config,
      clientScript,
    });
    sendResponse(res, 404, htmlHeaders(), html);
    return;
  }

  try {
    const filename = viewPath.split("/").pop() ?? viewPath;
    const { html, toc } = await processMarkdown(markdown, resolveCodeTheme(config));
    const page = generateMarkdownPage({
      html,
      toc,
      fileName: filename,
      files,
      config,
      currentPath: viewPath,
      clientScript,
    });

    sendResponse(res, 200, htmlHeaders(), page);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to render markdown";
    const errorHtml = generateErrorPage({
      errorCode: 500,
      message,
      files,
      config,
      clientScript,
    });
    sendResponse(res, 500, htmlHeaders(), errorHtml);
  }
};

// Helper: serve the analytics page
const handleAnalyticsPage = async (params: {
  url: URL;
  config: Config;
  files: MarkdownFile[];
  clientScript: string;
  res: ServerResponse;
  eventService: EventService;
}): Promise<void> => {
  const { url, config, files, clientScript, res, eventService } = params;
  try {
    const showAllHistory = url.searchParams.get("all") === "true";
    const directory = showAllHistory
      ? undefined
      : url.searchParams.get("directory") || config.directory;

    const analytics = await eventService.getAnalytics(directory);
    analytics.timeSeries = await eventService.getActivityTimeSeries(directory || null, 7);

    const { generateAnalyticsPage } = await import("./analytics-template");
    const html = generateAnalyticsPage({
      data: analytics,
      config,
      files,
      clientScript,
      showAllHistory,
    });
    sendResponse(res, 200, htmlHeaders(), html);
  } catch (err) {
    console.error("[analytics] Failed to generate analytics page:", err);
    const errorHtml = generateErrorPage({
      errorCode: 500,
      message: "Failed to load analytics",
      files,
      config,
      clientScript,
    });
    sendResponse(res, 500, htmlHeaders(), errorHtml);
  }
};

// Helper: serve the highlights page
const handleHighlightsPage = async (params: {
  url: URL;
  config: Config;
  files: MarkdownFile[];
  clientScript: string;
  res: ServerResponse;
  eventService: EventService;
}): Promise<void> => {
  const { url, config, files, clientScript, res, eventService } = params;
  try {
    const requested = url.searchParams.get("directory") || config.directory;
    const directory = resolveSafePath(config.directory, requested) ?? config.directory;

    const { getHighlightsByDirectory } = await import("./highlights");
    const { extractPlainText } = await import("./markdown");
    const { resolveAnchor } = await import("./anchor");
    const highlights = getHighlightsByDirectory(eventService.getDatabase(), directory);

    // Compute staleness (display-only) by resolving each anchor against the
    // rendered plain text of its file. Rendered text is cached per file.
    const textCache = new Map<string, string | null>();
    const renderedText = (filePath: string): string | null => {
      const cached = textCache.get(filePath);
      if (cached !== undefined) {
        return cached;
      }
      let text: string | null = null;
      try {
        text = extractPlainText(readFileSync(filePath, "utf-8"));
      } catch {
        text = null;
      }
      textCache.set(filePath, text);
      return text;
    };

    const views = highlights.map((h) => {
      const text = renderedText(h.resourcePath);
      return {
        id: h.id,
        resourcePath: h.resourcePath,
        exact: h.exact,
        notes: h.notes,
        createdAt: h.createdAt,
        isStale: text === null || resolveAnchor(text, h) === null,
      };
    });

    const { generateHighlightsPage } = await import("./highlights-template");
    const html = generateHighlightsPage({
      directory,
      config,
      files,
      clientScript,
      highlights: views,
    });
    sendResponse(res, 200, htmlHeaders(), html);
  } catch (err) {
    console.error("[highlights] Failed to generate highlights page:", err);
    const errorHtml = generateErrorPage({
      errorCode: 500,
      message: "Failed to load highlights",
      files,
      config,
      clientScript,
    });
    sendResponse(res, 500, htmlHeaders(), errorHtml);
  }
};

// Helper: serve built-in static assets (client bundle, favicon). Returns true
// when the request was handled.
const serveStaticAsset = async (pathname: string, res: ServerResponse): Promise<boolean> => {
  if (pathname === "/_client.js") {
    const clientJs = await getClientScript();
    if (clientJs) {
      res.writeHead(200, {
        "Content-Type": "application/javascript",
        "Cache-Control": "no-cache, no-store, must-revalidate",
      });
      res.end(clientJs);
    } else {
      sendText(res, 404, "Client script not found");
    }
    return true;
  }

  if (pathname === "/_favicon") {
    res.writeHead(200, {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=31536000, immutable",
    });
    res.end(FAVICON_SVG);
    return true;
  }

  return false;
};

// Context shared by every page/route handler for a single request.
type RequestContext = {
  config: Config;
  files: MarkdownFile[];
  clientScript: string;
  eventService: EventService | null;
};

// Log markdown/home page requests (kept out of the hot dispatch path).
const logPageRequest = (method: string | undefined, pathname: string): void => {
  if (pathname === "/" || pathname.startsWith("/view/")) {
    const timestamp = new Date().toISOString().split("T")[1]?.split(".")[0];
    console.log(`[${timestamp}] ${method} ${pathname}`);
  }
};

// Route a non-API, non-asset request to the correct page handler.
const routePage = async (url: URL, res: ServerResponse, ctx: RequestContext): Promise<void> => {
  const { config, files, clientScript, eventService } = ctx;
  const pathname = url.pathname;

  if (pathname === "/analytics" || pathname === "/highlights") {
    if (!eventService) {
      sendText(res, 501, "Events disabled");
      return;
    }
    const params = { url, config, files, clientScript, res, eventService };
    await (pathname === "/analytics" ? handleAnalyticsPage(params) : handleHighlightsPage(params));
    return;
  }

  if (pathname === "/") {
    sendResponse(res, 200, htmlHeaders(), generateIndexPage(files, config, clientScript));
    return;
  }

  const viewPath = parseViewPath(pathname);
  if (viewPath) {
    await handleMarkdownView({ viewPath, config, files, clientScript, res });
    return;
  }

  const notFoundHtml = generateErrorPage({
    errorCode: 404,
    message: "Page not found",
    files,
    config,
    clientScript,
  });
  sendResponse(res, 404, htmlHeaders(), notFoundHtml);
};

// Pure function: create request handler (returns handler with side effects)
const createHandler = (
  config: Config,
  files: MarkdownFile[],
  clientScript: string,
  eventService: EventService | null
) => {
  const ctx: RequestContext = { config, files, clientScript, eventService };

  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
    logPageRequest(req.method, url.pathname);

    if (await handleApiRoute({ req, res, pathname: url.pathname, url, config, eventService })) {
      return;
    }

    if (await serveStaticAsset(url.pathname, res)) {
      return;
    }

    await routePage(url, res, ctx);
  };
};

// WebSocket message handler
const handleWebSocketMessage = (ws: WatchSocket, message: Buffer, config: Config): void => {
  try {
    const data = JSON.parse(message.toString());
    if (data.type === "watch" && typeof data.file === "string") {
      if (!ws.files) {
        ws.files = new Set();
      }
      ws.files.add(data.file);
      // biome-ignore lint/suspicious/noExplicitAny: ws subscriber compatibility
      watchFile(config.directory, data.file, ws as any);
    }
  } catch (err) {
    console.error("[ws] Failed to parse message:", err);
  }
};

// Side effect: attach the WebSocket server for live reload
const setupWebSocketServer = (
  server: ReturnType<typeof createServer>,
  config: Config
): WebSocketServer => {
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (request, socket, head) => {
    const url = new URL(request.url ?? "/", `http://${request.headers.host}`);
    if (url.pathname === "/_ws") {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit("connection", ws, request);
      });
    } else {
      socket.destroy();
    }
  });

  wss.on("connection", (ws: WatchSocket) => {
    console.log("[ws] Client connected");

    ws.on("message", (message: Buffer) => {
      handleWebSocketMessage(ws, message, config);
    });

    ws.on("close", () => {
      console.log("[ws] Client disconnected");
      // Stop watching every file this client subscribed to.
      for (const file of ws.files ?? []) {
        // biome-ignore lint/suspicious/noExplicitAny: ws subscriber compatibility
        unwatchFile(file, ws as any);
      }
      ws.files?.clear();
    });
  });

  return wss;
};

// Public function: start server
export const startServer = async (config: Config, files: MarkdownFile[]): Promise<ServerHandle> => {
  // Initialize event service
  const eventService = initEventService(config);

  // Record "open" event for root directory
  eventService?.recordEvent("open", config.directory, "dir");

  // Bundle client scripts once at startup.
  // Use an external script tag if source maps are present (dev mode).
  const devMode = await hasSourceMaps();
  const clientScript = devMode ? getClientScriptTagExternal() : await getClientScriptTag();

  const server = createServer(createHandler(config, files, clientScript, eventService));
  const sockets = new Set<Socket>();
  server.on("connection", (socket) => {
    sockets.add(socket);
    socket.once("close", () => sockets.delete(socket));
  });

  const wss = config.watch ? setupWebSocketServer(server, config) : undefined;

  // Start listening
  await new Promise<void>((resolve) => {
    server.listen(config.port, "localhost", resolve);
  });

  // Get actual assigned port (important when using port 0)
  const address = server.address();
  const actualPort = typeof address === "object" && address !== null ? address.port : config.port;

  return {
    hostname: "localhost",
    port: actualPort,
    stop: async (): Promise<void> => {
      eventService?.close();
      cleanupAllWatchers();
      for (const client of wss?.clients ?? []) {
        client.terminate();
      }
      wss?.close();
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
        // Graceful close waits for active requests, including stalled request bodies.
        for (const socket of sockets) {
          socket.destroy();
        }
      });
    },
  };
};

// Pure function: get URL for server
export const getServerUrl = (server: ServerHandle): string =>
  `http://${server.hostname}:${server.port}`;
