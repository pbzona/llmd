// Markdown parsing and rendering (functional style)

import { marked } from "marked";
import { highlightCode } from "./highlighter";

// Configure marked for GFM
marked.setOptions({
  gfm: true,
  breaks: false,
});

// Regex for heading detection (moved to top level for performance)
const HEADING_REGEX = /^(#{1,6})\s+(.+)$/;

// Slug construction regexes (top-level for performance)
const MD_LINK_REGEX = /\[([^\]]+)\]\([^)]*\)/g;
const HTML_TAG_REGEX = /<[^>]+>/g;
const MD_MARKER_REGEX = /[`*_~]/g;
const NON_SLUG_REGEX = /[^\w\s-]/g;
const WHITESPACE_REGEX = /\s+/g;

// Pure function: slugify heading text into a stable anchor id.
// Strips markdown links/emphasis and any rendered HTML tags so that the id
// computed from markdown source (TOC) matches the id computed from rendered
// HTML (heading element).
const slugifyHeading = (text: string): string =>
  text
    .replace(MD_LINK_REGEX, "$1")
    .replace(HTML_TAG_REGEX, "")
    .replace(MD_MARKER_REGEX, "")
    .toLowerCase()
    .replace(NON_SLUG_REGEX, "")
    .trim()
    .replace(WHITESPACE_REGEX, "-");

// Pure function: disambiguate duplicate slugs in document order (foo, foo-1, ...)
const makeUniqueSlug = (slug: string, seen: Map<string, number>): string => {
  const count = seen.get(slug) ?? 0;
  seen.set(slug, count + 1);
  return count === 0 ? slug : `${slug}-${count}`;
};

// Pure function: extract headings from markdown for TOC
export const extractHeadings = (
  markdown: string
): Array<{ level: number; text: string; id: string }> => {
  const headings: Array<{ level: number; text: string; id: string }> = [];
  const lines = markdown.split("\n");
  const seenSlugs = new Map<string, number>();
  let inCodeBlock = false;

  for (const line of lines) {
    // Track code fence boundaries (``` or ~~~)
    if (line.trim().startsWith("```") || line.trim().startsWith("~~~")) {
      inCodeBlock = !inCodeBlock;
      continue;
    }

    // Skip lines inside code blocks
    if (inCodeBlock) {
      continue;
    }

    const match = line.match(HEADING_REGEX);
    if (match) {
      const level = match[1]!.length;
      const text = match[2]!.trim();
      const id = makeUniqueSlug(slugifyHeading(text), seenSlugs);
      headings.push({ level, text, id });
    }
  }

  return headings;
};

// Markdown link rewriting regexes (top-level for performance)
// Matches [text](path.md) or [text](./path.md) with an optional #fragment.
const MARKDOWN_MD_LINK_REGEX = /\[([^\]]+)\]\((?:\.\/)?([^)\s#]+\.md)(#[^)]*)?\)/g;
const ABSOLUTE_URL_REGEX = /^(?:[a-z][a-z0-9+.-]*:)?\/\//i;

// Pure function: rewrite relative markdown links to /view/ URLs.
// Leaves absolute URLs untouched and preserves #fragments.
const rewriteMarkdownLinks = (markdown: string): string =>
  markdown.replace(MARKDOWN_MD_LINK_REGEX, (match, text, path, fragment = "") =>
    ABSOLUTE_URL_REGEX.test(path) ? match : `[${text}](/view/${path}${fragment})`
  );

// Pure function: render markdown to HTML
export const renderMarkdown = (markdown: string): string => {
  const rewritten = rewriteMarkdownLinks(markdown);
  const html = marked.parse(rewritten) as string;
  return html;
};

// Pure function: decode the HTML entities marked emits (named + numeric).
const decodeHtmlEntities = (html: string): string =>
  html
    .replace(/&#(\d+);/g, (_m, dec) => String.fromCodePoint(Number.parseInt(dec, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_m, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");

const HTML_TAG_STRIP_REGEX = /<[^>]+>/g;

// Pure function: extract the rendered plain text of a markdown document.
// This approximates the text content of the rendered `.markdown-body` element
// and is the coordinate space that highlight anchors resolve against.
export const extractPlainText = (markdown: string): string => {
  const html = renderMarkdown(markdown);
  return decodeHtmlEntities(html.replace(HTML_TAG_STRIP_REGEX, ""));
};

// Pure function: convert inline backtick code to <code> tags
const renderInlineCode = (text: string): string => text.replace(/`([^`]+)`/g, "<code>$1</code>");

// Pure function: generate table of contents HTML from headings
export const generateTOC = (
  headings: Array<{ level: number; text: string; id: string }>
): string => {
  if (headings.length === 0) {
    return "";
  }

  const items = headings
    .map(
      (h) =>
        `<li class="toc-level-${h.level}"><a href="#${h.id}">${renderInlineCode(h.text)}</a></li>`
    )
    .join("\n");

  return `<nav class="toc collapsed"><h3>Contents</h3><ul>${items}</ul></nav>`;
};

// Heading element regex (marked emits <hN>...</hN> with no attributes)
const HEADING_ELEMENT_REGEX = /<h([1-6])>(.+?)<\/h\1>/g;

// Pure function: add IDs to headings in HTML.
// When `ids` is supplied (from extractHeadings) it is consumed in document
// order so the anchors match the TOC exactly; otherwise ids are derived here.
export const addHeadingIds = (html: string, ids?: string[]): string => {
  const seenSlugs = new Map<string, number>();
  let index = 0;

  return html.replace(HEADING_ELEMENT_REGEX, (_match, level, text) => {
    const id = ids
      ? (ids[index] ?? slugifyHeading(text))
      : makeUniqueSlug(slugifyHeading(text), seenSlugs);
    index += 1;
    return `<h${level} id="${id}">${text}</h${level}>`;
  });
};

// Code block regex for syntax highlighting
const CODE_BLOCK_REGEX = /<pre><code(?:\s+class="language-(\w+)")?>([\s\S]*?)<\/code><\/pre>/g;

// Pure function: decode HTML entities produced by marked inside code blocks.
// `&amp;` is decoded last so escaped entities (e.g. `&amp;quot;`) survive.
const decodeCodeEntities = (code: string): string =>
  code
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");

// Function: apply syntax highlighting to code blocks in HTML
const applySyntaxHighlighting = async (html: string, codeTheme?: string): Promise<string> => {
  const matches = Array.from(html.matchAll(CODE_BLOCK_REGEX));
  let result = html;

  for (const match of matches) {
    const [fullMatch, lang, code] = match;
    if (!(fullMatch && code)) {
      continue;
    }

    const decodedCode = decodeCodeEntities(code);
    const highlighted = await highlightCode(decodedCode, lang, codeTheme);

    // Use a replacer function so `$&`/`$'` in highlighted output are literal.
    result = result.replace(fullMatch, () => highlighted);
  }

  return result;
};

// Combined function: full markdown processing pipeline
export const processMarkdown = async (
  markdown: string,
  codeTheme?: string
): Promise<{ html: string; toc: string }> => {
  const headings = extractHeadings(markdown);
  const rawHtml = renderMarkdown(markdown);
  const htmlWithIds = addHeadingIds(
    rawHtml,
    headings.map((h) => h.id)
  );
  const htmlWithHighlighting = await applySyntaxHighlighting(htmlWithIds, codeTheme);
  const toc = generateTOC(headings);

  return { html: htmlWithHighlighting, toc };
};
