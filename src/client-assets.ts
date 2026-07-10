// Client asset bundling and serving

import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
let clientScriptCache: string | null = null;

// Candidate locations for the pre-built client bundle:
// 1. Alongside this module (production: dist/llmd next to dist/client.js).
// 2. In ../dist (development: running from source with bun index.ts).
const candidateBundlePaths = (): string[] => [
  join(__dirname, "client.js"),
  join(__dirname, "..", "dist", "client.js"),
];

export const getClientScript = async (): Promise<string> => {
  if (clientScriptCache) {
    return clientScriptCache;
  }

  for (const bundlePath of candidateBundlePaths()) {
    try {
      const content = await readFile(bundlePath, "utf-8");
      clientScriptCache = content;
      return content;
    } catch {
      // Try the next candidate path.
    }
  }

  console.error(
    "[llmd] Client bundle not found. Run `bun run build` (or bash scripts/build-dev.sh) to generate dist/client.js."
  );
  return "";
};

// Check if bundle has inline source maps (for dev mode detection)
export const hasSourceMaps = async (): Promise<boolean> => {
  const script = await getClientScript();
  return script.includes("//# sourceMappingURL=data:application/json;base64,");
};

// Generate inline script tag (for production)
export const getClientScriptTag = async (): Promise<string> => {
  const script = await getClientScript();
  return `<script>${script}</script>`;
};

// Generate external script tag (for development with source maps)
export const getClientScriptTagExternal = (): string => '<script src="/_client.js"></script>';
