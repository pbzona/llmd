# Agent Guidelines for llmd

## Commands
- **Run**: `bun index.ts [args]` or `bun --hot index.ts` (dev mode)
- **Test**: `bun test` (all tests) or `bun test src/file.test.ts` (single test file)
- **Lint**: `bun run check` (Biome auto-fix) or `bun x ultracite fix`
- **Build**: `bun run build` (creates Node.js bundle in dist/)

## Runtime & APIs
- Use **Node.js APIs** (not Bun APIs) - this project compiles to Node.js for distribution
- HTTP: Use `node:http` with `ws` package for WebSockets (no Express, no Bun.serve)
- File I/O: Use `node:fs/promises` (readFile, writeFile, etc.)
- This runs in Bun locally but distributes as Node.js bundle
- Bun auto-loads `.env` files during development

## Code Style (Biome + Ultracite)
- **Formatting**: 2-space indent, 100 char line width, double quotes, semicolons, trailing commas (ES5)
- **Imports**: ES modules only; prefer named imports; `node:*` prefix for Node.js APIs
- **Types**: Explicit return types on exported functions; prefer `unknown` over `any`; strict null checks
- **Functions**: Use arrow functions; label pure vs side-effect functions with comments
- **Loops**: Prefer `for...of` over `.forEach()` and indexed loops; avoid `++`/`--` operators
- **Async**: Always `await` promises; use `async/await` over promise chains; handle errors with try-catch
- **Naming**: Descriptive names; SCREAMING_SNAKE_CASE for constants; avoid magic numbers
- **Complexity**: Keep functions under 15 cognitive complexity; extract conditionals to named booleans
- **Error handling**: Throw `Error` objects with messages; early returns over nesting; graceful CLI failures
