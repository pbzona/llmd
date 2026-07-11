// Text-quote anchoring (W3C Web Annotation TextQuoteSelector).
//
// A highlight is anchored to the *rendered plain text* of a document by the
// quoted text plus a small amount of surrounding context. This survives edits
// elsewhere in the file and disambiguates repeated phrases, without relying on
// fragile character offsets into the markdown source.
//
// This module is pure (no DOM / Node APIs) so it can be shared by the server
// (staleness checks) and the client bundle (painting highlights).

export type Anchor = {
  exact: string;
  prefix: string;
  suffix: string;
};

export type ResolvedRange = {
  start: number;
  end: number;
};

// Amount of surrounding context captured on each side of a selection.
export const CONTEXT_LENGTH = 32;

// Pure function: length of the longest common suffix of `a` and `b`.
const commonSuffixLength = (a: string, b: string): number => {
  const max = Math.min(a.length, b.length);
  let count = 0;
  while (count < max && a.at(-1 - count) === b.at(-1 - count)) {
    count += 1;
  }
  return count;
};

// Pure function: length of the longest common prefix of `a` and `b`.
const commonPrefixLength = (a: string, b: string): number => {
  const max = Math.min(a.length, b.length);
  let count = 0;
  while (count < max && a[count] === b[count]) {
    count += 1;
  }
  return count;
};

// Pure function: build an anchor for the range [start, end) within `text`.
export const buildAnchor = (text: string, start: number, end: number): Anchor => ({
  exact: text.slice(start, end),
  prefix: text.slice(Math.max(0, start - CONTEXT_LENGTH), start),
  suffix: text.slice(end, end + CONTEXT_LENGTH),
});

// Pure function: find every start index of `needle` in `haystack`.
const allIndicesOf = (haystack: string, needle: string): number[] => {
  const indices: number[] = [];
  let from = haystack.indexOf(needle);
  while (from !== -1) {
    indices.push(from);
    from = haystack.indexOf(needle, from + 1);
  }
  return indices;
};

// Pure function: resolve an anchor against `text`, returning the best-matching
// range or null when the quoted text no longer exists (i.e. the highlight is
// stale). Repeated occurrences are disambiguated by surrounding context.
export const resolveAnchor = (text: string, anchor: Anchor): ResolvedRange | null => {
  const { exact, prefix, suffix } = anchor;
  if (!exact) {
    return null;
  }

  const positions = allIndicesOf(text, exact);
  if (positions.length === 0) {
    return null;
  }
  if (positions.length === 1) {
    const start = positions[0] as number;
    return { start, end: start + exact.length };
  }

  // Multiple matches: pick the one whose surrounding text best matches the
  // stored prefix/suffix context.
  let bestStart = positions[0] as number;
  let bestScore = -1;
  for (const pos of positions) {
    const before = text.slice(Math.max(0, pos - prefix.length), pos);
    const after = text.slice(pos + exact.length, pos + exact.length + suffix.length);
    const score = commonSuffixLength(before, prefix) + commonPrefixLength(after, suffix);
    if (score > bestScore) {
      bestScore = score;
      bestStart = pos;
    }
  }

  return { start: bestStart, end: bestStart + exact.length };
};
