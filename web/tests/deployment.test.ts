import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { getCatalog } from "../src/lib/content.ts";

test("production content works without parent quiz/notes directories and excludes HTML", () => {
  const prepared = spawnSync(process.execPath, [path.join("scripts", "prepare-content.mjs")], { encoding: "utf8" });
  assert.equal(prepared.status, 0, prepared.stderr);
  const bundled = path.join(process.cwd(), ".netlify-content");
  const files = readdirSync(bundled, { recursive: true }).map(String);
  assert.ok(files.some((file) => file.endsWith(".json") && file.startsWith("quiz")));
  assert.ok(files.some((file) => file.endsWith(".md")));
  assert.equal(files.some((file) => file.endsWith(".html")), false);
  for (const level of ["n5", "n4", "n3", "n2", "n1"]) {
    assert.equal(readFileSync(path.join(bundled, "vocabulary", `${level}.json`), "utf8"),
      readFileSync(path.join(process.cwd(), "data", "vocabulary", `${level}.json`), "utf8"));
  }
  assert.ok(existsSync(path.join(bundled, "vocabulary", "LICENSE")));
  assert.ok(existsSync(path.join(bundled, "vocabulary", "NOTICE.md")));
  const parent = path.join(process.cwd(), "test-results");
  mkdirSync(parent, { recursive: true });
  const temporary = mkdtempSync(path.join(parent, "packaged-"));
  try {
    cpSync(bundled, path.join(temporary, ".netlify-content"), { recursive: true });
    const moduleUrl = pathToFileURL(path.join(process.cwd(), "src", "lib", "content.ts")).href;
    const vocabularyModule = pathToFileURL(path.join(process.cwd(), "src", "lib", "vocabulary.ts")).href;
    const program = `import {getCatalog, notesRoot} from ${JSON.stringify(moduleUrl)};
      import {getVocabulary} from ${JSON.stringify(vocabularyModule)};
      console.log(JSON.stringify({catalog:getCatalog(), notesRoot, vocabulary: ["N5","N4","N3","N2","N1"].map(level => getVocabulary(level).length)}));`;
    const check = spawnSync(process.execPath, ["--experimental-strip-types", "--input-type=module", "-e", program], {
      cwd: temporary, encoding: "utf8", env: { ...process.env, NODE_ENV: "production" },
    });
    assert.equal(check.status, 0, check.stderr);
    const result = JSON.parse(check.stdout);
    assert.deepEqual(result.catalog, JSON.parse(JSON.stringify(getCatalog())));
    assert.deepEqual(result.vocabulary, [674, 630, 1659, 1778, 3070]);
    assert.equal(result.notesRoot, path.join(temporary, ".netlify-content", "notes", "raw"));
    assert.equal(existsSync(path.join(temporary, "quiz")), false);
    assert.equal(existsSync(path.join(temporary, "notes")), false);
  } finally {
    rmSync(temporary, { recursive: true });
  }
});

test("Netlify build config traces packaged learning content and uses the official migrations", () => {
  const configuration = readFileSync(path.join(process.cwd(), "netlify.toml"), "utf8");
  assert.match(configuration, /publish\s*=\s*"\.next"/);
  assert.match(configuration, /NODE_VERSION\s*=\s*"24"/);
  assert.match(configuration, /included_files\s*=\s*\["\.netlify-content\/\*\*"\]/);
  assert.match(configuration, /\[\[plugins\]\]\s*package\s*=\s*"@netlify\/plugin-nextjs"/);
  const manifest = JSON.parse(readFileSync(path.join(process.cwd(), "package.json"), "utf8"));
  assert.ok(manifest.devDependencies["@netlify/plugin-nextjs"]);
  const migrations = readdirSync(path.join(process.cwd(), "netlify", "database", "migrations"));
  assert.ok(migrations.some((name) => /^\d+_.+\.sql$/.test(name)));
});
