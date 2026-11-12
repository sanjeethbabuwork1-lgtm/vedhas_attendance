// Zips the built web app (out/) into out/app.zip so Vercel can serve it at
// /app.zip for in-app updates. Runs after `next build` both locally and on
// Vercel (see package.json "build" script).
import { readdirSync, statSync, existsSync, copyFileSync } from "node:fs";
import { join, resolve, relative } from "node:path";
import AdmZip from "adm-zip";

const outDir = resolve("out");
if (!existsSync(outDir)) {
  console.error("out/ not found — run next build first.");
  process.exit(1);
}

const zip = new AdmZip();

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const rel = relative(outDir, full).replace(/\\/g, "/");
    if (rel === "app.zip") continue;
    if (statSync(full).isDirectory()) {
      walk(full);
    } else {
      zip.addLocalFile(full, rel.split("/").slice(0, -1).join("/"), entry);
    }
  }
}

walk(outDir);

const target = join(outDir, "app.zip");
zip.writeZip(target);

const publicZip = join(resolve("public"), "app.zip");
copyFileSync(target, publicZip);

const bytes = statSync(target).size;
console.log(
  `Generated ${relative(process.cwd(), target)} (${(bytes / 1024 / 1024).toFixed(2)} MB)`
);
console.log(
  `Saved release copy to ${relative(process.cwd(), publicZip)} (committed so next build serves it)`
);
