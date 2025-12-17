// Browser automation (functional style)

// Side effect: open URL in default browser
export const openBrowser = async (url: string): Promise<void> => {
  const platform = process.platform;

  try {
    if (platform === "darwin") {
      await Bun.$`open ${url}`;
    } else if (platform === "win32") {
      await Bun.$`start ${url}`;
    } else {
      // Linux and others
      await Bun.$`xdg-open ${url}`;
    }
  } catch (error) {
    console.error("Failed to open browser:", error);
  }
};
