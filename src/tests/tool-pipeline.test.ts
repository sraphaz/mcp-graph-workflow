import { describe, it, expect } from "vitest";
import { ToolPipeline, type ToolHandler } from "../core/pipeline/tool-pipeline.js";

describe("ToolPipeline", () => {
  function createMockHandlers(): Map<string, ToolHandler> {
    const handlers = new Map<string, ToolHandler>();

    handlers.set("search", async (args) => ({
      results: [`found: ${(args as Record<string, unknown>).query ?? "default"}`],
    }));

    handlers.set("analyze", async (args) => ({
      analysis: `analyzed ${JSON.stringify(args)}`,
    }));

    handlers.set("fail_tool", async () => {
      throw new Error("Tool exploded");
    });

    handlers.set("echo", async (args) => args);

    return handlers;
  }

  it("should execute a single-step pipeline", async () => {
    const handlers = createMockHandlers();
    const pipeline = new ToolPipeline(handlers);

    const result = await pipeline.execute([
      { tool: "search", args: { query: "auth" } },
    ]);

    expect(result.ok).toBe(true);
    expect(result.stepsTotal).toBe(1);
    expect(result.stepsCompleted).toBe(1);
    expect(result.steps[0].status).toBe("success");
  });

  it("should execute multi-step pipeline sequentially", async () => {
    const handlers = createMockHandlers();
    const pipeline = new ToolPipeline(handlers);

    const result = await pipeline.execute([
      { tool: "search", args: { query: "auth" } },
      { tool: "analyze", args: { data: "test" } },
    ]);

    expect(result.ok).toBe(true);
    expect(result.stepsTotal).toBe(2);
    expect(result.stepsCompleted).toBe(2);
  });

  it("should return partial results on mid-pipeline failure", async () => {
    const handlers = createMockHandlers();
    const pipeline = new ToolPipeline(handlers);

    const result = await pipeline.execute([
      { tool: "search", args: { query: "auth" } },
      { tool: "fail_tool", args: {} },
      { tool: "analyze", args: {} },
    ]);

    expect(result.ok).toBe(false);
    expect(result.stepsCompleted).toBe(1);
    expect(result.stepsFailed).toBe(1);
    expect(result.stepsSkipped).toBe(1);
    expect(result.steps[0].status).toBe("success");
    expect(result.steps[1].status).toBe("error");
    expect(result.steps[1].error).toContain("exploded");
    expect(result.steps[2].status).toBe("skipped");
  });

  it("should reject unknown tools", async () => {
    const handlers = createMockHandlers();
    const pipeline = new ToolPipeline(handlers);

    const result = await pipeline.execute([
      { tool: "nonexistent_tool", args: {} },
    ]);

    expect(result.ok).toBe(false);
    expect(result.steps[0].status).toBe("error");
    expect(result.steps[0].error).toContain("not found");
  });

  it("should pass previous step result to next step via extractField", async () => {
    const handlers = createMockHandlers();
    const pipeline = new ToolPipeline(handlers);

    const result = await pipeline.execute([
      { tool: "search", args: { query: "auth" }, extractField: "results" },
      { tool: "echo", args: {} },
    ]);

    expect(result.ok).toBe(true);
    // The echo tool receives the extracted field as _previousResult
    const echoResult = result.steps[1].result as Record<string, unknown>;
    expect(echoResult._previousResult).toBeDefined();
  });

  it("should track duration per step", async () => {
    const handlers = createMockHandlers();
    const pipeline = new ToolPipeline(handlers);

    const result = await pipeline.execute([
      { tool: "search", args: { query: "test" } },
    ]);

    expect(result.steps[0].durationMs).toBeGreaterThanOrEqual(0);
    expect(result.totalDurationMs).toBeGreaterThanOrEqual(0);
  });

  it("should handle empty pipeline", async () => {
    const handlers = createMockHandlers();
    const pipeline = new ToolPipeline(handlers);

    const result = await pipeline.execute([]);

    expect(result.ok).toBe(true);
    expect(result.stepsTotal).toBe(0);
    expect(result.steps).toEqual([]);
  });
});
