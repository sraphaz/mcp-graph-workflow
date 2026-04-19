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

import { memo } from "react";
import { useTheme } from "@/providers/theme-provider";
import { ProjectSelector } from "./project-selector";
import type { GraphStats } from "@/lib/types";

interface HeaderProps {
  stats: GraphStats | null;
  onImport: () => void;
  onCapture: () => void;
  onOpenFolder: () => void;
}

export const Header = memo(function Header({ stats, onImport, onCapture, onOpenFolder }: HeaderProps) {
  const { theme, toggleTheme } = useTheme();

  const done = stats?.byStatus?.done ?? 0;
  const total = stats?.totalNodes ?? 0;

  return (
    <header className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 border-b border-edge bg-surface-alt">
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-bold text-accent">
          mcp-graph
        </h1>
        <ProjectSelector />
        {total > 0 && (
          <span className="text-sm text-muted">
            {done}/{total} done
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onOpenFolder}
          className="px-3 py-1.5 text-sm border border-edge rounded hover:bg-surface-elevated transition-colors"
          aria-label="Open project folder"
          title="Open a different project folder"
        >
          Open Folder
        </button>
        <button
          onClick={onImport}
          className="px-3 py-1.5 text-sm bg-accent text-white rounded hover:bg-accent-light transition-colors"
          aria-label="Import PRD file"
        >
          Import PRD
        </button>
        <button
          onClick={onCapture}
          className="px-3 py-1.5 text-sm border border-edge rounded hover:bg-surface-elevated transition-colors"
          aria-label="Capture web content"
        >
          Capture
        </button>
        <button
          onClick={toggleTheme}
          className="px-2 py-1.5 text-sm border border-edge rounded hover:bg-surface-elevated transition-colors"
          title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
          aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
        >
          {theme === "dark" ? "☀" : "☾"}
        </button>
      </div>
    </header>
  );
});
