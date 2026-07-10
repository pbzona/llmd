import { describe, expect, test } from "bun:test";
import { escapeAttr, escapeHtml, scriptValue } from "./escape";

describe("escapeHtml", () => {
  test("escapes HTML-significant characters", () => {
    expect(escapeHtml('<img src=x onerror="alert(1)">')).toBe(
      "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;"
    );
  });

  test("escapes ampersands and single quotes", () => {
    expect(escapeHtml("Tom & Jerry's")).toBe("Tom &amp; Jerry&#39;s");
  });

  test("leaves plain text untouched", () => {
    expect(escapeHtml("hello world")).toBe("hello world");
  });
});

describe("escapeAttr", () => {
  test("escapes double quotes for attribute context", () => {
    expect(escapeAttr('a" onmouseover="x')).toBe("a&quot; onmouseover=&quot;x");
  });
});

describe("scriptValue", () => {
  test("produces a quoted JS string literal", () => {
    expect(scriptValue("/docs/readme.md")).toBe('"/docs/readme.md"');
  });

  test("neutralizes a closing script tag", () => {
    const encoded = scriptValue("</script><script>alert(1)");
    expect(encoded).not.toContain("</script>");
    expect(encoded).toContain("\\u003c");
  });

  test("round-trips through JSON.parse", () => {
    const original = "a'b\"c\n\\d";
    expect(JSON.parse(scriptValue(original))).toBe(original);
  });
});
