# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.7.0] - 2026-07-10

### Changed
- Re-architected highlights onto a text-quote anchor model (W3C
  TextQuoteSelector). Highlights now store the quoted text plus a short
  prefix/suffix of context instead of markdown-source character offsets:
  - Highlights survive edits elsewhere in the file and disambiguate repeated
    phrases by their surrounding context
  - Anchors resolve against the document's rendered plain text, so highlights no
    longer corrupt code fences, headings, or the table of contents
  - Resolution and painting happen on the client against the live DOM; the
    server serves clean HTML and stores/serves anchors only
  - Staleness is recomputed on every view and is display-only; highlights are
    never auto-deleted or silently re-anchored to unrelated text
- New shared, unit-tested resolver in `anchor.ts` used by both server and client
- Database: `highlights` table rebuilt on the anchor model behind a
  `schema_version` migration; enabled WAL + busy_timeout to avoid `SQLITE_BUSY`
  between concurrent instances
- The highlights summary now renders from a single fetch (no duplicate request)

### Added
- Rewritten highlights documentation (`docs/highlights.md`,
  `docs/highlight_implementation.md`) describing the anchor model

## [0.6.0] - 2026-07-10

### Security
- Constrain all file-path inputs (`/view/*`, `/api/markdown/raw`, highlight
  create) to the served directory, rejecting absolute paths and `..` traversal
- Validate `Host`/`Origin` on every `/api/*` request (localhost-only) to guard
  against DNS-rebinding and cross-origin/CSRF requests
- Escape all interpolated user/filesystem-derived values in server-rendered
  HTML and inline scripts (stored-XSS fix in the highlights UI)

### Fixed
- Highlights could not be deleted from the UI and restore never worked, due to
  an off-by-one when parsing the highlight ID from the request path
- Reads (page views and highlight fetches) no longer delete highlights; a
  changed file marks its highlights stale instead (non-destructive)
- Markdown views now URL-decode paths, so files with spaces/non-ASCII names load
- Table-of-contents anchors now match heading element ids for headings with
  inline formatting, and duplicate headings get unique ids
- Empty markdown files render instead of returning 404
- `--port`/`--tree-depth` reject non-integer values instead of crashing
- Dev mode (`bun index.ts`) now finds and serves the client bundle
- Live reload survives editor atomic-saves (`rename` events) and reconnects with
  capped backoff; watchers/sockets are cleaned up on shutdown

### Changed
- Split shared HTTP/escaping/path logic into `http-utils.ts` and `escape.ts`
- Highlights page and markdown decoration no longer access the database directly
- Analytics resource scan now respects `--tree-depth`
- `check` script and the build now run `tsc --noEmit`; the project typechecks
  cleanly and passes the linter with zero errors

### Removed
- Half-wired features: `llmd highlights enable/disable`, sidebar highlight
  indicators, and the highlight export/restore HTTP endpoints + restore UI
- Dead code: orphaned client highlight renderer, stale `.bak` file, unused
  `figlet`/`fast-glob` dependencies, and duplicated helpers

## [0.5.0] - 2026-01-15

### Added
- File size tracking for markdown files
  - File sizes captured during scanning and stored in database
  - Analytics page now displays file sizes in kB format
  - Data prepared for future client-side caching implementation
- Collapsible directory sections in sidebar
  - Fixed initialization of collapsible functionality
  - State persisted in localStorage
- Improved sidebar organization
  - Directory names now show up to 2 levels to reduce naming conflicts
  - Root-level files displayed at top of sidebar without grouping

### Changed
- Database schema: Added `size_bytes INTEGER` column to resources table
- MarkdownFile type: Added `sizeBytes` field
- Analytics queries: Now retrieve and display file size information
- Analytics display: Shows file sizes alongside view counts

## [0.4.7] - 2024-12-21

### Fixed
- Sidebar file tree alignment by using consistent depth-0 class

## [0.4.6] - 2024-12-21

### Added
- `--tree-depth` flag to control directory scanning depth (1-20, default 5)

## [0.4.5] - 2024-12-21

### Fixed
- Sidebar file tree alignment to properly nest files under directories

## [0.4.4] - 2024-12-21

### Fixed
- Render inline code as monospace in TOC instead of showing backticks
