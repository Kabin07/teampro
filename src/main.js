import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  initSmoothScroll,
  loadVideo,
  initVideoScrub,
  initEntryCopy,
} from "./scroll-parallax.js";
import { initGymTour } from "./gym-tour.js";
import { initScene } from "./scene3d.js";

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const loader = $("[data-loader]");
const loaderFill = $("[data-loader-fill]");
const video = $("[data-enter-video]");

const dismissLoader = () => loader?.classList.add("is-done");

/**
 * Reduced-motion visitors get the same content as a plain vertical page:
 * no pinning, no scrubbing, no WebGL, every detail panel already open.
 * The CSS `.no-motion` rules do the layout half of this.
 */
if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
  document.body.classList.add("no-motion");
  if (video) {
    video.setAttribute("loop", "");
    video.play().catch(() => {});
  }
  dismissLoader();
} else {
  const lenis = initSmoothScroll();
  // Lenis owns the scroll position, so `window.scrollTo` won't move the page.
  // Expose the instance during development so the scroll sequence can be
  // driven from the console / automated checks.
  if (import.meta.env.DEV) window.__lenis = lenis;
  bootstrap();
}

async function bootstrap() {
  // ── The 3D gym ──────────────────────────────────────────
  // Built first so it's already rendering behind the loader. If WebGL is
  // unavailable the page falls back to flat sections and still works.
  const scene = initScene({
    canvas: $("[data-stage3d]"),
    zoneCount: $$("[data-zone]").length,
  });

  if (scene) {
    // Render on GSAP's ticker so the scene, the scrub and Lenis all advance
    // on the same clock — separate rAF loops drift apart visibly.
    gsap.ticker.add(scene.render);
  } else {
    document.body.classList.add("no-webgl");
  }

  // The entry sequence is scrubbed, not played — it can't start until the
  // video is buffered enough to seek, so hold the loader until then.
  if (video) {
    await loadVideo(video, {
      onProgress: (p) => {
        if (loaderFill) loaderFill.style.width = `${(p * 100).toFixed(0)}%`;
      },
    });
  }
  dismissLoader();

  // ── Entry: video scrub dissolving into the 3D interior ──
  const enter = $("[data-enter]");
  if (enter && video) {
    initVideoScrub({ video, trigger: enter, pin: $(".enter-stage", enter) });
    initEntryCopy({ blocks: $$("[data-enter-copy]", enter), trigger: enter });

    // Hand off from the filmed doorway to the real-time interior: the video
    // dissolves over the last stretch of the entry, revealing the WebGL gym
    // the camera has been dollying through the whole time.
    gsap
      .timeline({
        scrollTrigger: { trigger: enter, start: "top top", end: "bottom bottom", scrub: 0.6 },
      })
      .to(video, { opacity: 0, ease: "none", duration: 0.22 }, 0.72)
      .to($(".enter-grade"), { opacity: 0.45, ease: "none", duration: 0.22 }, 0.72);

    if (scene) {
      ScrollTrigger.create({
        trigger: enter,
        start: "top top",
        end: "bottom bottom",
        scrub: true,
        onUpdate: (self) => scene.setEntry(self.progress),
      });
    }
  }

  // ── The floor: horizontal travel, camera strafes with it ──
  initGymTour({
    section: $("[data-tour]"),
    track: $("[data-tour-track]"),
    zones: $$("[data-zone]"),
    hud: {
      zoneName: $("[data-hud-zone]"),
      fill: $("[data-hud-fill]"),
      dots: $("[data-hud-dots]"),
    },
    onTourProgress: scene ? (p) => scene.setTour(p) : null,
  });

  // ── Outro: camera lifts off the floor ───────────────────
  const outro = $("[data-outro]");
  if (outro && scene) {
    ScrollTrigger.create({
      trigger: outro,
      start: "top bottom",
      end: "bottom bottom",
      scrub: true,
      onUpdate: (self) => scene.setOutro(self.progress),
    });
  }

  // Web fonts land after first paint and change the width of the horizontal
  // track, so remeasure once they're in.
  document.fonts?.ready.then(() => ScrollTrigger.refresh());
  ScrollTrigger.refresh();
}
