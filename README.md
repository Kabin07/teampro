# Ironhouse — scroll-driven gym tour

A 3D-feel, scroll-driven site: you scrub a video walking in through the front doors,
then travel sideways across the floor, and each zone opens its details as you get near it.

## Files

- `index.html` — page structure (entry sequence, four tour zones, join section)
- `styles.css` — all styling, including the CSS 3D depth layers and reduced-motion fallback
- `src/main.js` — entry point; loads the video, then wires the two scroll systems
- `src/scroll-parallax.js` — Lenis smooth scroll, video buffering, scroll-scrubbed video playback
- `src/gym-tour.js` — horizontal travel + the per-zone proximity mechanic
- `public/videos/gym-entry.mp4` — the entry clip
- `server/index.js` — optional Express backend that calls the Anthropic API (see *AI backend* below)

## Setup

```bash
npm install
```

```bash
npm run dev
```

Open `http://localhost:5173`.

## How it works

### 1. Entry — scroll-scrubbed video

The entry section is `420vh` tall and its stage is pinned. The video is never played:
its `currentTime` is driven directly from scroll position, so scrolling scrubs the
camera move through the doors. Scrubbing runs through a GSAP tween rather than
assigning `currentTime` on every scroll event, which lets GSAP smooth the seeking and
hides most of the stutter a normal web-encoded MP4 produces.

The page holds a loader until the clip is buffered enough to seek, because a scrubbed
video that isn't loaded just shows a frozen first frame.

**For noticeably smoother scrubbing**, re-encode with every frame a keyframe — seeking
then never has to decode forward from a distant keyframe:

```bash
ffmpeg -i public/videos/gym-entry.mp4 -g 1 -c:v libx264 -crf 22 -an public/videos/gym-entry-scrub.mp4
```

That trades file size for seek accuracy. Point the `src` in `index.html` at the new file.

### 2. The floor — horizontal travel

`#tour` is pinned and vertical scroll is converted into horizontal movement of the
track, so the four zones travel past sideways. Scroll distance is derived from the
track's real width, so adding a fifth zone needs no constant updated anywhere.

### 3. Depth — the 3D

Perspective sits on the *pinned* stage while the track moves inside it, so background
layers at negative `translateZ` genuinely parallax as zones slide past — the browser's
3D projection does the work rather than JS moving layers at different speeds. Each layer
is counter-scaled (`scale = (perspective + |z|) / perspective`) so it reads at its
intended size while still sitting further back.

### 4. Proximity — details open as you approach

Elements moving horizontally can't be measured against the viewport normally, so each
zone's trigger binds to the horizontal tween via ScrollTrigger's `containerAnimation`.
Progress then runs 0 → 1 as the zone crosses the screen, putting it dead-centre at
exactly `0.5`. Distance from that midpoint is the proximity signal that drives the
meter, the "Approaching → In range" tag, and the staggered reveal:

- **Reception** → membership tiers and accepted payment methods
- **Strength floor**, **Cardio deck**, **Free weights** → machine counts and specs

Tuning lives at the top of `src/gym-tour.js` (`NEAR_START`, `NEAR_RANGE`, `IN_RANGE_AT`).

### Accessibility

Visitors with `prefers-reduced-motion: reduce` get the same content as a plain vertical
page — no pinning, no scrubbing, every detail panel already open, depth layers off.

## Editing content

Zones are plain markup in `index.html`. To add one, copy an `<article class="zone">`
block, give it a `data-zone-name`, and add a `<li>` to `.hud-dots`. The JS picks it up
and the scroll distance adjusts automatically. Pricing and machine specs are placeholder
content — swap in your real numbers.

## AI backend (optional, unused by the tour)

`server/index.js` exposes `POST /api/chat` (`{ messages }` → `{ reply }`) backed by the
Anthropic SDK, with `src/ai-client.js` as the browser-side helper. It's wired for
things like an "ask about membership" assistant but nothing on the page calls it yet.

```bash
cp .env.example .env   # then add ANTHROPIC_API_KEY
```

`npm run dev` runs it alongside Vite on port 3001. The API key stays server-side —
never call the Anthropic API directly from the browser. `.env` is gitignored.
