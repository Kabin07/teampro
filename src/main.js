import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { initSmoothScroll, loadVideo, initVideoScrub } from "./scroll-parallax.js";
import { initMachineViewer, MACHINES } from "./machine-viewer.js";

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const loader = $("[data-loader]");
const loaderFill = $("[data-loader-fill]");
const dismissLoader = () => loader?.classList.add("is-done");

const videos = {
  entrance: $("[data-entry-video]"),
  workspace: $("[data-workspace-video]"),
  reception: $("[data-reception-video]"),
};

if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
  // Reduced motion: flat vertical page, videos loop gently, no scrubbing.
  document.body.classList.add("no-motion");
  Object.values(videos).forEach((v) => {
    if (!v) return;
    v.loop = true;
    v.play().catch(() => {});
  });
  initNav();
  initMachines();
  dismissLoader();
} else {
  const lenis = initSmoothScroll();
  if (import.meta.env.DEV) window.__lenis = lenis;
  bootstrap(lenis);
}

async function bootstrap(lenis) {
  // ── Machines viewer boots first so it's warm before you reach it ──
  initMachines();
  initNav(lenis);

  // Hold the loader until the entrance clip can be seeked — a scrubbed video
  // that isn't buffered just shows a frozen first frame.
  await loadVideo(videos.entrance, {
    onProgress: (p) => {
      if (loaderFill) loaderFill.style.width = `${(p * 100).toFixed(0)}%`;
    },
  });
  dismissLoader();

  initEntrance();
  initWorkspace();
  initReception();

  // The other two clips buffer in the background; refresh once they're in so
  // any layout they influence is measured correctly.
  Promise.all([loadVideo(videos.workspace), loadVideo(videos.reception)]).then(() =>
    ScrollTrigger.refresh(),
  );

  document.fonts?.ready.then(() => ScrollTrigger.refresh());
  ScrollTrigger.refresh();

  // Pinned sections bake their width into a pin-spacer at creation time. If
  // the window is resized and that spacer isn't re-measured, it keeps the old
  // width — wider than the viewport — and `overflow-x: hidden` then clips the
  // hero. Re-measure on resize (debounced; ScrollTrigger.refresh is not cheap).
  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => ScrollTrigger.refresh(), 180);
  });
}

/* ── Stop 1 — Entrance: doors open, lights come up ────────── */

function initEntrance() {
  const section = $("[data-entrance]");
  if (!section || !videos.entrance) return;

  const stage = $(".entrance-stage", section);
  const grade = $("[data-entrance-grade]");
  const sweep = $("[data-light-sweep]");
  const blackout = $("[data-entrance-blackout]");
  const copy = $(".entrance-copy", section);
  const cue = $("[data-scroll-cue]");

  initVideoScrub({ video: videos.entrance, trigger: section, pin: stage });

  // The lighting reveal, timed against what the footage actually shows:
  //
  //   0–12%   the black steel door, opening   <- the hero shot
  //   12–70%  walking the dark hallway
  //   70–100% emerging into the lit gym floor
  //
  // The clip already carries its own dark-to-light arc (the gym at the end is
  // genuinely bright), so the grade supports that arc rather than imposing one.
  // An earlier version blacked the screen out until ~30%, which hid the door
  // opening entirely — by the time the lights came up the door was long gone.
  // The footage **hard-cuts** from hallway to gym floor — measured by average
  // luma, which jumps from ~80 to ~95 between 5.5s and 6.0s of a 7.92s clip,
  // i.e. ~74% of the scroll. Scrubbing across a cut always reads as a glitch,
  // because the viewer controls the speed and can sit right on the seam.
  //
  // So rather than fight it, the cut is used: the screen dips to near-black as
  // you cross the threshold and the lights slam on the far side. The jump lands
  // inside the darkness where there is nothing to see, and what was a glitch
  // becomes the moment the gym is revealed.
  const CUT = 0.74;

  // The grade is built against the clip's *measured* luma, sampled by drawing
  // frames to a canvas at 5% intervals (average of 255):
  //
  //     0%  49.7   the door
  //    10%  33.3   <- darkest frame in the entire clip
  //    30%  75.7   hallway
  //    50%  81.0   hallway, brightest stretch
  //    70%  63.6   approaching the threshold
  //    75%  85.8   <- the cut; gym floor
  //   100%  82.8   gym floor
  //
  // Two things fall out of that. First, the footage supplies its own dark-to-
  // light arc, so gain should *fall* across the hallway to hold a steady
  // exposure — pushing brightness up alongside rising source luma just blows
  // the highlights. Second, and the reason this section shipped broken: the
  // clip bottoms out at 10%, exactly where the hero shot is. Gain has to RISE
  // there to keep the door readable. The previous grade did the opposite,
  // multiplying brightness(0.6) against a 42% black overlay and a near-opaque
  // vignette to land the door on screen at luma 17 — visually pure black.
  gsap
    .timeline({
      scrollTrigger: { trigger: section, start: "top top", end: "bottom bottom", scrub: 0.15 },
    })
    // — Door: a veil for mood only, gone by 6%. The footage is already dark.
    .fromTo(blackout, { opacity: 0.14 }, { opacity: 0, ease: "power2.out", duration: 0.06 }, 0)

    // — Counter-light the dip at 10% so the door survives it.
    .fromTo(
      videos.entrance,
      { filter: "brightness(1.24) contrast(1.14) saturate(0.94)" },
      { filter: "brightness(1.36) contrast(1.12) saturate(0.96)", ease: "sine.out", duration: 0.13 },
      0,
    )

    // — Hallway: source luma climbs 55 -> 81, so ease the gain back down.
    .to(
      videos.entrance,
      { filter: "brightness(1.04) contrast(1.06) saturate(1)", ease: "none", duration: 0.42 },
      0.15,
    )
    .fromTo(grade, { opacity: 0.82 }, { opacity: 0.2, ease: "none", duration: 0.5 }, 0.06)

    // — Threshold: fall into darkness just before the cut.
    .to(videos.entrance,
      { filter: "brightness(0.12) contrast(1.2) saturate(0.78)", ease: "power2.in", duration: 0.12 },
      CUT - 0.12)
    .to(blackout, { opacity: 0.97, ease: "power2.in", duration: 0.12 }, CUT - 0.12)
    .to(grade, { opacity: 0.5, ease: "none", duration: 0.12 }, CUT - 0.12)

    // — Reveal: lights slam on. Fast easing so it reads as a switch being
    //   thrown, not a fade.
    .to(blackout, { opacity: 0, ease: "power3.out", duration: 0.07 }, CUT)
    .to(videos.entrance,
      { filter: "brightness(1.5) contrast(1.02) saturate(1.1)", ease: "power3.out", duration: 0.07 },
      CUT)
    .to(grade, { opacity: 0.08, ease: "power2.out", duration: 0.09 }, CUT)
    .fromTo(sweep, { opacity: 0 }, { opacity: 1, ease: "power2.out", duration: 0.1 }, CUT)

    // — Settle back from the initial flare to a steady exposure.
    .to(videos.entrance,
      { filter: "brightness(1.28) contrast(1) saturate(1.05)", ease: "none", duration: 0.14 },
      CUT + 0.09)
    .to(sweep, { opacity: 0.45, ease: "none", duration: 0.14 }, CUT + 0.09)

    // Title is gone before the threshold, so the reveal is uncluttered.
    .to(copy, { opacity: 0, y: -40, ease: "none", duration: 0.2 }, 0.44)
    .to(cue, { opacity: 0, ease: "none", duration: 0.15 }, 0.1);
}

/* ── Stop 2 — Workspace: explore the floor ────────────────── */

function initWorkspace() {
  const section = $(".workspace");
  if (!section || !videos.workspace) return;

  const stage = $(".workspace-stage", section);
  const panels = $$("[data-info-panel]", section);

  initVideoScrub({ video: videos.workspace, trigger: section, pin: stage });

  // Each panel owns a slice of the scroll and hands off to the next, so the
  // floor tour reads as three distinct beats rather than one static caption.
  const tl = gsap.timeline({
    scrollTrigger: { trigger: section, start: "top top", end: "bottom bottom", scrub: 0.3 },
  });

  panels.forEach((panel, i) => {
    const slot = 0.08 + i * 0.3;
    tl.fromTo(panel, { opacity: 0, x: -50 }, { opacity: 1, x: 0, ease: "power2.out", duration: 0.12 }, slot)
      .to(panel, { opacity: 0, x: -30, ease: "power2.in", duration: 0.1 }, slot + 0.2);
  });
}

/* ── Stop 3 — Machines: pick one, view it in 3D ───────────── */

function initMachines() {
  const viewport = $("[data-viewer-viewport]");
  const canvas = $("[data-viewer-canvas]");
  const hint = $("[data-viewer-hint]");
  if (!viewport || !canvas) return;

  const viewer = initMachineViewer({ canvas, viewport });
  if (!viewer) {
    viewport.classList.add("no-webgl");
    return;
  }

  gsap.ticker.add(viewer.render);
  if (import.meta.env.DEV) window.__viewer = viewer;

  // Hide the "drag to rotate" affordance once the user has actually dragged.
  const watchHint = () => {
    if (viewer.hasDragged()) {
      hint?.classList.add("is-hidden");
      gsap.ticker.remove(watchHint);
    }
  };
  gsap.ticker.add(watchHint);

  const specs = {
    capacity: $('[data-spec="capacity"]'),
    category: $('[data-spec="category"]'),
    target: $('[data-spec="target"]'),
  };

  $$("[data-machine]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const key = btn.dataset.machine;
      const data = MACHINES[key];
      if (!data) return;

      $$("[data-machine]").forEach((b) => b.classList.toggle("is-active", b === btn));
      viewer.show(key);

      // Specs cross-fade so the swap reads as deliberate, not a flicker.
      Object.entries(specs).forEach(([field, el]) => {
        if (!el) return;
        gsap.fromTo(el, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.35, ease: "power2.out" });
        el.innerHTML = data[field];
      });
    });
  });
}

/* ── Stop 4 — Reception: billing ──────────────────────────── */

function initReception() {
  const section = $(".reception");
  if (!section || !videos.reception) return;

  const stage = $(".reception-stage", section);
  const cards = $$(".plan-card", section);

  initVideoScrub({ video: videos.reception, trigger: section, pin: stage });

  gsap.timeline({
    scrollTrigger: { trigger: section, start: "top top", end: "60% bottom", scrub: 0.3 },
  }).fromTo(
    cards,
    { opacity: 0, y: 60 },
    { opacity: 1, y: 0, stagger: 0.12, ease: "power2.out", duration: 0.5 },
    0.12,
  );
}

/* ── Nav: active-section highlighting + smooth anchor scroll ─ */

function initNav(lenis) {
  const links = $$("[data-nav-link]");
  if (!links.length) return;

  // Lenis owns scroll position, so native anchor jumps have to be intercepted.
  $$('a[href^="#"]').forEach((a) => {
    a.addEventListener("click", (e) => {
      const target = $(a.getAttribute("href"));
      if (!target) return;
      e.preventDefault();
      if (lenis) lenis.scrollTo(target, { offset: -1 });
      else target.scrollIntoView({ behavior: "smooth" });
    });
  });

  const setActive = (id) => {
    links.forEach((l) => l.classList.toggle("is-active", l.getAttribute("href") === `#${id}`));
  };

  $$("[data-stop]").forEach((section) => {
    ScrollTrigger.create({
      trigger: section,
      start: "top 60%",
      end: "bottom 40%",
      onToggle: (self) => self.isActive && setActive(section.id),
    });
  });

  setActive("entrance");
}
