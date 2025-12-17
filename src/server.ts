// HTTP server using Bun.serve() (functional style)

import { join } from "node:path";
import type { ServerWebSocket } from "bun";
import { getClientScriptTag } from "./client-assets";
import { processMarkdown } from "./markdown";
import { generateErrorPage, generateIndexPage, generateMarkdownPage } from "./template";
import type { Config, MarkdownFile } from "./types";
import { unwatchFile, watchFile } from "./watcher";

// Pure function: create HTML response headers with cache control
const htmlHeaders = (): HeadersInit => ({
  "Content-Type": "text/html",
  "Cache-Control": "no-cache, no-store, must-revalidate",
  Pragma: "no-cache",
  Expires: "0",
});

// Pure function: parse URL path to extract file path
const parseViewPath = (pathname: string): string | null => {
  if (!pathname.startsWith("/view/")) {
    return null;
  }

  const filePath = pathname.slice(6); // Remove "/view/"
  return filePath.endsWith(".md") ? filePath : null;
};

// Side effect: read markdown file
const readMarkdownFile = async (rootDir: string, relativePath: string): Promise<string | null> => {
  try {
    const fullPath = join(rootDir, relativePath);
    const file = Bun.file(fullPath);
    const content = await file.text();
    return content;
  } catch {
    return null;
  }
};

// Helper: handle markdown file view
const handleMarkdownView = async (
  viewPath: string,
  config: Config,
  files: MarkdownFile[],
  clientScript: string
): Promise<Response> => {
  const markdown = await readMarkdownFile(config.directory, viewPath);

  if (!markdown) {
    const html = generateErrorPage({
      errorCode: 404,
      message: `File not found: ${viewPath}`,
      files,
      config,
      clientScript,
    });
    return new Response(html, {
      status: 404,
      headers: htmlHeaders(),
    });
  }

  try {
    const { html, toc } = await processMarkdown(markdown, config.theme);
    const page = generateMarkdownPage({
      html,
      toc,
      fileName: viewPath.split("/").pop() ?? viewPath,
      files,
      config,
      currentPath: viewPath,
      clientScript,
    });

    return new Response(page, {
      headers: htmlHeaders(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to render markdown";
    const errorHtml = generateErrorPage({
      errorCode: 500,
      message,
      files,
      config,
      clientScript,
    });
    return new Response(errorHtml, {
      status: 500,
      headers: htmlHeaders(),
    });
  }
};

// Pure function: create server handler
const createHandler = (config: Config, files: MarkdownFile[], clientScript: string) => {
  return (
    req: Request,
    // biome-ignore lint/suspicious/noExplicitAny: Bun.serve has complex generic types that are hard to satisfy here
    server: any
  ): Promise<Response | undefined> | Response | undefined => {
    const url = new URL(req.url);
    const pathname = url.pathname;

    // Route: WebSocket upgrade (only if watch enabled)
    if (pathname === "/_ws" && config.watch) {
      if (server.upgrade(req)) {
        return; // WebSocket upgrade successful
      }
      return new Response("WebSocket upgrade failed", { status: 400 });
    }

    // Route: Font files
    if (pathname.startsWith("/_fonts/")) {
      const fontPath = pathname.slice(8); // Remove "/_fonts/"
      const fontFile = Bun.file(`./src/fonts/${fontPath}`);

      if (fontFile.size > 0) {
        return new Response(fontFile, {
          headers: {
            "Content-Type": "font/woff2",
            "Cache-Control": "public, max-age=31536000, immutable",
          },
        });
      }
    }

    // Route: Home page (directory index)
    if (pathname === "/") {
      const html = generateIndexPage(files, config, clientScript);
      return new Response(html, {
        headers: htmlHeaders(),
      });
    }

    // Route: View markdown file
    const viewPath = parseViewPath(pathname);
    if (viewPath) {
      return handleMarkdownView(viewPath, config, files, clientScript);
    }

    // 404 for unknown routes
    const notFoundHtml = generateErrorPage({
      errorCode: 404,
      message: "Page not found",
      files,
      config,
      clientScript,
    });
    return new Response(notFoundHtml, {
      status: 404,
      headers: htmlHeaders(),
    });
  };
};

// WebSocket message handler
const handleWebSocketMessage = (
  ws: ServerWebSocket<{ file: string }>,
  message: string | Buffer,
  config: Config
) => {
  try {
    const data = JSON.parse(message.toString());

    if (data.type === "watch" && data.file) {
      // Start watching this file
      watchFile(config.directory, data.file, ws);
    }
  } catch (err) {
    console.error("[ws] Failed to parse message:", err);
  }
};

// Public function: start server
export const startServer = async (config: Config, files: MarkdownFile[]) => {
  // Bundle client scripts once at startup
  const clientScript = await getClientScriptTag();

  const server = config.watch
    ? Bun.serve<{ file: string }>({
        port: config.port,
        hostname: config.host,
        fetch: createHandler(config, files, clientScript),
        websocket: {
          open(_ws) {
            console.log("[ws] Client connected");
          },
          message(ws, message) {
            handleWebSocketMessage(ws, message, config);
          },
          close(ws) {
            console.log("[ws] Client disconnected");
            // Stop watching all files for this client
            if (ws.data?.file) {
              unwatchFile(ws.data.file, ws);
            }
          },
        },
      })
    : // @ts-expect-error - Bun types require websocket even when not used
      Bun.serve<undefined>({
        port: config.port,
        hostname: config.host,
        fetch: createHandler(config, files, clientScript),
      });

  return server;
};

// Pure function: get URL for server
export const getServerUrl = (server: Awaited<ReturnType<typeof startServer>>): string =>
  `http://${server.hostname}:${server.port}`;
