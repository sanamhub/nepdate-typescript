// The workflow parser fails on YAML that GitHub Actions would read differently or that hides a
// value, so the workflow tests never check a tree the runner does not see.

import { describe, expect, it } from "vitest";
import { parseWorkflow, triggers } from "./workflow-yaml.js";

describe("workflow YAML parser", () => {
  it("keeps on as a string key", () => {
    expect(triggers(parseWorkflow("on:\n  push:\njobs: {}\n"))).toEqual(["push"]);
  });

  it("rejects a duplicate key instead of keeping the last value", () => {
    expect(() =>
      parseWorkflow("permissions:\n  contents: write\npermissions:\n  contents: read\n"),
    ).toThrow(/unique/);
  });

  it("rejects a second document", () => {
    expect(() => parseWorkflow("on: push\n---\non: pull_request\n")).toThrow(
      /exactly one document/,
    );
  });

  it("rejects an unresolved tag instead of warning", () => {
    expect(() => parseWorkflow("on: !custom push\n")).toThrow(/not clean/);
  });

  it("keeps a merge key as a plain key", () => {
    const parsed = parseWorkflow("base: &base\n  a: 1\nother:\n  <<: *base\n");
    expect(parsed.other).toEqual({ "<<": { a: 1 } });
  });

  it("rejects an empty file", () => {
    expect(() => parseWorkflow("")).toThrow(/exactly one document/);
  });

  it("rejects a document that is not a mapping", () => {
    expect(() => parseWorkflow("- push\n")).toThrow(/mapping/);
  });
});
