#!/usr/bin/env bun

/**
 * Generate preview pages for font/color theme combinations
 *
 * Usage:
 *   bun scripts/generate-preview.ts
 *     → Generates theme-font.md files for all themes × default fonts (sans, modern)
 *
 *   bun scripts/generate-preview.ts --font modern
 *     → Generates {theme}.md files for all themes with 'modern' font
 *
 *   bun scripts/generate-preview.ts --theme nord
 *     → Generates {font}.md files for all fonts with 'nord' theme
 *
 *   bun scripts/generate-preview.ts --theme nord --font modern
 *     → Generates preview-1.md file for single nord+modern combination
 *     → Run server with: node dist/llmd preview-output --theme nord --fonts modern
 *
 * How it works:
 *   The server's extractPreviewConfig() function (src/server.ts) extracts theme/font
 *   from filenames that match specific patterns. Filename-based config ALWAYS overrides
 *   CLI flags, enabling each file to demonstrate a different theme/font combination.
 */

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";

// Kitchen sink markdown showing all elements
const KITCHEN_SINK_MD = `# Kitchen Sink - All Markdown Elements

This document demonstrates every markdown element supported by llmd.

## Typography

### Headings

# Heading 1
## Heading 2
### Heading 3
#### Heading 4
##### Heading 5
###### Heading 6

### Text Styles

Regular text with **bold text**, *italic text*, ***bold and italic***, ~~strikethrough~~, and \`inline code\`.

You can also use __bold__ and _italic_ with underscores.

### Paragraphs

This is the first paragraph. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.

This is the second paragraph. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.

### Links

[External link to Google](https://google.com)
[Link with title](https://github.com "GitHub Homepage")

### Blockquotes

> This is a blockquote.
> It can span multiple lines.
>
> And have multiple paragraphs.

> **Note:** Blockquotes can contain **formatting**.

### Horizontal Rules

---

***

___

## Lists

### Unordered Lists

- Item 1
- Item 2
  - Nested item 2.1
  - Nested item 2.2
    - Deeply nested 2.2.1
- Item 3

* Alternative syntax
* Using asterisks

### Ordered Lists

1. First item
2. Second item
   1. Nested item 2.1
   2. Nested item 2.2
3. Third item

### Task Lists

- [x] Completed task
- [ ] Incomplete task
- [ ] Another incomplete task
  - [x] Nested completed
  - [ ] Nested incomplete

## Code

### Inline Code

Use \`console.log()\` to print to the console. Variables like \`myVariable\` and functions like \`getData()\`.

### Code Blocks

\`\`\`javascript
// JavaScript code block
function greet(name) {
  console.log(\`Hello, \${name}!\`);
}

greet("World");
\`\`\`

\`\`\`typescript
// TypeScript code block
interface User {
  name: string;
  age: number;
}

const user: User = {
  name: "Alice",
  age: 30
};
\`\`\`

\`\`\`python
# Python code block
def factorial(n):
    if n <= 1:
        return 1
    return n * factorial(n - 1)

print(factorial(5))
\`\`\`

\`\`\`bash
# Bash script
#!/bin/bash
echo "Hello from bash"
for i in {1..5}; do
  echo "Number: $i"
done
\`\`\`

\`\`\`json
{
  "name": "llmd",
  "version": "0.1.0",
  "description": "Local markdown server",
  "keywords": ["markdown", "server", "documentation"]
}
\`\`\`

\`\`\`css
/* CSS styles */
.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

h1 {
  font-size: 2.5rem;
  color: #333;
}
\`\`\`

### Code Without Language

\`\`\`
Plain text code block
No syntax highlighting
Just monospace font
\`\`\`

## Tables

### Simple Table

| Name | Age | City |
|------|-----|------|
| Alice | 30 | NYC |
| Bob | 25 | LA |
| Charlie | 35 | Chicago |

### Aligned Columns

| Left Aligned | Center Aligned | Right Aligned |
|:-------------|:--------------:|--------------:|
| Left | Center | Right |
| Text | Text | Text |
| More | More | More |

### Complex Table

| Feature | Description | Status | Priority |
|---------|-------------|--------|----------|
| Syntax highlighting | Powered by Shiki | ✅ Done | High |
| Live reload | WebSocket updates | ✅ Done | High |
| Custom themes | CSS variables | ✅ Done | Medium |
| Dark mode | Built-in themes | ✅ Done | High |

## Images

![Alt text for image](https://via.placeholder.com/600x200/4a9eff/ffffff?text=Placeholder+Image)

## HTML Elements

You can use <mark>highlighted text</mark>, <sub>subscript</sub>, <sup>superscript</sup>, and <kbd>Ctrl+C</kbd> keyboard keys.

## Special Cases

### Long Code Lines

\`\`\`javascript
const veryLongLine = "This is a very long line of code that might require horizontal scrolling depending on the viewport width and font size settings";
\`\`\`

### Nested Elements

> ### Heading in Blockquote
>
> - List in blockquote
> - Another item
>
> \`\`\`javascript
> // Code in blockquote
> console.log("Hello");
> \`\`\`

### Math-like Content

The equation is: \`x = (-b ± √(b² - 4ac)) / 2a\`

Variables: \`α, β, γ, δ, π, Σ, ∫, ∂\`

### Emoji

🚀 Rocket | 💻 Computer | 📝 Memo | ✅ Check | ❌ Cross | ⚠️ Warning | 🎨 Art | 🔥 Fire

## Edge Cases

### Empty Lines and Spacing


Multiple empty lines above and below.


### Very Long Words

supercalifragilisticexpialidocious pneumonoultramicroscopicsilicovolcanoconiosis antidisestablishmentarianism

### Mixed Content

Here's a paragraph with **bold**, *italic*, \`code\`, [link](https://example.com), and ~~strikethrough~~ all together.

1. **Bold list item** with *italic* and \`code\`
2. > Blockquote in list
3. \`\`\`js
   // Code block in list
   const x = 1;
   \`\`\`

---

## Conclusion

This kitchen sink document covers all major markdown elements. Use it to test and preview your themes!
`;

// Available themes and fonts
const THEMES = ["dark", "light", "nord", "dracula", "solarized", "monokai"];
const FONTS = [
  "serif",
  "sans",
  "mono",
  "classic",
  "future",
  "modern",
  "artsy",
  "literary",
  "editorial",
];

// Parse command line arguments
const { values } = parseArgs({
  options: {
    font: { type: "string", short: "f" },
    theme: { type: "string", short: "t" },
    output: { type: "string", short: "o", default: "preview-output" },
  },
});

const selectedFont = values.font;
const selectedTheme = values.theme;
const outputDir = values.output as string;

// Validate inputs
if (selectedFont && !FONTS.includes(selectedFont)) {
  console.error(`❌ Invalid font: ${selectedFont}`);
  console.error(`   Available fonts: ${FONTS.join(", ")}`);
  process.exit(1);
}

if (selectedTheme && !THEMES.includes(selectedTheme)) {
  console.error(`❌ Invalid theme: ${selectedTheme}`);
  console.error(`   Available themes: ${THEMES.join(", ")}`);
  process.exit(1);
}

// Determine what to generate
let combinations: Array<{ font: string; theme: string }> = [];
let useFilenameFormat = false;

if (selectedFont && selectedTheme) {
  // Single combination - generate simple numbered files
  combinations = [{ font: selectedFont, theme: selectedTheme }];
  useFilenameFormat = false;
} else if (selectedFont) {
  // All themes for one font - use theme names in filename
  combinations = THEMES.map((theme) => ({ font: selectedFont, theme }));
  useFilenameFormat = true;
} else if (selectedTheme) {
  // All fonts for one theme - use font names in filename
  combinations = FONTS.map((font) => ({ font, theme: selectedTheme }));
  useFilenameFormat = true;
} else {
  // Default: generate for a sensible subset with theme-font format
  const defaultFonts = ["sans", "modern"];
  combinations = defaultFonts.flatMap((font) => THEMES.map((theme) => ({ font, theme })));
  useFilenameFormat = true;
}

// Create output directory
if (!existsSync(outputDir)) {
  mkdirSync(outputDir, { recursive: true });
}

// Generate a kitchen sink markdown for each combination
for (let i = 0; i < combinations.length; i += 1) {
  const combo = combinations[i];
  if (!combo) {
    continue;
  }

  const { font, theme } = combo;

  // Determine filename based on generation mode
  let filename: string;
  if (!useFilenameFormat) {
    // Single combination: use simple numbered name
    filename = `preview-${i + 1}.md`;
  } else if (selectedFont) {
    // All themes for one font: use theme name
    filename = `${theme}.md`;
  } else if (selectedTheme) {
    // All fonts for one theme: use font name
    filename = `${font}.md`;
  } else {
    // Default: theme-font format
    filename = `${theme}-${font}.md`;
  }

  const title = `${theme.charAt(0).toUpperCase() + theme.slice(1)} + ${font.charAt(0).toUpperCase() + font.slice(1)}`;

  const content = `# ${title}

**Theme:** \`${theme}\` | **Font:** \`${font}\`

${KITCHEN_SINK_MD.split("\n").slice(4).join("\n")}`; // Skip first few lines (title already added)

  writeFileSync(join(outputDir, filename), content);
}

// Generate index with instructions
let indexExplanation = "";
if (!useFilenameFormat) {
  indexExplanation = `Each file demonstrates the \`${selectedTheme}\` theme with \`${selectedFont}\` fonts.

When you run llmd with both \`--theme\` and \`--fonts\` flags, those settings apply to ALL files.`;
} else if (selectedFont) {
  indexExplanation = `Each file demonstrates the \`${selectedFont}\` fonts with different themes.

Files are named by theme (e.g., \`nord.md\`, \`dark.md\`) and the server extracts the theme from the filename.`;
} else if (selectedTheme) {
  indexExplanation = `Each file demonstrates the \`${selectedTheme}\` theme with different fonts.

Files are named by font (e.g., \`modern.md\`, \`classic.md\`) and the server extracts the font from the filename.`;
} else {
  indexExplanation = `Each markdown file in the sidebar automatically applies its own theme and font based on its filename.

**Format:** \`{theme}-{font}.md\`

For example:
- \`dark-modern.md\` uses the \`dark\` theme with \`modern\` fonts
- \`nord-classic.md\` uses the \`nord\` theme with \`classic\` fonts`;
}

const indexContent = `# llmd Theme Preview

This directory contains ${combinations.length} preview documents, each demonstrating a different theme/font combination.

## How It Works

${indexExplanation}

## Quick Start

1. Build the executable (if you haven't already):
   \`\`\`bash
   bun run build
   \`\`\`

2. Start the preview server:
   \`\`\`bash
   node dist/llmd ${outputDir}
   \`\`\`

3. Click through the files in the sidebar to see each combination!

**Or use Bun directly for development:**
\`\`\`bash
bun index.ts ${outputDir}
\`\`\`

## Generated Combinations

${combinations
  .map(({ font, theme }, idx) => {
    let filename: string;
    if (!useFilenameFormat) {
      filename = `preview-${idx + 1}.md`;
    } else if (selectedFont) {
      filename = `${theme}.md`;
    } else if (selectedTheme) {
      filename = `${font}.md`;
    } else {
      filename = `${theme}-${font}.md`;
    }
    return `- **${filename}** - ${theme} theme + ${font} fonts`;
  })
  .join("\n")}

## Available Themes

${THEMES.map((t) => `- \`${t}\``).join("\n")}

## Available Fonts

${FONTS.map((f) => `- \`${f}\``).join("\n")}

---

**Tip:** Keep this browser window open and click through each file to quickly compare all your theme/font combinations!
`;

writeFileSync(join(outputDir, "README.md"), indexContent);

// Generate a shell script for easy testing
const shellScript = `#!/bin/bash
# Preview all combinations

echo "🎨 Theme Preview Generator"
echo ""

BASE_DIR="${outputDir}"
PORT=8888

${combinations
  .map(
    ({ font, theme }, idx) => `
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Preview ${idx + 1}/${combinations.length}: ${theme} + ${font}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Starting server at http://localhost:$PORT"
echo "Press Ctrl+C to continue to next preview..."
echo ""

bun index.ts "$BASE_DIR" --theme ${theme} --fonts ${font} --port $PORT --no-open

echo ""
`
  )
  .join("\n")}

echo "✅ All previews complete!"
`;

const scriptPath = join(outputDir, "preview-all.sh");
writeFileSync(scriptPath, shellScript);
// Make script executable
if (process.platform !== "win32") {
  const { chmodSync } = await import("node:fs");
  chmodSync(scriptPath, 0o755);
}

// Print summary
console.log("✅ Preview generation complete!\n");
console.log(`📁 Output directory: ${outputDir}`);
console.log(`📄 Generated ${combinations.length} preview files`);
console.log(`📖 Index: ${join(outputDir, "README.md")}\n`);

console.log("Preview files created:\n");
for (let i = 0; i < combinations.length; i += 1) {
  const combo = combinations[i];
  if (!combo) {
    continue;
  }
  const { font, theme } = combo;

  let filename: string;
  if (!useFilenameFormat) {
    filename = `preview-${i + 1}.md`;
  } else if (selectedFont) {
    filename = `${theme}.md`;
  } else if (selectedTheme) {
    filename = `${font}.md`;
  } else {
    filename = `${theme}-${font}.md`;
  }

  console.log(`  • ${filename}`);
}

console.log("\n🎨 Quick Start:\n");
console.log("First build if you haven't already:");
console.log("   bun run build\n");
console.log("Then start the preview:");
console.log(`   node dist/llmd ${outputDir}`);
console.log("\nClick through the files in the sidebar to see each theme/font combination!");
