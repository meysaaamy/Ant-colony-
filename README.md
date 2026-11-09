# Myrmecodia — Ant Colony Scent-Painting Sandbox

A bioluminescent, museum-grade **mobile sandbox for ant-colony neuroethology**, shipped as a
signed, installable **Android APK** — no Android Studio, no Gradle, no SDK download required.

```
dist/Ant-Colony-Scent-Painting.apk      ← the deliverable (423 KB, signed, offline)
```

The two uploaded archives (`*.zip`) were read, compared and merged into a single app: the newer
AI-Studio build supplied the simulation core (SoA agent engine, tri-channel pheromone solver,
bloom compositor, soundscape); the older build supplied the scientific field-guide content. The
entire UI layer — HUD, cockpit, icon system, light language — was rebuilt from scratch against the
mobile design specification, and the app was rewired for a WebView: single classic bundle,
no network, no AI service calls.

---

## 1. Install & run

| | |
|---|---|
| **File** | `dist/Ant-Colony-Scent-Painting.apk` |
| **Package** | `com.app.antcolony` |
| **Version** | 1.0.0 (versionCode 1) |
| **Min / target SDK** | 24 / 34 |
| **Signature** | APK Signature Scheme **v2** (verified) |
| **Permissions** | *none* — fully offline, no INTERNET permission |
| **Tested surface** | 360–412 dp portrait phones, gesture-nav and 3-button nav |

Sideload by tapping the APK on the device, or:

```bash
adb install -r dist/Ant-Colony-Scent-Painting.apk
```

Requirements: Android 7.0+ with a reasonably current **Android System WebView** (the UI uses
`backdrop-filter`, CSS custom properties and `dvh`; WebView 108+ recommended). The launcher icon is
a procedural bioluminescent composition shipped at all five densities.

> The signing key in `android/signing/` is a **sideload identity** generated for this project so
> rebuilds upgrade in place. Regenerate it (delete the two PEMs) for any store distribution.

---

## 2. The experience

A full-bleed, edge-to-edge canvas of dark substrate. Pheromone highways, faceted emerald crystals
and the breathing nest crater float under obsidian glass chrome that dissolves to 22 % opacity the
moment a finger touches the sandbox.

**Top split HUD** — a unified telemetry capsule (`ant glyph · ants ┃ crystal · food`) with a
recessed speed chip (1×/2×/4×) and an amber-lit 48 px play target, plus two 46 px utility
squircles for the field guide and the parameter sheet.

**Bottom 3-tier cockpit**

1. **World controls card** — drag handle, tinted slider badge, preset title, `Clear trails` and a
   deliberately armed `Reset` (two taps, amber border glow, 3 s timeout). Drag or tap to open the
   three-snap parameter sheet (*peek → half → full*).
2. **Contextual row** — breathing tool orb + active tool name + slot index; a brush pill that
   floats a glass popover with **brush radius** and **deposition intensity**.
3. **Six-tool thumb dock** — the active slot becomes an illuminated jewel: translucent accent
   fill, 1 px glowing border, subsurface radial bleed, 1 px icon lift.

**Painting choreography** — contact ripple, a tapered dual-core light ribbon (white-hot centre
inside the tool's halo), and a live brush boundary: a solid luminous ring with crosshair ticks for
paint tools, a rotating dashed ring with dissolve shimmer for the eraser.

**Tool light profiles**

| Tool | Incandescent core | Saturated accent | Ambient halo |
|---|---|---|---|
| Food trail | `#fff3b0` | `#ffae00` | `rgba(255,174,0,.20)` |
| Home trail | `#e0ffff` | `#00f0ff` | `rgba(0,240,255,.20)` |
| Alarm | `#ffd1dc` | `#ff0a43` | `rgba(255,10,67,.20)` |
| Food cluster | `#b9f6ca` | `#00e676` | `rgba(0,230,118,.20)` |
| Wall | `#cbd5e1` | `#64748b` | `rgba(100,116,139,.20)` |
| Eraser | `#ffffff` | `#94a3b8` | `rgba(148,163,184,.16)` |

The same triad drives the world renderer: pheromone deposition is tinted amber / cyan / crimson, so
the canvas and the chrome speak one colour language.

---

## 3. Artisan SVG system (zero emojis, zero stock icons)

`app/src/components/icons.tsx` — every glyph is a hand-authored 24×24 composition: 1.75 px rounded
strokes, dual-tone opacity layering, per-instance vector gradients (unique `useId` prefixes).

* **Tools** — dual-wave food current with directional micro-arrow and tapered filament · sinuous
  homeward wave with beacon node · broken sonar rings pierced by a mandibular spike · three-spired
  faceted emerald cluster with refraction lines · contoured basalt silhouette with topographic
  bevel · angled prism eraser with baseline sweep.
* **HUD** — top-down articulated 3-segment ant · faceted crystal telemetry glyph · sparkle-sweep ·
  circular reset arrow · tuning sliders · info emblem · play/pause · concentric dotted brush ring ·
  chevrons.
* **Field guide diagrams** — bilateral antenna sensing with ±35° sampling cone and Δ-steer vector ·
  pheromone colour-gradient legend with concentration ramp · Deneubourg double-bridge geometry.

---

## 4. Simulation core

Kept intact from the source archive and re-tuned for the new world aspect:

* **Structure-of-arrays engine** (`app/src/sim/engine.ts`) — preallocated `Float32Array` /
  `Uint8Array` buffers for up to 3 000 agents, O(1) spatial hash for antennation, zero per-frame
  allocation.
* **Tri-channel pheromone grid** — amber food trail, cyan home guide, crimson alarm; exponential
  decay (`exp(-dt·λ)`, alarm 3.5× faster), CFL-stable 3×3 Laplacian diffusion with zero-flux walls.
* **Compositor** (`app/src/sim/renderer.ts`) — cached terrain, per-cell chromatic blending with
  traffic-driven luminance, quarter-res bloom, faceted crystals, nest heartbeat, 24-frame ant sprite
  sheet, spore motes, vignette, and the touch ribbon/ripple/boundary layer.
* **World sizing** — the logical world is derived from the device aspect (height 1440, width
  clamped 560–1080) so the cover-fit camera never crops the nest or the nutrient groves on tall
  phones.
* **Audio** — optional generative WebAudio chimes (off by default; toggle in *World* tab).

---

## 5. Repository layout

```
app/                    React + TypeScript sandbox (Vite-free, esbuild)
  src/App.tsx           state machine, RAF loop, pointer choreography
  src/index.css         obsidian glass design system (tokens → materials → chrome)
  src/components/       TopHud · Cockpit · ParameterSheet · FieldGuideModal · GlassSlider · icons
  src/sim/              engine, renderer, math, types
  src/audio/            generative soundscape
  scripts/build.mjs     esbuild → www/ (classic IIFE + CSS, no ES modules: file:// safe)
  scripts/preview.mjs   zero-dep preview server (0.0.0.0:5173, auto-builds www/ if missing)
  scripts/smoke-live.mjs boots the page over HTTP in jsdom (served build, not disk)
  scripts/test-ui.mjs   28-check headless interaction suite (jsdom + stubbed Canvas2D)

android/                apktool project (no Gradle)
  AndroidManifest.xml   exported launcher activity, portrait, targetSdk 34, no permissions
  smali/                hand-tuned WebView activity (immersive sticky, keep-screen-on,
                        obsidian background, hardware acceleration)
  res/                  app name + five-density launcher icon
  signing/              sideload key/cert used by the v2 signer

tools/
  build-apk.sh          bundle → stage → apktool → sign
  fetch-toolchain.sh    provisioning (JDK via PyPI, apktool via npm, signing venv)
  sign_apk.py           APK Signature Scheme v2 signer (pure Python + cryptography)

dist/                   signed APK
build/                  intermediates (git-ignored)
```

---

## 6. Build from source

```bash
./tools/fetch-toolchain.sh     # JDK 17 (jdk4py wheel) + apktool (npm) + venv
./tools/build-apk.sh           # bundle, assemble, sign → dist/*.apk
```

Nothing else is required: the sandbox has no Android SDK, so the toolchain is assembled from
package mirrors that are reachable, and the APK is signed by `tools/sign_apk.py`, a small
implementation of the APK Signature Scheme v2 format (chunked-SHA256 content digest → length-prefixed
signed data → RSA-PKCS#1-v1.5 → signing-block insertion). The chunking semantics were validated
against a production-signed APK (`io.appium.settings`) and the output verifies with `apksigtool`.

Preview the exact bundle that ships in the APK:

```bash
cd app && npm install && npm run serve     # build + preview on 0.0.0.0:5173
```

Test the shipped bundle headlessly:

```bash
cd app && npm test        # 28/28 checks, ~2 s, self-terminating (watchdog-guarded)
cd app && npm run test:live   # 14/14 — boots the *served* page over HTTP
```

---

## 7. Verification performed

```
apksigtool verify dist/Ant-Colony-Scent-Painting.apk   →  v2 verified
aapt2 dump badging                                     →  com.app.antcolony, sdk 24→34,
                                                          label "Ant Colony", launchable
aapt2 dump xmltree                                     →  exported=true, portrait,
                                                          hardwareAccelerated, no permissions
apktool d (round trip)                                 →  3 classes, manifest, resources,
                                                          assets/www (index + bundle)
jsdom interaction suite                                →  28/28 behavioural checks
```

---

## 8. Source archives

* `ant-colony-sandbox-nov-9-2026-2-36-42-pm.zip` — the newer AI-Studio/Vite build; source of the
  simulation engine, renderer, soundscape and field-guide research copy.
* `bioluminescent-ant-colony-simulation.zip` — the earlier Next.js build; source of supporting
  scientific diagrams and parameter taxonomy.

Both remain in the repository as the original inputs; `app/` is the consolidated, mobile-first
implementation that the APK is built from.
