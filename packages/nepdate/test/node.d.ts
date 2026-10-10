// The few Node APIs the tests use. The ADRs list no @types/node, so the tests declare only what
// they call; replace this file with @types/node if the human adds it to the devDependencies.

interface ImportMeta {
  readonly url: string;
}

declare class URL {
  constructor(url: string, base?: string | URL);
  readonly href: string;
}

declare module "node:fs" {
  export function readFileSync(path: string | URL, encoding: "utf8"): string;
}
