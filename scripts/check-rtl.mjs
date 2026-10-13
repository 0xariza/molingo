// Bans physical-direction Tailwind utilities so one layout serves RTL and LTR.
// Use ms-/me-/ps-/pe-/start-/end-/text-start/border-s/rounded-s… instead.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const banned =
  /(?<![\w-])(?:-?m[lr]|p[lr]|-?left|-?right|text-left|text-right|border-[lr]|rounded-[lr]|rounded-[tb][lr]|scroll-m[lr]|scroll-p[lr]|float-left|float-right|clear-left|clear-right)(?:-[\w./[\]%]+)?(?![\w-])/g;

const files = [];
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(tsx|ts|jsx|css)$/.test(name) && !name.endsWith(".test.ts")) files.push(p);
  }
};
walk("src");

let failures = 0;
for (const file of files) {
  readFileSync(file, "utf8")
    .split("\n")
    .forEach((line, i) => {
      // Only inspect class strings: className="…", class lists in cn()/template literals, @apply.
      const candidates = line.match(/className=\{?[`"'][^`"']*[`"']|@apply[^;]*/g);
      if (!candidates) return;
      for (const c of candidates) {
        const hits = c.match(banned);
        if (hits) {
          failures++;
          console.error(`${file}:${i + 1}  ${hits.join(", ")}`);
        }
      }
    });
}
if (failures) {
  console.error(`\n${failures} physical-direction class(es). Use logical utilities (ms/me/ps/pe/start/end).`);
  process.exit(1);
}
console.log(`rtl: ${files.length} files clean.`);
