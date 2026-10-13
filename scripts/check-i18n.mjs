// Fails when fa.json and en.json don't have exactly the same keys.
import { readFileSync } from "node:fs";

const load = (l) => JSON.parse(readFileSync(new URL(`../messages/${l}.json`, import.meta.url)));
const keys = (obj, prefix = "") =>
  Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === "object" ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`],
  );

const fa = new Set(keys(load("fa")));
const en = new Set(keys(load("en")));
const missingInEn = [...fa].filter((k) => !en.has(k));
const missingInFa = [...en].filter((k) => !fa.has(k));

if (missingInEn.length || missingInFa.length) {
  if (missingInEn.length) console.error("Missing in en.json:\n  " + missingInEn.join("\n  "));
  if (missingInFa.length) console.error("Missing in fa.json:\n  " + missingInFa.join("\n  "));
  process.exit(1);
}
console.log(`i18n: ${fa.size} keys, fa and en in sync.`);
