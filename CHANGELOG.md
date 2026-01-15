# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
