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
  const copy = $(".entrance-copy", section);
  const cue = $("[data-scroll-cue]");

  initVideoScrub({ video: videos.entrance, trigger: section, pin: stage });

  // The lighting reveal: the heavy black grade lifts and a warm amber wash
  // rises, so scrolling reads as the gym's lights switching on.
  gsap
    .timeline({
      scrollTrigger: { trigger: section, start: "top top", end: "bottom bottom", scrub: 0.15 },
    })
    .fromTo(grade, { opacity: 1 }, { opacity: 0.25, ease: "none", duration: 0.7 }, 0)
    .fromTo(sweep, { opacity: 0 }, { opacity: 1, ease: "none", duration: 0.55 }, 0.15)
    .fromTo(videos.entrance, { filter: "brightness(0.35) contrast(1.15)" },
      { filter: "brightness(1.05) contrast(1)", ease: "none", duration: 0.7 }, 0)
    .to(copy, { opacity: 0, y: -40, ease: "none", duration: 0.25 }, 0.6)
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
