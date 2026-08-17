# Project Summary — Ironhouse 3D Scroll-Driven Gym Site

_Last updated: 2026-08-17_

## 1. What this is

A single-page gym site structured as a **four-stop guided walk**, where scrolling
drives cinematic video scrubbing and a real 3D equipment viewer. Built to the
"Dark Industrial Luxury" design system supplied in `DESIGN.md` (Stitch export).

Repo: `Kabin07/teampro` (public) · Branch: `ironhouse-3d-gym-site`

## 2. The four stops

| # | Section | Media | Interaction |
|---|---|---|---|
| 01 | **Entrance** | `door-hallway-scrub.mp4` | Scroll scrubs the door opening down a dark hallway; **the lights come on as you scroll** — black grade lifts, amber wash rises, brightness ramps 0.35 → 1.05 |
| 02 | **Workspace** | `gym-lounge-scrub.mp4` | Camera moves through the lounge; three glass info panels hand off in sequence (The Floor → Recovery Lounge → Coaching on Call) |
| 03 | **Machines** | Live WebGL (no video) | Pick equipment from the sidebar, **view it in real 3D** — drag to rotate, auto-spins until you take over; spec sheet updates per machine |
| 04 | **Reception** | `desk-approach-scrub.mp4` | Camera approaches the desk; three billing tiers fade up (Daily / Monthly / Annual) |

A floating glass **pill nav** (Entrance · Workspace · Machines · Reception) tracks the
active section and smooth-scrolls to any stop.

## 3. Tech stack

| Layer | Library | Role |
|---|---|---|
| Build | Vite ^8.2 | Dev server + bundler |
| Smooth scroll | Lenis ^1.3 | Eased, interruptible scroll position |
| Scroll animation | GSAP + ScrollTrigger ^3.15 | Pinning, scrubbing, timelines |
| 3D | Three.js ^0.185 | Machine viewer (procedural models) |
| Backend (optional, unused) | Express + `@anthropic-ai/sdk` | `POST /api/chat` |

## 4. File map

```
index.html                 Four stops + pill nav + footer
styles.css                 Design-system tokens from DESIGN.md, all styling
src/main.js                Boot order + per-stop scroll orchestration + nav
src/scroll-parallax.js     Lenis, video buffering, initVideoScrub()
src/machine-viewer.js      Three.js equipment models + drag-to-rotate
public/videos/*.mp4        Three scrub-encoded clips
server/index.js            Optional Anthropic backend
```

## 5. Smooth scrolling & video scrubbing — requirements

### 5.1 The video pipeline (this is the "smoothness" answer)

Every clip is re-encoded before use:

```bash
ffmpeg -i <source>.mp4 -r 30 -g 1 -c:v libx264 -crf 22 -an <name>-scrub.mp4
```

- **`-g 1`** — every frame becomes a keyframe (all-intra). Seeking never has to
  decode forward from a distant keyframe, which is the single biggest cause of
  choppy scrubbing. Costs file size (~12MB → ~17MB) and is worth it.
- **`-r 30`** — 30fps. Source footage is 24fps, so ffmpeg duplicates frames to
  reach 30; this smooths perceived motion during a scrub.
- **`-an`** — drop audio; the videos are never played.

ffmpeg is installed via `winget install Gyan.FFmpeg`. Binary lives at
`~/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_*/ffmpeg-*/bin/ffmpeg.exe`
(not on PATH in Git Bash — call it by full path).

### 5.2 `scrub: 0.15` — the critical value

`initVideoScrub()` in `scroll-parallax.js` uses **`scrub: 0.15`**, not the default
or a heavier value. Reason: **Lenis already smooths raw wheel input.** Stacking
GSAP's own scrub smoothing on top compounds into visible lag — the video trails
behind the wheel. At 0.6 this was clearly perceptible; 0.15 absorbs jitter from
fast flicks without feeling delayed. Verified: an instant scroll jump reaches the
correct frame within one render tick.

Applies to all three scrubbed videos.

### 5.3 Other load-bearing constraints

1. **One clock.** `gsap.ticker.add(time => lenis.raf(time*1000))` plus
   `gsap.ticker.add(viewer.render)`. Separate rAF loops drift and judder.
2. **`lenis.on("scroll", ScrollTrigger.update)`** is mandatory — ScrollTrigger
   otherwise reads a stale `window.scrollY`.
3. **Never assign `video.currentTime` on raw scroll events.** Tween a proxy
   `{time}` object and write `currentTime` in `onUpdate`.
4. **Videos must be buffered before scrubbing.** `loadVideo()` waits for
   `canplaythrough` with a 20s timeout fallback. The entrance clip blocks the
   loader; the other two buffer in the background, then `ScrollTrigger.refresh()`.
5. **`window.scrollTo` does nothing** once Lenis is active — including anchor
   links. `initNav()` intercepts all `a[href^="#"]` clicks and calls
   `lenis.scrollTo(target)`. Dev builds expose `window.__lenis`.
6. **No `anticipatePin`** — it fights Lenis and jitters backwards on pin entry.
7. **Reduced motion is a structural branch**, checked *before* Lenis/ScrollTrigger
   init. Videos loop gently, panels are all visible, `body.no-motion` CSS
   un-pins and stacks everything.

### 5.4 Machine viewer (Stop 03)

Separate `WebGLRenderer` on its own canvas, independent of the scroll system.

- Four procedural models built from primitives — power rack, cable cross,
  treadmill, leg press — modelled against the user's reference photographs.
  No GLTF/asset loading; shared materials plus an emissive amber accent.
  Repeated detail (upright hole patterns, weight-stack plates) uses
  `InstancedMesh`, so ~120 holes cost one draw call.
- **Drag to rotate**: pointer events with `setPointerCapture`; vertical rotation
  clamped so models can't be flipped upside down.
- Auto-spins slowly until first drag, so the viewport reads as 3D without
  requiring interaction. The "Drag to rotate" hint hides after the first drag.
- `touch-action: pan-y` on the viewport so vertical page scroll still works on
  touch devices while horizontal drag rotates.

#### Framing requirements (the models must never look small or sunk)

These are hard requirements — an earlier hand-tuned `{scale, y-offset}` table
failed all three and left the machines tiny and half-buried in the floor:

| # | Requirement | How it's met |
|---|---|---|
| M1 | Model is **centred on the pivot origin** | `frameModel()` offsets by the bounding-box centre. The pivot spins about its own origin, so an off-centre model *orbits* out of shot instead of turning in place. |
| M2 | **Fully visible through a full 360°**, never clipped | Camera distance is fitted against the worst screen extent sampled across 16 rotations. Verified: max NDC ≤ 0.87 for all four (1.0 = frame edge). |
| M3 | **Fills the frame** — no tiny models | Fit converges on `FILL = 0.9`. Verified: 84–87% of frame height for all four. |
| M4 | **Never sunk into the floor** | Model sits centred; the floor disc is re-seated to `-halfHeight` per model so it meets the model's base exactly. |
| M5 | All machines read at **comparable scale** | Every model is normalised to the same nominal size (largest dimension → 6 units) before framing, so a treadmill and a power rack look proportionate. |
| M6 | Framing survives **viewport/aspect changes** | `frameCamera()` re-runs from `resize()`; horizontal fit depends on aspect. |

**Why the fit is iterative, not closed-form.** A closed-form bound has to assume
the worst corner and worst rotation angle coincide, which they rarely do — that
over-estimate left models filling only ~70% of the frame. Screen extent scales
almost exactly inversely with camera distance, so measuring the real projection
and multiplying by `worst / FILL` converges in two or three passes and lands on
the exact fill. Two effects the naive formula misses, both worth keeping in mind
if this is ever retuned:

1. The camera is **lifted** slightly, so the model's *bottom* is further from the
   view axis than its top — vertical reach is `halfHeight + lift`.
2. Perspective magnifies whatever is **nearest**. A spinning corner swings up to
   `halfWidth` closer to the camera than the centre, and that near face clips
   first — this alone accounted for a 38% under-estimate of the required
   distance.

`viewer.debug` (dev builds only, via `window.__viewer`) exposes the camera,
pivot and live metrics so framing can be verified by projecting real bounds
rather than reading back canvas pixels — `readPixels` is unreliable without
`preserveDrawingBuffer` and silently returns identical data for every model.

## 6. Verification status

**Verified programmatically** (DOM/measurement, this session):
- All 3 videos: `readyState 4`, correct durations (8s/10s/10s), no decode errors
- Entrance lighting reveal: grade 1 → 0.25, sweep 0 → 1, brightness 0.35 → 1.05,
  video scrubs 0 → 8s
- Workspace: video scrubs 0 → 8.67s, panels hand off (0.81/0 /0 → 0/0.95/0 → 0/0/1)
- Machines: all four swap correctly — active state, model, and specs
- Reception: video scrubs, cards fade 0.08 → 1
- Nav: active section tracks correctly through all four stops
- 3 pin spacers, WebGL viewer live, clean console on fresh load

**Not verified:** actual visual appearance. Screenshots have been unavailable the
entire project (Browser pane not displayed). Nobody has *looked* at this yet.

## 7. Known gaps / next steps

1. **Visual QA — top priority.** Open it and scroll. Likely tuning: grade/sweep
   opacity in the entrance reveal, info-panel timing on the workspace stop,
   machine model proportions and lighting in the viewer.
2. **Machine models are approximations.** Built from primitives to read correctly
   at a glance, not to match specific equipment. If you supply photos, they can be
   used as reference to refine proportions/colors — but a photo cannot be
   converted into a 3D model without photogrammetry software (not available here).
3. **Pricing is placeholder** (₹300/₹1,800/₹16,000). Machine specs likewise.
4. **No real-device/touch testing.** `syncTouch` and `touch-action` are configured
   but untested on hardware.
5. **Repo size** — five videos totaling ~76MB now live in git history.
   Consider Git LFS before this merges to `main`.
6. **Uncommitted.** This rebuild is not yet committed.

## 8. Running it

```bash
npm install
npm run dev        # Vite :5173, optional AI backend :3001
```

`window.__lenis.scrollTo(y)` in the console for scroll testing (dev only).
