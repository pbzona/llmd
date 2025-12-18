# Installation

## npm (Recommended)

```bash
npm install -g llmd
```

Or run directly without installing:

```bash
npx llmd
```

Requires Node.js 22 or later.

## Quick Start

After installation, try it out:

```bash
llmd docs
```

This will clone the llmd repository to `~/.local/share/llmd-docs` and open the documentation in your browser.

## From Source

```bash
git clone https://github.com/pbzona/llmd.git
cd llmd
bun install
bun run build:npm
npm install -g .
```

## Troubleshooting

### Analytics Disabled Warning

If you see a warning like:

```
[llmd] Analytics disabled: SQLite database unavailable
[llmd] To enable analytics, rebuild the native bindings:
[llmd]   npm rebuild better-sqlite3
```

This means the optional analytics feature couldn't initialize due to missing native bindings. The app will work perfectly fine without it - you just won't have access to the analytics dashboard (`llmd analytics`).

**To fix it:**

Option 1 - Rebuild the native bindings (fastest):
```bash
npm rebuild better-sqlite3
```

Option 2 - Reinstall llmd:
```bash
npm install -g llmd --force
```

Option 3 - If using a global install, navigate to the install location and rebuild:
```bash
cd $(npm root -g)/llmd
npm rebuild better-sqlite3
```

**Common causes:**
- Node.js version changed after installation
- Missing build tools (python, make, gcc)
- Platform-specific compilation issues

**If the fix doesn't work:**
llmd will continue to work perfectly without analytics. All core features (serving markdown, themes, live reload) are unaffected.
