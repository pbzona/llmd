import { describe, expect, test } from "bun:test";
import type { IncomingMessage } from "node:http";
import { isLocalRequest, resolveSafePath } from "./http-utils";

const ROOT = "/srv/docs";

describe("resolveSafePath", () => {
  test("resolves a relative path within the root", () => {
    expect(resolveSafePath(ROOT, "guide.md")).toBe("/srv/docs/guide.md");
  });

  test("resolves nested relative paths", () => {
    expect(resolveSafePath(ROOT, "a/b/c.md")).toBe("/srv/docs/a/b/c.md");
  });

  test("allows absolute paths that stay within the root", () => {
    expect(resolveSafePath(ROOT, "/srv/docs/guide.md")).toBe("/srv/docs/guide.md");
  });

  test("rejects traversal escaping the root", () => {
    expect(resolveSafePath(ROOT, "../../etc/passwd")).toBeNull();
  });

  test("rejects absolute paths outside the root", () => {
    expect(resolveSafePath(ROOT, "/etc/passwd")).toBeNull();
  });

  test("rejects sibling-prefix collisions", () => {
    expect(resolveSafePath(ROOT, "/srv/docs-secret/x.md")).toBeNull();
  });

  test("resolves the root itself", () => {
    expect(resolveSafePath(ROOT, ".")).toBe("/srv/docs");
  });
});

// Minimal IncomingMessage stub for header-based checks.
const reqWith = (headers: Record<string, string | undefined>): IncomingMessage =>
  ({ headers }) as unknown as IncomingMessage;

describe("isLocalRequest", () => {
  test("accepts a loopback host with no origin", () => {
    expect(isLocalRequest(reqWith({ host: "localhost:8080" }))).toBe(true);
    expect(isLocalRequest(reqWith({ host: "127.0.0.1:8080" }))).toBe(true);
  });

  test("rejects a non-loopback host (DNS rebinding)", () => {
    expect(isLocalRequest(reqWith({ host: "evil.example.com" }))).toBe(false);
  });

  test("rejects a cross-origin request", () => {
    expect(
      isLocalRequest(reqWith({ host: "localhost:8080", origin: "http://evil.example.com" }))
    ).toBe(false);
  });

  test("accepts a same-origin loopback request", () => {
    expect(
      isLocalRequest(reqWith({ host: "localhost:8080", origin: "http://localhost:8080" }))
    ).toBe(true);
  });

  test("rejects a request with no host header", () => {
    expect(isLocalRequest(reqWith({}))).toBe(false);
  });
});
