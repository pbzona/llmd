# Agent Guidelines for llmd

## Build/Test Commands
- Run: `bun index.ts`
- Test: `bun test` (test files: `*.test.ts`)
- Single test: `bun test <file.test.ts>`
- Install: `bun install`

## Runtime & APIs
- Use Bun instead of Node.js, npm, or vite
- Use `Bun.serve()` for HTTP servers (not express)
- Use `Bun.file` over `node:fs` readFile/writeFile
- Use `bun:sqlite`, `Bun.redis`, `Bun.sql` for databases
- Bun auto-loads .env files

## TypeScript Config
- Strict mode enabled with bundler module resolution
- No unused locals/parameters checking disabled
- Use ESNext target and lib

## Code Style
- Module system: ES modules only
- Imports: Prefer Bun built-ins over npm packages
- Types: Full type safety, strict TypeScript
- Error handling: Graceful failures with clear CLI/browser messages
