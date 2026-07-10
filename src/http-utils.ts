// Shared HTTP helpers used by the server and its route handlers.

import type { IncomingMessage, ServerResponse } from "node:http";
import { isAbsolute, resolve, sep } from "node:path";

// Maximum accepted request body size (1 MB) to bound memory usage.
const MAX_BODY_BYTES = 1024 * 1024;

// Loopback host names that identify a local request.
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

// Regex to strip a trailing ":port" from a Host header value.
const PORT_SUFFIX_REGEX = /:\d+$/;

// Helper: send a JSON response. A 204 response is sent without a body per RFC 9110.
export const sendJson = (res: ServerResponse, statusCode: number, data: unknown): void => {
  if (statusCode === 204) {
    res.writeHead(204);
    res.end();
    return;
  }
  res.writeHead(statusCode, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
};

// Helper: send a raw response with explicit headers.
export const sendResponse = (
  res: ServerResponse,
  statusCode: number,
  headers: Record<string, string>,
  body: string
): void => {
  res.writeHead(statusCode, headers);
  res.end(body);
};

// Helper: send a plain-text response.
export const sendText = (res: ServerResponse, statusCode: number, message: string): void => {
  sendResponse(res, statusCode, { "Content-Type": "text/plain" }, message);
};

// Helper: parse a JSON request body, rejecting bodies that exceed the size cap.
export const parseJsonBody = async (req: IncomingMessage): Promise<unknown> =>
  new Promise((resolvePromise, reject) => {
    let body = "";
    let size = 0;
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error("Request body too large"));
        req.destroy();
        return;
      }
      body += chunk.toString();
    });
    req.on("end", () => {
      try {
        resolvePromise(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });

// Pure function: extract the hostname (without port) from a Host header value.
const hostnameFromHeader = (host: string): string =>
  host.replace(PORT_SUFFIX_REGEX, "").toLowerCase();

// Pure function: determine whether a request originates from localhost.
// Guards against DNS rebinding (the Host header must be a loopback address)
// and cross-origin browser requests (the Origin header, when present, must
// also be a loopback address).
export const isLocalRequest = (req: IncomingMessage): boolean => {
  const host = req.headers.host;
  if (!(host && LOOPBACK_HOSTS.has(hostnameFromHeader(host)))) {
    return false;
  }

  const origin = req.headers.origin;
  if (!origin) {
    return true;
  }

  try {
    return LOOPBACK_HOSTS.has(new URL(origin).hostname.toLowerCase());
  } catch {
    return false;
  }
};

// Pure function: resolve a user-supplied path against a root directory,
// returning the absolute path only if it stays within the root. Returns null
// for any path (absolute or containing "..") that escapes the root.
export const resolveSafePath = (root: string, input: string): string | null => {
  const rootResolved = resolve(root);
  const resolved = isAbsolute(input) ? resolve(input) : resolve(rootResolved, input);
  if (resolved === rootResolved || resolved.startsWith(rootResolved + sep)) {
    return resolved;
  }
  return null;
};
