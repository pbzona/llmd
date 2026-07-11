# Highlight System Implementation

## Design philosophy

Highlights are anchored with a **text-quote selector** (W3C Web Annotation
model) resolved against the document's **rendered plain text**:

- Store the quoted text (`exact`) plus a short `prefix`/`suffix` of surrounding
  context — never character offsets into the markdown source.
- Resolve anchors against the rendered text, on the client, against the live
  DOM, **after** the page renders.
- Serve clean HTML; the server never injects `<mark>` into markdown source.
- Fail gracefully: if the quoted text no longer exists, the highlight is shown
  as stale (never auto-deleted, never re-anchored to unrelated text).

This avoids the failure modes of the previous source-offset design (offset
drift on edits, `<mark>` corruption inside code fences / headings / the TOC,
and ambiguous re-anchoring).

## Modules

- `src/anchor.ts` — pure, shared resolver. `buildAnchor(text, start, end)`
  produces `{ exact, prefix, suffix }`; `resolveAnchor(text, anchor)` returns a
  `{ start, end }` range or `null`. Used by both the server and the client
  bundle so resolution is identical in both.
- `src/highlights.ts` — SQLite storage and the schema migration.
- `src/routes/highlights.ts` — HTTP API (create / read / delete).
- `src/client/highlight-renderer.ts` — canonical-text extraction from the
  `.markdown-body` DOM, and painting (splitting text nodes and wrapping the
  matched ranges in `<mark>`).
- `src/client/highlights.ts` — selection → anchor creation, and fetch → paint.

## Lifecycle

### Create

```
User selects text within .markdown-body
        ↓
Client computes canonical offsets of the selection (Range → text length)
        ↓
buildAnchor(canonicalText, start, end) → { exact, prefix, suffix }
        ↓
POST /api/highlights { resourcePath, exact, prefix, suffix, notes }
        ↓
Server stores the anchor (no source scanning, no offsets)
```

### Render

```
GET /view/... → clean HTML (no server-side marks), wrapped in .markdown-body
        ↓
Client fetches the file's anchors
        ↓
For each anchor: resolveAnchor(renderedText, anchor)
        ↓
Non-overlapping resolved ranges are painted as <mark> elements
Unresolved anchors are reported as stale (shown in the summary / highlights page)
```

### Resolution

`resolveAnchor`:

1. Find every occurrence of `exact` in the text.
2. None → `null` (stale).
3. Exactly one → that range.
4. Several → score each by how much of the stored `prefix`/`suffix` matches the
   surrounding text, and pick the best. This disambiguates duplicates and
   survives edits elsewhere in the file.

## Schema

```sql
CREATE TABLE highlights (
  id          TEXT PRIMARY KEY,
  resource_id TEXT NOT NULL,
  exact       TEXT NOT NULL,
  prefix      TEXT NOT NULL DEFAULT '',
  suffix      TEXT NOT NULL DEFAULT '',
  notes       TEXT,
  created_at  INTEGER NOT NULL,
  FOREIGN KEY (resource_id) REFERENCES resources(id) ON DELETE CASCADE
);
```

Migrations are tracked in a `schema_version` table. Moving to the anchor model
bumped the version; the migration drops any legacy offset-based `highlights`
table and recreates it (highlight data is treated as disposable across the
rewrite).

## Notes and future work

- Anchors resolve against relative-path-keyed rendered text but resources are
  still keyed by absolute path, so moving/renaming a file orphans its
  highlights. Keying resources by relative path + content hash is a possible
  future improvement.
- Highlights are single-file; there are no categories or colors yet.
