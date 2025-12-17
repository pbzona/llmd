// CLI argument parsing and validation (functional style)

import { dirname, isAbsolute, resolve } from "node:path";
import type { Config, ParsedArgs } from "./types";

const VERSION = "0.1.0";
const HELP_TEXT = `
llmd - Serve Markdown files as beautiful HTML

Usage:
  llmd [path] [options]

Arguments:
  path                     Directory or file to serve (default: current directory)

Options:
  --port <number>                   Port to bind to, 0 for auto (default: 0)
  --host <string>                   Host interface (default: localhost)
  --theme <light|dark>              UI theme (default: dark)
  --font-theme <system|modern|editorial> Font theme (default: system)
  --open / --no-open                Auto-open browser (default: --open)
  --watch / --no-watch              Reload on file changes (default: --no-watch)
  --help                            Show this help
  --version                         Show version

Examples:
  llmd                              # Serve current directory
  llmd ./docs                       # Serve docs directory
  llmd README.md                    # Serve current dir, open to README.md
  llmd ./docs/API.md                # Serve docs dir, open to API.md
  llmd --font-theme modern          # Use modern font theme
  llmd --font-theme editorial       # Use editorial font theme
`;

// Pure function: parse raw CLI arguments
export const parseArgs = (args: string[]): ParsedArgs => {
  const flags: ParsedArgs["flags"] = {};
  let path: string | undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg) {
      continue;
    }

    if (arg === "--help") {
      flags.help = true;
    } else if (arg === "--version") {
      flags.version = true;
    } else if (arg === "--port") {
      flags.port = Number.parseInt(args[++i] ?? "0", 10);
    } else if (arg === "--host") {
      flags.host = args[++i];
    } else if (arg === "--theme") {
      flags.theme = args[++i];
    } else if (arg === "--font-theme") {
      flags.fontTheme = args[++i];
    } else if (arg === "--open") {
      flags.open = true;
    } else if (arg === "--no-open") {
      flags.open = false;
    } else if (arg === "--watch") {
      flags.watch = true;
    } else if (arg === "--no-watch") {
      flags.watch = false;
    } else if (!arg.startsWith("-")) {
      path = arg;
    }
  }

  return { path, flags };
};

// Pure function: resolve path to directory and optional file
const resolvePath = (inputPath: string): { directory: string; initialFile?: string } => {
  const absolutePath = isAbsolute(inputPath) ? inputPath : resolve(process.cwd(), inputPath);

  // Check if it's a file (ends with .md)
  if (absolutePath.endsWith(".md")) {
    return {
      directory: dirname(absolutePath),
      initialFile: absolutePath,
    };
  }

  // It's a directory
  return { directory: absolutePath };
};

// Pure function: create config from parsed args with defaults
export const createConfig = (parsed: ParsedArgs): Config => {
  const { path = ".", flags } = parsed;
  const { directory, initialFile } = resolvePath(path);

  return {
    directory,
    initialFile,
    port: flags.port ?? 0,
    host: flags.host ?? "localhost",
    theme: (flags.theme as "light" | "dark") ?? "dark",
    fontTheme: (flags.fontTheme as "system" | "modern" | "editorial") ?? "system",
    open: flags.open ?? true,
    watch: flags.watch ?? false,
  };
};

// Side effect: validate config (throws on error)
export const validateConfig = (config: Config): void => {
  const dirExists = Bun.file(config.directory).exists();
  if (!dirExists) {
    throw new Error(`Directory not found: ${config.directory}`);
  }

  if (config.theme !== "light" && config.theme !== "dark") {
    throw new Error(`Invalid theme: ${config.theme}. Must be "light" or "dark"`);
  }

  if (config.port < 0 || config.port > 65_535) {
    throw new Error(`Invalid port: ${config.port}. Must be 0-65535`);
  }
};

// Side effect functions: print to stdout
export const printHelp = (): void => {
  console.log(HELP_TEXT);
};

export const printVersion = (): void => {
  console.log(`llmd v${VERSION}`);
};

// Main CLI handler (coordinates pure functions + side effects)
export const parseCli = (args: string[]): Config | null => {
  const parsed = parseArgs(args);

  if (parsed.flags.help) {
    printHelp();
    return null;
  }

  if (parsed.flags.version) {
    printVersion();
    return null;
  }

  const config = createConfig(parsed);
  validateConfig(config);

  return config;
};
