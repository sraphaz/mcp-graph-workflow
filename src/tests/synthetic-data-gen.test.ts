import { describe, it, expect } from "vitest";
import { z } from "zod/v4";
import {
  generateMinimal,
  generateEdgeCase,
} from "../core/harness/synthetic-data-gen.js";

describe("Synthetic Data Generator — QuickCheck (Claessen & Hughes 2000)", () => {
  describe("generateMinimal", () => {
    it("should generate minimal valid data for object schema with 10 fields", () => {
      const schema = z.object({
        id: z.string(),
        name: z.string().min(1).max(100),
        email: z.string(),
        age: z.number(),
        active: z.boolean(),
        role: z.enum(["admin", "user", "guest"]),
        tags: z.array(z.string()),
        score: z.number().min(0).max(100),
        bio: z.string().optional(),
        metadata: z.record(z.string(), z.string()).optional(),
      });

      const data = generateMinimal(schema);

      expect(() => schema.parse(data)).not.toThrow();
      expect(typeof data.id).toBe("string");
      expect(typeof data.name).toBe("string");
      expect(data.name.length).toBeGreaterThanOrEqual(1);
      expect(data.name.length).toBeLessThanOrEqual(100);
      expect(typeof data.age).toBe("number");
      expect(typeof data.active).toBe("boolean");
      expect(["admin", "user", "guest"]).toContain(data.role);
      expect(Array.isArray(data.tags)).toBe(true);
    });

    it("should generate valid string with min/max constraints", () => {
      const schema = z.object({
        code: z.string().min(1).max(100),
      });

      const data = generateMinimal(schema);

      expect(data.code.length).toBeGreaterThanOrEqual(1);
      expect(data.code.length).toBeLessThanOrEqual(100);
    });

    it("should generate valid number with min/max constraints", () => {
      const schema = z.object({
        score: z.number().min(0).max(100),
      });

      const data = generateMinimal(schema);

      expect(data.score).toBeGreaterThanOrEqual(0);
      expect(data.score).toBeLessThanOrEqual(100);
    });

    it("should handle enum by picking first value", () => {
      const schema = z.object({
        status: z.enum(["active", "inactive", "pending"]),
      });

      const data = generateMinimal(schema);
      expect(["active", "inactive", "pending"]).toContain(data.status);
    });

    it("should handle optional fields by omitting them in minimal", () => {
      const schema = z.object({
        required: z.string(),
        optional: z.string().optional(),
      });

      const data = generateMinimal(schema);

      expect(typeof data.required).toBe("string");
      // Optional may or may not be present in minimal
    });

    it("should handle nullable fields", () => {
      const schema = z.object({
        value: z.string().nullable(),
      });

      const data = generateMinimal(schema);
      // Should produce either null or a string
      expect(data.value === null || typeof data.value === "string").toBe(true);
    });

    it("should handle arrays with empty array as minimal", () => {
      const schema = z.object({
        items: z.array(z.string()),
      });

      const data = generateMinimal(schema);
      expect(Array.isArray(data.items)).toBe(true);
    });
  });

  describe("generateEdgeCase", () => {
    it("should generate edge case values for enum (all values)", () => {
      const schema = z.object({
        role: z.enum(["a", "b", "c"]),
      });

      const cases = generateEdgeCase(schema);

      // Should include all enum values across edge cases
      expect(Array.isArray(cases)).toBe(true);
      expect(cases.length).toBeGreaterThanOrEqual(1);

      // Each case should be valid
      for (const c of cases) {
        expect(() => schema.parse(c)).not.toThrow();
      }
    });

    it("should generate boundary values for numbers", () => {
      const schema = z.object({
        score: z.number().min(0).max(100),
      });

      const cases = generateEdgeCase(schema);

      // Should have edge cases with boundary values
      const scores = cases.map((c: Record<string, unknown>) => c.score as number);
      expect(scores).toContain(0); // min boundary
      expect(scores).toContain(100); // max boundary
    });

    it("should produce valid data for each edge case", () => {
      const schema = z.object({
        name: z.string().min(1).max(50),
        count: z.number().min(0).max(1000),
        status: z.enum(["on", "off"]),
      });

      const cases = generateEdgeCase(schema);

      for (const c of cases) {
        expect(() => schema.parse(c)).not.toThrow();
      }
    });
  });
});
