import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";

gsap.registerPlugin(ScrollTrigger);

/**
 * Buttery smooth scrolling, kept in sync with ScrollTrigger so scrubbed
 * animations track the scroll position exactly instead of lagging behind.
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
 * Waits until the video has enough data to be seeked, reporting buffer
 * progress along the way. Resolves regardless after `timeout` so a slow or
 * partial download can never leave the page stuck behind the loader.
 */
export function loadVideo(video, { onProgress, timeout = 15000 } = {}) {
  return new Promise((resolve) => {
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

    // Already buffered (cache hit / instant load).
    if (video.readyState >= 4) finish();
    else video.load();
  });
}

/**
 * Scroll-scrubbed video playback — the "3D parallax" entry sequence.
 *
 * The video is never played; its `currentTime` is driven directly by scroll
 * position, so the user is effectively scrubbing a pre-rendered 3D camera
 * move. Scrubbing through a tween (rather than assigning `currentTime` raw on
 * every scroll event) lets GSAP smooth the seeking, which hides a lot of the
 * stutter that comes from sparse keyframes in a normal web-encoded MP4.
 */
export function initVideoScrub({ video, trigger, pin, end = "bottom bottom" }) {
  if (!video) return null;

  video.pause();
  const playhead = { time: 0 };

  return gsap.to(playhead, {
    time: () => video.duration || 0,
    ease: "none",
    scrollTrigger: {
      // Function-based value + invalidateOnRefresh keeps the tween correct if
      // duration only becomes known after the tween is built.
      trigger,
      pin,
      start: "top top",
      end,
      scrub: 0.6,
      invalidateOnRefresh: true,
    },
    onUpdate: () => {
      if (video.readyState >= 1) video.currentTime = playhead.time;
    },
  });
}

/**
 * Cross-fades the stacked copy blocks over the entry video as it scrubs, so
 * the text beats land with the camera move.
 */
export function initEntryCopy({ blocks, trigger, end = "bottom bottom" }) {
  if (!blocks?.length) return null;

  const timeline = gsap.timeline({
    scrollTrigger: { trigger, start: "top top", end, scrub: 0.6 },
  });

  blocks.forEach((block, i) => {
    // Each block owns an equal slice of the scrub, fading up then out.
    // The last one stays visible so it hands off cleanly to the next section.
    const slot = i / blocks.length;
    timeline
      .fromTo(
        block,
        { opacity: 0, y: 40 },
        { opacity: 1, y: 0, duration: 0.18, ease: "power2.out" },
        slot,
      )
      .to(
        block,
        { opacity: 0, y: -30, duration: 0.14, ease: "power2.in" },
        slot + 0.2,
      );
  });

  return timeline;
}
