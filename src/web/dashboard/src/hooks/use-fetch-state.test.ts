/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC — Task 3.3: useFetchState hook + LoadingState/ErrorState components
 *
 * AC1: GIVEN fetch falha WHEN retry chamado THEN refetch executado
 * AC2: GIVEN fetch retorna dados WHEN hook THEN data disponível
 * AC3: GIVEN loading=true WHEN hook THEN error/data undefined
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useFetchState } from "./use-fetch-state";

describe("useFetchState", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("AC1: starts in loading=true state", () => {
    const fn = vi.fn(() => new Promise(() => {}));
    const { result } = renderHook(() => useFetchState(fn));
    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBeUndefined();
    expect(result.current.error).toBeUndefined();
  });

  it("AC2: data is set after successful fetch", async () => {
    const fn = vi.fn().mockResolvedValue({ items: [1, 2, 3] });
    const { result } = renderHook(() => useFetchState(fn));
    await act(async () => {});
    expect(result.current.loading).toBe(false);
    expect(result.current.data).toEqual({ items: [1, 2, 3] });
    expect(result.current.error).toBeUndefined();
  });

  it("AC3: error is set when fetch rejects", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("network error"));
    const { result } = renderHook(() => useFetchState(fn));
    await act(async () => {});
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe("network error");
    expect(result.current.data).toBeUndefined();
  });

  it("AC1: retry re-invokes the fetch function", async () => {
    const fn = vi.fn().mockRejectedValueOnce(new Error("fail")).mockResolvedValue({ ok: true });
    const { result } = renderHook(() => useFetchState(fn));
    await act(async () => {});
    expect(result.current.error).toBe("fail");

    await act(async () => { result.current.retry(); });
    expect(fn).toHaveBeenCalledTimes(2);
    expect(result.current.data).toEqual({ ok: true });
    expect(result.current.error).toBeUndefined();
  });
});
