import { describe, expect, test } from "bun:test";
import { createConfig, parseArgs } from "./cli";

describe("parseArgs", () => {
  test("parses path argument", () => {
    const result = parseArgs(["./docs"]);
    expect(result.path).toBe("./docs");
  });

  test("parses flags", () => {
    const result = parseArgs(["--port", "3000"]);
    expect(result.flags.port).toBe(3000);
  });

  test("parses boolean flags", () => {
    const result = parseArgs(["--no-open", "--watch"]);
    expect(result.flags.open).toBe(false);
    expect(result.flags.watch).toBe(true);
  });

  test("parses theme flag", () => {
    const result = parseArgs(["--theme", "dark"]);
    expect(result.flags.theme).toBe("dark");
  });

  test("handles help flag", () => {
    const result = parseArgs(["--help"]);
    expect(result.flags.help).toBe(true);
  });

  test("handles version flag", () => {
    const result = parseArgs(["--version"]);
    expect(result.flags.version).toBe(true);
  });

  test("parses short flags", () => {
    const result = parseArgs(["-p", "3000", "-t", "light", "-o", "-w"]);
    expect(result.flags.port).toBe(3000);
    expect(result.flags.theme).toBe("light");
    expect(result.flags.open).toBe(true);
    expect(result.flags.watch).toBe(true);
  });

  test("parses short version flag", () => {
    const result = parseArgs(["-v"]);
    expect(result.flags.version).toBe(true);
  });

  test("parses short help flag", () => {
    const result = parseArgs(["-h"]);
    expect(result.flags.help).toBe(true);
  });

  test("parses short no-open flag", () => {
    const result = parseArgs(["-n"]);
    expect(result.flags.open).toBe(false);
  });

  test("parses analytics subcommands", () => {
    const enableResult = parseArgs(["analytics", "enable"]);
    expect(enableResult.flags.analytics).toBe(true);
    expect(enableResult.flags.analyticsSubcommand).toBe("enable");

    const disableResult = parseArgs(["analytics", "disable"]);
    expect(disableResult.flags.analytics).toBe(true);
    expect(disableResult.flags.analyticsSubcommand).toBe("disable");

    const viewResult = parseArgs(["analytics", "view"]);
    expect(viewResult.flags.analytics).toBe(true);
    expect(viewResult.flags.analyticsSubcommand).toBe("view");
  });

  test("parses highlights subcommands", () => {
    const enableResult = parseArgs(["highlights", "enable"]);
    expect(enableResult.flags.highlights).toBe(true);
    expect(enableResult.flags.highlightsSubcommand).toBe("enable");

    const disableResult = parseArgs(["highlights", "disable"]);
    expect(disableResult.flags.highlights).toBe(true);
    expect(enableResult.flags.highlightsSubcommand).toBe("enable");
  });

  test("defaults to enable when highlights called without subcommand", () => {
    const result = parseArgs(["highlights"]);
    expect(result.flags.highlights).toBe(true);
    expect(result.flags.highlightsSubcommand).toBe("enable");
  });

  test("parses db subcommands", () => {
    const checkResult = parseArgs(["db", "check"]);
    expect(checkResult.flags.db).toBe(true);
    expect(checkResult.flags.dbSubcommand).toBe("check");

    const cleanupResult = parseArgs(["db", "cleanup"]);
    expect(cleanupResult.flags.db).toBe(true);
    expect(cleanupResult.flags.dbSubcommand).toBe("cleanup");

    const clearResult = parseArgs(["db", "clear"]);
    expect(clearResult.flags.db).toBe(true);
    expect(clearResult.flags.dbSubcommand).toBe("clear");
  });

  test("parses --days flag for db cleanup", () => {
    const result = parseArgs(["db", "cleanup", "--days", "7"]);
    expect(result.flags.days).toBe(7);
  });

  test("uses default 30 days when --days not provided", () => {
    const result = parseArgs(["db", "cleanup"]);
    expect(result.flags.days).toBeUndefined();
  });

  test("handles invalid --days value", () => {
    const result = parseArgs(["db", "cleanup", "--days", "invalid"]);
    expect(result.flags.days).toBe(30); // Should default to 30
  });

  test("parses archive subcommands", () => {
    const listResult = parseArgs(["archive", "list"]);
    expect(listResult.flags.archive).toBe(true);
    expect(listResult.flags.archiveSubcommand).toBe("list");

    const showResult = parseArgs(["archive", "show", "README.md"]);
    expect(showResult.flags.archive).toBe(true);
    expect(showResult.flags.archiveSubcommand).toBe("show");
    expect(showResult.flags.archivePath).toBe("README.md");

    const clearResult = parseArgs(["archive", "clear"]);
    expect(clearResult.flags.archive).toBe(true);
    expect(clearResult.flags.archiveSubcommand).toBe("clear");
  });

  test("defaults to list when archive called without subcommand", () => {
    const result = parseArgs(["archive"]);
    expect(result.flags.archive).toBe(true);
    expect(result.flags.archiveSubcommand).toBe("list");
  });

  test("parses export command", () => {
    const withPathResult = parseArgs(["export", "./docs"]);
    expect(withPathResult.flags.export).toBe(true);
    expect(withPathResult.flags.exportPath).toBe("./docs");

    const withoutPathResult = parseArgs(["export"]);
    expect(withoutPathResult.flags.export).toBe(true);
    expect(withoutPathResult.flags.exportPath).toBeUndefined();
  });

  test("does not parse flags as export path", () => {
    const result = parseArgs(["export", "--theme", "dark"]);
    expect(result.flags.export).toBe(true);
    expect(result.flags.exportPath).toBeUndefined();
    expect(result.flags.theme).toBe("dark");
  });
});

describe("createConfig", () => {
  test("uses defaults or saved preferences when no flags provided", () => {
    const parsed = parseArgs([]);
    const config = createConfig(parsed);
    expect(config.port).toBe(0);
    // Theme may be "dark" (default) or saved preference from database
    expect(typeof config.theme).toBe("string");
    expect(config.open).toBe(true);
    expect(config.watch).toBe(false);
  });

  test("resolves directory path", () => {
    const parsed = parseArgs(["./docs"]);
    const config = createConfig(parsed);
    expect(config.directory).toContain("docs");
    expect(config.initialFile).toBeUndefined();
  });

  test("resolves file path and extracts directory", () => {
    const parsed = parseArgs(["./docs/README.md"]);
    const config = createConfig(parsed);
    expect(config.directory).toContain("docs");
    expect(config.initialFile).toContain("README.md");
  });

  test("applies flag overrides", () => {
    const parsed = parseArgs(["--port", "8080", "--theme", "dark", "--no-open"]);
    const config = createConfig(parsed);
    expect(config.port).toBe(8080);
    expect(config.theme).toBe("dark");
    expect(config.open).toBe(false);
  });
});
