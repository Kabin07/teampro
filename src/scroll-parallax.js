import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";

gsap.registerPlugin(ScrollTrigger);

/**
 * Smooth scrolling. Lenis replaces the browser's scroll with an eased,
 * interruptible position; ScrollTrigger reads that same position so pinned
 * and scrubbed animations stay in lockstep with it.
 */
export function initSmoothScroll() {
  const lenis = new Lenis({
    // Lower lerp = heavier, more cinematic glide. Below ~0.06 the scrubbed
    // video starts to feel disconnected from the wheel.
    lerp: 0.075,
    wheelMultiplier: 0.9,
    touchMultiplier: 1.6,
    syncTouch: true,
  });
  lenis.on("scroll", ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
  return lenis;
}

/**
 * Waits until a video has enough data to be seeked, reporting buffer progress
 * along the way. Resolves regardless after `timeout` so a slow or partial
 * download can never leave the page stuck behind the loader.
 */
export function loadVideo(video, { onProgress, timeout = 20000 } = {}) {
  return new Promise((resolve) => {
    if (!video) return resolve(null);
    let settled = false;

    const finish = () => {
      if (settled) return;
      settled = true;
      onProgress?.(1);
      cleanup();
      resolve(video);
    };

    const report = () => {
      if (!video.duration || !video.buffered.length) return;
      const buffered = video.buffered.end(video.buffered.length - 1);
      onProgress?.(Math.min(buffered / video.duration, 0.99));
    };

    const cleanup = () => {
      clearTimeout(timer);
      video.removeEventListener("progress", report);
      video.removeEventListener("loadedmetadata", report);
      video.removeEventListener("canplaythrough", finish);
    };

    const timer = setTimeout(finish, timeout);
    video.addEventListener("progress", report);
    video.addEventListener("loadedmetadata", report);
    video.addEventListener("canplaythrough", finish);

    if (video.readyState >= 4) finish();
    else video.load();
  });
}

/**
 * Scroll-scrubbed video playback.
 *
 * The video is never played; its `currentTime` is driven by scroll position,
 * so the user is scrubbing a pre-rendered camera move. Seeking runs through a
 * proxy tween rather than raw `currentTime` writes on every scroll event, so
 * GSAP can absorb jitter from fast flicks.
 *
 * `scrub: 0.15` is deliberately light — Lenis already smooths the raw input,
 * and a heavier value compounds on top of it into visible lag.
 */
export function initVideoScrub({ video, trigger, pin, end = "bottom bottom", onProgress }) {
  if (!video) return null;

  video.pause();
  const playhead = { time: 0 };

  return gsap.to(playhead, {
    time: () => video.duration || 0,
    ease: "none",
    scrollTrigger: {
      trigger,
      pin,
      start: "top top",
      end,
      scrub: 0.15,
      invalidateOnRefresh: true,
      onUpdate: (self) => onProgress?.(self.progress),
    },
    onUpdate: () => {
      if (video.readyState >= 1) video.currentTime = playhead.time;
    },
  });
}
