# Handoff: Ironhouse — 3D scroll-driven gym website
_Written 2026-08-17. Session ending: user approaching usage limit._

## Goal
Turn `E:\Team Website` (was a static team-page skeleton) into a 3D scroll-driven gym
website built around the user's video `Entering_modern_gym_through_doors_202608170020.mp4`.
Requirements as stated: video-triggered parallax scrolling, reception + workout space in
**horizontal** scrolling, and details that appear as you approach a zone — payment details
near reception, machine details near the workout areas. Latest instruction: **smooth
scrolling, and the complete website should be 3D-based** (not just one section).

## Current state
Fully built and running at `http://localhost:5173` via `npm run dev`. The site is a
WebGL (Three.js) gym interior that the whole page sits inside, with three scroll phases:
entry (video scrubbed by scroll, dissolving into the 3D interior), the floor (pinned
horizontal travel past 4 zones while the WebGL camera strafes in lockstep), and outro
(camera lifts off the floor). Verified programmatically — **not verified visually**, see
Gotchas.

## Completed
- [x] npm + Vite scaffold, `npm run dev` runs frontend + API together — `package.json`, `vite.config.js`
- [x] Video copied into project — `public/videos/gym-entry.mp4` (10s, 1920×1080, 12.4 MB)
- [x] Entry: scroll-scrubbed video, pinned, 420vh — verified 0→3.28→6.56→9.84→10s — `src/scroll-parallax.js`
- [x] Horizontal tour, 4 zones, pinned — verified full monotonic travel 0 → −3840px — `src/gym-tour.js`
- [x] Proximity reveals — verified each centred zone hits 100% / "In range" / all items visible
- [x] Content: Reception (membership tiers + payment methods), Strength floor, Cardio deck, Free weights — `index.html`
- [x] Three.js gym: floor grid, ceiling light strips, doorway, 4 equipment stations, fog/lights — `src/scene3d.js` (WebGL context verified live, no console errors)
- [x] All sections made transparent over the 3D scene; frosted panels for legibility — `styles.css`
- [x] Zone panels rotate in real 3D (`--ry`/`--tz`) driven by proximity
- [x] Smooth scroll deepened — Lenis `lerp: 0.075`, `wheelMultiplier: 0.9`, `syncTouch`
- [x] Reduced-motion fallback — verified: no WebGL, vertical stack, all panels open
- [x] README rewritten explaining all four mechanisms — `README.md`

## Remaining
- [ ] **Look at it in a real browser** — open `http://localhost:5173` and scroll. The 3D scene's *appearance* (lighting levels, station spacing, whether copy is legible over live geometry) was never seen; only measured. Most likely tuning: scrim opacity in `.zone::before`, and `STATION_GAP` / light intensity in `src/scene3d.js`.
- [ ] **Replace placeholder content** — pricing (₹300/day, ₹1,800/mo, ₹4,800/qtr, ₹16,000/yr) and machine counts/specs in `index.html` are invented.
- [ ] **Optional: re-encode video for smoother scrubbing** — `ffmpeg -i public/videos/gym-entry.mp4 -g 1 -c:v libx264 -crf 22 -an public/videos/gym-entry-scrub.mp4`, then update `src` in `index.html`. ffmpeg is **not installed** on this machine.
- [ ] **Nothing is committed to git** — all work is uncommitted on branch `add-viewport-meta-tag`. Note `index.html`/`styles.css`/`README.md` were *replaced*, so the old team-page content only exists in git history.
- [ ] Optional: mobile pass — horizontal pin + WebGL on small screens was never exercised.

## Key decisions
| Decision | Reason | Reversible? |
|---|---|---|
| Video scrubbed by scroll, not played | User asked for video-triggered parallax; scrubbing = user drives the camera move | Yes, cheap |
| CSS 3D depth layers **and** Three.js scene | User escalated to "complete website should be 3D-based"; WebGL provides the environment, CSS 3D the UI panels | Yes — scene is one module, `initScene` returns null → flat fallback |
| Perspective on the *pinned* stage, track moves inside | Makes browser 3D projection produce the parallax rather than JS faking speeds | No, structural |
| `containerAnimation` for proximity | Horizontally-moving elements can't be measured against the viewport normally; gives progress 0→1 with 0.5 = dead centre | No |
| Replaced team-page content entirely | User asked to "generate me a 3D scrolling website" | Yes, via git history |
| Procedural geometry, no GLTF assets | No asset pipeline, fast load, few draw calls | Yes |

## Constraints & preferences
- Anthropic API key must stay server-side; user adds it themselves to `.env` (never committed). I did not handle the real key.
- Repo `Kabin07/teampro` is **PUBLIC** — never commit `.env`.
- User wants smooth scrolling to be a felt quality, and the *whole* site 3D, not one section.

## Open questions / blockers
- Real pricing and equipment inventory — currently placeholder.
- Gym/brand name is invented ("Ironhouse"). User never specified one.
- Whether the optional Anthropic `/api/chat` backend should actually be used on the page (currently wired but unused).

## Environment & assets
- Project root: `E:\Team Website` (this is a normal local disk, not a resetting sandbox — files persist)
- Source video original: `E:\Imgs\Entering_modern_gym_through_doors_202608170020.mp4`
- Key files: `index.html`, `styles.css`, `src/main.js`, `src/scene3d.js`, `src/gym-tour.js`, `src/scroll-parallax.js`, `server/index.js`
- Stack: Vite 8, GSAP 3.15 (+ScrollTrigger), Lenis 1.3, Three 0.185, Express 5, @anthropic-ai/sdk
- Dev servers: Vite 5173, API 3001 (`npm run dev` runs both)

## Gotchas
- **`anticipatePin` breaks Lenis** — it made the page jitter *backwards* entering the tour pin. Removed deliberately in `src/gym-tour.js`; do not re-add.
- **`PORT` env var collides** with the preview harness (it injects `PORT=5173`). Backend reads `API_PORT` instead. Don't rename it back.
- **`npm init -y` left a duplicate `"type": "commonjs"`** key that silently overrode `"type": "module"`. Fixed; watch for it if regenerating package.json.
- **`window.scrollTo` does nothing** — Lenis owns scroll. Use `window.__lenis.scrollTo(y)` (exposed in dev only).
- **Testing artifact, not a bug:** when the Browser pane is hidden, rAF is paused → GSAP never ticks → the scrubbed track freezes while `scrollY` still changes, making proximity readings look wrong. Also, repeated *instant* `scrollTo` jumps inside a pin stall. Both disappear under real scrolling; full travel was proven with an animated scroll.
- Screenshots were impossible all session ("Browser pane is not displayed"), which is why visual verification is the top remaining item.

## Resume prompt
> Continuing work on the Ironhouse 3D gym website in `E:\Team Website` — see
> `HANDOFF-ironhouse-2026-08-17.md` in the project root for full context. Everything is
> built and running (`npm run dev` → http://localhost:5173). Next: I want to actually look
> at the 3D scene and tune how it renders — check the scrim opacity over the WebGL gym,
> the lighting, and whether the zone copy is readable over the live geometry. Don't
> re-add `anticipatePin`, and don't rename `API_PORT` back to `PORT`.
