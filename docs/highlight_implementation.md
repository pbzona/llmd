# Highlight System Implementation

## Design Philosophy

The highlight system uses a **pragmatic, source-based approach** that:
- Stores offsets relative to **markdown source text**
- Injects `<mark>` tags **before** markdown rendering
- Uses **occurrence indices** to disambiguate duplicates
- Applies **whitespace normalization** for robustness
- **Fails gracefully** by marking mismatches as stale

## How It Works

### 1. Creating a Highlight

```
User selects "Hello World" in browser
                ↓
Client calculates occurrence index (0, 1, 2...)
by counting occurrences before selection
                ↓
Client sends: {
  highlightedText: "Hello World",
  occurrenceIndex: 1,
  notes: "..."
}
                ↓
Server searches markdown source for "Hello World"
                ↓
Server finds all occurrences: [offset0, offset1, offset2]
                ↓
Server uses occurrenceIndex=1 → picks offset1
                ↓
Server verifies extracted text matches (with normalization)
                ↓
If mismatch → mark as stale immediately
If match → store offsets in database
```

### 2. Rendering Highlights

```
User visits page
                ↓
Server reads markdown source from disk
                ↓
Server queries highlights from database
                ↓
Server filters out stale highlights
                ↓
Server injects <mark> tags into markdown:
  "Hello World" → "<mark data-highlight-id='...'>Hello World</mark>"
                ↓
Markdown renderer processes file (marks pass through as HTML)
                ↓
Browser displays highlighted text
                ↓
Client attaches click handlers to marks for notes display
```

## Key Functions

### `findAllOccurrences(content, searchText)`

Finds all positions where text appears in content.

**Strategy:**
1. Try exact string match first (fast path)
2. If no matches, try with whitespace normalization (slower fallback)

**Returns:** Array of start offsets `[10, 45, 89]`

### `findTextOffset(content, searchText, occurrenceIndex)`

Finds specific occurrence of text.

**Parameters:**
- `content`: Markdown source
- `searchText`: Text to find
- `occurrenceIndex`: Which occurrence (0-indexed)

**Returns:** `{ startOffset, endOffset }` or `null`

### `injectHighlightMarks(markdown, highlights)`

Injects `<mark>` tags into markdown source.

**Algorithm:**
1. Filter out stale highlights (don't render inline)
2. Sort active highlights by startOffset (descending)
3. For each highlight (end to start):
   - Split markdown at offsets
   - Wrap text with `<mark class="llmd-highlight" data-highlight-id="...">text</mark>`
   - Reconstruct markdown

**Why reverse order?** Prevents offset shifts as we modify the string.

## Whitespace Normalization

```javascript
const normalizeWhitespace = (text) => text.replace(/\s+/g, ' ').trim();
```

**Purpose:** Handle differences between markdown and rendered HTML:
- `"Hello    World"` (markdown) → `"Hello World"` (HTML)
- `"Hello\n\nWorld"` (markdown) → `"Hello World"` (HTML)

**Applied:**
- When searching for text in markdown (if exact match fails)
- When verifying extracted text matches selection

## Stale Detection

A highlight is marked **stale** when:

1. **Text not found at occurrence index** - Not enough occurrences exist
2. **Extracted text doesn't match** - Text at offset differs fundamentally
3. **File content hash changed** - During validation on page load

**Stale highlights:**
- ❌ NOT rendered inline in the document
- ✅ Shown in `/highlights` page with warning badge
- ✅ Can be deleted or have original file restored

## Occurrence Index Calculation

Client calculates which occurrence was selected:

```javascript
// Get all text before the selection
const textBefore = getTextBeforeSelection();

// Count occurrences
let count = 0;
let pos = 0;
while (true) {
  const found = textBefore.indexOf(selectedText, pos);
  if (found === -1) break;
  count++;
  pos = found + 1;
}

return count; // This is the occurrence index
```

**Example:**
```
Document: "test ... test ... test"
User selects 2nd "test"
→ occurrenceIndex = 1 (0-indexed)
```

## Edge Cases

### Multiple Spaces
```markdown
Hello    World  (markdown)
```
- HTML collapses to: `Hello World`
- Search tries exact match: FAIL
- Search with normalization: SUCCESS
- Stores offsets in original markdown (with spaces)
- Renders correctly because marks wrap original text

### Markdown Syntax
```markdown
**Hello** World  (markdown)
```
- HTML renders as: `Hello World` (bold removed)
- User selects: `Hello World`
- Search in markdown for `Hello World`: FAIL (has `**`)
- **Result:** Marked as STALE (expected behavior)

### Newlines
```markdown
Hello
World  (markdown)
```
- HTML renders as: `Hello World` (newline → space)
- Normalization handles this: both become `Hello World`
- **Result:** Works with whitespace normalization

### Code Blocks
```markdown
```
function test() {}
```
```
- Text preserves all whitespace/newlines
- Exact match should work
- **Result:** Usually works fine

## API

### POST `/api/highlights`

Create a new highlight.

**Request:**
```json
{
  "resourcePath": "README.md",
  "highlightedText": "Hello World",
  "occurrenceIndex": 1,
  "notes": "Optional note"
}
```

**Response:**
```json
{
  "id": "abc-123-def",
  "isStale": false
}
```

**Error Cases:**
- `400`: Text not found or occurrence index out of bounds
- `404`: Resource not found

### GET `/api/highlights/resource?path=README.md`

Get all highlights for a resource.

**Response:**
```json
{
  "highlights": [
    {
      "id": "abc-123",
      "startOffset": 10,
      "endOffset": 21,
      "highlightedText": "Hello World",
      "isStale": false,
      "notes": "My note",
      "createdAt": 1234567890,
      "updatedAt": 1234567890
    }
  ]
}
```

## Limitations

### Known Issues

1. **Markdown syntax in selection** - Selecting text with markdown syntax (bold, italic, links) will often result in stale highlights
2. **Complex transformations** - Lists, tables, and other complex markdown may not match between source and rendered
3. **Occurrence counting mismatch** - If whitespace differs, occurrence count in HTML may differ from markdown

### Won't Fix (By Design)

1. **Overlapping highlights** - System doesn't support overlapping/nested highlights
2. **Cross-block selections** - Can only highlight within a single block element
3. **HTML-based offsets** - System uses markdown offsets only

## Testing Checklist

- [ ] Single occurrence - unique text
- [ ] Multiple occurrences - same text multiple times
- [ ] Whitespace variations - multiple spaces, newlines
- [ ] Bold/italic text - markdown syntax in selection
- [ ] Code blocks - preserve formatting
- [ ] Lists - ignore list markers
- [ ] Multiple highlights in same paragraph
- [ ] Stale detection - modify file and reload
- [ ] Deep linking - URL fragments
- [ ] Notes - add and display notes on highlights

## Future Enhancements

Potential improvements:
1. Better markdown-aware parsing (use AST instead of string search)
2. Support for markdown syntax in selections (strip before searching)
3. Fuzzy matching for better drift tolerance
4. Visual diff for stale highlights (show what changed)
5. Auto-update highlights when possible (try to find moved text)
