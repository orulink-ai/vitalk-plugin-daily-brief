import { build } from "vite";
import { validatePluginPackage } from "@vitalk/plugin-sdk";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve, join } from "node:path";
import { createHash } from "node:crypto";
export async function buildPlugin(directory) {
  const manifest = JSON.parse(
    await readFile(new URL("./manifest.json", import.meta.url), "utf8"),
  );
  const bundle = await build({
    root: fileURLToPath(new URL("./", import.meta.url)),
    configFile: fileURLToPath(new URL("./vite.config.ts", import.meta.url)),
    build: { write: false, minify: true },
  });
  const output = Array.isArray(bundle) ? bundle[0].output : bundle.output;
  const script = output
    .filter((item) => item.type === "chunk")
    .map((item) => item.code)
    .join("\n")
    .replace(/<\/script/gi, "<\\/script");
  const style = output
    .filter((item) => item.type === "asset" && item.fileName.endsWith(".css"))
    .map((item) => item.source)
    .join("\n");
  if (/url\(["']?(?:https?:|\/assets\/)/i.test(style))
    throw new Error("插件资源必须内联");
  const html = `<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>今日简报</title><style>${style}</style></head><body><div id="root"></div><script>${script}</script></body></html>`;
  const pkg = validatePluginPackage({
    format: "vitalk-plugin/v1",
    manifest,
    html,
  });
  const bytes = Buffer.from(JSON.stringify(pkg, null, 2) + "\n");
  if (bytes.length > 2_000_000) throw new Error("插件包超过2MB");
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  await mkdir(directory, { recursive: true });
  const path = join(directory, `${manifest.id}.vitalk-plugin.json`);
  await writeFile(path, bytes);
  await writeFile(path + ".sha256", sha256 + "\n");
  return { path, sha256, size: bytes.length };
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  console.log(
    JSON.stringify(
      await buildPlugin(fileURLToPath(new URL("./dist", import.meta.url))),
    ),
  );
