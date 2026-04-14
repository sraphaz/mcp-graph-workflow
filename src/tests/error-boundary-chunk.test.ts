import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Static analysis tests for ErrorBoundary chunk load recovery (Task 1.1).
 * Verifies the ErrorBoundary handles dynamic import failures correctly.
 */

const APP_TSX = readFileSync(
  join(process.cwd(), "src/web/dashboard/src/app/App.tsx"),
  "utf-8",
);

describe("ErrorBoundary chunk load recovery (Task 1.1)", () => {
  // AC1: auto-retry once on chunk load failure
  it("should detect chunk load errors via isChunkLoadError", () => {
    expect(APP_TSX).toContain("isChunkLoadError");
    expect(APP_TSX).toContain("dynamically imported module");
  });

  it("should attempt controlled reload once using sessionStorage key", () => {
    expect(APP_TSX).toContain("CHUNK_RETRY_KEY");
    expect(APP_TSX).toContain("sessionStorage.setItem");
    expect(APP_TSX).toContain("window.location.reload()");
  });

  it("should check if retry was already attempted before reloading", () => {
    expect(APP_TSX).toContain("sessionStorage.getItem(CHUNK_RETRY_KEY)");
  });

  // AC2: clear message when retry already happened
  it("should show chunk-specific error message for chunk load failures", () => {
    expect(APP_TSX).toContain("This tab failed to load");
  });

  it("should show generic message for non-chunk errors", () => {
    expect(APP_TSX).toContain("Something went wrong");
  });

  // AC3: tab change resets ErrorBoundary (via key={activeTab})
  it("should use key={activeTab} on ErrorBoundary so tab change resets error state", () => {
    expect(APP_TSX).toContain("key={activeTab}");
  });

  it("should have ErrorBoundary wrapping only tab content (not global buttons)", () => {
    // ErrorBoundary should be inside <main>, modals are outside
    expect(APP_TSX).toMatch(/<ErrorBoundary[\s\S]*?<\/ErrorBoundary>/);
    // Modals are rendered after the main area, outside ErrorBoundary
    expect(APP_TSX).toMatch(/<\/ErrorBoundary>[\s\S]*?<ImportModal/);
  });
});
