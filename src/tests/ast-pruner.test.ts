import { describe, it, expect } from "vitest";
import { pruneFile } from "../core/context/ast-pruner.js";

describe("AstPruner — Shannon Information Theory + Liskov/Parnas", () => {
  const sampleFile = `import { z } from 'zod/v4';
import { logger } from '../utils/logger.js';

export interface UserInput {
  name: string;
  email: string;
}

export function createUser(input: UserInput): string {
  const id = generateId();
  logger.info('creating user', { name: input.name });
  const validated = validateEmail(input.email);
  if (!validated) {
    throw new Error('Invalid email');
  }
  return id;
}

export function deleteUser(id: string): boolean {
  logger.info('deleting user', { id });
  const found = findUser(id);
  if (!found) {
    return false;
  }
  removeFromDb(id);
  return true;
}

function generateId(): string {
  return Math.random().toString(36).slice(2);
}

function validateEmail(email: string): boolean {
  return email.includes('@');
}

function findUser(id: string): boolean {
  return id.length > 0;
}

function removeFromDb(id: string): void {
  logger.info('removed', { id });
}

export class UserService {
  private db: Map<string, string>;

  constructor() {
    this.db = new Map();
  }

  getAll(): string[] {
    return Array.from(this.db.values());
  }

  add(name: string): void {
    this.db.set(name, name);
  }
}

export type UserRole = 'admin' | 'user' | 'guest';
`;

  it("should prune non-relevant function bodies while keeping signatures", () => {
    const result = pruneFile({
      content: sampleFile,
      relevantSymbols: ["createUser"],
      preserveExports: false,
    });

    // createUser body should be preserved
    expect(result.content).toContain("const id = generateId()");
    expect(result.content).toContain("logger.info('creating user'");

    // deleteUser body should be pruned
    expect(result.content).not.toContain("logger.info('deleting user'");
    expect(result.content).toMatch(/\{ \/\* \.\.\.\d+ lines \*\/ \}/);

    // Signatures should all be present
    expect(result.content).toContain("export function createUser");
    expect(result.content).toContain("export function deleteUser");
  });

  it("should replace pruned body with line count comment", () => {
    const result = pruneFile({
      content: sampleFile,
      relevantSymbols: ["createUser"],
      preserveExports: false,
    });

    // deleteUser has ~7 lines of body — should show approximate count
    const prunedMatch = result.content.match(/deleteUser[^{]*\{ \/\* \.\.\.(\d+) lines \*\/ \}/);
    expect(prunedMatch).not.toBeNull();
    const lineCount = parseInt(prunedMatch![1], 10);
    expect(lineCount).toBeGreaterThanOrEqual(3);
  });

  it("should preserve export interfaces intact when preserveExports=true", () => {
    const result = pruneFile({
      content: sampleFile,
      relevantSymbols: [],
      preserveExports: true,
    });

    // Exported interface should be fully preserved
    expect(result.content).toContain("export interface UserInput");
    expect(result.content).toContain("name: string");
    expect(result.content).toContain("email: string");

    // Exported type should be preserved
    expect(result.content).toContain("export type UserRole");
  });

  it("should return original content as fallback when no symbols can be parsed", () => {
    const result = pruneFile({
      content: "this is not valid typescript at all!!!",
      relevantSymbols: ["foo"],
      preserveExports: false,
    });

    // Fallback: return as-is
    expect(result.content).toBe("this is not valid typescript at all!!!");
    expect(result.reductionPercent).toBe(0);
  });

  it("should report reduction metrics", () => {
    const result = pruneFile({
      content: sampleFile,
      relevantSymbols: ["createUser"],
      preserveExports: false,
    });

    expect(result.originalLines).toBeGreaterThan(0);
    expect(result.prunedLines).toBeGreaterThan(0);
    expect(result.reductionPercent).toBeGreaterThan(0);
    expect(result.preservedSymbols.length).toBeGreaterThanOrEqual(1);
    expect(result.preservedSymbols).toContain("createUser");
    expect(result.truncatedSymbols.length).toBeGreaterThanOrEqual(1);
  });

  it("should preserve all exports when preserveExports=true even with no relevant symbols", () => {
    const result = pruneFile({
      content: sampleFile,
      relevantSymbols: [],
      preserveExports: true,
    });

    // All exported functions should have bodies preserved
    expect(result.content).toContain("const id = generateId()"); // createUser body
    expect(result.content).toContain("removeFromDb(id)"); // deleteUser body

    // Private functions should be pruned
    expect(result.content).not.toContain("return Math.random()"); // generateId body
    expect(result.content).not.toContain("return email.includes"); // validateEmail body
  });

  it("should handle empty file gracefully", () => {
    const result = pruneFile({
      content: "",
      relevantSymbols: ["foo"],
      preserveExports: false,
    });

    expect(result.content).toBe("");
    expect(result.originalLines).toBe(0);
    expect(result.reductionPercent).toBe(0);
  });
});
