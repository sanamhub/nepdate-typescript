// Tests for the tarball member and manifest rules (ADR-0011). The tar reader itself is exercised by
// the release pack job; these cases check the allow-list and the manifest with plain members.

import { strict as assert } from "node:assert";
import test from "node:test";
import { checkMembers, PICKER_MEMBERS, REPOSITORY_URL } from "./tarball-check.ts";

interface TestMember {
  readonly name: string;
  readonly data: Buffer;
  readonly type?: string;
}

function packageJson(fields: Record<string, unknown> = {}): TestMember {
  return {
    name: "package/package.json",
    data: Buffer.from(
      JSON.stringify({
        name: "nepdate-patro",
        version: "0.1.0",
        peerDependencies: { "nepdate-core": "~0.1.0" },
        repository: { type: "git", url: REPOSITORY_URL, directory: "packages/nepdate-patro" },
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

const PATRO = {
  name: "nepdate-patro",
  version: "0.1.0",
  peer: "nepdate-core",
  directory: "packages/nepdate-patro",
} as const;
const CORE = {
  name: "nepdate-core",
  version: "0.1.0",
  peer: undefined,
  directory: "packages/nepdate",
} as const;

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
      ? packageJson({ peerDependencies: { "nepdate-core": "~0.2.0" } })
      : member,
  );
  const errors = checkMembers(members, PATRO);
  assert.match(
    errors[0] as string,
    /peerDependencies\["nepdate-core"\] is ~0\.2\.0, expected ~0\.1\.0/,
  );
});

test("devDependencies fail", () => {
  const members = allowed().map((member) =>
    member.name === "package/package.json"
      ? packageJson({ devDependencies: { "nepdate-core": "0.1.0" } })
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
    member.name === "package/package.json" ? packageJson({ name: "nepdate-core" }) : member,
  );
  const errors = checkMembers(members, CORE);
  assert.match(errors[0] as string, /has peerDependencies, expected none for nepdate-core/);
});

test("a missing package.json fails", () => {
  const errors = checkMembers(
    allowed().filter((member) => member.name !== "package/package.json"),
    PATRO,
  );
  assert.deepEqual(errors, ["package/package.json is missing"]);
});

test("an install lifecycle script in the packed manifest fails", () => {
  for (const name of ["preinstall", "install", "postinstall", "prepare"]) {
    const members = allowed().map((member) =>
      member.name === "package/package.json"
        ? packageJson({ scripts: { build: "tsc", [name]: "node evil.js" } })
        : member,
    );
    const errors = checkMembers(members, PATRO);
    assert.deepEqual(errors, [
      `package.json has the install lifecycle script ${name}, expected none`,
    ]);
  }
});

test("ordinary scripts in the packed manifest pass", () => {
  const members = allowed().map((member) =>
    member.name === "package/package.json"
      ? packageJson({ scripts: { build: "tsc", test: "vitest", prepack: "npm run build" } })
      : member,
  );
  assert.deepEqual(checkMembers(members, PATRO), []);
});

test("a symlink member fails", () => {
  const errors = checkMembers(
    [...allowed(), { name: "package/dist/link.js", data: Buffer.alloc(0), type: "2" }],
    PATRO,
  );
  assert.deepEqual(errors, [
    "member package/dist/link.js has tar type 2, expected a regular file or directory",
  ]);
});

test("a pax header member fails", () => {
  const errors = checkMembers(
    [...allowed(), { name: "package/PaxHeader/index.js", data: Buffer.from("x"), type: "x" }],
    PATRO,
  );
  assert.match(errors[0] as string, /has tar type x/);
});

test("a path that climbs out of dist fails", () => {
  const errors = checkMembers(
    [...allowed(), { name: "package/dist/../src/index.ts", data: Buffer.from("x") }],
    PATRO,
  );
  assert.deepEqual(errors, [
    "member package/dist/../src/index.ts has a relative path segment, expected a plain path",
  ]);
});

test("a manifest without the repository fails, because npm provenance needs it", () => {
  const members = allowed().map((member) =>
    member.name === "package/package.json" ? packageJson({ repository: undefined }) : member,
  );
  const errors = checkMembers(members, PATRO);
  assert.match(errors[0] as string, /package.json repository is undefined, expected url/);
});

test("a repository with the other package's directory fails", () => {
  const members = allowed().map((member) =>
    member.name === "package/package.json"
      ? packageJson({
          repository: { type: "git", url: REPOSITORY_URL, directory: "packages/nepdate" },
        })
      : member,
  );
  const errors = checkMembers(members, PATRO);
  assert.match(errors[0] as string, /expected url .* and directory packages\/nepdate-patro/);
});

const PICKER = {
  name: "nepdate-datepicker",
  version: "0.1.0",
  peer: "nepdate-core",
  directory: "packages/nepdate-picker",
  members: PICKER_MEMBERS,
} as const;

function pickerMembers(): TestMember[] {
  return [
    packageJson({
      name: "nepdate-datepicker",
      repository: { type: "git", url: REPOSITORY_URL, directory: "packages/nepdate-picker" },
    }),
    { name: "package/dist/index.js", data: Buffer.from("export {};") },
    { name: "package/dist/index.d.ts", data: Buffer.from("export {};") },
    { name: "package/dist/index.d.ts.map", data: Buffer.from("{}") },
    { name: "package/dist/define.js", data: Buffer.from("export {};") },
    { name: "package/dist/nepdate-datepicker.js", data: Buffer.from("var a=1;") },
    { name: "package/dist/theme.css", data: Buffer.from(":root{}") },
    { name: "package/LICENSE", data: Buffer.from("MIT") },
    { name: "package/README.md", data: Buffer.from("# Picker") },
  ];
}

test("the picker members and manifest pass", () => {
  assert.deepEqual(checkMembers(pickerMembers(), PICKER), []);
});

test("a picker source, test or stray file fails", () => {
  for (const name of [
    "package/src/grid.ts",
    "package/test/grid.test.ts",
    "package/NOTICE",
    "package/dist/index.js.map",
    "package/dist/src/grid.js",
    "package/dist/theme.scss",
  ]) {
    const errors = checkMembers([...pickerMembers(), { name, data: Buffer.from("x") }], PICKER);
    assert.equal(errors.length, 1, name);
    assert.ok((errors[0] as string).startsWith(`unexpected member ${name}, expected only`), name);
  }
});

test("a picker without the theme or the standalone file fails", () => {
  for (const path of ["dist/theme.css", "dist/nepdate-datepicker.js"]) {
    const errors = checkMembers(
      pickerMembers().filter((member) => member.name !== `package/${path}`),
      PICKER,
    );
    assert.deepEqual(errors, [`package/${path} is missing`]);
  }
});

test("the picker manifest needs its own directory and the core peer", () => {
  const members = pickerMembers().map((member) =>
    member.name === "package/package.json"
      ? packageJson({
          name: "nepdate-datepicker",
          peerDependencies: { "nepdate-core": "^0.1.0" },
        })
      : member,
  );
  const errors = checkMembers(members, PICKER);
  assert.equal(errors.length, 2);
  assert.match(errors[0] as string, /peerDependencies\["nepdate-core"\] is \^0\.1\.0/);
  assert.match(errors[1] as string, /directory packages\/nepdate-picker/);
});
