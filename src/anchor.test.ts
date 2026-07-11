import { describe, expect, test } from "bun:test";
import { type Anchor, buildAnchor, CONTEXT_LENGTH, resolveAnchor } from "./anchor";

describe("buildAnchor", () => {
  test("captures exact text plus bounded context", () => {
    const text = "The quick brown fox jumps over the lazy dog";
    const start = text.indexOf("brown fox");
    const anchor = buildAnchor(text, start, start + "brown fox".length);

    expect(anchor.exact).toBe("brown fox");
    expect(anchor.prefix.endsWith("quick ")).toBe(true);
    expect(anchor.suffix.startsWith(" jumps")).toBe(true);
    expect(anchor.prefix.length).toBeLessThanOrEqual(CONTEXT_LENGTH);
    expect(anchor.suffix.length).toBeLessThanOrEqual(CONTEXT_LENGTH);
  });

  test("clamps context at the document boundaries", () => {
    const text = "hello world";
    const anchor = buildAnchor(text, 0, 5);
    expect(anchor.prefix).toBe("");
    expect(anchor.exact).toBe("hello");
    expect(anchor.suffix).toBe(" world");
  });
});

describe("resolveAnchor", () => {
  const anchor = (exact: string, prefix = "", suffix = ""): Anchor => ({ exact, prefix, suffix });

  test("resolves a unique quote", () => {
    const text = "The quick brown fox";
    expect(resolveAnchor(text, anchor("brown fox"))).toEqual({ start: 10, end: 19 });
  });

  test("returns null when the quote is gone (stale)", () => {
    expect(resolveAnchor("The quick red fox", anchor("brown fox"))).toBeNull();
  });

  test("returns null for an empty quote", () => {
    expect(resolveAnchor("anything", anchor(""))).toBeNull();
  });

  test("disambiguates repeated text using context", () => {
    const text = "alpha target beta target gamma target";
    // Second occurrence: preceded by 'beta ', followed by ' gamma'.
    const resolved = resolveAnchor(text, anchor("target", "beta ", " gamma"));
    expect(resolved).toEqual({
      start: text.indexOf("beta target") + 5,
      end: text.indexOf("beta target") + 11,
    });
  });

  test("survives edits above the highlight (offset shift)", () => {
    const original = "intro paragraph\nThe quick brown fox";
    const start = original.indexOf("brown fox");
    const a = buildAnchor(original, start, start + "brown fox".length);

    const edited = "a much longer intro paragraph with more words\nThe quick brown fox";
    const resolved = resolveAnchor(edited, a);
    expect(resolved).not.toBeNull();
    expect(edited.slice(resolved!.start, resolved!.end)).toBe("brown fox");
  });

  test("picks the correct duplicate after surrounding edits", () => {
    const original = "see foo here and foo there";
    const secondStart = original.indexOf("foo there");
    const a = buildAnchor(original, secondStart, secondStart + 3); // the second 'foo'

    // Insert text before both occurrences; context still selects the 2nd 'foo'.
    const edited = "PREFIX see foo here and foo there";
    const resolved = resolveAnchor(edited, a);
    expect(resolved?.start).toBe(edited.indexOf("foo there"));
  });

  test("handles multi-byte characters (emoji / CJK)", () => {
    const text = "start 日本語 middle 🎉 end";
    const emojiStart = text.indexOf("🎉");
    const a = buildAnchor(text, emojiStart, emojiStart + "🎉".length);
    const resolved = resolveAnchor(text, a);
    expect(resolved).not.toBeNull();
    expect(text.slice(resolved!.start, resolved!.end)).toBe("🎉");
  });
});
