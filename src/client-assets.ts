// Client asset bundling and serving

// Build client bundle on startup and cache it
let clientScriptCache: string | null = null;

export const getClientScript = async (): Promise<string> => {
  if (clientScriptCache) {
    return clientScriptCache;
  }

  // Bundle client code using Bun's bundler
  const result = await Bun.build({
    entrypoints: ["./src/client-bundle.ts"],
    minify: true,
    target: "browser",
  });

  if (!result.success) {
    console.error("Failed to bundle client code:", result.logs);
    return "";
  }

  const output = result.outputs[0];
  if (!output) {
    return "";
  }

  clientScriptCache = await output.text();
  return clientScriptCache;
};

// Generate inline script tag
export const getClientScriptTag = async (): Promise<string> => {
  const script = await getClientScript();
  return `<script>${script}</script>`;
};
