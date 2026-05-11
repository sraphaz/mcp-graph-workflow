/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-credential-pool — Task 1.3: SecretStore interface + EnvVarSecretStore
 *
 * AC1: GIVEN SecretStore mock WHEN resolve("FOO") THEN retorna valor configurado
 * AC2: GIVEN EnvVarSecretStore + process.env.OPENAI_KEY="sk-test" WHEN resolve THEN "sk-test"
 * AC3: GIVEN secretRef inexistente WHEN resolve THEN throw com ref name (sem leak do valor)
 */

import { describe, it, expect, afterEach } from "vitest";
import {
  EnvVarSecretStore,
  type SecretStore,
} from "../core/llm/secret-store.js";

// ── AC1: interface contract via mock ─────────────────────────────────────

describe("SecretStore interface — AC1: mock implementation", () => {
  it("AC1: a mock implementation of SecretStore satisfies the interface contract", async () => {
    const store: SecretStore = {
      async resolve(ref: string) {
        if (ref === "FOO") return "bar";
        throw new Error(`not found: ${ref}`);
      },
      async rotate(_ref: string, _newValue: string) { /* no-op */ },
    };

    await expect(store.resolve("FOO")).resolves.toBe("bar");
  });

  it("AC1: resolve returns whatever the implementation configures", async () => {
    const values = new Map([["DB_URL", "postgres://localhost"], ["API_KEY", "secret-123"]]);
    const store: SecretStore = {
      async resolve(ref: string) {
        const v = values.get(ref);
        if (!v) throw new Error(ref);
        return v;
      },
      async rotate(ref: string, newValue: string) { values.set(ref, newValue); },
    };

    expect(await store.resolve("DB_URL")).toBe("postgres://localhost");
    await store.rotate("DB_URL", "postgres://prod");
    expect(await store.resolve("DB_URL")).toBe("postgres://prod");
  });
});

// ── AC2: EnvVarSecretStore reads process.env ──────────────────────────────

describe("EnvVarSecretStore — AC2: reads process.env", () => {
  afterEach(() => {
    delete process.env["OPENAI_KEY"];
    delete process.env["_TEST_SECRET_A"];
  });

  it("AC2: resolve returns the env var value when set", async () => {
    process.env["OPENAI_KEY"] = "sk-test";
    const store = new EnvVarSecretStore();
    await expect(store.resolve("OPENAI_KEY")).resolves.toBe("sk-test");
  });

  it("AC2: rotate updates process.env in-place", async () => {
    process.env["_TEST_SECRET_A"] = "old";
    const store = new EnvVarSecretStore();
    await store.rotate("_TEST_SECRET_A", "new");
    expect(process.env["_TEST_SECRET_A"]).toBe("new");
  });
});

// ── AC3: missing secretRef throws clearly without leaking ─────────────────

describe("EnvVarSecretStore — AC3: missing ref throws (no leak)", () => {
  afterEach(() => {
    delete process.env["MISSING_SECRET"];
  });

  it("AC3: throws when secretRef is not in env", async () => {
    delete process.env["MISSING_SECRET"];
    const store = new EnvVarSecretStore();
    await expect(store.resolve("MISSING_SECRET")).rejects.toThrow();
  });

  it("AC3: error message contains the ref name", async () => {
    const store = new EnvVarSecretStore();
    await expect(store.resolve("MISSING_SECRET")).rejects.toThrow("MISSING_SECRET");
  });

  it("AC3: error message does NOT contain a secret value (no leak)", async () => {
    process.env["OPENAI_KEY"] = "sk-this-must-not-appear";
    const store = new EnvVarSecretStore();
    // A different ref is missing — the error should not mention the other secret's value
    let thrownMessage = "";
    try {
      await store.resolve("NONEXISTENT_REF");
    } catch (err) {
      thrownMessage = err instanceof Error ? err.message : String(err);
    }
    expect(thrownMessage).not.toContain("sk-this-must-not-appear");
    delete process.env["OPENAI_KEY"];
  });
});
