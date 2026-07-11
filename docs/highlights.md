# Highlights

Mark and save important passages from your markdown documentation.

Highlights are part of the local tracking service and are available whenever
event tracking is enabled (the default). Because they share the same service,
`llmd analytics disable` also turns off highlights; `llmd analytics enable`
turns them back on.

## Overview

The highlights feature lets you select text while reading a markdown file and
save it, optionally with a note. Highlights are stored in a local SQLite
database and persist across sessions.

Highlights are anchored to the **quoted text plus a little surrounding
context** (a [W3C TextQuoteSelector](https://www.w3.org/TR/annotation-model/#text-quote-selector)),
not to character offsets. This means a highlight keeps working when you edit
other parts of the file, and repeated phrases are disambiguated by their
surroundings.

## How It Works

### Creating highlights

1. Open any markdown file in llmd.
2. Select the text you want to highlight with your mouse.
3. A popup appears near your selection with an optional note field and a
   **Create Highlight** button (and a × to dismiss).
4. Add a note (optional) and click **Create Highlight**.

The highlight is saved and painted with your theme's highlight color.

### Viewing highlights

**On the page**

- Highlights are painted in the rendered document after it loads.
- Click a highlight to view its note.
- A summary box above the document lists every highlight in the file; click one
  to scroll to it.

**On the highlights page** (sidebar → Admin → Highlights)

- Lists all highlights in the current directory.
- Shows which file each highlight belongs to.
- Marks highlights whose text can no longer be found as **stale**.

### Stale highlights

Each time a document is displayed, llmd re-resolves every highlight against the
current rendered text:

- **Found** – the quoted text still exists (context disambiguates duplicates) →
  the highlight is painted normally.
- **Not found** – the quoted text is gone → the highlight is shown as **stale**
  on the highlights page and is not painted in the document.

Staleness is display-only. Highlights are **never** deleted automatically; use
the Delete button on the highlights page to remove one.

### File backups

The first time you create a highlight in a file, llmd stores a copy of the file
in `~/.cache/llmd/file-backups/`. Manage these with the `llmd archive` commands.

## Storage

Highlights live in the llmd SQLite database at `~/.local/share/llmd/llmd.db`.
The `highlights` table stores, per highlight:

| Column       | Description                                        |
| ------------ | -------------------------------------------------- |
| `id`         | UUID                                               |
| `resource_id`| Owning file resource                               |
| `exact`      | The highlighted text                               |
| `prefix`     | A short slice of text immediately before it        |
| `suffix`     | A short slice of text immediately after it         |
| `notes`      | Optional note                                      |
| `created_at` | Creation timestamp                                 |

A `schema_version` table tracks migrations.

## Anchoring model

- Anchors are resolved against the document's **rendered plain text** (the text
  content of the rendered markdown), not the markdown source. This avoids the
  code-fence, heading, and table-of-contents corruption that source-offset
  injection caused.
- Resolution and painting happen **on the client**, against the live DOM, after
  the page renders. The server sends clean HTML and stores/serves anchors only.
- The server performs the same resolution when rendering the highlights page, to
  compute the stale indicator.

## API

All endpoints are restricted to local (loopback) requests.

### `POST /api/highlights`

```json
{
  "resourcePath": "README.md",
  "exact": "the highlighted text",
  "prefix": "text just before ",
  "suffix": " text just after",
  "notes": "optional note"
}
```

Response: `{ "id": "…" }`

### `GET /api/highlights/resource?path=…`

Returns the highlights for a file:

```json
{
  "highlights": [
    { "id": "…", "exact": "…", "prefix": "…", "suffix": "…", "notes": null, "createdAt": 1703001234567 }
  ]
}
```

### `GET /api/highlights/directory?path=…`

Returns the highlights for every file under a directory.

### `DELETE /api/highlights/:id`

Deletes a highlight (`204` on success, `404` if it does not exist).

## CLI commands

### Export highlights

```bash
llmd export              # export the current directory
llmd export ./docs       # export a specific directory
```

Exports are written to `~/.llmd/{directory}-{date}.md`.

### Archive management

```bash
llmd archive list            # list backed-up files
llmd archive show README.md  # show a backup's details
llmd archive clear           # delete all backups
```

Archive location: `~/.cache/llmd/file-backups/`.

## Limitations

- A highlight is scoped to a single file.
- If the exact quoted text is removed, the highlight becomes stale (it is not
  re-anchored to different text).
- No highlight categories or colors yet.
