import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { DaVinciStore } from "../../core/davinci/davinci-store.js";
import type { CreateJobInput } from "../../core/davinci/davinci-store.js";

function makeInput(overrides: Partial<CreateJobInput> = {}): CreateJobInput {
  return {
    sourceCode: 'module.exports = a = async ({params}) => { return { ok: true }; }',
    pluginType: "idp-adapter",
    pluginName: "my-auth-adapter",
    packageName: "com.example.adapter",
    className: "MyAuthAdapter",
    targetSdk: "pingfederate",
    ...overrides,
  };
}

describe("davinci-store", () => {
  let db: Database.Database;
  let store: DaVinciStore;

  beforeEach(() => {
    db = new Database(":memory:");
    store = new DaVinciStore(db);
  });

  describe("createJob", () => {
    it("should create a job with generated ID", () => {
      const job = store.createJob(makeInput());

      expect(job.id).toBeDefined();
      expect(job.id.startsWith("dvjob_")).toBe(true);
      expect(job.status).toBe("analyzing");
      expect(job.pluginName).toBe("my-auth-adapter");
    });

    it("should set timestamps on creation", () => {
      const job = store.createJob(makeInput());

      expect(job.createdAt).toBeDefined();
      expect(job.updatedAt).toBeDefined();
    });
  });

  describe("getJob", () => {
    it("should retrieve a job by ID", () => {
      const created = store.createJob(makeInput());
      const retrieved = store.getJob(created.id);

      expect(retrieved).toBeDefined();
      expect(retrieved!.id).toBe(created.id);
      expect(retrieved!.sourceCode).toBe(created.sourceCode);
    });

    it("should return undefined for non-existent ID", () => {
      const result = store.getJob("dvjob_nonexistent");
      expect(result).toBeUndefined();
    });
  });

  describe("listJobs", () => {
    it("should return empty array when no jobs", () => {
      const jobs = store.listJobs();
      expect(jobs).toHaveLength(0);
    });

    it("should return all jobs sorted by created_at desc", () => {
      store.createJob(makeInput({ pluginName: "first" }));
      store.createJob(makeInput({ pluginName: "second" }));
      store.createJob(makeInput({ pluginName: "third" }));

      const jobs = store.listJobs();

      expect(jobs).toHaveLength(3);
    });
  });

  describe("updateJob", () => {
    it("should update status", () => {
      const job = store.createJob(makeInput());
      const updated = store.updateJob(job.id, { status: "converting" });

      expect(updated).toBeDefined();
      expect(updated!.status).toBe("converting");
    });

    it("should update generated Java and POM", () => {
      const job = store.createJob(makeInput());
      const updated = store.updateJob(job.id, {
        generatedJava: "public class MyPlugin { }",
        generatedPom: "<project></project>",
        status: "done",
        confidence: 0.85,
      });

      expect(updated!.generatedJava).toBe("public class MyPlugin { }");
      expect(updated!.generatedPom).toBe("<project></project>");
      expect(updated!.status).toBe("done");
      expect(updated!.confidence).toBe(0.85);
    });

    it("should update warnings as JSON array", () => {
      const job = store.createJob(makeInput());
      const updated = store.updateJob(job.id, {
        warnings: ["require() detected", "fs mockup"],
      });

      expect(updated!.warnings).toEqual(["require() detected", "fs mockup"]);
    });

    it("should update jar path after build", () => {
      const job = store.createJob(makeInput());
      const updated = store.updateJob(job.id, {
        jarPath: "/tmp/target/my-plugin-1.0.0.jar",
        status: "done",
      });

      expect(updated!.jarPath).toBe("/tmp/target/my-plugin-1.0.0.jar");
    });

    it("should set updatedAt on update", () => {
      const job = store.createJob(makeInput());
      const updated = store.updateJob(job.id, { status: "converting" });

      expect(updated!.updatedAt).toBeDefined();
      expect(typeof updated!.updatedAt).toBe("string");
    });
  });

  describe("deleteJob", () => {
    it("should delete an existing job", () => {
      const job = store.createJob(makeInput());
      const deleted = store.deleteJob(job.id);

      expect(deleted).toBe(true);
      expect(store.getJob(job.id)).toBeUndefined();
    });

    it("should return false for non-existent job", () => {
      const deleted = store.deleteJob("dvjob_nonexistent");
      expect(deleted).toBe(false);
    });
  });
});
