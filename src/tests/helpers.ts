import path from "node:path";

export const fixtures = (subpath: string) =>
  `${path.resolve(import.meta.dirname, "fixtures")}/${subpath}`;

export async function unpack() {}
