// Client-side: Add copy buttons to code blocks

const addCopyButtons = () => {
  for (const codeBlock of Array.from(document.querySelectorAll("pre code"))) {
    const pre = codeBlock.parentElement;
    if (!pre) {
      continue;
    }

    // Don't add button twice
    if (pre.querySelector(".copy-button")) {
      continue;
    }

    // Create copy button
    const button = document.createElement("button");
    button.className = "copy-button";
    button.textContent = "Copy";
    button.setAttribute("aria-label", "Copy code to clipboard");

    // Handle click
    button.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(codeBlock.textContent || "");
        button.textContent = "Copied!";
        button.classList.add("copied");

        setTimeout(() => {
          button.textContent = "Copy";
          button.classList.remove("copied");
        }, 2000);
      } catch (err) {
        console.error("Failed to copy:", err);
        button.textContent = "Failed";
        setTimeout(() => {
          button.textContent = "Copy";
        }, 2000);
      }
    });

    pre.appendChild(button);
  }
};

// Run on page load
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", addCopyButtons);
} else {
  addCopyButtons();
}
