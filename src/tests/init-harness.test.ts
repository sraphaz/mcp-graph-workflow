/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { initWithHarnessBaseline } from "../core/pipeline/init-harness.js";

vi.mock("../core/harness/harness-scan-runner.js", () => ({
  runHarnessScan: vi.fn(),
}));

import { runHarnessScan } from "../core/harness/harness-scan-runner.js";

describe("initWithHarnessBaseline", () => {
  let store: SqliteStore;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("init-harness test");
    vi.mocked(runHarnessScan).mockReset();
  });

  it("returns score+grade when scan succeeds", () => {
    vi.mocked(runHarnessScan).mockReturnValue({
      score: 78.3,
      grade: "B",
    } as ReturnType<typeof runHarnessScan>);

    const r = initWithHarnessBaseline(store);
    expect(r.harnessBaseline).toEqual({ score: 78.3, grade: "B" });
  });

  it("returns null baseline when scan throws — non-blocking by contract", () => {
    vi.mocked(runHarnessScan).mockImplementation(() => {
      throw new Error("scan blew up");
    });

    const r = initWithHarnessBaseline(store);
    expect(r.harnessBaseline).toBeNull();
  });

  it("always returns the harness hint string regardless of scan outcome", () => {
    vi.mocked(runHarnessScan).mockImplementation(() => {
      throw new Error("nope");
    });
    const r = initWithHarnessBaseline(store);
    expect(r.harnessHint).toContain("harness_scan");
    expect(r.harnessHint).toContain("help(topic:");
  });

  it("invokes runHarnessScan with the store's db", () => {
    vi.mocked(runHarnessScan).mockReturnValue({
      score: 50,
      grade: "C",
    } as ReturnType<typeof runHarnessScan>);

    initWithHarnessBaseline(store);
    expect(runHarnessScan).toHaveBeenCalledTimes(1);
    expect(runHarnessScan).toHaveBeenCalledWith(process.cwd(), store.getDb());
  });
});
