/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC — Task 3.3: useFetchState — utility hook for data fetching
 *
 * Returns { data, loading, error, retry } — eliminates per-tab fetch boilerplate.
 */

import { useState, useEffect, useCallback, useRef } from "react";

export interface FetchState<T> {
  data: T | undefined;
  loading: boolean;
  error: string | undefined;
  retry: () => void;
}

export function useFetchState<T>(fetchFn: () => Promise<T>): FetchState<T> {
  const [data, setData] = useState<T | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>(undefined);
  const [tick, setTick] = useState(0);
  const fetchRef = useRef(fetchFn);
  fetchRef.current = fetchFn;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(undefined);
    fetchRef.current()
      .then((result) => {
        if (!cancelled) {
          setData(result);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
          setLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, [tick]);

  const retry = useCallback(() => setTick((t) => t + 1), []);

  return { data, loading, error, retry };
}
