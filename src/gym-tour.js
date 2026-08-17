import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

const clamp01 = gsap.utils.clamp(0, 1);

// A zone starts revealing once it's ~30% of the way to centred, and is fully
// open by ~75%. Tuned so the panel is readable well before it's dead-centre,
// but still feels like it responds to walking up to it.
const NEAR_START = 0.3;
const NEAR_RANGE = 0.45;
const IN_RANGE_AT = 0.85;

/**
 * Pins the tour and converts vertical scroll into horizontal travel across
 * the zones. Returns the horizontal tween so per-zone triggers can hang off
 * it via ScrollTrigger's `containerAnimation`.
 */
export function initHorizontalTour({ section, track, onProgress }) {
  const distance = () => Math.max(track.scrollWidth - window.innerWidth, 0);

  return gsap.to(track, {
    x: () => -distance(),
    ease: "none",
    scrollTrigger: {
      trigger: section,
      pin: true,
      start: "top top",
      end: () => "+=" + distance(),
      scrub: 0.8,
      // No anticipatePin here — it fights Lenis's smooth scrolling and makes
      // the page jitter backwards when entering the pin.
      invalidateOnRefresh: true,
      onUpdate: (self) => onProgress?.(self.progress),
    },
  });
}

/**
 * Wires one zone's "walk up to it and the details appear" behaviour.
 *
 * Elements moving horizontally can't be measured against the viewport the
 * normal way, so the trigger is bound to the horizontal tween with
 * `containerAnimation` — progress then runs 0 → 1 as the zone crosses the
 * screen, putting it dead-centre at exactly 0.5. Distance from that midpoint
 * is the proximity signal everything else reads from.
 */
function initZoneProximity(zone, containerAnimation) {
  const body = zone.querySelector(".zone-body");
  const detail = zone.querySelector("[data-detail]");
  const items = zone.querySelectorAll("[data-detail-item]");
  const meter = zone.querySelector("[data-proximity]");
  const meterFill = zone.querySelector("[data-proximity-fill]");
  const meterTag = zone.querySelector("[data-proximity-tag]");
  const depths = zone.querySelectorAll("[data-depth]");

  const reveal = gsap.timeline({ paused: true });
  if (detail) {
    reveal.fromTo(
      detail,
      { opacity: 0, x: 70 },
      { opacity: 1, x: 0, duration: 1, ease: "power2.out" },
      0,
    );
  }
  if (items.length) {
    reveal.fromTo(
      items,
      { opacity: 0, y: 30 },
      { opacity: 1, y: 0, duration: 0.7, stagger: 0.09, ease: "power2.out" },
      0.15,
    );
  }

  let wasInRange = null;

  ScrollTrigger.create({
    trigger: zone,
    containerAnimation,
    start: "left right",
    end: "right left",
    onUpdate: (self) => {
      const nearness = 1 - Math.abs(self.progress - 0.5) * 2;
      const eased = clamp01((nearness - NEAR_START) / NEAR_RANGE);

      reveal.progress(eased);

      if (meterFill) meterFill.style.width = `${(eased * 100).toFixed(1)}%`;

      const inRange = eased > IN_RANGE_AT;
      if (inRange !== wasInRange) {
        wasInRange = inRange;
        meter?.classList.toggle("is-near", inRange);
        if (meterTag) meterTag.textContent = inRange ? "In range" : "Approaching";
      }

      // `drift` is -1 fully right of screen, 0 centred, +1 fully left.
      const drift = (self.progress - 0.5) * 2;

      // The panel swings to face the camera as you approach it: angled away
      // while it's off to the side, square-on once you're in front of it.
      if (body) {
        body.style.setProperty("--ry", `${(drift * -22).toFixed(2)}deg`);
        body.style.setProperty("--tz", `${(-Math.abs(drift) * 90).toFixed(1)}px`);
      }

      // Extra drift on the depth layers, on top of the parallax the CSS
      // perspective already produces from their Z offsets.
      depths.forEach((layer) => {
        const factor = parseFloat(layer.dataset.depth) || 0;
        layer.style.setProperty("--px", `${(drift * factor * 90).toFixed(1)}px`);
      });
    },
  });
}

/**
 * Builds the whole floor tour: horizontal travel, per-zone proximity reveals,
 * and the HUD that names whichever zone you're closest to.
 */
export function initGymTour({ section, track, zones, hud, onTourProgress }) {
  if (!section || !track || !zones.length) return null;

  const dots = hud?.dots ? Array.from(hud.dots.querySelectorAll("[data-hud-dot]")) : [];
  let activeIndex = -1;

  const onProgress = (progress) => {
    // Walk the WebGL camera along the stations in lockstep with the track.
    onTourProgress?.(progress);
    if (hud?.fill) hud.fill.style.width = `${(progress * 100).toFixed(1)}%`;

    const index = Math.round(progress * (zones.length - 1));
    if (index === activeIndex) return;
    activeIndex = index;

    if (hud?.zoneName) {
      hud.zoneName.textContent = zones[index].dataset.zoneName || "";
    }
    dots.forEach((dot, i) => dot.classList.toggle("is-active", i === index));
  };

  const horizontal = initHorizontalTour({ section, track, onProgress });
  zones.forEach((zone) => initZoneProximity(zone, horizontal));
  onProgress(0);

  return horizontal;
}
