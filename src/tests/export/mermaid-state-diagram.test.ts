import { describe, it, expect } from "vitest";
import { graphToMermaid } from "../../core/graph/mermaid-export.js";
import { makeNode } from "../helpers/factories.js";

describe("buildStateDiagram", () => {
  it("should return fallback when no state_machine nodes exist", () => {
    const node = makeNode({ type: "task", title: "Some task" });
    const result = graphToMermaid([node], [], { format: "stateDiagram" });
    expect(result).toContain("stateDiagram-v2");
    expect(result).toContain("[*] --> Empty : No state machines found");
  });

  it("should render initial state and transitions from metadata", () => {
    const machine = makeNode({
      type: "state_machine",
      title: "Player State",
      metadata: {
        states: ["Idle", "Running", "Jumping"],
        initialState: "Idle",
        transitions: [
          { from: "Idle", to: "Running", trigger: "move" },
          { from: "Running", to: "Jumping", trigger: "jump" },
          { from: "Jumping", to: "Idle", trigger: "land" },
        ],
      },
    });

    const result = graphToMermaid([machine], [], { format: "stateDiagram" });

    expect(result).toContain("stateDiagram-v2");
    expect(result).toContain("[*] --> Idle");
    expect(result).toContain("Idle --> Running : move");
    expect(result).toContain("Running --> Jumping : jump");
    expect(result).toContain("Jumping --> Idle : land");
  });

  it("should use first state as initial when initialState is not set", () => {
    const machine = makeNode({
      type: "state_machine",
      title: "Simple FSM",
      metadata: {
        states: ["Off", "On"],
        transitions: [{ from: "Off", to: "On", trigger: "toggle" }],
      },
    });

    const result = graphToMermaid([machine], [], { format: "stateDiagram" });
    expect(result).toContain("[*] --> Off");
  });

  it("should sanitize state names with spaces and special chars", () => {
    const machine = makeNode({
      type: "state_machine",
      title: "Complex FSM",
      metadata: {
        states: ["Game Over", "In Menu"],
        initialState: "In Menu",
        transitions: [
          { from: "In Menu", to: "Game Over", trigger: "lose" },
        ],
      },
    });

    const result = graphToMermaid([machine], [], { format: "stateDiagram" });
    expect(result).toContain("[*] --> In_Menu");
    expect(result).toContain("In_Menu --> Game_Over : lose");
  });

  it("should skip state_machine nodes without metadata", () => {
    const machine = makeNode({
      type: "state_machine",
      title: "No metadata FSM",
    });

    const result = graphToMermaid([machine], [], { format: "stateDiagram" });
    expect(result).toContain("stateDiagram-v2");
    // Should just have the header, no transitions
    const lines = result.split("\n").filter((l) => l.includes("-->"));
    expect(lines).toHaveLength(0);
  });

  it("should render transitions without triggers (no label)", () => {
    const machine = makeNode({
      type: "state_machine",
      title: "Triggerless FSM",
      metadata: {
        states: ["A", "B"],
        initialState: "A",
        transitions: [{ from: "A", to: "B" }],
      },
    });

    const result = graphToMermaid([machine], [], { format: "stateDiagram" });
    expect(result).toContain("A --> B");
    expect(result).not.toContain("A --> B :");
  });
});
