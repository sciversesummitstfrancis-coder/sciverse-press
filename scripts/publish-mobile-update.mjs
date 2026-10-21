#!/usr/bin/env node
/**
 * Publish an over-the-air update for the mobile app.
 *
 * 1. Runs `expo export` to build the JavaScript bundle and assets.
 * 2. Writes an Expo Updates protocol v1 `manifest.json` next to them.
 * 3. Serves the result with `scripts/updates-server.mjs` (or copies it to
 *    any static host / CDN).
 *
 * Usage:
 *   node scripts/publish-mobile-update.mjs [--out mobile/dist/updates] [--runtime 1.1.0]
 *
 * The installed APK is never touched: clients download the new bundle and
 * swap it in on the next launch, so nobody has to reinstall.
 */
import { spawn } from "node:child_process";
import { readdir, readFile, writeFile, mkdir, rm, stat } from "node:fs/promises";
import { join, relative, extname } from "node:path";
import { createHash } from "node:crypto";

const args = process.argv.slice(2);
function arg(name, fallback) {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
}

const root = process.cwd();
const mobile = join(root, "mobile");
const out = resolvePath(arg("out", join(mobile, "dist", "updates")));
const runtimeVersion = arg("runtime", "1.1.0");

function resolvePath(p) {
  return p.startsWith("/") ? p : join(root, p);
}

function run(cmd, args, cwd) {
  return new Promise((res, rej) => {
    const p = spawn(cmd, args, { cwd, stdio: "inherit", shell: false });
    p.on("exit", (code) =>
      code === 0 ? res() : rej(new Error(`${cmd} exited with ${code}`)),
    );
    p.on("error", rej);
  });
}

async function walk(dir) {
  const out = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(p)));
    else out.push(p);
  }
  return out;
}

function hashOf(buffer) {
  // Expo's client uses a sha256 base64 digest for asset integrity.
  return createHash("sha256").update(buffer).digest("base64");
}

console.log("==> Exporting the JavaScript bundle");
const exportDir = join(mobile, "dist");
await rm(exportDir, { recursive: true, force: true });
await run("npx", ["expo", "export", "--platform", "android", "--output-dir", "dist"], mobile);

console.log("==> Locating the exported bundle");
const files = await walk(exportDir);
const bundle = files.find((f) => f.endsWith(".hbc") || (f.endsWith(".js") && f.includes("bundle")));
if (!bundle) {
  console.error("!! Could not find the exported JavaScript bundle.");
  process.exit(1);
}
const bundleRel = relative(exportDir, bundle);

console.log("==> Building the update directory");
await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });

const assets = [];
for (const file of files) {
  const rel = relative(exportDir, file);
  if (rel === "metadata.json" || rel.startsWith("metadata.json")) continue;
  const dest = join(out, rel);
  await mkdir(join(dest, ".."), { recursive: true });
  const data = await readFile(file);
  await writeFile(dest, data);
  if (rel !== bundleRel) {
    assets.push({
      type: "asset",
      url: rel.split("\\").join("/"),
      hash: hashOf(data),
      hashAlgorithm: "sha256",
      mimeType: mimeFor(file),
    });
  }
}

const bundleData = await readFile(bundle);
const id = `upd-${Date.now().toString(16)}`;
const manifest = {
  id,
  createdAt: new Date().toISOString(),
  runtimeVersion,
  launchAsset: {
    type: "js",
    url: bundleRel.split("\\").join("/"),
    hash: hashOf(bundleData),
    hashAlgorithm: "sha256",
    mimeType: "application/javascript",
  },
  assets,
  metadata: { version: runtimeVersion, channel: "production" },
};

await writeFile(join(out, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
console.log(`==> Wrote ${join(out, "manifest.json")}`);
console.log(`    update id : ${id}`);
console.log(`    runtime   : ${runtimeVersion}`);
console.log(`    assets    : ${assets.length + 1}`);
console.log("");
console.log("Next steps:");
console.log("  1. Serve this directory:  node scripts/updates-server.mjs --dir mobile/dist/updates");
console.log("  2. Or copy it to any static host / CDN.");
console.log("  3. Point the app at the server (login screen → Server settings), or set");
console.log("     expo.updates.url in mobile/app.json and rebuild the APK once.");

function mimeFor(file) {
  const ext = extname(file).toLowerCase();
  return (
    {
      ".js": "application/javascript",
      ".hbc": "application/javascript",
      ".json": "application/json",
      ".css": "text/css",
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".gif": "image/gif",
      ".svg": "image/svg+xml",
      ".ttf": "font/ttf",
      ".otf": "font/otf",
      ".woff": "font/woff",
      ".woff2": "font/woff2",
    }[ext] ?? "application/octet-stream"
  );
}
