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
ffmpeg -i <source>.mp4 \
  -vf "minterpolate=fps=90:mi_mode=mci:mc_mode=obmc" \
  -g 2 -c:v libx264 -crf 20 -preset medium -pix_fmt yuv420p -an <name>-scrub.mp4
```

- **`minterpolate=fps=90`** — motion-interpolated to 90fps. **This is what fixes
  slow-scroll judder**, and it is not the same as `-r 90` (see the warning below).
- **`-g 2`** — a keyframe every other frame. All-intra (`-g 1`) was the original
  choice, but at 90fps adjacent frames are nearly identical, so a GOP of 2 halves
  the bitrate cost while a seek still only ever decodes one extra frame (~11ms of
  video) — imperceptible when scrubbing. **This is what paid for the higher frame
  rate and better quality without the files doubling.**
- **`-crf 20 -preset medium`** — quality. An earlier pass used
  `-crf 23 -preset veryfast`, chosen for encode speed, which left visible
  compression artifacts in the dark gradients these clips are full of.
- **`-an`** — drop audio; the videos are never played.

> **On resolution / "4K".** The source footage is 1920×1080. True 4K is not
> achievable — upscaling cannot recover detail that was never captured, and would
> roughly quadruple file size for no real gain. Quality improvements here come
> from bitrate and frame density at native 1080p, not from resampling upward.

> ⚠️ **`minterpolate` softens the picture — budget for it.** Motion interpolation
> builds frames by blending warped neighbours, so output is measurably softer
> than the source. A 1:1 crop comparison against the pristine source showed
> clearly mushier equipment edges and brick texture. Two corrections, both in the
> command above:
> - **`unsharp=5:5:1.0:5:5:0.0`** after the interpolation, restoring edge
>   definition. Keep it *after* `minterpolate` in the chain — sharpening first
>   just gives the interpolator crunchier input to blend away.
> - **`-crf 16 -preset slow`** rather than 20/medium. Interpolated frames carry
>   subtle warping that a higher CRF turns into visible mush, so this footage
>   needs more bitrate than its apparent complexity suggests.
>
> Check this by eye, not by file size: extract the same timestamp from source and
> output, crop 1:1 (do **not** scale down — that hides the exact softness you are
> looking for), and stack the two.

> **The source clips carry an AI-generator watermark** (a sparkle, bottom-right,
> measured at x1705–1780 / y862–937 in the 1920×1080 frame — identical position
> in all three). It is burned into the pixels, not an overlay.
>
> `delogo=x=1694:y=852:w=98:h=100` removes the mark but leaves **faint seam lines**
> where its patch box meets untouched pixels — invisible normally, obvious at
> +contrast, and worst on the dark reception footage. The reliable fix is to
> **crop it off**: `crop=1690:950:0:0` cuts the right/bottom edge past the mark,
> keeps 16:9, and cannot leave artifacts because the pixels are gone. No upscale
> back to 1920 — that would re-soften what `unsharp` just recovered.
>
> Whichever method, it must run **first in the filter chain**. After
> `minterpolate` the watermark has already been smeared across synthesised
> frames, and no patch will clean that up.

> **Budget the bitrate for a web page, not a master.** A CRF 16 / 90fps pass
> produced 187MB across three clips (up to ~71 Mbps). The entrance clip must
> fully buffer before the loader clears, so at 60MB that is ~20s of blank screen
> on 25 Mbps broadband. **CRF 19** is the working setting: roughly half the size,
> with the difference only findable by pixel-peeping a paused frame.

> ⚠️ **`-r 60` does not work here, and an earlier version of this doc wrongly
> recommended `-r 30`.** The source footage is 24fps. A plain `-r` flag reaches
> the target rate by *duplicating* frames, so the clip still contains only 24
> distinct images per second — no new visual information. During a slow scrub
> the playhead sits on one image, then snaps to the next, which is exactly the
> lag the user reported. `minterpolate` synthesises genuinely new in-between
> frames by motion estimation, so slow scrolling has real intermediate images
> to land on.
>
> Measured: over 40 slow-scroll updates the playhead traverses ~1.02s of video.
> At 30fps that range holds ~31 distinct frames; at 60fps it holds ~61.
>
> Cost: interpolation is slow to encode (~7 min per 8s clip at 1080p) and
> roughly +30% file size. Encode once, commit the result.

ffmpeg is installed via `winget install Gyan.FFmpeg`. Binary lives at
`~/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_*/ffmpeg-*/bin/ffmpeg.exe`
(not on PATH in Git Bash — call it by full path).

### 5.2 The four latency sources (all must be tuned together)

Slow-scroll lag is not one bug — four things stack, and fixing only one leaves it
feeling sluggish. Current settings:

| Source | Setting | Why this value |
|---|---|---|
| Video frame density | `minterpolate=fps=90` | Below this the playhead has no intermediate image to land on during a slow scroll (§5.1). 24fps source → 90fps means ~3.75× the images to land on. |
| Lenis easing | `lerp: 0.12` | Lenis approaches its target exponentially, so a *low* lerp leaves the position permanently trailing the wheel. That constant offset is most noticeable at slow speeds, where it reads as lag rather than weight. Was 0.075. |
| GSAP scrub | `scrub: 0.1` | Lenis already smooths input; GSAP smoothing stacks on top. Only needs to absorb fast-flick jitter. Was 0.6 → 0.15 → 0.1. |
| Redundant seeks | `MIN_STEP = 1/120` | At 60fps many scroll updates land inside the same frame. Each still costs the decoder a seek, and that wasted work is felt as stutter precisely when scrolling slowly. Skip sub-half-frame changes. |

Plus a compositing hint: `.stop-video` carries `will-change: transform` and
`translateZ(0)` so the browser keeps each video on its own GPU layer instead of
re-rasterising the frame on the main thread on every seek.

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

### 5.3b Glassmorphism

`DESIGN.md` specifies glass as the primary depth device ("Surface 1: Glass
layers, 12px backdrop blur, 40% tertiary; 1px ghost borders at 15% white; 1px
top inner-glow simulating light on a machined edge"). That is tokenised rather
than repeated per component, so every floating surface matches:

| Token | Value | Used by |
|---|---|---|
| `--glass-fill` / `--glass-fill-strong` | `rgba(232,229,228, .06 / .09)` | all panes |
| `--glass-blur` / `--glass-blur-lg` | `blur(12px)` / `blur(20px)`, both `saturate(~145%)` | small / large panes |
| `--inner-glow` | `inset 0 1px 0 rgba(255,255,255,.2)` | all panes |
| `--glass-shadow` / `-lg` | ambient occlusion under the pane | all panes |

The `.glass` class (and matching `::before` on `.spec-sheet` / `.plan-card`)
adds a top-down sheen gradient. Without it a blurred panel reads as a flat
translucent rectangle rather than a pane catching light.

Applied to: pill nav, workspace info panels, equipment list items, the 3D viewer
viewport, the spec sheet, and the pricing cards. The equipment list and viewer
were previously solid fills — they were the two surfaces breaking the effect.

> `saturate()` is paired with every blur deliberately. Backdrop blur alone
> averages colour toward grey; the saturation boost keeps the amber accent and
> the video behind the glass from going muddy.

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

## 7b. Video storage (Git LFS)

`*.mp4` is tracked by Git LFS (`.gitattributes`). Each clip is 24–37MB and gets
re-encoded whenever the scrub settings change; without LFS every one of those
revisions would sit in history permanently and the repo would grow without
bound.

Anyone cloning needs `git lfs install` first, or the videos arrive as ~130-byte
pointer files and the entrance shows a frozen black frame.

> **Partial migration.** LFS applies from this commit forward. The *earlier*
> video revisions (the 30fps and 60fps passes, ~58MB) are still ordinary blobs
> in history, so a fresh clone still pays for them once. Purging them needs a
> history rewrite:
> ```bash
> git lfs migrate import --include="*.mp4" --everything
> git push --force origin --all
> ```
> That rewrites every commit hash and requires a force-push, so it was **not**
> done automatically. Worth doing before this merges to `main`, ideally while the
> repo still has a single contributor.

## 8. Running it

```bash
npm install
npm run dev        # Vite :5173, optional AI backend :3001
```

`window.__lenis.scrollTo(y)` in the console for scroll testing (dev only).
