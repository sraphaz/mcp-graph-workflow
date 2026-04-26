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

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { UploadProgress } from "./upload-progress.js";

describe("<UploadProgress>", () => {
  it("should return null when status='idle'", () => {
    const { container } = render(
      <UploadProgress status="idle" progress={0} error={null} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("should render status='reading' label and progress bar", () => {
    render(<UploadProgress status="reading" progress={25} error={null} />);

    expect(screen.getByText("Reading file...")).toBeInTheDocument();
    expect(screen.getByText("25%")).toBeInTheDocument();
  });

  it("should style done state with green text and bar", () => {
    const { container } = render(
      <UploadProgress status="done" progress={100} error={null} />,
    );

    expect(screen.getByText("Done!")).toBeInTheDocument();
    expect(screen.getByText("100%")).toBeInTheDocument();
    // The bar's inner element gets bg-green-500 in done state
    const bar = container.querySelector(".bg-green-500");
    expect(bar).not.toBeNull();
  });

  it("should hide percentage and bar when status='error', show the error message in red", () => {
    render(
      <UploadProgress
        status="error"
        progress={50}
        error="Invalid SIF file"
      />,
    );

    expect(screen.getByText("Invalid SIF file")).toBeInTheDocument();
    expect(screen.queryByText("50%")).not.toBeInTheDocument();
    // The error label has the red text class.
    const node = screen.getByText("Invalid SIF file");
    expect(node.className).toContain("text-red-500");
  });

  it("should expose role=status with aria-live='polite' for screen readers", () => {
    render(<UploadProgress status="parsing" progress={50} error={null} />);

    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-live", "polite");
  });

  it("should set the progress bar width via inline style", () => {
    const { container } = render(
      <UploadProgress status="extracting" progress={75} error={null} />,
    );

    const bar = container.querySelector(
      ".h-full.rounded-full",
    ) as HTMLElement;
    expect(bar.style.width).toBe("75%");
  });

  it("should map all known statuses to a label", () => {
    const cases: Array<["reading" | "parsing" | "extracting" | "inferring" | "done" | "error", string]> = [
      ["reading", "Reading file..."],
      ["parsing", "Parsing XML..."],
      ["extracting", "Extracting objects..."],
      ["inferring", "Inferring dependencies..."],
      ["done", "Done!"],
    ];
    for (const [status, label] of cases) {
      const { unmount } = render(
        <UploadProgress status={status} progress={50} error={null} />,
      );
      expect(screen.getByText(label)).toBeInTheDocument();
      unmount();
    }
  });
});
