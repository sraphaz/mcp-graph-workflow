import { describe, it, expect } from "vitest";
import { diffPrd } from "../../core/parser/prd-diff.js";

describe("diffPrd", () => {
  it("should return all unchanged when PRDs are identical", () => {
    const prd = `# Overview\nThis is the overview.\n\n## Features\nFeature list here.`;

    const result = diffPrd(prd, prd);

    expect(result.addedCount).toBe(0);
    expect(result.removedCount).toBe(0);
    expect(result.modifiedCount).toBe(0);
    expect(result.unchangedCount).toBe(2);
    expect(result.sections.every((s) => s.status === "unchanged")).toBe(true);
  });

  it("should detect added sections", () => {
    const oldPrd = `# Overview\nThis is the overview.`;
    const newPrd = `# Overview\nThis is the overview.\n\n## New Section\nBrand new content.`;

    const result = diffPrd(oldPrd, newPrd);

    expect(result.addedCount).toBe(1);
    expect(result.removedCount).toBe(0);
    expect(result.modifiedCount).toBe(0);
    expect(result.unchangedCount).toBe(1);

    const added = result.sections.find((s) => s.status === "added");
    expect(added).toBeDefined();
    expect(added!.title).toBe("New Section");
    expect(added!.newContent).toBe("Brand new content.");
  });

  it("should detect removed sections", () => {
    const oldPrd = `# Overview\nThis is the overview.\n\n## Deprecated\nOld content.`;
    const newPrd = `# Overview\nThis is the overview.`;

    const result = diffPrd(oldPrd, newPrd);

    expect(result.addedCount).toBe(0);
    expect(result.removedCount).toBe(1);
    expect(result.modifiedCount).toBe(0);
    expect(result.unchangedCount).toBe(1);

    const removed = result.sections.find((s) => s.status === "removed");
    expect(removed).toBeDefined();
    expect(removed!.title).toBe("Deprecated");
    expect(removed!.oldContent).toBe("Old content.");
  });

  it("should detect modified sections", () => {
    const oldPrd = `# Overview\nOriginal overview text.`;
    const newPrd = `# Overview\nUpdated overview text with changes.`;

    const result = diffPrd(oldPrd, newPrd);

    expect(result.addedCount).toBe(0);
    expect(result.removedCount).toBe(0);
    expect(result.modifiedCount).toBe(1);
    expect(result.unchangedCount).toBe(0);

    const modified = result.sections.find((s) => s.status === "modified");
    expect(modified).toBeDefined();
    expect(modified!.oldContent).toBe("Original overview text.");
    expect(modified!.newContent).toBe("Updated overview text with changes.");
  });

  it("should handle mixed changes (add + remove + modify + unchanged)", () => {
    const oldPrd = [
      "# Overview",
      "Same overview.",
      "",
      "## Features",
      "Old features.",
      "",
      "## Deprecated",
      "Will be removed.",
    ].join("\n");

    const newPrd = [
      "# Overview",
      "Same overview.",
      "",
      "## Features",
      "New features list.",
      "",
      "## Timeline",
      "Brand new timeline.",
    ].join("\n");

    const result = diffPrd(oldPrd, newPrd);

    expect(result.unchangedCount).toBe(1); // Overview
    expect(result.modifiedCount).toBe(1); // Features
    expect(result.removedCount).toBe(1); // Deprecated
    expect(result.addedCount).toBe(1); // Timeline
    expect(result.sections).toHaveLength(4);
  });

  it("should match sections case-insensitively", () => {
    const oldPrd = `# OVERVIEW\nContent here.`;
    const newPrd = `# Overview\nContent here.`;

    const result = diffPrd(oldPrd, newPrd);

    expect(result.unchangedCount).toBe(1);
    expect(result.addedCount).toBe(0);
    expect(result.removedCount).toBe(0);
  });
});
