// The release workflow keeps its permissions, pins, shell inputs and job order in the right places.
// The checks run on the parsed YAML tree, so a comment, an indentation change or a step moved to
// another job cannot satisfy a rule by accident. This is the TypeScript counterpart of the Python
// port's test_release_workflow.py (T7-02), tightened in T11.

import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";
import { describe, expect, it } from "vitest";
import { expressionProblems, pinProblems } from "./workflow-rules.js";
import {
  envValue,
  isMapping,
  type Job,
  job,
  jobPermissions,
  jobRun,
  jobsOf,
  needsOf,
  parseWorkflow,
  permissionMap,
  type Step,
  step,
  stepIndex,
  stepRun,
  stepsOf,
  stringValues,
  trigger,
  triggers,
  type Workflow,
  withValue,
  workflowPermissions,
} from "./workflow-yaml.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const WORKFLOW = join(ROOT, ".github", "workflows", "release.yml");
const TEXT = readFileSync(WORKFLOW, "utf8");
const SHIPPED = parseWorkflow(TEXT);
const EXPRESSION = "${{";

function expression(name: string): string {
  return `${EXPRESSION} ${name} }}`;
}

function sameSet(actual: readonly string[], expected: readonly string[]): boolean {
  if (actual.length !== expected.length) return false;
  const left = [...actual].sort();
  const right = [...expected].sort();
  return left.every((value, index) => value === right[index]);
}

function stepProblems(
  workflow: Workflow,
  jobName: string,
  stepName: string,
  message: string,
  predicate: (value: Step) => boolean,
): string[] {
  const value = step(workflow, jobName, stepName);
  return value !== undefined && predicate(value) ? [] : [message];
}

function runHas(value: Step, ...needles: string[]): boolean {
  const run = stepRun(value);
  return needles.every((needle) => run.includes(needle));
}

function orderProblems(
  workflow: Workflow,
  jobName: string,
  first: string,
  second: string,
  message: string,
): string[] {
  const firstAt = stepIndex(workflow, jobName, first);
  const secondAt = stepIndex(workflow, jobName, second);
  return firstAt >= 0 && secondAt >= 0 && firstAt > secondAt ? [message] : [];
}

function needsProblems(
  workflow: Workflow,
  jobName: string,
  expected: readonly string[],
  message: string,
): string[] {
  return sameSet(needsOf(workflow, jobName), expected) ? [] : [message];
}

function triggerProblems(workflow: Workflow): string[] {
  const found: string[] = [];
  if (!sameSet(triggers(workflow), ["push", "workflow_dispatch"])) {
    found.push("release triggers must be exactly push and workflow_dispatch");
  }
  const push = trigger(workflow, "push");
  if (!isDeepStrictEqual(push, { tags: ["v*"] })) {
    found.push("push trigger must be exactly the v* tag");
  }
  const dispatch = trigger(workflow, "workflow_dispatch");
  const inputs = isMapping(dispatch) ? dispatch.inputs : undefined;
  const dryRun = isMapping(inputs) ? inputs["dry-run"] : undefined;
  if (!isMapping(dryRun) || dryRun.type !== "boolean" || dryRun.default !== true) {
    found.push("workflow_dispatch must define a boolean dry-run input that defaults to true");
  }
  return found;
}

function topPermissionProblems(workflow: Workflow): string[] {
  const actual = workflowPermissions(workflow);
  return isDeepStrictEqual(actual, { contents: "read" })
    ? []
    : ["default permissions must be exactly contents: read"];
}

function jobPermissionProblems(workflow: Workflow): string[] {
  const found: string[] = [];

  const publish = jobPermissions(workflow, "publish");
  if (publish === undefined || publish.contents !== "read" || publish["id-token"] !== "write") {
    found.push("publish needs contents: read and id-token: write");
  }
  if (publish?.contents === "write") found.push("publish must not have contents: write");
  if (
    publish !== undefined &&
    publish.contents === "read" &&
    publish["id-token"] === "write" &&
    !isDeepStrictEqual(publish, { contents: "read", "id-token": "write" })
  ) {
    found.push("publish permissions must be exactly contents: read and id-token: write");
  }

  const verify = jobPermissions(workflow, "verify");
  if (verify === undefined || verify.contents !== "read") {
    found.push("verify must set contents: read");
  }
  if (verify?.["id-token"] !== undefined) found.push("verify must not request id-token");
  else if (verify !== undefined && !isDeepStrictEqual(verify, { contents: "read" })) {
    found.push("verify permissions must be exactly contents: read");
  }

  const release = jobPermissions(workflow, "github-release");
  if (release === undefined || release.contents !== "write") {
    found.push("github-release must set contents: write");
  }
  if (release?.["id-token"] !== undefined) found.push("github-release must not request id-token");
  else if (release !== undefined && !isDeepStrictEqual(release, { contents: "write" })) {
    found.push("github-release permissions must be exactly contents: write");
  }

  if (!isDeepStrictEqual(jobPermissions(workflow, "smoke"), { contents: "read" })) {
    found.push("smoke must set only contents: read");
  }
  if (!isDeepStrictEqual(jobPermissions(workflow, "mutation"), { contents: "read" })) {
    found.push("mutation must set only contents: read");
  }

  for (const [name, value] of Object.entries(jobsOf(workflow))) {
    if (["smoke", "mutation", "publish", "verify", "github-release"].includes(name)) continue;
    const actual = permissionMap(isMapping(value) ? value.permissions : undefined);
    if (actual !== undefined && !isDeepStrictEqual(actual, { contents: "read" })) {
      found.push(`job ${name} must have only contents: read`);
    }
  }
  return found;
}

function environmentProblems(workflow: Workflow): string[] {
  const found: string[] = [];
  if (job(workflow, "publish")?.environment !== "production") {
    found.push("publish must use the production environment");
  }
  for (const [name, value] of Object.entries(jobsOf(workflow))) {
    if (name === "publish") continue;
    if (isMapping(value) && value.environment !== undefined) {
      found.push(`${name} must not use an environment`);
    }
  }
  return found;
}

const JOBS = ["pack", "smoke", "mutation", "publish", "verify", "github-release"];

function jobProblems(workflow: Workflow): string[] {
  const found: string[] = [];
  for (const name of ["pack", "smoke", "mutation", "publish"]) {
    if (job(workflow, name) === undefined) {
      found.push(`release workflow must have a ${name} job`);
    }
  }
  for (const name of Object.keys(jobsOf(workflow))) {
    if (!JOBS.includes(name)) found.push(`release workflow has an unexpected job: ${name}`);
  }
  return found;
}

function packProblems(workflow: Workflow): string[] {
  const found: string[] = [];
  found.push(
    ...stepProblems(workflow, "pack", "Data status", "pack must run the data status", (value) =>
      runHas(value, "scripts/data-status.ts"),
    ),
  );
  found.push(
    ...orderProblems(
      workflow,
      "pack",
      "Check the manifests and the changelog",
      "Data status",
      "pack must run the data status after release-check",
    ),
  );
  found.push(
    ...stepProblems(
      workflow,
      "pack",
      "Check the tarball contents and write SHA256SUMS",
      "pack must check the tarball contents and write SHA256SUMS",
      (value) => runHas(value, "scripts/tarball-check.ts", "--sums"),
    ),
  );
  found.push(
    ...stepProblems(
      workflow,
      "pack",
      "Upload the tarballs",
      "pack must upload the tarballs and SHA256SUMS",
      (value) =>
        typeof value.uses === "string" &&
        value.uses.startsWith("actions/upload-artifact@") &&
        withValue(value, "name") === "release-tarballs" &&
        withValue(value, "path") === "release-tarballs/",
    ),
  );
  found.push(
    ...orderProblems(
      workflow,
      "pack",
      "Check the tarball contents and write SHA256SUMS",
      "Upload the tarballs",
      "pack must check the tarball contents before uploading",
    ),
  );
  found.push(
    ...stepProblems(
      workflow,
      "pack",
      "Pack both packages",
      "pack must pack both packages",
      (value) => runHas(value, "npm pack -w nepdate", "npm pack -w nepdate-patro"),
    ),
  );
  found.push(
    ...stepProblems(
      workflow,
      "pack",
      "Check both tarballs",
      "pack must check both tarballs with publint and attw",
      (value) => runHas(value, "npx publint", "npx attw"),
    ),
  );
  return found;
}

function smokeProblems(workflow: Workflow): string[] {
  const value = job(workflow, "smoke");
  if (value === undefined) return ["release workflow must have a smoke job"];
  const found: string[] = [];
  found.push(...needsProblems(workflow, "smoke", ["pack"], "smoke must need pack"));
  if (stringValues(value).some((text) => text.includes("secrets."))) {
    found.push("smoke must not read a secret");
  }
  found.push(
    ...stepProblems(
      workflow,
      "smoke",
      "Download the tarballs",
      "smoke must download the packed tarballs",
      (item) =>
        typeof item.uses === "string" &&
        item.uses.startsWith("actions/download-artifact@") &&
        withValue(item, "name") === "release-tarballs",
    ),
  );
  found.push(
    ...stepProblems(
      workflow,
      "smoke",
      "Core only, from the README",
      "smoke must run both README examples",
      (item) => runHas(item, "--mode core", "scripts/smoke.ts"),
    ),
  );
  found.push(
    ...stepProblems(
      workflow,
      "smoke",
      "Core plus patro, from the README",
      "smoke must run both README examples",
      (item) => runHas(item, "--mode patro", "scripts/smoke.ts"),
    ),
  );
  found.push(
    ...stepProblems(
      workflow,
      "smoke",
      "Core plus patro, from the README",
      "smoke must install the patro tarball",
      (item) => runHas(item, "nepdate-patro"),
    ),
  );
  found.push(
    ...orderProblems(
      workflow,
      "smoke",
      "Download the tarballs",
      "Core only, from the README",
      "smoke must download the tarballs before the examples",
    ),
  );
  found.push(
    ...orderProblems(
      workflow,
      "smoke",
      "Core only, from the README",
      "Core plus patro, from the README",
      "smoke must run the core example before the patro example",
    ),
  );
  return found;
}

function mutationProblems(workflow: Workflow): string[] {
  const value = job(workflow, "mutation");
  if (value === undefined) return ["release workflow must have a mutation job"];
  const found: string[] = [];
  found.push(...needsProblems(workflow, "mutation", ["pack"], "mutation must need pack"));
  if (stringValues(value).some((text) => text.includes("secrets."))) {
    found.push("mutation must not read a secret");
  }
  found.push(
    ...stepProblems(
      workflow,
      "mutation",
      "Run mutation testing",
      "mutation must run the mutation suite",
      (item) => runHas(item, "npm run mutation:force"),
    ),
  );
  found.push(
    ...stepProblems(
      workflow,
      "mutation",
      "Check the floor and the equivalent list",
      "mutation must check the floor and equivalents",
      (item) => runHas(item, "npm run mutation:check"),
    ),
  );
  found.push(
    ...orderProblems(
      workflow,
      "mutation",
      "Run mutation testing",
      "Check the floor and the equivalent list",
      "mutation must run the suite before the floor check",
    ),
  );
  return found;
}

function publishProblems(workflow: Workflow): string[] {
  const value = job(workflow, "publish");
  if (value === undefined) return [];
  const found: string[] = [];
  found.push(
    ...needsProblems(
      workflow,
      "publish",
      ["pack", "smoke", "mutation"],
      "publish must need pack, smoke and mutation",
    ),
  );
  const condition = typeof value.if === "string" ? value.if : "";
  if (!condition.includes("github.event_name == 'push'") || !condition.includes("refs/tags/v")) {
    found.push("publish must run only on a tag push");
  }
  found.push(
    ...stepProblems(
      workflow,
      "publish",
      "Check out",
      "publish checkout must fetch full history",
      (item) => withValue(item, "fetch-depth") === "0",
    ),
  );
  found.push(
    ...stepProblems(
      workflow,
      "publish",
      "Check the tag commit is on origin/main",
      "publish must fetch origin/main",
      (item) => runHas(item, "git fetch --no-tags origin main"),
    ),
  );
  found.push(
    ...stepProblems(
      workflow,
      "publish",
      "Check the tag commit is on origin/main",
      "publish must verify the tag is on origin/main",
      (item) => runHas(item, "git merge-base --is-ancestor"),
    ),
  );
  found.push(
    ...stepProblems(
      workflow,
      "publish",
      "Check the tag commit is on origin/main",
      "publish must pass github.sha through env",
      (item) => envValue(item, "COMMIT_SHA") === expression("github.sha"),
    ),
  );
  found.push(
    ...orderProblems(
      workflow,
      "publish",
      "Check the tag commit is on origin/main",
      "Publish nepdate",
      "publish must check main before publishing",
    ),
  );
  found.push(
    ...stepProblems(
      workflow,
      "publish",
      "Download the tarballs",
      "publish must download the checked tarballs",
      (item) =>
        typeof item.uses === "string" &&
        item.uses.startsWith("actions/download-artifact@") &&
        withValue(item, "name") === "release-tarballs" &&
        withValue(item, "path") === "release-tarballs",
    ),
  );
  found.push(
    ...stepProblems(
      workflow,
      "publish",
      "Read and validate the version",
      "publish must read and validate the version",
      (item) => runHas(item, "scripts/release-version.ts") && item.id === "version",
    ),
  );
  found.push(
    ...stepProblems(
      workflow,
      "publish",
      "Check the manifests and the changelog",
      "publish must check the manifests and the changelog",
      (item) => runHas(item, "scripts/release-check.ts"),
    ),
  );
  found.push(
    ...stepProblems(
      workflow,
      "publish",
      "Verify the checked tarballs",
      "publish must verify the tarball checksums before publishing",
      (item) => runHas(item, "sha256sum -c SHA256SUMS"),
    ),
  );
  found.push(
    ...orderProblems(
      workflow,
      "publish",
      "Verify the checked tarballs",
      "Publish nepdate",
      "publish must verify the tarball checksums before publishing",
    ),
  );

  for (const [name, tarball] of [
    ["Publish nepdate", "nepdate-$VERSION.tgz"],
    ["Publish nepdate-patro", "nepdate-patro-$VERSION.tgz"],
  ] as const) {
    found.push(
      ...stepProblems(workflow, "publish", name, "publish must publish both packages", (item) =>
        runHas(
          item,
          `npm publish "release-tarballs/${tarball}"`,
          "--provenance",
          "--access public",
        ),
      ),
    );
    found.push(
      ...stepProblems(
        workflow,
        "publish",
        name,
        "both publish steps need NODE_AUTH_TOKEN",
        (item) => envValue(item, "NODE_AUTH_TOKEN") === expression("secrets.NPM_TOKEN"),
      ),
    );
    found.push(
      ...stepProblems(
        workflow,
        "publish",
        name,
        "both publish steps must unset an empty NODE_AUTH_TOKEN",
        (item) => runHas(item, "unset NODE_AUTH_TOKEN"),
      ),
    );
    found.push(
      ...stepProblems(
        workflow,
        "publish",
        name,
        "both publish steps must publish under the version's dist-tag",
        (item) =>
          runHas(item, '--tag "$DIST_TAG"') &&
          envValue(item, "DIST_TAG") === expression("steps.version.outputs.dist-tag"),
      ),
    );
  }
  // A publish without --tag moves latest, so a pre-release would become the default install.
  for (const line of jobRun(workflow, "publish").split("\n")) {
    if (line.includes("npm publish") && !line.includes('--tag "$DIST_TAG"')) {
      found.push('every npm publish must pass --tag "$DIST_TAG"');
    }
  }

  if (jobRun(workflow, "publish").includes("npm pack")) {
    found.push("publish must not rebuild the tarballs");
  }
  if (jobRun(workflow, "publish").includes("gh release")) {
    found.push("publish must not create the GitHub release");
  }
  return found;
}

export function verifyProblems(workflow: Workflow): string[] {
  const value = job(workflow, "verify");
  if (value === undefined) return ["release workflow must have a verify job"];
  const found: string[] = [];
  found.push(...needsProblems(workflow, "verify", ["publish"], "verify must need publish"));
  if (value.uses !== "./.github/workflows/verify-published.yml") {
    found.push("verify must call ./.github/workflows/verify-published.yml");
  }
  const withMap = isMapping(value.with) ? value.with : undefined;
  if (withMap?.version !== expression("needs.publish.outputs.version")) {
    found.push("verify must pass the published version");
  }
  const condition = typeof value.if === "string" ? value.if : "";
  if (!condition.includes("github.event_name == 'push'") || !condition.includes("refs/tags/v")) {
    found.push("verify must run only on a tag push");
  }
  if (
    value.secrets !== undefined ||
    stringValues(value).some((text) => text.includes("secrets."))
  ) {
    found.push("verify must not read a secret");
  }
  return found;
}

export function githubReleaseProblems(workflow: Workflow): string[] {
  const value = job(workflow, "github-release");
  if (value === undefined) return ["release workflow must have a github-release job"];
  const found: string[] = [];
  found.push(
    ...needsProblems(
      workflow,
      "github-release",
      ["publish", "verify"],
      "github-release must need verify",
    ),
  );
  if (jobRun(workflow, "github-release").includes("npm publish")) {
    found.push("github-release must not publish to npm");
  }
  found.push(
    ...stepProblems(
      workflow,
      "github-release",
      "Verify the checked tarballs",
      "github-release must verify the tarball checksums first",
      (item) => runHas(item, "sha256sum -c SHA256SUMS"),
    ),
  );
  found.push(
    ...stepProblems(
      workflow,
      "github-release",
      "Create the GitHub release",
      "github-release must create the GitHub release",
      (item) =>
        runHas(item, "gh release create") &&
        envValue(item, "VERSION") === expression("needs.publish.outputs.version"),
    ),
  );
  found.push(
    ...stepProblems(
      workflow,
      "github-release",
      "Create the GitHub release",
      "github-release must write the notes from the changelog and mark a pre-release",
      (item) => runHas(item, "scripts/release-notes.ts", "--prerelease", "*-*"),
    ),
  );
  found.push(
    ...orderProblems(
      workflow,
      "github-release",
      "Verify the checked tarballs",
      "Create the GitHub release",
      "github-release must verify the tarball checksums first",
    ),
  );
  return found;
}

export function problems(workflow: Workflow): string[] {
  return [
    ...triggerProblems(workflow),
    ...pinProblems(workflow),
    ...expressionProblems(workflow),
    ...topPermissionProblems(workflow),
    ...jobPermissionProblems(workflow),
    ...environmentProblems(workflow),
    ...jobProblems(workflow),
    ...packProblems(workflow),
    ...smokeProblems(workflow),
    ...mutationProblems(workflow),
    ...publishProblems(workflow),
    ...verifyProblems(workflow),
    ...githubReleaseProblems(workflow),
  ];
}

function requireJob(workflow: Workflow, name: string): Job {
  const value = job(workflow, name);
  if (value === undefined) throw new Error(`release workflow has no ${name} job`);
  return value;
}

function rawSteps(value: Job): unknown[] {
  if (!Array.isArray(value.steps)) throw new Error("job has no steps");
  return value.steps;
}

function rawStepIndex(steps: unknown[], name: string): number {
  const index = steps.findIndex((value) => isMapping(value) && value.name === name);
  expect(index, `missing ${name} step`).toBeGreaterThanOrEqual(0);
  return index;
}

function replaceOnce(text: string, from: string, to: string): string {
  expect(text.split(from).length - 1, `expected one ${from}`).toBe(1);
  return text.replace(from, to);
}

describe("release workflow", () => {
  it("satisfies every rule", () => {
    expect(problems(SHIPPED)).toEqual([]);
  });

  it("reports a missing main check", () => {
    const workflow = structuredClone(SHIPPED);
    const steps = rawSteps(requireJob(workflow, "publish"));
    steps.splice(rawStepIndex(steps, "Check the tag commit is on origin/main"), 1);
    expect(problems(workflow)).toContain("publish must verify the tag is on origin/main");
  });

  it("does not accept a rule that is only met inside a comment", () => {
    const commented = replaceOnce(
      TEXT,
      "          fetch-depth: 0\n",
      "          # fetch-depth: 0\n",
    );
    expect(problems(parseWorkflow(commented))).toContain(
      "publish checkout must fetch full history",
    );
  });

  it("reports a missing mutation job", () => {
    const workflow = structuredClone(SHIPPED);
    delete jobsOf(workflow).mutation;
    expect(problems(workflow)).toContain("release workflow must have a mutation job");
  });

  it("reports every other rule in one negative example", () => {
    const bad = `on:
  workflow_dispatch:
permissions:
  contents: write
jobs:
  pack:
    outputs:
      version: ${EXPRESSION} steps.version.outputs.version }}
  smoke:
    needs: build
    environment: production
    env:
      TOKEN: ${EXPRESSION} secrets.NPM_TOKEN }}
  mutation:
    environment: production
    env:
      TOKEN: ${EXPRESSION} secrets.NPM_TOKEN }}
    steps:
      - run: npm ci
  publish:
    if: github.event_name == 'workflow_dispatch'
    permissions:
      contents: write
      id-token: write
    steps:
      - uses: actions/checkout@v7
      - run: echo "${EXPRESSION} inputs.version }}"
      - name: Publish nepdate
        run: npm publish
      - name: Check the tag commit is on origin/main
        run: git fetch --no-tags origin main && git merge-base --is-ancestor "$COMMIT_SHA" origin/main
`;
    const found = problems(parseWorkflow(bad));
    for (const message of [
      "default permissions",
      "not pinned",
      "expression inside run",
      "tag push",
      "check main before publishing",
      "fetch full history",
      "pass github.sha",
      "NODE_AUTH_TOKEN",
      "unset an empty",
      "need pack, smoke and mutation",
      "mutation must need pack",
      "mutation must not use an environment",
      "mutation must not read a secret",
      "run the mutation suite",
      "check the floor and equivalents",
      "smoke must need pack",
      "smoke must not use an environment",
      "smoke must not read a secret",
      "download the packed tarballs",
      "both README examples",
      "install the patro tarball",
      "check the tarball contents",
      "upload the tarballs",
      "verify job",
      "github-release job",
    ]) {
      expect(
        found.some((candidate) => candidate.includes(message)),
        message,
      ).toBe(true);
    }
  });

  it("reports a missing tarball check", () => {
    const workflow = structuredClone(SHIPPED);
    const steps = rawSteps(requireJob(workflow, "pack"));
    steps.splice(rawStepIndex(steps, "Check the tarball contents and write SHA256SUMS"), 1);
    expect(problems(workflow)).toContain(
      "pack must check the tarball contents and write SHA256SUMS",
    );
  });

  it("reports a publish job that rebuilds the tarballs", () => {
    const workflow = structuredClone(SHIPPED);
    const steps = rawSteps(requireJob(workflow, "publish"));
    steps.splice(rawStepIndex(steps, "Check the tag commit is on origin/main"), 0, {
      name: "Rebuild",
      run: "npm pack -w nepdate",
    });
    expect(problems(workflow)).toContain("publish must not rebuild the tarballs");
  });

  it("reports a missing verify job", () => {
    const workflow = structuredClone(SHIPPED);
    delete jobsOf(workflow).verify;
    expect(problems(workflow)).toContain("release workflow must have a verify job");
  });

  it("reports a publish step without the dist-tag", () => {
    const workflow = structuredClone(SHIPPED);
    const steps = rawSteps(requireJob(workflow, "publish"));
    const publish = steps[rawStepIndex(steps, "Publish nepdate-patro")] as Record<string, unknown>;
    publish.run = String(publish.run).replace(' --tag "$DIST_TAG"', "");
    const found = problems(workflow);
    expect(found).toContain("both publish steps must publish under the version's dist-tag");
    expect(found).toContain('every npm publish must pass --tag "$DIST_TAG"');
  });

  it("reports a GitHub release that does not mark a pre-release", () => {
    const workflow = structuredClone(SHIPPED);
    const steps = rawSteps(requireJob(workflow, "github-release"));
    const create = steps[rawStepIndex(steps, "Create the GitHub release")] as Record<
      string,
      unknown
    >;
    create.run = String(create.run).replace("prerelease=(--prerelease)", "prerelease=()");
    expect(problems(workflow)).toContain(
      "github-release must write the notes from the changelog and mark a pre-release",
    );
  });

  it("reports a verify job that runs its own steps instead of verify-published", () => {
    const workflow = structuredClone(SHIPPED);
    const verify = requireJob(workflow, "verify");
    delete verify.uses;
    verify.steps = [{ run: "npm install nepdate" }];
    expect(problems(workflow)).toContain(
      "verify must call ./.github/workflows/verify-published.yml",
    );
  });

  it("reports a verify job with the wrong needs", () => {
    const workflow = structuredClone(SHIPPED);
    requireJob(workflow, "verify").needs = "pack";
    expect(problems(workflow)).toContain("verify must need publish");
  });

  it("reports an id-token permission on verify", () => {
    const workflow = structuredClone(SHIPPED);
    requireJob(workflow, "verify").permissions = {
      contents: "read",
      "id-token": "write",
    };
    expect(problems(workflow)).toContain("verify must not request id-token");
  });

  it("reports a GitHub release that does not need verify", () => {
    const workflow = structuredClone(SHIPPED);
    requireJob(workflow, "github-release").needs = ["publish"];
    expect(problems(workflow)).toContain("github-release must need verify");
  });

  it("reports a GitHub release created in the publish job", () => {
    const workflow = structuredClone(SHIPPED);
    const steps = rawSteps(requireJob(workflow, "publish"));
    steps.splice(rawStepIndex(steps, "Publish nepdate"), 0, {
      name: "Release early",
      run: 'gh release create "v$VERSION"',
    });
    expect(problems(workflow)).toContain("publish must not create the GitHub release");
  });

  it("reports contents: write on publish", () => {
    const workflow = structuredClone(SHIPPED);
    requireJob(workflow, "publish").permissions = {
      contents: "write",
      "id-token": "write",
    };
    expect(problems(workflow)).toContain("publish must not have contents: write");
  });

  it("reports a GitHub release step moved into another job", () => {
    const workflow = structuredClone(SHIPPED);
    const releaseSteps = rawSteps(requireJob(workflow, "github-release"));
    const moved = releaseSteps.splice(rawStepIndex(releaseSteps, "Create the GitHub release"), 1);
    rawSteps(requireJob(workflow, "publish")).push(...moved);
    expect(
      stepsOf(workflow, "publish").some((item) => item.name === "Create the GitHub release"),
    ).toBe(true);
    expect(
      stepsOf(workflow, "github-release").some((item) => item.name === "Create the GitHub release"),
    ).toBe(false);
    expect(problems(workflow)).toContain("publish must not create the GitHub release");
    expect(problems(workflow)).toContain("github-release must create the GitHub release");
  });

  it("reports id-token granted at the workflow level", () => {
    const workflow = structuredClone(SHIPPED);
    workflow.permissions = { contents: "read", "id-token": "write" };
    requireJob(workflow, "publish").permissions = { contents: "read" };
    expect(workflow.permissions).toEqual({ contents: "read", "id-token": "write" });
    expect(requireJob(workflow, "publish").permissions).toEqual({ contents: "read" });
    expect(problems(workflow)).toContain("default permissions must be exactly contents: read");
    expect(problems(workflow)).toContain("publish needs contents: read and id-token: write");
  });

  it("reports a push trigger that also fires on a branch", () => {
    const workflow = structuredClone(SHIPPED);
    const push = trigger(workflow, "push");
    if (!isMapping(push)) throw new Error("push trigger must be a mapping");
    push.branches = ["main"];
    expect(problems(workflow)).toContain("push trigger must be exactly the v* tag");
  });

  it("reports a job outside the release path", () => {
    const workflow = structuredClone(SHIPPED);
    jobsOf(workflow).extra = { "runs-on": "ubuntu-latest", steps: [{ run: "true" }] };
    expect(problems(workflow)).toContain("release workflow has an unexpected job: extra");
  });

  it("reports the tarball check after the upload", () => {
    const workflow = structuredClone(SHIPPED);
    const steps = rawSteps(requireJob(workflow, "pack"));
    const check = steps.splice(
      rawStepIndex(steps, "Check the tarball contents and write SHA256SUMS"),
      1,
    );
    const uploadAt = rawStepIndex(steps, "Upload the tarballs");
    steps.splice(uploadAt + 1, 0, ...check);
    expect(
      stepIndex(workflow, "pack", "Check the tarball contents and write SHA256SUMS"),
    ).toBeGreaterThan(stepIndex(workflow, "pack", "Upload the tarballs"));
    expect(problems(workflow)).toContain("pack must check the tarball contents before uploading");
  });
});
