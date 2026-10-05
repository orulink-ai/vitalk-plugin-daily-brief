import { fileURLToPath } from "node:url";
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { buildPlugin } from "../build.mjs";
test("builds a self contained public SDK package with reproducible digest", async () => {
  const folder = await mkdtemp(join(tmpdir(), "vitalk-daily-"));
  const result = await buildPlugin(folder);
  const bytes = await readFile(result.path);
  const pkg = JSON.parse(bytes);
  assert.equal(pkg.manifest.id, "vitalk.daily-brief");
  assert.equal(pkg.manifest.page.layout, "full");
  assert.ok(pkg.html.includes("daily-brief-cover"));
  assert.ok(bytes.length < 2_000_000);
  assert.equal(result.sha256, createHash("sha256").update(bytes).digest("hex"));
  assert.ok(!/src=["']https?:/.test(pkg.html));
});
test("source modules do not import host private or native APIs", async () => {
  async function walk(path) {
    for (const entry of await readdir(path, { withFileTypes: true })) {
      const p = join(path, entry.name);
      if (entry.isDirectory()) await walk(p);
      else if (/\.tsx?$/.test(p) && !p.includes(".test.")) {
        const source = await readFile(p, "utf8");
        assert.ok(
          !/@tauri-apps|supabase|\.\.\/\.\.\/ViTalk\/|vitalk-client/.test(
            source,
          ),
          p,
        );
      }
    }
  }
  await walk(fileURLToPath(new URL("../src", import.meta.url)));
});
