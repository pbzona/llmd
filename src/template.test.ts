import { describe, expect, test } from "bun:test";
import { baseLayout } from "./template";

const DESIGN_CASES = [
  { theme: "vesper", design: "technical", contentWidth: "920px" },
  { theme: "folio", design: "editorial", contentWidth: "700px" },
  { theme: "ember", design: "cozy", contentWidth: "780px" },
] as const;

const renderTheme = (theme: string): string =>
  baseLayout({
    content: "<p>Theme preview</p>",
    title: "Preview",
    theme,
    files: [],
  });

describe("theme visual designs", () => {
  for (const { theme, design, contentWidth } of DESIGN_CASES) {
    test(`renders the ${design} design for ${theme}`, () => {
      const html = renderTheme(theme);

      expect(html).toContain(`data-design="${design}"`);
      expect(html).toContain(`body[data-design="${design}"]`);
      expect(html).toContain(`max-width: ${contentWidth}`);
    });
  }

  test("keeps legacy themes on the original design", () => {
    const html = renderTheme("dark");

    expect(html).not.toContain("data-design=");
    expect(html).not.toContain('body[data-design="technical"]');
    expect(html).not.toContain('body[data-design="editorial"]');
    expect(html).not.toContain('body[data-design="cozy"]');
  });
});
