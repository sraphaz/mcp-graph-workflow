import { describe, it, expect } from "vitest";
import { percentile } from "../core/insights/dora-metrics.js";

describe("percentile", () => {
  it("should return 0 for empty array", () => {
    expect(percentile([], 0.5)).toBe(0);
  });

  it("should return only element for single-element array", () => {
    expect(percentile([42], 0.5)).toBe(42);
    expect(percentile([42], 0.95)).toBe(42);
  });

  it("should return p50 = 50 for [1..100]", () => {
    const arr = Array.from({ length: 100 }, (_, i) => i + 1);
    expect(percentile(arr, 0.5)).toBe(50);
  });

  it("should return p95 = 95 for [1..100]", () => {
    const arr = Array.from({ length: 100 }, (_, i) => i + 1);
    expect(percentile(arr, 0.95)).toBe(95);
  });

  it("should return correct p50 for small arrays", () => {
    // [10, 20, 30] — p50 should be middle value (20)
    expect(percentile([10, 20, 30], 0.5)).toBe(20);
  });

  it("should return correct p95 for 2-element array", () => {
    // [10, 20] — p95 should be close to 20 (index 0.95 * 1 = 0.95 -> floor = 0 -> 10? or nearest-rank: 20)
    // Standard nearest-rank: p95 of [10, 20] = 20 (rank = ceil(0.95 * 2) = 2, idx = 1)
    // Our fix Math.floor(p*(len-1)): Math.floor(0.95*1) = 0 -> 10
    // Actually, nearest-rank method: idx = Math.ceil(p * len) - 1 = Math.ceil(1.9) - 1 = 1 -> 20
    // This IS correct for nearest-rank. Let's keep nearest-rank behavior.
    expect(percentile([10, 20], 0.95)).toBe(20);
  });

  it("should handle p=0", () => {
    expect(percentile([10, 20, 30], 0)).toBe(10);
  });

  it("should handle p=1", () => {
    expect(percentile([10, 20, 30], 1)).toBe(30);
  });
});

describe("percentile — E3-T03 ACs", () => {
  it("percentile([1,2,3,4,5], 0.5) returns 3 (median of odd array)", () => {
    expect(percentile([1, 2, 3, 4, 5], 0.5)).toBe(3);
  });

  it("single-element array returns that element for any p", () => {
    expect(percentile([42], 0.1)).toBe(42);
    expect(percentile([42], 0.5)).toBe(42);
    expect(percentile([42], 0.99)).toBe(42);
  });

  it("p=0 returns first element", () => {
    expect(percentile([5, 10, 15], 0)).toBe(5);
  });

  it("p=1 returns last element", () => {
    expect(percentile([5, 10, 15], 1)).toBe(15);
  });

  it("no NaN or Infinity in output", () => {
    const result = percentile([1, 2, 3, 4, 5], 0.95);
    expect(Number.isFinite(result)).toBe(true);
  });

  it("clamps percentile above 1 to the max value", () => {
    expect(percentile([1, 2, 3], 2)).toBe(3);
  });

  it("handles unsorted input values deterministically", () => {
    expect(percentile([30, 10, 20], 0.5)).toBe(20);
  });
});
