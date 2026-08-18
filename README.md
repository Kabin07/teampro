# Ironhouse — the private sanctuary

A four-stop, scroll-driven gym site: you scrub through the front doors as the
lights come on, explore the floor, pick equipment and view it in real 3D, then
land on membership billing at reception. Built to the "Dark Industrial Luxury"
design system in `E:\Imgs\stitch_extracted\...\ironhouse\DESIGN.md`.

See `PROJECT-SUMMARY.md` for full technical detail and `HANDOFF-*.md` for the
current state of unfinished work.

## Files

- `index.html` — the four stops (Entrance, Workspace, Machines, Reception) + pill nav
- `styles.css` — design-system tokens (amber `#ffbf00` on charcoal `#121414`), all styling
- `src/main.js` — boot order, per-stop scroll orchestration, nav active-state
- `src/scroll-parallax.js` — Lenis smooth scroll, video buffering, scroll-scrubbed video
- `src/machine-viewer.js` — the 3D equipment viewer (procedural models, drag-to-rotate)
- `public/videos/*.mp4` — the three scrub-encoded clips
- `server/index.js` — optional Express + Anthropic backend (`POST /api/chat`), unused by the page

## Setup

```bash
npm install
npm run dev
```

Open `http://localhost:5173`. `window.__lenis` and `window.__viewer` are exposed
in dev builds for console-driven testing.

## How it works

### The four stops

| Stop | Video | What happens |
|---|---|---|
| **Entrance** | `door-hallway-scrub.mp4` | Scroll scrubs the door opening; the lights come on as you scroll — a black grade lifts and an amber wash rises |
| **Workspace** | `gym-lounge-scrub.mp4` | Camera moves through the floor; three glass info panels hand off in sequence |
| **Machines** | none — live WebGL | Pick equipment from the sidebar, drag to rotate a real 3D model, spec sheet updates |
| **Reception** | `desk-approach-scrub.mp4` | Camera approaches the desk; three billing tiers fade up |

### Video scrubbing

Each video is never played — `currentTime` is driven directly from scroll
position through a GSAP proxy tween (`initVideoScrub` in `scroll-parallax.js`),
using **`scrub: 0.15`**. That value matters: Lenis already smooths raw scroll
input, so a heavier scrub value compounds into visible lag between the wheel
and the video.

Every clip is re-encoded before use so scrubbing doesn't stutter:

```bash
ffmpeg -i <source>.mp4 \
  -vf "minterpolate=fps=60:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1" \
  -g 1 -c:v libx264 -crf 23 -pix_fmt yuv420p -an <name>-scrub.mp4
```

`-g 1` makes every frame a keyframe, so seeking never decodes forward from a
distant one. `minterpolate` is the part that fixes *slow*-scroll judder — the
source footage is 24fps, and a plain `-r 60` would only duplicate frames, giving
the playhead no new images to land on between them. Motion interpolation
synthesises real in-betweens instead. Slow to encode (~7 min per 8s clip) and
~30% larger; do it once and commit the result.

### The 3D machine viewer

A separate `WebGLRenderer`, independent of the page's scroll system. Four
procedural models (power rack, cable cross, treadmill, leg press) built from
primitives and matched against reference photos — no asset loading. Camera
framing is fitted automatically per model (see `PROJECT-SUMMARY.md` §5.4) so
every machine fills the frame and survives a full 360° drag without clipping.
Materials use a baked environment map (`PMREMGenerator` + `RoomEnvironment`) —
without it, metallic materials render flat black regardless of lighting.

### Accessibility

`prefers-reduced-motion: reduce` gets a plain vertical page: no pinning, no
scrubbing, no WebGL, every panel already open.

## AI backend (optional, unused by the page)

`server/index.js` exposes `POST /api/chat` backed by the Anthropic SDK, with
`src/ai-client.js` as the browser-side helper — wired but not called from
anywhere on the page yet.

```bash
cp .env.example .env   # then add ANTHROPIC_API_KEY
```

`npm run dev` runs it alongside Vite on port 3001 (`API_PORT`, not `PORT` —
this environment's preview harness injects `PORT`). The key stays
server-side; `.env` is gitignored.
