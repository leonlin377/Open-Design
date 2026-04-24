# OpenDesign Studio — Application Icons

`icon.png` in this directory is a **placeholder** (solid OpenDesign blue, 512×512).
You almost certainly want to replace it with the real OpenDesign wordmark / glyph
before shipping a public build.

## Replacing the icon

1. Drop your master artwork into this folder as `icon.png`. It must be:
   - PNG, 32-bit RGBA
   - At least **1024×1024** (Tauri will downscale)
   - Square, with transparent background if the mark is non-rectangular

2. From `apps/desktop/`, regenerate every platform-specific format:

   ```bash
   pnpm tauri icon src-tauri/icons/icon.png
   ```

   `cargo tauri icon` (or `pnpm tauri icon` through this package's devDependency)
   will emit `icon.ico`, `icon.icns`, a set of Windows Store tiles, and the
   resized PNG variants that `tauri.conf.json` references.

3. Commit the generated files. Do **not** edit the generated PNGs by hand —
   rerun the command instead.

## Why we ship the placeholder

Tauri refuses to build if `bundle.icon[]` points at a missing file. Shipping a
valid (if boring) PNG keeps `pnpm desktop:build` runnable on a fresh checkout
without forcing every contributor to install ImageMagick or Pillow.
