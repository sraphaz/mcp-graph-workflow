/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * This file is part of mcp-graph.
 *
 * mcp-graph is free software: you can redistribute it and/or modify it under the
 * terms of the GNU Affero General Public License v3.0 or later, as published by
 * the Free Software Foundation. See LICENSE for the full terms.
 *
 * mcp-graph is distributed in the hope that it will be useful, but WITHOUT ANY
 * WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
 * A PARTICULAR PURPOSE.
 *
 * Commercial licenses are available — see COMMERCIAL.md.
 */

import { useEffect, useRef, useCallback } from "react";

/**
 * Hook for accessible dialog behavior: focus trap, initial focus, focus return on close.
 * Attach the returned ref to the dialog content container (not the overlay).
 */
export function useDialogA11y(open: boolean, onClose: () => void): React.RefObject<HTMLDivElement | null> {
  const dialogRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<Element | null>(null);

  // Capture the element that had focus when dialog opened
  useEffect(() => {
    if (open) {
      triggerRef.current = document.activeElement;
    }
  }, [open]);

  // Initial focus: move focus into the dialog when it opens
  useEffect(() => {
    if (!open || !dialogRef.current) return;

    // Focus first focusable element, or the dialog itself
    const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    const firstFocusable = focusable[0];
    if (firstFocusable) {
      firstFocusable.focus();
    } else {
      dialogRef.current.focus();
    }
  }, [open]);

  // Return focus when dialog closes
  useEffect(() => {
    if (open) return;
    // When open transitions from true to false, return focus
    const trigger = triggerRef.current;
    if (trigger && trigger instanceof HTMLElement) {
      trigger.focus();
      triggerRef.current = null;
    }
  }, [open]);

  // Focus trap: keep Tab cycling within the dialog
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!dialogRef.current) return;

      if (e.key === "Escape") {
        onClose();
        return;
      }

      if (e.key !== "Tab") return;

      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    },
    [onClose],
  );

  useEffect(() => {
    if (!open) return;
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, handleKeyDown]);

  return dialogRef;
}
