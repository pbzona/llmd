# llmd

**Serve Markdown as beautiful HTML. Instantly.**

A zero-config CLI tool for viewing Markdown files in your browser with syntax highlighting, live reload, and a clean interface. Built for developers reviewing LLM-generated documentation.

```
 ██╗     ██╗     ███╗   ███╗██████╗ 
 ██║     ██║     ████╗ ████║██╔══██╗
 ██║     ██║     ██╔████╔██║██║  ██║
 ██║     ██║     ██║╚██╔╝██║██║  ██║
 ███████╗███████╗██║ ╚═╝ ██║██████╔╝
 ╚══════╝╚══════╝╚═╝     ╚═╝╚═════╝ 
```

## Features

- **Zero config** - Point at a directory and go
- **Syntax highlighting** - Powered by Shiki
- **Live reload** - Watch mode reloads on file changes
- **Copy buttons** - One-click code copying
- **Dark/light themes** - With 3 font options
- **Fast** - Built with Bun, instant startup
- **Sidebar navigation** - Browse files with directory structure
- **Table of contents** - Auto-generated from headings

## Installation

### Option 1: Bun (Recommended)

```bash
bunx llmd          # Run directly, no install needed
```

Or install globally:
```bash
bun install -g llmd
```

### Option 2: Download Binary

**macOS**:
- Apple Silicon: [llmd-macos-arm64](https://github.com/pbzona/llmd/releases/latest/download/llmd-macos-arm64)
- Intel: [llmd-macos-x64](https://github.com/pbzona/llmd/releases/latest/download/llmd-macos-x64)

**Linux**: [llmd-linux-x64](https://github.com/pbzona/llmd/releases/latest/download/llmd-linux-x64)

```bash
# Example for macOS Apple Silicon:
curl -L https://github.com/pbzona/llmd/releases/latest/download/llmd-macos-arm64 -o llmd
chmod +x llmd
sudo mv llmd /usr/local/bin/
```

### Option 3: From Source

```bash
git clone https://github.com/pbzona/llmd.git
cd llmd
bun install
bun run build
```

## Usage

```bash
# Serve current directory
llmd

# Serve specific directory
llmd ./docs

# Dark mode with live reload
llmd ./docs --theme dark --watch

# Custom port
llmd ./docs --port 8080
```

## Options

| Flag | Description | Default |
|------|-------------|---------|
| `--port <number>` | Port (0 = auto-assign) | `0` |
| `--host <string>` | Host interface | `localhost` |
| `--theme <light\|dark>` | UI theme | `dark` |
| `--font-theme <system\|modern\|editorial>` | Font theme | `system` |
| `--open / --no-open` | Auto-open browser | `--open` |
| `--watch / --no-watch` | Live reload on changes | `--no-watch` |
| `--help` | Show help | |
| `--version` | Show version | |

## Development

```bash
# Install dependencies
bun install

# Run with hot reload
bun --hot index.ts ./docs

# Run tests
bun test

# Build binary
bun run build
```

## Tech Stack

- **Runtime**: Bun
- **Markdown**: marked (GFM support)
- **Highlighting**: Shiki (VS Code themes)
- **Server**: Bun.serve() with WebSocket
- **Bundler**: Bun's built-in bundler

## License

MIT

## Contributing

Issues and PRs welcome. This tool is intentionally minimal—new features should materially improve the "view markdown now" workflow.
