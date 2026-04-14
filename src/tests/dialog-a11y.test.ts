import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Static analysis tests for dialog accessibility contract (E1-T11 / Task 2.1).
 * Verifies that all 3 global modals have required ARIA attributes.
 * Full interactive testing (focus trap, focus return) requires Playwright E2E.
 */

const DASHBOARD_SRC = join(process.cwd(), "src/web/dashboard/src/components/modals");

function readModal(filename: string): string {
  return readFileSync(join(DASHBOARD_SRC, filename), "utf-8");
}

describe("Dialog accessibility contract (Task 2.1)", () => {
  const modals = [
    { file: "import-modal.tsx", titleId: "import-modal-title" },
    { file: "open-folder-modal.tsx", titleId: "open-folder-modal-title" },
    { file: "capture-modal.tsx", titleId: "capture-modal-title" },
  ];

  for (const { file, titleId } of modals) {
    describe(file, () => {
      const source = readModal(file);

      it('should have role="dialog"', () => {
        expect(source).toContain('role="dialog"');
      });

      it('should have aria-modal="true"', () => {
        expect(source).toContain('aria-modal="true"');
      });

      it(`should have aria-labelledby="${titleId}"`, () => {
        expect(source).toContain(`aria-labelledby="${titleId}"`);
      });

      it(`should have id="${titleId}" on the heading`, () => {
        expect(source).toContain(`id="${titleId}"`);
      });

      it("should use useDialogA11y hook for focus management", () => {
        expect(source).toContain("useDialogA11y");
      });

      it("should NOT have duplicate Escape key handler (handled by hook)", () => {
        // The hook handles Escape — modal should not have its own keydown listener for Escape
        const escapeHandlerPattern = /addEventListener\("keydown"/;
        expect(escapeHandlerPattern.test(source)).toBe(false);
      });
    });
  }
});
