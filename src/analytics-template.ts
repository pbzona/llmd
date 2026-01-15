// Analytics page template generation

import { baseLayout } from "./template";
import type { AnalyticsData, Config, MarkdownFile } from "./types";

// Helper: format file size in bytes to human-readable kB
const formatFileSize = (bytes: number | null | undefined): string => {
  if (bytes === null || bytes === undefined) {
    return "—";
  }
  return `${(bytes / 1024).toFixed(1)} kB`;
};

// Helper: generate bar chart SVG
const generateBarChart = (data: Array<{ date: string; count: number }>): string => {
  if (data.length === 0) {
    return '<p style="opacity: 0.6; text-align: center;">No data available</p>';
  }

  const maxCount = Math.max(...data.map((d) => d.count), 1);
  const barWidth = 40;
  const barGap = 8;
  const chartHeight = 200;
  const chartWidth = data.length * (barWidth + barGap) + barGap;

  const bars = data
    .map((d, i) => {
      const barHeight = (d.count / maxCount) * (chartHeight - 40);
      const x = i * (barWidth + barGap) + barGap;
      const y = chartHeight - barHeight - 20;

      // Format date as MM/DD
      const date = new Date(d.date);
      const label = `${date.getMonth() + 1}/${date.getDate()}`;

      return `
        <rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" fill="var(--accent)" opacity="0.8" rx="2"/>
        <text x="${x + barWidth / 2}" y="${chartHeight - 5}" text-anchor="middle" fill="var(--fg)" opacity="0.6" font-size="11">${label}</text>
        <text x="${x + barWidth / 2}" y="${y - 5}" text-anchor="middle" fill="var(--fg)" opacity="0.8" font-size="12" font-weight="600">${d.count}</text>
      `;
    })
    .join("");

  return `
    <svg width="${chartWidth}" height="${chartHeight}" style="max-width: 100%; height: auto;">
      ${bars}
    </svg>
  `;
};

// Helper: generate analytics content
const generateAnalyticsContent = (data: AnalyticsData, showAllHistory: boolean): string => {
  const displayDirectory = showAllHistory ? "All History" : data.currentDirectory;

  return `
    <div style="padding: 40px; max-width: 1200px; margin: 0 auto;">
      <div style="margin-bottom: 32px;">
        <h1 style="font-size: 2rem; font-weight: 700; margin-bottom: 8px;">Analytics</h1>
        <p style="opacity: 0.6; font-size: 14px;">${displayDirectory}</p>
      </div>

      <!-- Tabs -->
      <div style="border-bottom: 1px solid var(--border); margin-bottom: 32px;">
        <div style="display: flex; gap: 0;">
          <button 
            id="tab-current" 
            class="analytics-tab ${showAllHistory ? "" : "active"}"
            style="padding: 12px 20px; background: none; border: none; border-bottom: 2px solid ${showAllHistory ? "transparent" : "var(--accent)"}; color: ${showAllHistory ? "var(--fg)" : "var(--accent)"}; cursor: pointer; font-size: 14px; font-weight: 600; opacity: ${showAllHistory ? "0.6" : "1"}; transition: all 0.2s;"
            onclick="location.href='/analytics?directory=' + encodeURIComponent('${data.currentDirectory}')"
          >
            Current Directory
          </button>
          <button 
            id="tab-all" 
            class="analytics-tab ${showAllHistory ? "active" : ""}"
            style="padding: 12px 20px; background: none; border: none; border-bottom: 2px solid ${showAllHistory ? "var(--accent)" : "transparent"}; color: ${showAllHistory ? "var(--accent)" : "var(--fg)"}; cursor: pointer; font-size: 14px; font-weight: 600; opacity: ${showAllHistory ? "1" : "0.6"}; transition: all 0.2s;"
            onclick="location.href='/analytics?all=true'"
          >
            All History
          </button>
        </div>
      </div>

      <!-- Stats Overview -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 32px;">
        <div style="padding: 20px; background: var(--code-bg); border: 1px solid var(--border); border-radius: 8px;">
          <div style="font-size: 24px; font-weight: 700; margin-bottom: 4px;">${data.totalEvents}</div>
          <div style="opacity: 0.6; font-size: 13px;">Total Events</div>
        </div>
        <div style="padding: 20px; background: var(--code-bg); border: 1px solid var(--border); border-radius: 8px;">
          <div style="font-size: 24px; font-weight: 700; margin-bottom: 4px;">${data.totalResources}</div>
          <div style="opacity: 0.6; font-size: 13px;">Total Resources</div>
        </div>
        <div style="padding: 20px; background: var(--code-bg); border: 1px solid var(--border); border-radius: 8px;">
          <div style="font-size: 24px; font-weight: 700; margin-bottom: 4px;">${data.mostViewed.length}</div>
          <div style="opacity: 0.6; font-size: 13px;">Viewed Documents</div>
        </div>
        <div style="padding: 20px; background: var(--code-bg); border: 1px solid var(--border); border-radius: 8px;">
          <div style="font-size: 24px; font-weight: 700; margin-bottom: 4px;">${data.zeroViews.length}</div>
          <div style="opacity: 0.6; font-size: 13px;">Unviewed Documents</div>
        </div>
      </div>

      <!-- Most Viewed Documents -->
      <div style="margin-bottom: 32px;">
        <h2 style="font-size: 1.25rem; font-weight: 600; margin-bottom: 16px;">Most Viewed Documents</h2>
        ${
          data.mostViewed.length > 0
            ? `
          <div style="background: var(--code-bg); border: 1px solid var(--border); border-radius: 8px; overflow: hidden;">
            ${data.mostViewed
              .map(
                (doc, i) => `
              <div style="display: flex; justify-content: space-between; align-items: center; padding: 14px 20px; border-bottom: ${i < data.mostViewed.length - 1 ? "1px solid var(--border)" : "none"};">
                <div style="display: flex; align-items: center; gap: 12px; min-width: 0; flex: 1;">
                  <span style="opacity: 0.4; font-size: 13px; font-weight: 600; width: 24px; flex-shrink: 0;">${i + 1}</span>
                  <div style="min-width: 0; flex: 1;">
                    <a href="/view/${doc.path.replace(`${data.currentDirectory}/`, "")}" style="color: var(--fg); text-decoration: none; font-size: 14px; display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${doc.path}">
                      ${doc.name}
                    </a>
                    <div style="opacity: 0.5; font-size: 11px; margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${doc.path}">
                      ${(() => {
                        const relativePath = doc.path.replace(`${data.currentDirectory}/`, "");
                        const parentPath = relativePath.substring(0, relativePath.lastIndexOf("/"));
                        return parentPath ? `/${parentPath}` : "/";
                      })()}
                    </div>
                  </div>
                </div>
                <div style="display: flex; flex-direction: column; align-items: flex-end; white-space: nowrap; margin-left: 16px;">
                  <span style="opacity: 0.6; font-size: 13px; font-weight: 600;">
                    ${doc.views} view${doc.views === 1 ? "" : "s"}
                  </span>
                  <span style="opacity: 0.4; font-size: 11px; margin-top: 2px;">
                    ${formatFileSize(doc.sizeBytes)}
                  </span>
                </div>
              </div>
            `
              )
              .join("")}
          </div>
        `
            : '<p style="opacity: 0.6; font-size: 14px;">No views recorded yet</p>'
        }
      </div>

      <!-- Activity Over Time -->
      <div style="margin-bottom: 32px;">
        <h2 style="font-size: 1.25rem; font-weight: 600; margin-bottom: 16px;">Activity Over Time (Last 7 Days)</h2>
        <div style="background: var(--code-bg); border: 1px solid var(--border); border-radius: 8px; padding: 24px; overflow-x: auto;">
          ${generateBarChart(data.timeSeries)}
        </div>
      </div>

      <!-- Zero View Documents -->
      ${
        data.zeroViews.length > 0
          ? `
        <div>
          <h2 style="font-size: 1.25rem; font-weight: 600; margin-bottom: 16px;">Documents with Zero Views</h2>
          <div style="background: var(--code-bg); border: 1px solid var(--border); border-radius: 8px; overflow: hidden;">
            ${data.zeroViews
              .slice(0, 20)
              .map(
                (doc, i) => `
              <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 20px; border-bottom: ${i < Math.min(data.zeroViews.length, 20) - 1 ? "1px solid var(--border)" : "none"};">
                <div style="min-width: 0; flex: 1;">
                  <a href="/view/${doc.path.replace(`${data.currentDirectory}/`, "")}" style="color: var(--fg); text-decoration: none; font-size: 14px; opacity: 0.7; display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${doc.path}">
                    ${doc.name}
                  </a>
                  <div style="opacity: 0.4; font-size: 11px; margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${doc.path}">
                    ${(() => {
                      const relativePath = doc.path.replace(`${data.currentDirectory}/`, "");
                      const parentPath = relativePath.substring(0, relativePath.lastIndexOf("/"));
                      return parentPath ? `/${parentPath}` : "/";
                    })()}
                  </div>
                </div>
                <span style="opacity: 0.4; font-size: 11px; white-space: nowrap; margin-left: 16px;">
                  ${formatFileSize(doc.sizeBytes)}
                </span>
              </div>
            `
              )
              .join("")}
            ${data.zeroViews.length > 20 ? `<div style="padding: 12px 20px; opacity: 0.6; font-size: 13px;">...and ${data.zeroViews.length - 20} more</div>` : ""}
          </div>
        </div>
      `
          : ""
      }
    </div>
  `;
};

// Options for analytics page generation
type AnalyticsPageOptions = {
  data: AnalyticsData;
  config: Config;
  files: MarkdownFile[];
  clientScript: string;
  showAllHistory?: boolean;
};

// Public function: generate analytics page
export const generateAnalyticsPage = (options: AnalyticsPageOptions): string => {
  const { data, config, files, clientScript, showAllHistory = false } = options;

  const content = generateAnalyticsContent(data, showAllHistory);

  return baseLayout({
    content,
    title: "Analytics",
    theme: config.theme,
    files,
    clientScript,
  });
};
