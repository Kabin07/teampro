# Handoff: Ironhouse — 3D scroll-driven gym website
_Written 2026-08-18. Session ending: approaching usage limit._

## Goal
`E:\Team Website` — a four-stop, scroll-driven gym site built on the user's own
video footage and a supplied Stitch design system ("Dark Industrial Luxury").
Stops: **Entrance** (door opens, lights come up as you scroll) → **Workspace**
(explore the floor) → **Machines** (pick equipment, view in real 3D) →
**Reception** (billing). Floating pill nav ties them together.

## Current state
Built, running, and pushed. Runs at `http://localhost:5173` via `npm run dev`.
The last two rounds were visual correction driven by the user's screenshots.

**One encode is mid-flight and unfinished** (see Remaining #1) — the workspace
video is being re-encoded at higher quality. Everything else is committed and
pushed to branch `ironhouse-3d-gym-site` (last commit `56b4b4e`).

## Completed
- [x] Four-stop site: entrance / workspace / machines / reception + pill nav — `index.html`
- [x] Design system from `DESIGN.md` (amber `#ffbf00` on charcoal `#121414`) — `styles.css`
- [x] Video scrubbing at 90fps, `scrub: 0.1`, Lenis `lerp: 0.12` — `src/scroll-parallax.js`
- [x] 3D machine viewer, 4 procedural models, drag-to-rotate, auto-framed — `src/machine-viewer.js`
- [x] Glassmorphism tokenised and applied to all 6 floating surfaces — `styles.css`
- [x] Git LFS configured for `*.mp4` — pushed, 91MB of LFS objects uploaded
- [x] **Entrance door-opening restored** (uncommitted, verified in browser) — see below
- [x] Docs: `README.md`, `PROJECT-SUMMARY.md`, previous handoff

## Remaining
- [ ] **1. Finish the workspace HQ re-encode.** An ffmpeg job was running at
  session end producing `public/videos/_hq-lounge.mp4` (~18MB and climbing;
  expect ~35–45MB). When ffmpeg exits:
  ```bash
  cd "E:/Team Website"
  mv -f public/videos/_hq-lounge.mp4 public/videos/gym-lounge-scrub.mp4
  ```
  Then reload and confirm it looks sharper. If the job died, re-run:
  ```bash
  FFMPEG="/c/Users/Kabin Mukesh R/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-9.0-full_build/bin/ffmpeg.exe"
  "$FFMPEG" -y -i "E:/Imgs/Camera_moving_through_gym_lounge_202608171035.mp4" \
    -vf "minterpolate=fps=90:mi_mode=mci:mc_mode=obmc,unsharp=5:5:1.0:5:5:0.0" \
    -g 2 -c:v libx264 -crf 16 -preset slow -pix_fmt yuv420p -an \
    public/videos/gym-lounge-scrub.mp4
  ```
- [ ] **2. Re-encode the other two clips with the same HQ settings** — the
  entrance (`Black_steel_door_opens_hallway_202608171011.mp4`) and reception
  (`Camera_approaches_black_steel_desk_202608171035.mp4`) sources are in
  `E:\Imgs\`. They still use the older softer settings (`-crf 20`, no `unsharp`),
  so the site is currently inconsistent. ~6–8 min each.
- [ ] **3. Commit + push everything.** Uncommitted right now: the entrance
  door-opening retiming (`src/main.js`), the `minterpolate`-softening note in
  `PROJECT-SUMMARY.md`, and the re-encoded videos.
- [ ] **4. Replace placeholder content** — pricing (₹300 / ₹1,800 / ₹16,000) and
  machine specs in `index.html` are invented.
- [ ] **5. Machine models never visually reviewed** since the materials overhaul.
- [ ] **6. Consider full LFS history migration** — see Gotchas.
- [ ] **7. Mobile/touch pass** — never tested on real hardware.

## Key decisions
| Decision | Reason | Reversible? |
|---|---|---|
| Rejected the user's newer 720p lounge video | It is **lower** quality than the existing source (1280×720 @1.9Mbps vs 1920×1080 @6.6Mbps), same scene. Using it would make the workspace softer, not sharper. | Yes |
| `minterpolate` + `unsharp` + CRF 16 | Interpolation genuinely softens the image (verified by 1:1 crop comparison). Sharpening after interpolation and more bitrate restores it. | Yes |
| 90fps interpolation, GOP 2 | 24fps source has too few frames for slow scrubbing; GOP 2 halved the bitrate cost that paid for it | Yes |
| Procedural 3D models, not photo-derived | A photo cannot become a rotatable 3D model without photogrammetry | Yes |
| Git LFS for `*.mp4` | 24–37MB per clip, re-encoded often; every revision would otherwise live in history forever | Yes |
| Entrance blackout softened to 0.42, clearing by 5% | The full blackout hid the door opening entirely — the door is only on screen for the first ~12% of scroll | Yes |

## Constraints & preferences
- **"i want this exact quality"** — the user judges by eye, and has been right
  every time even when the technical numbers pointed elsewhere. Verify visually
  (extract frames, crop 1:1, stack) rather than trusting bitrate/resolution.
- **"the initial one was nice"** re: the door opening — the door-opening shot is
  the hero moment of the entrance. Do not bury it under grading again.
- Repo `Kabin07/teampro` is **public**. API key stays server-side; `.env` gitignored.
- Design must follow the supplied `DESIGN.md` tokens.

## Open questions / blockers
- Does the user want the entrance/reception clips re-encoded to match the
  workspace (Remaining #2)? Offered at session end, no answer yet.
- True 4K is impossible from the current 1080p sources. If the user wants it,
  they must regenerate the source clips at 4K — told them this explicitly.

## Environment & assets
- Project root: `E:\Team Website` — persistent local disk, **not** a resetting sandbox
- Source videos: `E:\Imgs\*.mp4`. Design export: `E:\Imgs\stitch_extracted\...\ironhouse\DESIGN.md`
- User's rejected 720p file: `C:\Users\Kabin Mukesh R\Downloads\Camera_moving_through_gym_lounge_202608181955.mp4`
- **ffmpeg is installed (winget) but NOT on PATH in Git Bash.** Full path:
  `/c/Users/Kabin Mukesh R/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-9.0-full_build/bin/ffmpeg.exe`
  (`ffprobe.exe` sits beside it.)
- Stack: Vite 8, GSAP 3.15 + ScrollTrigger, Lenis 1.3, Three 0.185
- Dev globals (dev builds only): `window.__lenis`, `window.__viewer`

## Gotchas
- **`npm run dev` must be running** or the site simply won't open — this is what
  "I can't open it" meant last time, nothing was broken. Server dies when its
  shell exits. If 5173 is taken it silently moves to 5174.
- **ScrollTrigger bakes stale pixel widths into pinned elements on resize**,
  which clipped the hero title. Fixed with `width: 100% !important` on
  `.pin-spacer` and `.stop-stage`. `ScrollTrigger.refresh()` did *not* fix it.
  **Do not remove.**
- **`anticipatePin` breaks Lenis** — jitters backwards entering a pin. Never re-add.
- **Metallic materials render flat black without an environment map.** The machine
  viewer's `PMREMGenerator` + `RoomEnvironment` is load-bearing — do not remove.
- **`API_PORT`, not `PORT`** — the preview harness injects `PORT=5173`.
- **`window.scrollTo` does nothing** — Lenis owns scroll. Use `window.__lenis.scrollTo(y)`.
- **Don't verify 3D with `readPixels`** — without `preserveDrawingBuffer` it
  silently returns identical data for every model. Project geometry through the
  camera instead.
- **Don't verify sharpness on a downscaled screenshot** — scaling hides exactly
  the softness you're checking. Crop 1:1.
- **rAF pauses when the Browser pane is hidden** → GSAP stops ticking and scrubbed
  values freeze while `scrollY` still moves. Readings look wrong but aren't.
- **LFS migration is partial** — it applies from `56b4b4e` forward. The earlier
  30/60fps revisions (~58MB) are still ordinary blobs in history. Purging needs
  `git lfs migrate import --include="*.mp4" --everything` + a force-push; not done
  unilaterally. Best done before merging to `main`.
- Anyone cloning needs `git lfs install` first or videos arrive as ~130-byte stubs.
- Console shows `ERR_NAME_NOT_RESOLVED` for Google Fonts in the sandbox only (no
  external network there) — fine on a real machine.

## Resume prompt
> Continuing the Ironhouse 3D gym site in `E:\Team Website`. Read
> `HANDOFF-ironhouse-2026-08-18.md` and `PROJECT-SUMMARY.md` in the project root
> first. Start `npm run dev` (site at http://localhost:5173).
>
> First job: an ffmpeg re-encode of the workspace video was still running when the
> last session ended — check whether `public/videos/_hq-lounge.mp4` finished, and
> if so move it over `public/videos/gym-lounge-scrub.mp4`. Then re-encode the
> entrance and reception clips with the same high-quality settings so all three
> match, and commit + push everything (the entrance door-opening fix is
> uncommitted).
>
> Don't re-add `anticipatePin`, don't remove the PMREM/RoomEnvironment env map or
> the `width: 100% !important` on `.pin-spacer`/`.stop-stage`, and don't swap in
> the 720p lounge video from my Downloads folder — it's lower quality than the
> source we're already using.
