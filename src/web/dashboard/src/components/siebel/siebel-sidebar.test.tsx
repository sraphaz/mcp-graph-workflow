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
import { SiebelSidebar } from "./siebel-sidebar.js";

describe("<SiebelSidebar>", () => {
  it("should render all 4 Siebel sections", () => {
    render(
      <SiebelSidebar
        activeSection="upload"
        onSectionChange={() => {}}
        objectCount={0}
      />,
    );

    expect(screen.getByText("Upload")).toBeInTheDocument();
    expect(screen.getByText("Objects")).toBeInTheDocument();
    expect(screen.getByText("Graph")).toBeInTheDocument();
    expect(screen.getByText("Generation")).toBeInTheDocument();
  });

  it("should expose nav landmark with aria-label='Siebel sections'", () => {
    render(
      <SiebelSidebar
        activeSection="upload"
        onSectionChange={() => {}}
        objectCount={0}
      />,
    );

    const nav = screen.getByRole("navigation");
    expect(nav).toHaveAttribute("aria-label", "Siebel sections");
  });

  it("should call onSectionChange with the correct section id when clicked", async () => {
    const user = userEvent.setup();
    const onSectionChange = vi.fn();

    render(
      <SiebelSidebar
        activeSection="upload"
        onSectionChange={onSectionChange}
        objectCount={0}
      />,
    );

    await user.click(screen.getByText("Graph"));

    expect(onSectionChange).toHaveBeenCalledOnce();
    expect(onSectionChange).toHaveBeenCalledWith("graph");
  });

  it("should highlight the active section with accent classes", () => {
    render(
      <SiebelSidebar
        activeSection="objects"
        onSectionChange={() => {}}
        objectCount={0}
      />,
    );

    const objectsButton = screen
      .getByText("Objects")
      .closest("button") as HTMLButtonElement;
    expect(objectsButton.className).toContain("text-accent");

    const uploadButton = screen
      .getByText("Upload")
      .closest("button") as HTMLButtonElement;
    expect(uploadButton.className).not.toContain("text-accent");
  });

  it("should show object count badge ONLY on the Objects section when count > 0", () => {
    render(
      <SiebelSidebar
        activeSection="upload"
        onSectionChange={() => {}}
        objectCount={42}
      />,
    );

    const badge = screen.getByText("42");
    expect(badge).toBeInTheDocument();

    // Confirm badge sits inside the Objects button.
    const objectsButton = screen.getByText("Objects").closest("button");
    expect(objectsButton?.contains(badge)).toBe(true);
  });

  it("should NOT render the badge when objectCount is 0", () => {
    render(
      <SiebelSidebar
        activeSection="upload"
        onSectionChange={() => {}}
        objectCount={0}
      />,
    );

    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });
});
