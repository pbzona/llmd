# Highlight System Test

This document tests the new highlight system with occurrence indices and whitespace normalization.

## Test 1: Single Occurrence

This is a unique phrase that appears only once.

Try highlighting "unique phrase" - it should work perfectly since it only appears once.

## Test 2: Multiple Occurrences (Exact Match)

The word test appears multiple times.
Highlight the first test.
Highlight the second test.
Highlight the third test.

Each should be tracked separately by occurrence index.

## Test 3: Whitespace Variations

This    has    multiple    spaces.

The markdown source has multiple spaces, but HTML collapses them. The system should handle this with normalization.

## Test 4: Mixed Content

Here is some **bold text** and some *italic text* and some `inline code`.

Try highlighting across the bold/italic boundaries - the system should find it in the markdown source even though the markdown syntax is present there.

## Test 5: Code Blocks

```javascript
function test() {
  return "hello world";
}
```

Try highlighting text inside code blocks.

## Test 6: Lists

- First item
- Second item
- Third item

Try highlighting "Second item" - the list marker shouldn't interfere.

## Test 7: Edge Cases

Text at start of paragraph.
Text at end of paragraph.

Text
with
newlines
between
words.

## Expected Behavior

1. **Exact matches**: Should highlight immediately
2. **Whitespace differences**: Should still highlight with normalization
3. **Multiple occurrences**: Should track by index
4. **Markdown syntax**: May become stale if markdown syntax interferes
5. **Stale highlights**: Will NOT render inline, only visible in /highlights page
