# Handoff: Ironhouse — 3D scroll-driven gym website
_Updated 2026-08-17 (third session). Session ending: approaching usage limit._

## Goal
`E:\Team Website` — a four-stop, scroll-driven gym site built on the user's own
video footage and reference photos, following the Stitch "Dark Industrial Luxury"
design system. Stops: **Entrance** (doors open, lights come on as you scroll) →
**Workspace** (explore the floor) → **Machines** (pick equipment, view in real 3D)
→ **Reception** (billing). All reachable from a floating pill nav.

## Current state
Complete and running (`npm run dev` → http://localhost:5173). This session was
almost entirely **visual correction driven by the user's screenshots** — the first
real visual feedback the project has had. Three rounds of fixes to the machine
viewer: framing, then scale/sink, then materials and lighting.

## Completed this session
- [x] Reception overflow fixed — header clears nav, pay strip inside viewport
- [x] Pay methods re-laid out as one centred row (label + chips inline)
- [x] Footer shrunk 64px → 24px padding (height now ~73px)
- [x] **Horizontal overflow bug fixed** — see Gotchas, this clipped the hero title
- [x] Machine models rebuilt from reference photos (hole-punched uprights via InstancedMesh, multi-grip pull-up bar, plate pegs, weight stacks, chrome guide rods, console/rails/cowling, 45° sled)
- [x] **Auto-framing** replaced the hand-tuned scale/offset table — models were tiny and half-sunk. Verified: 81–86% frame fill, full 360° never clips.
- [x] **Materials + lighting overhaul** — models rendered as flat black silhouettes; see "The black-model fix" below. Verified: 4–6 distinct material values per model.
- [x] Leg press geometry repaired (had two overlapping footplates → read as broken)

## Remaining
- [ ] **Look at the machines again.** The material/lighting overhaul is verified only as "distinct values present, no errors" — nobody has seen the result. This is the direct continuation point.
- [ ] If still not photoreal enough: the next lever is adding subtle roughness/normal maps, or a floor with a real reflection (`MeshStandardMaterial` + low roughness plus a mirrored render). Materials are all in one block at the top of `src/machine-viewer.js`.
- [ ] Check whether the **Entrance is too dark** before scrolling (user selected `.light-sweep` at opacity 0 in the inspector earlier; opacity 0 at the top is intended — lights off — but the floor value may need lifting).
- [ ] **Replace placeholder content** — pricing (₹300/₹1,800/₹16,000) and machine specs are invented.
- [ ] **Nothing since the first push is committed.** Last push: branch `ironhouse-3d-gym-site`.
- [ ] Mobile/touch pass — never tested on real hardware.
- [ ] Repo size: 5 videos ≈ 76MB in git history. Consider Git LFS before merging to `main`.

## The black-model fix (most important thing to not undo)
The models rendered as near-black silhouettes despite plenty of lights. Cause:
**a metallic material is essentially a mirror — with no environment map it has
nothing to reflect and renders black regardless of how many lights you add.**
The fix, in `src/machine-viewer.js`:

1. `PMREMGenerator` + `RoomEnvironment` → `scene.environment`. This is what makes
   metal read as metal. Do not remove it.
2. `ACESFilmicToneMapping` + `toneMappingExposure ≈ 1.15`, so specular highlights
   roll off instead of clipping to flat white.
3. Materials lifted and **differentiated** — graphite frame `0x53565e`, lighter
   hardware `0x787d87`, bright chrome `0xdfe3e9`, rubber `0x25262b`. Everything
   was previously ~`0x1d1d21`, which is what flattened it into one silhouette.
4. The amber directional light was replaced with a **cool** counter-key
   (`0xa9c6ff`) plus a weak amber kicker. The strong amber light was what turned
   the floor into a mustard blob.
5. Floor is now an **unlit radial-gradient contact shadow** (canvas texture,
   `MeshBasicMaterial`, `transparent`, `depthWrite: false`) — a lit disc picked
   up the coloured rim light across its whole face.

## Machine framing rules (documented in PROJECT-SUMMARY.md §5.4, M1–M6)
- Model is **centred on the pivot origin** — otherwise it *orbits* the origin and
  swings out of shot instead of spinning in place.
- Camera distance is **fitted iteratively** by measuring the real projection over
  16 sample rotations and converging on `FILL = 0.9`. A closed-form bound is
  necessarily conservative and left models at ~70% fill.
- Two effects break the naive formula: the camera **lift** (bottom is further
  from the view axis than the top) and **perspective magnifying the nearest
  corner** as it spins — the latter alone was a 38% under-estimate.
- Floor disc is re-seated to `-halfHeight` per model, so models never sink.

## Key decisions
| Decision | Reason | Reversible? |
|---|---|---|
| Procedural 3D models, not photo-derived | A photo can't become a rotatable 3D model without photogrammetry (unavailable). Photos used as visual reference. | Yes |
| `scrub: 0.15` on all video scrubs | Lenis already smooths input; heavier scrub compounds into visible lag | Yes |
| `-g 1 -r 30` re-encode for every clip | All-intra = no forward decoding when seeking | Yes, re-run ffmpeg |
| Environment-map-based shading | Only way metals read correctly; lights alone cannot fix it | No — would undo the fix |
| Iterative camera fit over closed-form | Exact fill, no magic constants, survives aspect changes | Yes |

## Environment & assets
- Project root: `E:\Team Website` (persistent local disk)
- Source videos `E:\Imgs\*.mp4`; design export at `E:\Imgs\stitch_extracted\...\ironhouse\DESIGN.md`
- **ffmpeg installed via winget, NOT on PATH in Git Bash.** Full path:
  `/c/Users/Kabin Mukesh R/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-9.0-full_build/bin/ffmpeg.exe`
- Key files: `index.html`, `styles.css`, `src/main.js`, `src/machine-viewer.js`, `src/scroll-parallax.js`
- Stack: Vite 8, GSAP 3.15 + ScrollTrigger, Lenis 1.3, Three 0.185

## Gotchas
- **Horizontal-overflow bug (fixed — don't regress).** ScrollTrigger bakes a fixed
  pixel width into the pin-spacer *and* the pinned element. After a resize those
  go stale and `overflow-x: hidden` clips the hero (this is why the title showed
  as "IRONHOU"). `ScrollTrigger.refresh()` on resize did **not** fix it. The
  working fix is `width: 100% !important` on `.pin-spacer` and `.stop-stage`.
- **`anticipatePin` breaks Lenis** — jitters backwards on pin entry. Never re-add.
- **`API_PORT`, not `PORT`** — the preview harness injects `PORT=5173`.
- **`window.scrollTo` does nothing** — Lenis owns scroll. Use `window.__lenis.scrollTo(y)`.
  Dev globals: `window.__lenis`, `window.__viewer` (the latter exposes
  `debug.camera/pivot/getMetrics` for framing checks).
- **Don't verify 3D with `readPixels`** — without `preserveDrawingBuffer` it
  silently returns identical data for every model. Project real geometry through
  the camera instead (see the verification snippets used this session).
- **rAF pauses when the Browser pane is hidden** → GSAP stops ticking, scrubbed
  values freeze while `scrollY` still moves. Readings look wrong but aren't.
- **`ERR_NAME_NOT_RESOLVED` in this sandbox is just Google Fonts** — no external
  network here. Fine on a real machine.
- Console may show a stale `initEntryCopy` export error from an old HMR state;
  fresh loads boot clean.

## Resume prompt
> Continuing the Ironhouse 3D gym site in `E:\Team Website` — see
> `HANDOFF-ironhouse-2026-08-17.md` and `PROJECT-SUMMARY.md` (§5.4 has the machine
> framing rules). Runs with `npm run dev` → http://localhost:5173. I just overhauled
> the machine viewer's materials and lighting so the models stop looking like flat
> black toys — I want to look at the result on the Machines stop and keep tuning
> realism. Don't remove the PMREM/RoomEnvironment environment map (metals render
> black without it), don't re-add `anticipatePin`, don't rename `API_PORT`, and keep
> `width: 100% !important` on `.pin-spacer`/`.stop-stage`.
