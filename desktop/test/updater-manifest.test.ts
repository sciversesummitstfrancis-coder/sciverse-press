import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, rmSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const ROOT = join(__dirname, "..", "..");
const SCRIPT = join(ROOT, "scripts", "make-updater-manifest.mjs");

function run(dir: string, version: string) {
  execFileSync("node", [SCRIPT, dir, version, dir], { encoding: "utf8" });
  return JSON.parse(readFileSync(join(dir, "latest.json"), "utf8"));
}

describe("updater manifest generator", () => {
  let dir: string;

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), "sciverse-updater-"));
    // A flat release folder, exactly like the one uploaded to GitHub.
    writeFileSync(join(dir, "SciversePress-v1.0.2-linux-x86_64.AppImage"), "appimage");
    writeFileSync(join(dir, "SciversePress-v1.0.2-linux-x86_64.AppImage.sig"), "sig-linux");
    writeFileSync(join(dir, "SciversePress-v1.0.2-windows-x64-setup.exe"), "nsis");
    writeFileSync(join(dir, "SciversePress-v1.0.2-windows-x64-setup.exe.sig"), "sig-windows");
    // The portable Windows binary is NOT an updater artefact — it must be
    // ignored so the manifest keeps pointing at the installer.
    writeFileSync(join(dir, "SciversePress-v1.0.2-windows-x64.exe"), "portable");
    writeFileSync(join(dir, "SciversePress-v1.0.2-windows-x64.exe.sig"), "sig-portable");
    // macOS: the signed .app tarball.
    writeFileSync(join(dir, "SciversePress-v1.0.2-macos-x86_64.app.tar.gz"), "app-tar");
    writeFileSync(join(dir, "SciversePress-v1.0.2-macos-x86_64.app.tar.gz.sig"), "sig-macos");
  });

  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it("emits one platform entry per supported artefact", () => {
    const manifest = run(dir, "1.0.2");
    expect(manifest.version).toBe("1.0.2");
    expect(Object.keys(manifest.platforms).sort()).toEqual([
      "darwin-x86_64",
      "linux-x86_64",
      "windows-x86_64",
    ]);
    expect(manifest.platforms["linux-x86_64"].signature).toBe("sig-linux");
    expect(manifest.platforms["windows-x86_64"].signature).toBe("sig-windows");
    expect(manifest.platforms["darwin-x86_64"].signature).toBe("sig-macos");
  });

  it("points each platform at the matching download URL", () => {
    const manifest = run(dir, "1.0.2");
    expect(manifest.platforms["linux-x86_64"].url).toContain("SciversePress-v1.0.2-linux-x86_64.AppImage");
    expect(manifest.platforms["linux-x86_64"].url).toContain("/v1.0.2/");
    expect(manifest.platforms["windows-x86_64"].url).toContain("SciversePress-v1.0.2-windows-x64-setup.exe");
    expect(manifest.platforms["darwin-x86_64"].url).toContain(".app.tar.gz");
  });

  it("ignores the portable binary so the updater keeps using the installer", () => {
    const manifest = run(dir, "1.0.2");
    expect(manifest.platforms["windows-x86_64"].signature).toBe("sig-windows");
    expect(manifest.platforms["windows-x86_64"].url).not.toContain("windows-x64.exe");
  });

  it("skips an artefact that has no signature", () => {
    const lonely = mkdtempSync(join(tmpdir(), "sciverse-updater-2-"));
    writeFileSync(join(lonely, "Sciverse Press_9.9.9_amd64.AppImage"), "appimage");
    expect(() => run(lonely, "9.9.9")).toThrow();
    rmSync(lonely, { recursive: true, force: true });
  });
});
