// Tests for the tarball member and manifest rules (T10-03). The tar reader itself is exercised by
// the release pack job; these cases check the allow-list and the manifest with plain members.

import { strict as assert } from "node:assert";
import test from "node:test";
import { checkMembers } from "./tarball-check.ts";

interface TestMember {
  readonly name: string;
  readonly data: Buffer;
}

function packageJson(fields: Record<string, unknown> = {}): TestMember {
  return {
    name: "package/package.json",
    data: Buffer.from(
      JSON.stringify({
        name: "nepdate-patro",
        version: "0.1.0",
        peerDependencies: { nepdate: "~0.1.0" },
        ...fields,
      }),
    ),
  };
}

function allowed(): TestMember[] {
  return [
    packageJson(),
    { name: "package/dist/index.js", data: Buffer.from("export {};") },
    { name: "package/dist/index.d.ts", data: Buffer.from("export {};") },
    { name: "package/dist/index.js.map", data: Buffer.from("{}") },
    { name: "package/LICENSE", data: Buffer.from("MIT") },
    { name: "package/NOTICE", data: Buffer.from("NepDate") },
    { name: "package/README.md", data: Buffer.from("# Patro") },
  ];
}

const PATRO = { name: "nepdate-patro", version: "0.1.0", peer: "nepdate" } as const;
const CORE = { name: "nepdate", version: "0.1.0", peer: undefined } as const;

test("the allowed members and patro manifest pass", () => {
  assert.deepEqual(checkMembers(allowed(), PATRO), []);
});

test("a source file fails", () => {
  const errors = checkMembers(
    [...allowed(), { name: "package/src/index.ts", data: Buffer.from("x") }],
    PATRO,
  );
  assert.equal(errors.length, 1);
  assert.match(errors[0] as string, /unexpected member package\/src\/index.ts/);
});

test("a test file fails", () => {
  const errors = checkMembers(
    [...allowed(), { name: "package/test/a.test.ts", data: Buffer.from("x") }],
    PATRO,
  );
  assert.match(errors[0] as string, /unexpected member package\/test\/a.test.ts/);
});

test("a scripts file fails", () => {
  const errors = checkMembers(
    [...allowed(), { name: "package/scripts/x.ts", data: Buffer.from("x") }],
    PATRO,
  );
  assert.match(errors[0] as string, /unexpected member package\/scripts\/x.ts/);
});

test("a map outside dist fails", () => {
  const errors = checkMembers(
    [...allowed(), { name: "package/app.js.map", data: Buffer.from("{}") }],
    PATRO,
  );
  assert.match(errors[0] as string, /unexpected member package\/app.js.map/);
});

test("the wrong version fails", () => {
  const members = allowed().map((member) =>
    member.name === "package/package.json" ? packageJson({ version: "0.1.1" }) : member,
  );
  const errors = checkMembers(members, PATRO);
  assert.match(errors[0] as string, /version 0\.1\.1, expected 0\.1\.0/);
});

test("the wrong peer range fails", () => {
  const members = allowed().map((member) =>
    member.name === "package/package.json"
      ? packageJson({ peerDependencies: { nepdate: "~0.2.0" } })
      : member,
  );
  const errors = checkMembers(members, PATRO);
  assert.match(errors[0] as string, /peerDependencies\.nepdate is ~0\.2\.0, expected ~0\.1\.0/);
});

test("devDependencies fail", () => {
  const members = allowed().map((member) =>
    member.name === "package/package.json"
      ? packageJson({ devDependencies: { nepdate: "0.1.0" } })
      : member,
  );
  const errors = checkMembers(members, PATRO);
  assert.match(errors[0] as string, /has devDependencies, expected none/);
});

test("runtime dependencies fail", () => {
  const members = allowed().map((member) =>
    member.name === "package/package.json"
      ? packageJson({ dependencies: { something: "1.0.0" } })
      : member,
  );
  const errors = checkMembers(members, PATRO);
  assert.match(errors[0] as string, /has dependencies, expected none/);
});

test("the core manifest must not carry a peer", () => {
  const members = allowed().map((member) =>
    member.name === "package/package.json" ? packageJson({ name: "nepdate" }) : member,
  );
  const errors = checkMembers(members, CORE);
  assert.match(errors[0] as string, /has peerDependencies, expected none for nepdate/);
});

test("a missing package.json fails", () => {
  const errors = checkMembers(
    allowed().filter((member) => member.name !== "package/package.json"),
    PATRO,
  );
  assert.deepEqual(errors, ["package/package.json is missing"]);
});
