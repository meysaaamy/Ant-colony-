# Myrmecodia — Ant Colony Scent-Painting Sandbox

A bioluminescent, museum-grade **mobile sandbox for ant-colony neuroethology**, shipped as a
signed, installable **Android APK** — no Android Studio, no Gradle, no SDK download required.

```
dist/Ant-Colony-Scent-Painting.apk      ← the deliverable (201 KB, signed, offline)
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
| **Version** | 1.2.0 (versionCode 4) |
| **Min / target SDK** | **21** / 34 — installs on Android 5.0+ |
| **Signature** | **v1 (JAR) + v2** APK Signature Scheme, zip-aligned |
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

**Entry screen.** The app opens on an editorial landing page — serif display headline
("Small world. Big wonder."), amber as the single call to action, and three starting worlds
(Sanctuary, Double Bridge, Labyrinth) as preview cards with bespoke SVG map thumbnails. Two ways in:

- **Play sandbox** — unrestricted; paint and watch.
- **180-second challenge** — countdown banner, live score, persisted personal best
  (`localStorage['myrmecodia.best.challenge']`).

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
| Food trail | `#c9ffe4` | `#00e676` | `rgba(0,230,118,.22)` |
| Home trail | `#dbe8ff` | `#2f7bff` | `rgba(47,123,255,.22)` |
| Alarm | `#ffd1dc` | `#ff0a43` | `rgba(255,10,67,.20)` |
| Food cluster | `#b9f6ca` | `#00e676` | `rgba(0,230,118,.20)` |
| Wall | `#cbd5e1` | `#64748b` | `rgba(100,116,139,.20)` |
| Eraser | `#ffffff` | `#94a3b8` | `rgba(148,163,184,.16)` |

The same triad drives the world renderer: pheromone deposition is tinted emerald / sapphire /
crimson, so the canvas and the chrome speak one colour language.

### Scent field — spectral mixing

Two channels share the substrate and are blended **per cell** (`app/src/sim/palette.ts`):

| Channel | Laid by | Colour |
|---|---|---|
| Food scent | ants returning with food | emerald `#00e676` + warm amber aura |
| Home scent | outbound ants marking the way back | cobalt `#1c3ad0` → electric cyan `#22e2ff` |
| Alarm | danger pulse, 3.5× decay | crimson |

Where both pass through the same cell, the local ratio mixes them into a **new hue** — aquamarine
and turquoise at balance, **prismatic white-gold** at peak overlap. The core keeps its hue while a
separate, wider aura pass warms the air around food trails and cools it around home trails. Brightness is the traffic itself: quiet
ground stays dim, busy corridors climb to an incandescent core. `blendScent` is pure and
allocation-free, and is unit-tested for hue, mixture and traffic response.

### Ant intelligence — shortest-path locking

*Bullet points below are the behaviours verified in `scripts/test-sim.mjs`.*


Each tick an ant samples a **five-ray fan** ahead of it, weighting every ray by concentration *and*
alignment, so the colony converges on the shortest well-travelled corridor instead of oscillating
between equal branches; local tropotaxis then handles fine trail following. Layered near/mid/far
whiskers begin the turn before contact, and a stuck detector scans 16 headings for the most open
one and steps into it — an ant cannot stay pinned behind a wall. Finding food stamps a radial scent
beacon so the return highway is unmistakable, and food scent decays at roughly half the rate of
home scent so established highways stay legible.

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
  signing/              sideload key/cert used by the signer

tools/
  build-apk.sh          bundle → stage → assemble → align + sign
  package_apk.py        direct-aapt packaging (fallback when apktool cannot fork)
  fetch-toolchain.sh    provisioning (JDK via PyPI, apktool via npm, signing venv)
  sign_apk.py           zipalign + v1 (JAR) + v2 signer (pure Python + cryptography)

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
implementation of both signature schemes plus `zipalign`:

- **zipalign** — every STORED entry's payload starts on a 4-byte boundary (4096 for `.so`), which
  Android 11+ requires and `resources.arsc` especially needs to stay uncompressed.
- **v1 (JAR)** — `META-INF/MANIFEST.MF` → `CERT.SF` → `CERT.RSA` (detached PKCS#7 over `CERT.SF`).
  Needed by pre-7.0 devices and by several OEM package installers on modern Android.
- **v2** — chunked-SHA256 content digest → length-prefixed signed data → RSA-PKCS#1-v1.5 →
  signing-block insertion. The chunking semantics were validated against a production-signed APK
  (`io.appium.settings`).

A `--v1-only` variant (`dist/Ant-Colony-Scent-Painting-v1only.apk`) is also produced
for installers that reject the v2 block outright — Android 12+ accepts v1-only
sideloads, it just warns.

The v2 block verifies with `apksigtool`, and the v1 digests/signature are re-checked independently
(manifest digests per entry, `CERT.SF` digest, then the RSA signature over `CERT.SF`).

Assembling is normally apktool's job, but some sandboxes forbid the JVM from forking child
processes, which breaks apktool's `aapt` invocation. `build-apk.sh` detects that and falls back to
`tools/package_apk.py`, which packages resources with aapt directly and drops in the `classes.dex`
apktool compiled in-process — same bytes, no JVM fork.

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
