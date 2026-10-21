# Android build

This project builds a **standalone release APK** with Gradle (no EAS account
required). The JS bundle is embedded, so the APK runs without a Metro dev server.

## Local-first database (no server needed)

Since **v1.1.0** the app carries its own SQLite database (`expo-sqlite`) and is
**local-first**:

| Concern | Behaviour |
| --- | --- |
| Sign-in | Verified against the on-device database — instant, works offline |
| Data | Seeded inside the APK (users, committees, delegates, points, articles, notifications) |
| Writes | Saved locally first, marked dirty, pushed to the server when one is reachable |
| Server | Optional. There is **no default server URL** — nothing is contacted unless one is configured |
| Admin centre | Runs on-device: create/delete accounts, change roles, create/patch/delete committees, live activity feed |

```
mobile/src/local/db.ts    schema + seed + queries (source of truth on the device)
mobile/src/local/sync.ts  optional network layer, every call has a hard timeout
mobile/src/api.ts         local-first facade used by every screen
```

Because `sync.ts` always applies an `AbortController` timeout, an unreachable
server can never hang the UI the way a plain `fetch` did. The seed is
self-healing: an install made by an older build repairs itself on next launch.

## Requirements (verified on Fedora 44)
- **JDK 17** — React Native 0.74 / Expo 51 / AGP 8.2 need JDK 17. JDK 21+ **fails**.
- **Android SDK** with a platform (`android-35` or `android-36`) and `build-tools`.
- **Node 20+** and the mobile dependencies (`npm install` in `mobile/`).
- No Android Studio GUI is required; the SDK + JDK are enough.

## One command
```bash
# The app ships with its own database — no server required:
scripts/build-android.sh
```
Output: `dist/SciversePress-v<version>-release.apk`, signed with the standard
React Native debug keystore (fine for sideloading; generate your own keystore
for the Play Store).

Override the ABIs with `ARCHS=arm64-v8a` if you only need one. On a low-RAM
machine use `ARCHS="arm64-v8a,armeabi-v7a"` — building `x86`/`x86_64` as well
roughly doubles the native build time and memory.

To point the app at a backend (optional — it works without one):

```bash
EXPO_PUBLIC_API_URL=http://192.168.1.8:4000 scripts/build-android.sh
```

## Launcher icon

The icon is generated, not hand-drawn:

```bash
python3 scripts/generate-logo.py
```

That writes `mobile/assets/icon.png` (master), `mobile/assets/adaptive-icon.png`,
`mobile/assets/icon-round.png` and every `mipmap-*/ic_launcher*.png` under
`mobile/android/app/src/main/res/`. Re-run it after editing the script, then
rebuild the APK.

## Manual steps (what the script does)
```bash
cd mobile
export JAVA_HOME=/path/to/jdk-17
export ANDROID_HOME=$HOME/Android/Sdk
npx expo prebuild -p android                 # generates ./android (once)
cd android
./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a,armeabi-v7a,x86_64
# → android/app/build/outputs/apk/release/app-release.apk
```

## Install
```bash
adb uninstall com.sciverse.press   # if an older build is installed
adb install -r dist/SciversePress-v<version>-release.apk
```
Or copy the APK to the phone and tap it (enable "install unknown apps").

> **Entry point:** `mobile/package.json` must point `"main"` at `index.ts`,
> which calls `registerRootComponent(App)`. If `main` points straight at
> `App.tsx`, nothing calls `AppRegistry.registerComponent('main', …)` and the
> APK installs but closes immediately ("app entry point named main was not
> registered").

## Talking to the backend from a real device
The backend listens on `0.0.0.0:4000`, so a phone on the same Wi-Fi can reach
`http://<your-lan-ip>:4000`. Find your IP with `hostname -I`, then either set it
at runtime under **Server:** on the login screen, or build with
`EXPO_PUBLIC_API_URL` set to it. The app sets `usesCleartextTraffic=true`, so
plain-HTTP backends work on Android 9+.

On an emulator, `localhost` maps to the host only via `10.0.2.2`; build with
`EXPO_PUBLIC_API_URL=http://10.0.2.2:4000` for the emulator.

> The backend's default CORS allow-list is `http://localhost:5173`. For phone
> clients start it with `CORS_ORIGIN="*"`.

## Release signing
`assembleRelease` signs with `android/app/debug.keystore` by default (React
Native template behaviour) — installable, but not Play-Store-ready. For a real
release, create a keystore:
```bash
keytool -genkeypair -v -storetype PKCS12 -keystore release.keystore \
  -alias sciverse -keyalg RSA -keysize 2048 -validity 10000
```
and wire it into `android/app/build.gradle` (`signingConfigs.release`).
