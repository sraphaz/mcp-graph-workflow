/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-atomic-files-writer — Task 1.1: Core types for the atomic-files writer.
 */

export type AtomicFile = {
  fileId: string;
  path: string;
  format: "markdown" | "json";
  managedContent: string;
};

export type AtomicFileMode = "init" | "update";

export type WriteResult = {
  status: "created" | "updated" | "noop" | "preserved_external";
  backupPath?: string;
  diff?: string;
};
