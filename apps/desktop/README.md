# @opendesign/desktop — OpenDesign Studio Desktop Shell

A **Tauri 2** desktop shell that wraps the OpenDesign Next.js Studio web app
(`apps/web`). The shell is intentionally thin: a native window, a native menu,
and a webview pointed at a running Studio origin.

> macOS is the first-class target. Windows and Linux bundle targets are
> configured but less exercised — file issues if they break.

---

## Prerequisites

Install these once per developer machine. None of them are bundled by pnpm.

1. **Rust toolchain** (stable, ≥ 1.77)

   ```bash
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   source "$HOME/.cargo/env"
   rustup default stable
   ```

2. **Xcode Command Line Tools** (macOS only)

   ```bash
   xcode-select --install
   ```

   On Windows install the *Microsoft C++ Build Tools* plus the Windows 10/11 SDK.
   On Linux install `libwebkit2gtk-4.1-dev`, `libssl-dev`, `libayatana-appindicator3-dev`,
   `librsvg2-dev`, `file`, `pkg-config`, and `build-essential` (names vary by distro —
   see <https://v2.tauri.app/start/prerequisites/>).

3. **Tauri CLI 2.x** (we use the `@tauri-apps/cli` node binding via pnpm, so this
   is optional — install it only if you want `cargo tauri ...` on your PATH)

   ```bash
   cargo install tauri-cli --version "^2.0"
   ```

4. **Node + pnpm** — already required elsewhere in this monorepo.

---

## Dev loop

The shell does **not** auto-start the web app. You need two terminals.

**Terminal 1** — run the Studio web app:

```bash
pnpm --filter @opendesign/web dev
# serves http://127.0.0.1:3100
```

**Terminal 2** — run the desktop shell:

```bash
pnpm desktop:dev
```

`pnpm desktop:dev` runs `tauri dev`, which compiles the Rust binary once and
then opens a native window pointed at `http://127.0.0.1:3100`. Reloads happen
through the **View → Reload** menu item (or ⌘R).

### Pointing at a different origin

`tauri.conf.json` hard-codes `http://127.0.0.1:3100`, but the shell honours the
`OPENDESIGN_STUDIO_URL` environment variable at startup:

```bash
OPENDESIGN_STUDIO_URL=http://staging.opendesign.internal pnpm desktop:dev
```

The main window navigates to that URL before it becomes visible.

---

## Production build

```bash
pnpm desktop:build
```

This runs `tauri build`, which produces:

- `apps/desktop/src-tauri/target/release/bundle/macos/OpenDesign Studio.app`
- `apps/desktop/src-tauri/target/release/bundle/dmg/OpenDesign Studio_<ver>_*.dmg`
- Equivalent `.msi` / `.nsis` / `.deb` / `.rpm` artefacts on the respective OS

We do **not** bundle the Next.js output. The produced binary still points at
`http://127.0.0.1:3100` by default; for a real distribution set the hosted
Studio origin at build time:

```bash
OPENDESIGN_STUDIO_URL=https://studio.opendesign.app pnpm desktop:build
```

(The built app reads the variable at startup, so users without it set will
fall back to the dev origin — override it via a launch script, env plist, or
rebuild if you need it hard-coded.)

---

## Code signing (macOS)

`tauri.conf.json` already sets `hardenedRuntime: true` and points at
`src-tauri/entitlements.plist`. To produce a signed + notarised build:

1. Obtain a **Developer ID Application** certificate from Apple and import it
   into your login keychain.
2. Export the following env vars before `pnpm desktop:build`:

   ```bash
   export APPLE_SIGNING_IDENTITY="Developer ID Application: Your Name (TEAMID)"
   export APPLE_ID="you@example.com"
   export APPLE_PASSWORD="app-specific-password"   # or APPLE_API_KEY + APPLE_API_ISSUER
   export APPLE_TEAM_ID="TEAMID"
   ```

3. Re-run `pnpm desktop:build`. Tauri will codesign the `.app`, staple the
   notarisation ticket, and emit a signed `.dmg`.

If you leave `APPLE_SIGNING_IDENTITY` unset, Tauri produces an *ad-hoc* signed
build that runs locally but triggers Gatekeeper warnings on other Macs.

### Icons

The icons in `src-tauri/icons/` are placeholders. See `src-tauri/icons/README.md`
for how to regenerate them with `pnpm tauri icon`.

---

## Follow-ups

- **DESKTOP-002** — system tray / menu-bar presence (deferred; the current slice
  ships without a tray icon).
- **DESKTOP-003** — auto-update channel via `tauri-plugin-updater`.
- **DESKTOP-004** — harden CSP once the Studio origin is pinned.
