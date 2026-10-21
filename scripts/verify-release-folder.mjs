#!/usr/bin/env node
/**
 * Verify a release folder before you upload it.
 *
 * Checks that:
 *   1. every file listed in latest.json actually exists in the folder
 *   2. every platform in the manifest has a matching .sig file
 *   3. the .sig files are valid minisign signatures over their artefact
 *   4. the signed version matches the version in the manifest
 *   5. SHA256SUMS.txt matches the files on disk
 *   6. the deb / rpm / AppImage / exe are the right kind of file
 *
 * Usage: node scripts/verify-release-folder.mjs <folder> [pubkey-base64]
 */
import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import { join, basename, extname } from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";

const dir = process.argv[2];
const pubkey = process.argv[3];

if (!dir) {
  console.error("usage: verify-release-folder.mjs <folder> [pubkey]");
  process.exit(2);
}

let failures = 0;
const ok = (m) => console.log(`  PASS  ${m}`);
const bad = (m) => { failures++; console.log(`  FAIL  ${m}`); };

const files = await readdir(dir);
const has = (n) => files.includes(n);

console.log(`Verifying ${dir}\n`);

// ---------------------------------------------------------------- 1. files ---
console.log("1. Manifest");
let manifest = null;
if (!has("latest.json")) {
  bad("latest.json is missing");
} else {
  manifest = JSON.parse(await readFile(join(dir, "latest.json"), "utf8"));
  ok(`latest.json present (version ${manifest.version})`);

  for (const [platform, entry] of Object.entries(manifest.platforms ?? {})) {
    const file = decodeURIComponent(entry.url.split("/").pop());
    if (has(file)) ok(`${platform}: ${file} is in the folder`);
    else bad(`${platform}: ${file} is referenced but missing from the folder`);

    if (has(`${file}.sig`)) ok(`${platform}: signature file present`);
    else bad(`${platform}: ${file}.sig is missing`);

    // The URL must be the real download location, not a local path.
    if (!/^https:\/\//.test(entry.url)) bad(`${platform}: url is not https`);
  }
}

// ------------------------------------------------------------ 2. signature ---
if (manifest && pubkey) {
  console.log("\n2. Signatures");
  const verifier = join(process.cwd(), "scripts", "verify-updater-signature.py");
  for (const [platform, entry] of Object.entries(manifest.platforms ?? {})) {
    const file = decodeURIComponent(entry.url.split("/").pop());
    if (!has(file) || !has(`${file}.sig`)) continue;
    try {
      const out = execFileSync(
        "python3",
        [verifier, join(dir, file), join(dir, `${file}.sig`), pubkey, manifest.version],
        { encoding: "utf8" },
      );
      ok(`${platform}: ${out.split("\n")[0].replace("PASS: ", "")}`);
    } catch (e) {
      bad(`${platform}: ${String(e.stdout ?? e.message).split("\n")[0]}`);
    }
  }
}

// ------------------------------------------------------------- 3. checksums ---
console.log("\n3. Checksums");
if (!has("SHA256SUMS.txt")) {
  bad("SHA256SUMS.txt is missing");
} else {
  const sums = await readFile(join(dir, "SHA256SUMS.txt"), "utf8");
  let allOk = true;
  for (const line of sums.split("\n").filter(Boolean)) {
    const [hash, name] = line.trim().split(/\s+/);
    const clean = name.replace(/^\.\//, "");
    if (!has(clean)) { bad(`${clean} listed in SHA256SUMS.txt but missing`); allOk = false; continue; }
    const data = await readFile(join(dir, clean));
    const actual = createHash("sha256").update(data).digest("hex");
    if (actual !== hash) { bad(`${clean} checksum does not match`); allOk = false; }
  }
  if (allOk) ok("every checksum in SHA256SUMS.txt matches the file on disk");
}

// ----------------------------------------------------------------- 4. types ---
console.log("\n4. File types");
for (const f of files) {
  const ext = extname(f).toLowerCase();
  if (![".appimage", ".deb", ".rpm", ".exe", ".apk"].includes(ext)) continue;
  const data = await readFile(join(dir, f));
  const head = data.subarray(0, 4);
  let kind = "unknown";
  if (ext === ".appimage" && head[0] === 0x7f && head[1] === 0x45) kind = "ELF (AppImage)";
  if (ext === ".exe" && head[0] === 0x4d && head[1] === 0x5a) kind = "PE (Windows executable)";
  if (ext === ".apk" && head[0] === 0x50 && head[1] === 0x4b) kind = "ZIP (APK)";
  if (ext === ".deb" && data.subarray(0, 4).toString() === "!<ar") kind = "ar archive (deb)";
  if (ext === ".rpm" && head[0] === 0xed && head[1] === 0xab && head[2] === 0xee && head[3] === 0xdb) kind = "RPM package";
  if (kind === "unknown") bad(`${f}: unexpected file type`);
  else ok(`${f}: ${kind} (${(await stat(join(dir, f))).size} bytes)`);
}

console.log();
if (failures) {
  console.log(`FAILED — ${failures} problem(s) found.`);
  process.exit(1);
}
console.log("All checks passed. This folder is ready to upload.");
