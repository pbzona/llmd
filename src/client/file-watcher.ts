// Client-side: File watching with WebSocket auto-reload

const connectFileWatcher = (currentFile: string) => {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const wsUrl = `${protocol}//${window.location.host}/_ws`;

  let ws: WebSocket | null = null;
  let reconnectTimeout: number | null = null;

  const connect = () => {
    ws = new WebSocket(wsUrl);

    ws.addEventListener("open", () => {
      console.log("[llmd] Connected to file watcher");
      // Send current file path
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
      console.log("[llmd] Disconnected from file watcher");
      // Auto-reconnect after 2 seconds
      reconnectTimeout = window.setTimeout(() => {
        console.log("[llmd] Reconnecting...");
        connect();
      }, 2000);
    });

    ws.addEventListener("error", (err) => {
      console.error("[llmd] WebSocket error:", err);
      ws?.close();
    });
  };

  // Initial connection
  connect();

  // Cleanup on page unload
  window.addEventListener("beforeunload", () => {
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout);
    }
    ws?.close();
  });
};

// Export for use in template
// biome-ignore lint/suspicious/noExplicitAny: Need to extend window global
(window as any).connectFileWatcher = connectFileWatcher;
