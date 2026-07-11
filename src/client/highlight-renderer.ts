// Client-side highlight painting and navigation.
//
// Highlights are stored as text-quote anchors (see ../anchor). On each page
// load the client resolves them against the rendered document text and wraps
// the matching ranges in <mark> elements. Nothing is persisted here.

import { type Anchor, resolveAnchor } from "../anchor";

export type PaintableHighlight = Anchor & { id: string };

export type PaintResult = {
  paintedIds: Set<string>;
  staleIds: Set<string>;
};

type TextSpan = { node: Text; start: number; end: number };

const ANNOTATION_ROOT_SELECTOR = ".markdown-body";
const FLASH_DURATION_MS = 1000;

// The element whose text highlights are anchored against.
export const getAnnotationRoot = (): HTMLElement | null =>
  document.querySelector(ANNOTATION_ROOT_SELECTOR);

// Walk every text node under `root`, building the canonical text and a map of
// each text node to its [start, end) offset within that text.
const buildTextMap = (root: Element): { text: string; spans: TextSpan[] } => {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const spans: TextSpan[] = [];
  let text = "";

  let node = walker.nextNode();
  while (node) {
    const value = node.textContent ?? "";
    spans.push({ node: node as Text, start: text.length, end: text.length + value.length });
    text += value;
    node = walker.nextNode();
  }

  return { text, spans };
};

// The full canonical text of the annotation root.
export const getCanonicalText = (root: Element): string => buildTextMap(root).text;

// Canonical offset of a DOM position (node + offset within it).
export const canonicalOffset = (root: Element, node: Node, offset: number): number => {
  const range = document.createRange();
  range.selectNodeContents(root);
  range.setEnd(node, offset);
  return range.toString().length;
};

// Remove existing highlight marks, restoring plain text nodes.
const removeExistingHighlights = (root: Element): void => {
  const marks = root.querySelectorAll("mark.llmd-highlight");
  for (const mark of Array.from(marks)) {
    const parent = mark.parentNode;
    if (parent) {
      parent.replaceChild(document.createTextNode(mark.textContent ?? ""), mark);
    }
  }
  root.normalize();
};

// Wrap [localStart, localEnd) of a single text node in a <mark>.
const wrapTextNode = (span: TextSpan, localStart: number, localEnd: number, id: string): void => {
  const value = span.node.textContent ?? "";
  const middle = value.slice(localStart, localEnd);
  const parent = span.node.parentNode;
  if (!(parent && middle)) {
    return;
  }

  const before = value.slice(0, localStart);
  const after = value.slice(localEnd);

  const mark = document.createElement("mark");
  mark.className = "llmd-highlight";
  mark.dataset.highlightId = id;
  mark.style.cursor = "pointer";
  mark.textContent = middle;

  const fragment = document.createDocumentFragment();
  if (before) {
    fragment.appendChild(document.createTextNode(before));
  }
  fragment.appendChild(mark);
  if (after) {
    fragment.appendChild(document.createTextNode(after));
  }
  parent.replaceChild(fragment, span.node);
};

// Wrap a resolved [start, end) range, splitting across intersecting text nodes.
const applyRange = (spans: TextSpan[], start: number, end: number, id: string): void => {
  const affected = spans.filter((s) => s.start < end && s.end > start);
  // Wrap right-to-left so untouched (leftward) node references stay valid.
  for (let i = affected.length - 1; i >= 0; i -= 1) {
    const span = affected[i] as TextSpan;
    const localStart = Math.max(0, start - span.start);
    const localEnd = Math.min((span.node.textContent ?? "").length, end - span.start);
    wrapTextNode(span, localStart, localEnd, id);
  }
};

// Pure function: keep only non-overlapping ranges (first-come by start offset).
const dropOverlaps = <T extends { start: number; end: number }>(ranges: T[]): T[] => {
  const sorted = [...ranges].sort((a, b) => a.start - b.start);
  const kept: T[] = [];
  let lastEnd = -1;
  for (const range of sorted) {
    if (range.start >= lastEnd) {
      kept.push(range);
      lastEnd = range.end;
    }
  }
  return kept;
};

// Resolve and paint highlights into the annotation root.
export const paintHighlights = (root: Element, highlights: PaintableHighlight[]): PaintResult => {
  removeExistingHighlights(root);

  const canonical = buildTextMap(root).text;
  const paintedIds = new Set<string>();
  const staleIds = new Set<string>();

  const resolved: Array<{ id: string; start: number; end: number }> = [];
  for (const highlight of highlights) {
    const range = resolveAnchor(canonical, highlight);
    if (range) {
      resolved.push({ id: highlight.id, start: range.start, end: range.end });
      paintedIds.add(highlight.id);
    } else {
      staleIds.add(highlight.id);
    }
  }

  // Apply from last to first, rebuilding the (offset-stable) node map each time.
  const ordered = dropOverlaps(resolved).sort((a, b) => b.start - a.start);
  for (const range of ordered) {
    const { spans } = buildTextMap(root);
    applyRange(spans, range.start, range.end, range.id);
  }

  return { paintedIds, staleIds };
};

// Scroll to a painted highlight by id. Returns true if it was found.
export const scrollToHighlight = (
  highlightId: string,
  behavior: ScrollBehavior = "smooth"
): boolean => {
  const marks = document.querySelectorAll(
    `mark.llmd-highlight[data-highlight-id="${highlightId}"]`
  );

  const firstMark = marks[0];
  if (!firstMark) {
    return false;
  }

  firstMark.scrollIntoView({ behavior, block: "center" });
  for (const mark of Array.from(marks)) {
    mark.classList.add("highlight-flash");
    setTimeout(() => mark.classList.remove("highlight-flash"), FLASH_DURATION_MS);
  }
  return true;
};
