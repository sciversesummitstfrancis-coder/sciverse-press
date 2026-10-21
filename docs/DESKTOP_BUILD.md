# Desktop Builds (Tauri 2)

The desktop client is a **Tauri 2** app: a Rust/Wry shell that renders the same
React + TypeScript frontend in `desktop/`.

```
desktop/
├── src/                  React + TS frontend (pages, animations, API client)
├── src-tauri/
│   ├── Cargo.toml        Rust crate
│   ├── tauri.conf.json   Window + bundle config (id: com.sciverse.press)
│   ├── capabilities/     Tauri permission scopes
│   ├── icons/            App icons used by every bundle target
│   └── src/              Rust entry point
└── dist/                 Built frontend (embedded into the binary)
```

## Producing the installers

### One command (current host)

```bash
scripts/build-desktop.sh
```

The script detects the OS and produces the matching bundle into
`dist-desktop/`:

| Host OS | Output |
|---|---|
| Linux | `SciversePress-v<ver>-linux-x86_64.AppImage`, `...-linux-amd64.deb`, `...-linux-x86_64.rpm` |
| Windows | `Sciverse Press_<ver>_x64-setup.exe` (NSIS) and/or `.msi` |
| macOS | `Sciverse Press_<ver>_aarch64.dmg` / `.app` |

### Prerequisites

**Linux (Fedora)**

```bash
sudo dnf install webkit2gtk4.1-devel libappindicator-gtk3-devel \
                 librsvg2-devel openssl-devel gcc make pkgconf-pkg-config
sudo dnf install mingw-nsis-base      # only for the Windows NSIS cross-build
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

**Linux (Debian/Ubuntu)**

```bash
sudo apt install libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev \
                 build-essential curl wget file libssl-dev
```

**Windows** — install the MSVC build tools and Rust from rustup.rs.
**macOS** — `xcode-select --install`, then Rust from rustup.rs.

## Cross-compiling Windows from Linux

Windows installers can be produced from a Linux host:

```bash
cargo install cargo-xwin
cd desktop
npx tauri build --target x86_64-pc-windows-msvc --runner cargo-xwin --bundles nsis
```

Requirements for the NSIS path: `makensis` on `PATH` (Fedora:
`mingw-nsis-base`; Debian: `nsis`) and `NSIS_PATH` pointing at the NSIS
install root if it is not `/usr/share/nsis`.

## macOS

macOS bundles **must** be built on macOS — Apple tooling and the
`.app`/`.dmg` formats require it. Two options:

1. **On a Mac**

   ```bash
   scripts/build-desktop.sh
   ```

2. **GitHub Actions** — `.github/workflows/build-desktop.yml` builds
   Linux, Windows, macOS (arm64 + x64) and uploads the artifacts. Push a
   `v*` tag or run the workflow manually.

## Docker/Podman (no root on host)

A prebaked builder image is defined in `scripts/`; it contains the whole
toolchain so no `sudo` is required on the host:

```bash
podman build -t sciverse-tauri-builder scripts/docker/builder
podman run --rm -v "$PWD:/workspace:Z" -w /workspace/desktop \
  sciverse-tauri-builder bash -lc 'node ../node_modules/.bin/tauri build'
```

## Version

The desktop version lives in three places and must stay in sync:

* `desktop/package.json` → `version`
* `desktop/src-tauri/tauri.conf.json` → `version`
* `mobile/app.json` → `version` / `versionCode` (shared release train)

## Notes

* The `.deb`/`.rpm`/NSIS/AppImage bundles are produced from a **release**
  profile (`--release` is the default for `tauri build`).
* The AppImage bundles WebKitGTK via `linuxdeploy`; the toolchain is cached
  under `$XDG_CACHE_HOME/tauri` so repeated builds do not re-download it.
* Windows binaries are unsigned. macOS binaries produced by CI are also
  unsigned and will be quarantined by Gatekeeper — users must right-click →
  Open, or the bundle must be signed and notarised with an Apple Developer
  certificate.
