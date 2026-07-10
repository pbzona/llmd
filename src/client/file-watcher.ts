// Client-side: File watching with WebSocket auto-reload

const BASE_RECONNECT_DELAY = 1000; // ms
const MAX_RECONNECT_DELAY = 30_000; // ms

const connectFileWatcher = (currentFile: string): void => {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const wsUrl = `${protocol}//${window.location.host}/_ws`;

  let ws: WebSocket | null = null;
  let reconnectTimeout: number | null = null;
  let attempts = 0;
  let closedByUnload = false;

  const connect = (): void => {
    ws = new WebSocket(wsUrl);

    ws.addEventListener("open", () => {
      attempts = 0;
      console.log("[llmd] Connected to file watcher");
      ws?.send(JSON.stringify({ type: "watch", file: currentFile }));
    });

    ws.addEventListener("message", (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "reload" && data.file === currentFile) {
          console.log(`[llmd] File changed: ${currentFile}, reloading...`);
          window.location.reload();
        }
      } catch (err) {
        console.error("[llmd] Failed to parse message:", err);
      }
    });

    ws.addEventListener("close", () => {
      if (closedByUnload) {
        return;
      }
      // Capped exponential backoff so a downed server does not busy-loop.
      const delay = Math.min(MAX_RECONNECT_DELAY, BASE_RECONNECT_DELAY * 2 ** attempts);
      attempts += 1;
      reconnectTimeout = window.setTimeout(connect, delay);
    });

    ws.addEventListener("error", () => {
      // The browser fires "close" after "error"; reconnection is handled there.
      console.error("[llmd] WebSocket error");
    });
  };

  connect();

  window.addEventListener("beforeunload", () => {
    closedByUnload = true;
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout);
    }
    ws?.close();
  });
};

// Initialize the file watcher from the <body data-watch-file="..."> attribute.
export const initFileWatcher = (): void => {
  const currentFile = document.body?.dataset.watchFile;
  if (currentFile) {
    connectFileWatcher(currentFile);
  }
};
