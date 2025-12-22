// Advanced highlight rendering system
// Implements deterministic, offset-based text highlighting with navigation support

/**
 * CANONICAL TEXT MODEL
 * ====================
 *
 * Offsets refer to a canonical plain-text representation of the document.
 * This is extracted by:
 * 1. Walking all text nodes in the rendered HTML DOM (document order)
 * 2. Skipping text inside existing highlight marks
 * 3. Concatenating text content as-is (no normalization)
 *
 * This ensures:
 * - Consistent offset mapping between server (markdown source) and client (rendered HTML)
 * - Independence from HTML structure
 * - Resilience to DOM changes
 */

// ============================================================================
// TYPES
// ============================================================================

export type HighlightRange = {
  id: string;
  startOffset: number;
  endOffset: number;
  quote: string; // The actual highlighted text
  isStale: boolean;
  notes: string | null;
};

type TextNodeMapping = {
  node: Text;
  globalStartOffset: number;
  globalEndOffset: number;
};

// ============================================================================
// CANONICAL TEXT EXTRACTION
// ============================================================================

/**
 * Extract canonical text representation from the DOM.
 * This is the "ground truth" that all offsets refer to.
 *
 * @param root - Root element to extract text from (typically .content)
 * @returns Canonical text string
 */
export const extractCanonicalText = (root: Element): string => {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const textParts: string[] = [];

  let node = walker.nextNode();
  while (node) {
    // Skip text inside existing highlight marks
    if (!isInsideHighlight(node, root)) {
      const text = node.textContent;
      if (text) {
        textParts.push(text);
      }
    }
    node = walker.nextNode();
  }

  return textParts.join("");
};

/**
 * Check if a node is inside a highlight mark element.
 */
const isInsideHighlight = (node: Node, root: Element): boolean => {
  let parent = node.parentElement;
  while (parent && parent !== root) {
    if (parent.tagName === "MARK" && parent.classList.contains("llmd-highlight")) {
      return true;
    }
    parent = parent.parentElement;
  }
  return false;
};

// ============================================================================
// DOM WALKING AND OFFSET MAPPING
// ============================================================================

/**
 * Build a map of all text nodes to their global offsets.
 * This is used to locate which text nodes contain highlight ranges.
 *
 * @param root - Root element to walk
 * @returns Array of text node mappings
 */
export const buildTextNodeMap = (root: Element): TextNodeMapping[] => {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const mappings: TextNodeMapping[] = [];
  let globalOffset = 0;

  let node = walker.nextNode();
  while (node) {
    if (!isInsideHighlight(node, root)) {
      const text = node.textContent || "";
      const startOffset = globalOffset;
      const endOffset = globalOffset + text.length;

      mappings.push({
        node: node as Text,
        globalStartOffset: startOffset,
        globalEndOffset: endOffset,
      });

      globalOffset = endOffset;
    }
    node = walker.nextNode();
  }

  console.log("[highlight-renderer] Built text node map:", {
    totalNodes: mappings.length,
    totalLength: globalOffset,
    firstFewNodes: mappings.slice(0, 3).map((m) => ({
      text: m.node.textContent?.slice(0, 50),
      start: m.globalStartOffset,
      end: m.globalEndOffset,
    })),
  });

  return mappings;
};

/**
 * Find text nodes that intersect with a given highlight range.
 *
 * @param mappings - Text node mappings
 * @param startOffset - Highlight start offset
 * @param endOffset - Highlight end offset
 * @returns Array of intersecting text nodes with local offsets
 */
const findIntersectingNodes = (
  mappings: TextNodeMapping[],
  startOffset: number,
  endOffset: number
): Array<{ node: Text; localStart: number; localEnd: number }> => {
  const result: Array<{ node: Text; localStart: number; localEnd: number }> = [];

  for (const mapping of mappings) {
    // Check if this node intersects with the highlight range
    const startsBeforeEnd = mapping.globalStartOffset < endOffset;
    const endsAfterStart = mapping.globalEndOffset > startOffset;
    const intersects = startsBeforeEnd && endsAfterStart;

    if (intersects) {
      // Calculate local offsets within this text node
      const localStart = Math.max(0, startOffset - mapping.globalStartOffset);
      const localEnd = Math.min(
        mapping.node.textContent?.length || 0,
        endOffset - mapping.globalStartOffset
      );

      result.push({
        node: mapping.node,
        localStart,
        localEnd,
      });
    }
  }

  return result;
};

// ============================================================================
// HIGHLIGHT RANGE VALIDATION
// ============================================================================

/**
 * Normalize and validate highlight ranges.
 *
 * Policy:
 * - Ranges must be [start, end) with start < end
 * - Ranges are sorted by startOffset
 * - Overlapping ranges are REJECTED (not supported)
 * - Adjacent ranges (end === start) are allowed
 *
 * @param ranges - Array of highlight ranges
 * @returns Normalized and validated ranges, or validation error
 */
export const validateHighlightRanges = (
  ranges: HighlightRange[]
): { valid: true; ranges: HighlightRange[] } | { valid: false; error: string } => {
  // Validate individual ranges
  for (const range of ranges) {
    if (range.startOffset >= range.endOffset) {
      return {
        valid: false,
        error: `Invalid range: startOffset (${range.startOffset}) >= endOffset (${range.endOffset})`,
      };
    }
    if (range.startOffset < 0) {
      return { valid: false, error: `Invalid range: negative startOffset (${range.startOffset})` };
    }
  }

  // Sort by startOffset
  const sorted = [...ranges].sort((a, b) => a.startOffset - b.startOffset);

  // Check for overlaps
  for (let i = 0; i < sorted.length - 1; i++) {
    const current = sorted[i];
    const next = sorted[i + 1];
    const hasCurrentAndNext = current && next;
    if (!hasCurrentAndNext) {
      continue;
    }

    if (current.endOffset > next.startOffset) {
      return {
        valid: false,
        error: `Overlapping highlights detected: [${current.startOffset}, ${current.endOffset}) overlaps with [${next.startOffset}, ${next.endOffset})`,
      };
    }
  }

  return { valid: true, ranges: sorted };
};

// ============================================================================
// TEXT NODE SPLITTING AND WRAPPING
// ============================================================================

/**
 * Split a text node at specified offsets and wrap the middle part.
 *
 * Example:
 *   Original: "Hello world"
 *   Split at [0, 5]: <mark>Hello</mark> world
 *   Split at [6, 11]: Hello <mark>world</mark>
 *   Split at [3, 8]: Hel<mark>lo wo</mark>rld
 *
 * @param params - Parameters object
 * @returns The created mark element
 */
const splitAndWrapTextNode = (params: {
  node: Text;
  localStart: number;
  localEnd: number;
  highlightId: string;
  isStale: boolean;
}): HTMLElement => {
  const { node, localStart, localEnd, highlightId, isStale } = params;
  const text = node.textContent || "";
  const parent = node.parentNode;

  if (!parent) {
    throw new Error("Text node has no parent");
  }

  // Create the three parts: before, highlight, after
  const before = text.slice(0, localStart);
  const highlighted = text.slice(localStart, localEnd);
  const after = text.slice(localEnd);

  // Create mark element
  const mark = document.createElement("mark");
  mark.className = isStale ? "llmd-highlight llmd-highlight-stale" : "llmd-highlight";
  mark.dataset.highlightId = highlightId;
  mark.textContent = highlighted;
  mark.style.cursor = "pointer";

  if (isStale) {
    mark.title = "This highlight may be outdated";
  }

  // Replace the original text node with the three parts
  const fragment = document.createDocumentFragment();

  if (before) {
    fragment.appendChild(document.createTextNode(before));
  }

  fragment.appendChild(mark);

  if (after) {
    fragment.appendChild(document.createTextNode(after));
  }

  parent.replaceChild(fragment, node);

  return mark;
};

/**
 * Apply a single highlight to the DOM by splitting and wrapping text nodes.
 *
 * @param root - Root element
 * @param mappings - Text node mappings
 * @param range - Highlight range to apply
 * @returns Array of created mark elements
 */
const applyHighlightRange = (mappings: TextNodeMapping[], range: HighlightRange): HTMLElement[] => {
  const intersectingNodes = findIntersectingNodes(mappings, range.startOffset, range.endOffset);

  const marks: HTMLElement[] = [];

  for (const { node, localStart, localEnd } of intersectingNodes) {
    const mark = splitAndWrapTextNode({
      node,
      localStart,
      localEnd,
      highlightId: range.id,
      isStale: range.isStale,
    });
    marks.push(mark);
  }

  return marks;
};

// ============================================================================
// RENDERING ALGORITHM
// ============================================================================

/**
 * Render all highlights into the DOM.
 *
 * Algorithm:
 * 1. Remove existing highlight marks
 * 2. Normalize text nodes
 * 3. Validate highlight ranges
 * 4. Build text node map
 * 5. Apply highlights in REVERSE order (end to start)
 *    - This prevents offset shifts as we split nodes
 *
 * @param root - Root element to render into
 * @param ranges - Array of highlight ranges
 * @returns Result with created marks or error
 */
export const renderHighlights = (
  root: Element,
  ranges: HighlightRange[]
): { success: true; marks: Map<string, HTMLElement[]> } | { success: false; error: string } => {
  console.log("[highlight-renderer] Rendering highlights:", {
    count: ranges.length,
    ranges: ranges.map((r) => ({
      id: r.id,
      start: r.startOffset,
      end: r.endOffset,
      quote: r.quote.slice(0, 50),
    })),
  });

  // Step 1: Remove existing highlights
  removeExistingHighlights(root);

  // Step 2: Normalize text nodes
  root.normalize();

  // Step 3: Validate ranges
  const validation = validateHighlightRanges(ranges);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  const validRanges = validation.ranges;

  if (validRanges.length === 0) {
    return { success: true, marks: new Map() };
  }

  // Step 4: Build text node map
  let mappings = buildTextNodeMap(root);
  const canonicalText = extractCanonicalText(root);
  console.log("[highlight-renderer] Canonical text:", {
    length: canonicalText.length,
    first100: canonicalText.slice(0, 100),
  });

  // Step 5: Apply highlights in REVERSE order
  const marks = new Map<string, HTMLElement[]>();

  for (let i = validRanges.length - 1; i >= 0; i--) {
    const range = validRanges[i];
    if (!range) {
      continue;
    }

    console.log("[highlight-renderer] Applying range:", {
      id: range.id,
      start: range.startOffset,
      end: range.endOffset,
      quote: range.quote,
      actualText: canonicalText.slice(range.startOffset, range.endOffset),
    });

    const createdMarks = applyHighlightRange(mappings, range);
    marks.set(range.id, createdMarks);

    // Rebuild mappings after DOM modification
    if (i > 0) {
      mappings = buildTextNodeMap(root);
    }
  }

  return { success: true, marks };
};

/**
 * Remove all existing highlight marks from the DOM.
 */
const removeExistingHighlights = (root: Element): void => {
  const marks = root.querySelectorAll("mark.llmd-highlight");
  for (const mark of Array.from(marks)) {
    const parent = mark.parentNode;
    if (parent) {
      const textNode = document.createTextNode(mark.textContent || "");
      parent.replaceChild(textNode, mark);
    }
  }
};

// ============================================================================
// NAVIGATION AND SCROLLING
// ============================================================================

/**
 * Scroll to a highlight by its ID.
 *
 * @param highlightId - Highlight ID
 * @param behavior - Scroll behavior (smooth or auto)
 * @returns true if highlight was found and scrolled to
 */
export const scrollToHighlight = (
  highlightId: string,
  behavior: ScrollBehavior = "smooth"
): boolean => {
  const marks = document.querySelectorAll(
    `mark.llmd-highlight[data-highlight-id="${highlightId}"]`
  );

  if (marks.length === 0) {
    return false;
  }

  const firstMark = marks[0];
  if (!firstMark) {
    return false;
  }

  // Scroll into view
  firstMark.scrollIntoView({
    behavior,
    block: "center",
  });

  // Add flash animation
  for (const mark of Array.from(marks)) {
    mark.classList.add("highlight-flash");
    setTimeout(() => {
      mark.classList.remove("highlight-flash");
    }, 1000);
  }

  return true;
};

/**
 * Get the DOM range for a highlight by ID.
 * Useful for programmatic selection or offset calculation.
 *
 * @param highlightId - Highlight ID
 * @returns DOM Range or null
 */
export const getHighlightRange = (highlightId: string): Range | null => {
  const marks = document.querySelectorAll(
    `mark.llmd-highlight[data-highlight-id="${highlightId}"]`
  );

  if (marks.length === 0) {
    return null;
  }

  const range = document.createRange();
  const marksArray = Array.from(marks);
  const firstMark = marksArray[0];
  const lastMark = marksArray.at(-1);

  const hasMarks = firstMark && lastMark;
  if (!hasMarks) {
    return null;
  }

  range.setStartBefore(firstMark);
  range.setEndAfter(lastMark);

  return range;
};

// ============================================================================
// OFFSET CALCULATION (for selection to highlight conversion)
// ============================================================================

/**
 * Calculate global offset for a DOM position (node + offset).
 * This is used to convert user selections into highlight ranges.
 *
 * @param root - Root element
 * @param targetNode - Target node
 * @param targetOffset - Offset within target node
 * @returns Global offset in canonical text
 */
export const calculateGlobalOffset = (
  root: Element,
  targetNode: Node,
  targetOffset: number
): number => {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let globalOffset = 0;
  let node = walker.nextNode();

  console.log("[calculateGlobalOffset] Looking for target node, targetOffset:", targetOffset);

  while (node) {
    if (!isInsideHighlight(node, root)) {
      const nodeText = node.textContent || "";
      console.log("[calculateGlobalOffset] Checking node:", {
        text: nodeText.slice(0, 50),
        isTarget: node === targetNode,
        currentOffset: globalOffset,
      });

      if (node === targetNode) {
        const result = globalOffset + targetOffset;
        console.log("[calculateGlobalOffset] Found target! Offset:", result);
        return result;
      }
      globalOffset += nodeText.length;
    }
    node = walker.nextNode();
  }

  console.log("[calculateGlobalOffset] Target not found, returning:", globalOffset);
  return globalOffset;
};

/**
 * Calculate highlight offsets from a DOM Range.
 *
 * @param root - Root element
 * @param range - DOM Range
 * @returns Highlight offsets
 */
export const calculateHighlightOffsets = (
  root: Element,
  range: Range
): { startOffset: number; endOffset: number; text: string } => {
  const startOffset = calculateGlobalOffset(root, range.startContainer, range.startOffset);
  const endOffset = calculateGlobalOffset(root, range.endContainer, range.endOffset);
  const text = range.toString();

  return { startOffset, endOffset, text };
};
