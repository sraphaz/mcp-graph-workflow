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

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { KanbanSuggestions } from "./kanban-suggestions.js";
import type { KanbanSuggestion } from "@/lib/types";

function makeSuggestion(overrides: Partial<KanbanSuggestion> = {}): KanbanSuggestion {
  return {
    action: "promote_ready",
    nodeId: "node-1",
    nodeTitle: "Test Task",
    reason: "Eligible for promotion",
    ...overrides,
  } as KanbanSuggestion;
}

describe("<KanbanSuggestions>", () => {
  it("should render the healthy-board empty state when no suggestions", () => {
    render(<KanbanSuggestions suggestions={[]} onApply={() => {}} />);

    expect(screen.getByText(/board looks healthy/i)).toBeInTheDocument();
  });

  it("should render the panel header when suggestions exist", () => {
    render(
      <KanbanSuggestions
        suggestions={[makeSuggestion()]}
        onApply={() => {}}
      />,
    );

    expect(screen.getByText("Suggestions")).toBeInTheDocument();
  });

  it("should map known actions to descriptive labels", () => {
    render(
      <KanbanSuggestions
        suggestions={[
          makeSuggestion({ action: "promote_ready", nodeId: "n1" }),
          makeSuggestion({ action: "wip_violation", nodeId: "n2" }),
          makeSuggestion({ action: "bottleneck_alert", nodeId: "n3" }),
        ]}
        onApply={() => {}}
      />,
    );

    expect(screen.getByText("Promote to Ready")).toBeInTheDocument();
    expect(screen.getByText("WIP Violation")).toBeInTheDocument();
    expect(screen.getByText("Bottleneck Alert")).toBeInTheDocument();
  });

  it("should fall back to raw action string for unknown action keys", () => {
    render(
      <KanbanSuggestions
        suggestions={[
          makeSuggestion({ action: "unknown_action" as KanbanSuggestion["action"] }),
        ]}
        onApply={() => {}}
      />,
    );

    expect(screen.getByText("unknown_action")).toBeInTheDocument();
  });

  it("should show Apply button for actionable suggestions (promote_ready)", () => {
    render(
      <KanbanSuggestions
        suggestions={[makeSuggestion({ action: "promote_ready" })]}
        onApply={() => {}}
      />,
    );

    expect(screen.getByText("Apply")).toBeInTheDocument();
  });

  it("should NOT show Apply button for read-only alerts (wip_violation, bottleneck_alert)", () => {
    render(
      <KanbanSuggestions
        suggestions={[
          makeSuggestion({ action: "wip_violation", nodeId: "n1" }),
          makeSuggestion({ action: "bottleneck_alert", nodeId: "n2" }),
        ]}
        onApply={() => {}}
      />,
    );

    expect(screen.queryByText("Apply")).not.toBeInTheDocument();
  });

  it("should call onApply with the suggestion object when Apply is clicked", async () => {
    const onApply = vi.fn();
    const user = userEvent.setup();
    const suggestion = makeSuggestion({ action: "unblock", nodeId: "u1" });

    render(<KanbanSuggestions suggestions={[suggestion]} onApply={onApply} />);

    await user.click(screen.getByText("Apply"));

    expect(onApply).toHaveBeenCalledOnce();
    expect(onApply).toHaveBeenCalledWith(suggestion);
  });
});
