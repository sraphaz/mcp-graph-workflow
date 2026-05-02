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

import { useState, useCallback } from "react";

interface JsonResultViewProps {
  data: unknown;
}

/** JsonResultView — auto-generated description placeholder. */
export function JsonResultView({ data }: JsonResultViewProps): React.JSX.Element {
  const [collapsed, setCollapsed] = useState(false);
  const [copied, setCopied] = useState(false);

  const jsonString = JSON.stringify(data, null, 2);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(jsonString);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: select text manually
    }
  }, [jsonString]);

  return (
    <div className="rounded-xl border border-edge shadow-sm hover:shadow-md transition-shadow bg-surface-alt">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-edge">
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="text-[10px] text-muted hover:text-foreground transition-colors"
        >
          {collapsed ? "▸ Show JSON" : "▾ JSON"}
        </button>
        <button
          onClick={() => void handleCopy()}
          className="text-[10px] px-2 py-0.5 rounded bg-surface-elevated text-muted hover:text-foreground transition-colors"
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>

      {!collapsed && (
        <pre className="p-3 text-xs whitespace-pre-wrap overflow-x-auto max-h-[400px] overflow-y-auto">
          {jsonString}
        </pre>
      )}
    </div>
  );
}
