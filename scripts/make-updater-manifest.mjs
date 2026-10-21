#!/usr/bin/env node
/**
 * Build the static `latest.json` manifest that the Tauri updater polls.
 *
 * Scans a directory of build outputs for the updater artefacts Tauri
 * produces (a `.tar.gz` for Linux, a `.nsis.zip` for Windows, an
 * `.app.tar.gz` for macOS), reads the matching `.sig` sidecar files, and
 * writes the manifest the updater expects:
 *
 *   {
 *     "version": "1.0.2",
 *     "notes": "…",
 *     "pub_date": "2026-10-21T00:00:00.000Z",
 *     "platforms": {
 *       "linux-x86_64":   { "signature": "…", "url": "…" },
 *       "windows-x86_64": { "signature": "…", "url": "…" },
 *       "darwin-x86_64":  { "signature": "…", "url": "…" }
 *     }
 *   }
 *
 * Usage: node make-updater-manifest.mjs <releaseDir> <version> [outDir]
 */
import { readdir, readFile, writeFile, stat } from "node:fs/promises";
import { join, basename, relative } from "node:path";

const releaseDir = process.argv[2];
const version = process.argv[3];
const outDir = process.argv[4] ?? releaseDir;

/** Read a `--name value` pair from the command line. */
function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

if (!releaseDir || !version) {
  console.error("usage: make-updater-manifest.mjs <releaseDir> <version> [outDir] [--base-url URL]");
  process.exit(1);
}

/**
 * Where the artefacts will be downloadable from once published. The URLs in
 * the manifest must match the published file names exactly, so this has to
 * be the real location the release will live at.
 *
 *   --base-url  https://github.com/OWNER/REPO/releases/download/v1.0.2
 *   or GITHUB_REPO=OWNER/REPO -> https://github.com/OWNER/REPO/releases/download/v<version>
 */
const baseUrl = (
  arg("base-url", "") ||
  (process.env.GITHUB_REPO
    ? `https://github.com/${process.env.GITHUB_REPO}/releases/download/v${version}`
    : `https://github.com/sciverse-summit/sciverse-press/releases/download/v${version}`)
).replace(/\/+$/, "");

/**
 * Map an artefact to a Tauri updater platform key.
 *
 * Tauri v2 updater artefacts per platform:
 *   Linux   -> the AppImage itself (self-contained) + .sig
 *   Windows -> the NSIS installer (.exe) + .sig
 *   macOS   -> <name>.app.tar.gz + .sig
 *
 * The Windows updater accepts the NSIS installer directly — it detects the
 * executable and runs it — so `bundle/nsis/*.exe` is a valid artefact.
 *
 * `relPath` is the artefact's path relative to the release directory, so the
 * Windows installer is identified by the `nsis/` folder it lives in rather
 * than by its file name.
 */
function platformFor(relPath) {
  const lower = relPath.toLowerCase();
  const name = lower.split("/").pop() ?? lower;
  if (name.endsWith(".app.tar.gz")) return "darwin";
  if (name.endsWith(".appimage")) return "linux";
  // The NSIS installer: either it lives in the bundler's `nsis/` folder, or
  // it is a flat release folder where the name says so ("…-setup.exe").
  const isNsis = lower.includes("nsis/") || lower.includes("nsis-updater/") || name.includes("setup");
  if (isNsis && name.endsWith(".exe")) return "windows";
  return null;
}

/** Percent-encode each path segment so spaces in file names are legal in a URL. */
function toUrlPath(relPath) {
  return relPath.split("/").map(encodeURIComponent).join("/");
}

function archFor(name) {
  const lower = name.toLowerCase();
  if (lower.includes("x86_64") || lower.includes("amd64") || lower.includes("x64")) return "x86_64";
  if (lower.includes("aarch64") || lower.includes("arm64")) return "aarch64";
  if (lower.includes("i686") || lower.includes("x86")) return "i686";
  return "x86_64";
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

const files = await walk(releaseDir);
const platforms = {};

for (const file of files) {
  // The path relative to the release directory identifies the artefact:
  // the Windows installer is the one inside the `nsis-updater/` folder.
  const relPath = relative(releaseDir, file).split("\\").join("/");
  const name = basename(file);
  const platform = platformFor(relPath);
  if (!platform) continue;
  const sigPath = `${file}.sig`;
  let signature;
  try {
    signature = (await readFile(sigPath, "utf8")).trim();
  } catch {
    console.warn(`  ! missing signature for ${relPath} — skipping`);
    continue;
  }
  const key = `${platform}-${archFor(name)}`;
  platforms[key] = {
    signature,
    url: `${baseUrl}/${toUrlPath(relPath)}`,
  };
  console.log(`  + ${key} <- ${relPath}`);
}

if (!Object.keys(platforms).length) {
  console.error("No signed updater artefacts found — nothing to publish.");
  process.exit(1);
}

const manifest = {
  version,
  notes: `Sciverse Press ${version}`,
  pub_date: new Date().toISOString(),
  platforms,
};

await writeFile(join(outDir, "latest.json"), JSON.stringify(manifest, null, 2) + "\n");
console.log(`\nWrote ${join(outDir, "latest.json")}`);
