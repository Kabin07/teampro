import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

/**
 * The equipment viewer — a real 3D model per machine, rotatable by dragging.
 *
 * Models are built procedurally from primitives, matched against reference
 * photographs of the actual equipment: hole-punched uprights and a multi-grip
 * pull-up bar on the rack, visible weight stacks and chrome guide rods on the
 * cable station, a console on angled posts for the treadmill, a 45° sled with
 * loaded horns for the leg press.
 *
 * Repeated detail (the hole pattern down every upright, weight-stack plates)
 * uses InstancedMesh so a rack with ~120 holes is still one draw call.
 */

const AMBER = 0xffbf00;

export const MACHINES = {
  rack: { label: "Power Rack", capacity: "1,200 <small>LBS</small>", category: "Strength", target: "Full Body" },
  cable: { label: "Cable Cross", capacity: "2 × 80 <small>KG</small>", category: "Functional", target: "Upper Body" },
  treadmill: { label: "Treadmill", capacity: "20 <small>KM/H</small>", category: "Cardio", target: "Endurance" },
  legpress: { label: "Leg Press", capacity: "400 <small>KG</small>", category: "Strength", target: "Lower Body" },
};

export function initMachineViewer({ canvas, viewport }) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  } catch {
    return null;
  }
  if (!renderer.getContext()) return null;

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  // Filmic tone mapping keeps bright specular highlights from clipping to flat
  // white, which is what makes rendered metal read as photographed metal.
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();

  // THE fix for "everything looks flat black": a metal surface is essentially
  // a mirror, so with no environment to reflect it renders near-black no matter
  // how many lights are added. This bakes a neutral studio room into an
  // environment map, giving every metallic part something real to reflect.
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  const camera = new THREE.PerspectiveCamera(38, 16 / 9, 0.1, 200);
  camera.position.set(0, 2.2, 12);
  camera.lookAt(0, 1.4, 0);

  // ── Materials ─────────────────────────────────────────────
  // The reference photos are matte black equipment, but studio light separates
  // it into distinct values: graphite frames, lighter machined hardware, bright
  // steel shafts. Rendering it all at one near-black value is what flattened it
  // into a silhouette — these are lifted and differentiated so parts read apart.
  const matFrame = new THREE.MeshStandardMaterial({ color: 0x53565e, roughness: 0.42, metalness: 0.88 });
  const matFrameLight = new THREE.MeshStandardMaterial({ color: 0x787d87, roughness: 0.33, metalness: 0.92 });
  const matChrome = new THREE.MeshStandardMaterial({ color: 0xdfe3e9, roughness: 0.07, metalness: 1 });
  const matRubber = new THREE.MeshStandardMaterial({ color: 0x25262b, roughness: 0.82, metalness: 0.15 });
  const matGrip = new THREE.MeshStandardMaterial({ color: 0x33353c, roughness: 0.7, metalness: 0.3 });
  // Holes are recessed shadow, not pure black voids — pure black reads as a
  // sticker rather than a cut-out.
  const matHole = new THREE.MeshStandardMaterial({ color: 0x0d0e10, roughness: 1, metalness: 0 });
  const matRed = new THREE.MeshStandardMaterial({ color: 0xc0392b, roughness: 0.38, metalness: 0.5 });
  const matAmber = new THREE.MeshStandardMaterial({
    color: AMBER, roughness: 0.35, metalness: 0.5, emissive: AMBER, emissiveIntensity: 0.45,
  });
  const matScreen = new THREE.MeshStandardMaterial({
    color: 0x0a1520, roughness: 0.2, metalness: 0.1, emissive: 0x2a4a66, emissiveIntensity: 0.6,
  });

  // ── Studio lighting ───────────────────────────────────────
  // The environment map now does most of the shading work, so these are here
  // to carve edges and add direction rather than to light from scratch.
  scene.add(new THREE.AmbientLight(0xb8c4d4, 0.35));

  const key = new THREE.DirectionalLight(0xfff6ea, 2.6);
  key.position.set(7, 11, 9);
  scene.add(key);

  // Cool counter-key opposite the warm key — the classic separation that stops
  // a dark object merging into a dark background.
  const rim = new THREE.DirectionalLight(0xa9c6ff, 1.9);
  rim.position.set(-9, 6, -7);
  scene.add(rim);

  const fill = new THREE.DirectionalLight(0xdfe6f5, 0.8);
  fill.position.set(-6, 3, 10);
  scene.add(fill);

  // A restrained amber kicker — brand accent, not a wash. Previously a strong
  // amber directional was the thing turning the whole floor mustard.
  const kicker = new THREE.DirectionalLight(AMBER, 0.5);
  kicker.position.set(4, 2, -9);
  scene.add(kicker);

  /**
   * A soft contact shadow rather than a lit surface.
   *
   * A lit disc picked up the coloured rim light across its whole face, which
   * is what produced the mustard ellipse under the models. Painting a radial
   * falloff and drawing it unlit keeps it a neutral pool that grounds the
   * model without taking on any light of its own.
   */
  function makeShadowTexture() {
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const ctx = c.getContext("2d");
    const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    g.addColorStop(0, "rgba(0,0,0,0.72)");
    g.addColorStop(0.45, "rgba(0,0,0,0.42)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 256);
    return new THREE.CanvasTexture(c);
  }

  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(1, 64),
    new THREE.MeshBasicMaterial({
      map: makeShadowTexture(),
      transparent: true,
      depthWrite: false,
    }),
  );
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);

  // ── Geometry helpers ──────────────────────────────────────
  const BOX = new THREE.BoxGeometry(1, 1, 1);
  const CYL = new THREE.CylinderGeometry(1, 1, 1, 20);
  const TUBE = new THREE.CylinderGeometry(1, 1, 1, 12);

  const addBox = (g, mat, w, h, d, x, y, z, rot) => {
    const m = new THREE.Mesh(BOX, mat);
    m.scale.set(w, h, d);
    m.position.set(x, y, z);
    if (rot) m.rotation.set(rot[0] || 0, rot[1] || 0, rot[2] || 0);
    g.add(m);
    return m;
  };

  const addCyl = (g, mat, r, len, x, y, z, axis = "y", geo = CYL) => {
    const m = new THREE.Mesh(geo, mat);
    m.scale.set(r, len, r);
    m.position.set(x, y, z);
    if (axis === "x") m.rotation.z = Math.PI / 2;
    if (axis === "z") m.rotation.x = Math.PI / 2;
    g.add(m);
    return m;
  };

  /** The punched hole pattern that runs down every rack upright. */
  const addHoleColumn = (g, x, z, yStart, yEnd, spacing = 0.3) => {
    const count = Math.floor((yEnd - yStart) / spacing);
    const holes = new THREE.InstancedMesh(CYL, matHole, count);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0));
    for (let i = 0; i < count; i++) {
      m.compose(
        new THREE.Vector3(x, yStart + i * spacing, z),
        q,
        new THREE.Vector3(0.05, 0.24, 0.05),
      );
      holes.setMatrixAt(i, m);
    }
    holes.instanceMatrix.needsUpdate = true;
    g.add(holes);
  };

  /** An Olympic bar with bumper plates and the red centre band. */
  const addLoadedBar = (g, y, z) => {
    addCyl(g, matChrome, 0.055, 7.6, 0, y, z, "x");
    addCyl(g, matRed, 0.062, 1.1, 0, y, z, "x");
    [-1.55, 1.55].forEach((x) => addCyl(g, matFrameLight, 0.075, 0.5, x, y, z, "x"));
    [[-2.15, 0.62], [-1.95, 0.62], [1.95, 0.62], [2.15, 0.62]].forEach(([x, r]) =>
      addCyl(g, matRubber, r, 0.22, x, y, z, "x"),
    );
  };

  /** A stack of bumper plates on a storage peg. */
  const addPegPlates = (g, x, y, z, dir) => {
    addCyl(g, matFrameLight, 0.07, 1.1, x + dir * 0.55, y, z, "x");
    [0.25, 0.5, 0.75].forEach((o) =>
      addCyl(g, matRubber, 0.72, 0.18, x + dir * o, y, z, "x"),
    );
  };

  // ── Power Rack ────────────────────────────────────────────
  function buildRack() {
    const g = new THREE.Group();
    const UX = 2.0;   // half-width between uprights
    const UZ = 1.45;  // half-depth
    const H = 7.6;

    // Four hole-punched uprights
    [[-UX, -UZ], [UX, -UZ], [-UX, UZ], [UX, UZ]].forEach(([x, z]) => {
      addBox(g, matFrame, 0.2, H, 0.2, x, H / 2, z);
      addHoleColumn(g, x, z + (z > 0 ? 0.101 : -0.101), 0.8, H - 0.7);
    });

    // Top perimeter
    addBox(g, matFrame, UX * 2 + 0.2, 0.18, 0.18, 0, H, -UZ);
    addBox(g, matFrame, UX * 2 + 0.2, 0.18, 0.18, 0, H, UZ);
    [-UX, UX].forEach((x) => addBox(g, matFrame, 0.18, 0.18, UZ * 2, x, H, 0));

    // Multi-grip pull-up bar: a raised centre span dropping to angled wings,
    // mounted forward of the frame like the reference.
    const bar = new THREE.Group();
    addCyl(bar, matFrame, 0.075, 1.5, 0, 0.42, 0, "x");
    [-1, 1].forEach((s) => {
      addCyl(bar, matFrame, 0.075, 1.05, s * 1.12, 0.28, 0, "x", TUBE).rotation.z = Math.PI / 2 + s * 0.42;
      addCyl(bar, matFrame, 0.075, 0.95, s * 1.72, 0, 0.32, "z", TUBE);
      addCyl(bar, matFrame, 0.075, 0.8, s * 1.72, -0.2, 0.72, "x", TUBE);
    });
    bar.position.set(0, H - 0.35, UZ + 0.3);
    g.add(bar);

    // Feet: rear pads plus long forward-projecting stabilisers
    [-UX, UX].forEach((x) => {
      addBox(g, matFrame, 0.3, 0.2, 2.9, x, 0.1, UZ + 0.75);
      addBox(g, matFrame, 0.42, 0.34, 0.5, x, 0.17, UZ + 2.05);
      addBox(g, matFrame, 0.3, 0.2, 0.7, x, 0.1, -UZ - 0.2);
    });

    // Rear cross braces
    addBox(g, matFrame, UX * 2, 0.16, 0.16, 0, 0.55, -UZ);
    addBox(g, matFrame, UX * 2, 0.16, 0.16, 0, 3.1, -UZ);

    // J-hooks and safety arms
    [-UX, UX].forEach((x) => {
      addBox(g, matFrame, 0.3, 0.34, 0.3, x, 4.05, UZ - 0.18);
      addBox(g, matFrame, 0.22, 0.5, 0.22, x, 4.32, UZ - 0.34);
      addBox(g, matFrame, 0.26, 0.2, 1.5, x, 2.35, UZ - 0.6);
    });

    addLoadedBar(g, 4.45, UZ - 0.34);

    // Plate storage on the rear uprights
    [[-UX, -1], [UX, 1]].forEach(([x, dir]) => {
      addPegPlates(g, x, 3.6, -UZ - 0.1, dir);
      addPegPlates(g, x, 2.0, -UZ - 0.1, dir);
    });

    return g;
  }

  // ── Cable Cross / Functional Trainer ──────────────────────
  function buildCable() {
    const g = new THREE.Group();
    const TX = 3.5;
    const H = 7.5;

    [-TX, TX].forEach((x) => {
      const inward = x > 0 ? -1 : 1;

      // Tower shell
      addBox(g, matFrame, 0.9, H, 1.5, x, H / 2, 0);
      addBox(g, matFrame, 1.25, 0.24, 1.9, x, 0.12, 0);

      // Weight stack — instanced plates behind chrome guide rods
      const plates = new THREE.InstancedMesh(BOX, matFrame, 14);
      const m = new THREE.Matrix4();
      for (let i = 0; i < 14; i++) {
        m.compose(
          new THREE.Vector3(x, 0.62 + i * 0.24, 0),
          new THREE.Quaternion(),
          new THREE.Vector3(0.78, 0.19, 1.15),
        );
        plates.setMatrixAt(i, m);
      }
      plates.instanceMatrix.needsUpdate = true;
      g.add(plates);

      // Selector pin sits in the stack
      addCyl(g, matAmber, 0.06, 0.5, x + 0.5, 1.6, 0, "x");

      // Chrome guide rods
      [-0.34, 0.34].forEach((dz) => addCyl(g, matChrome, 0.05, H - 1.1, x, H / 2 + 0.1, dz));

      // Pulley head + travelling carriage
      addCyl(g, matChrome, 0.3, 0.14, x + inward * 0.42, H - 0.5, 0, "x");
      addBox(g, matFrameLight, 0.5, 0.5, 0.9, x + inward * 0.42, 4.8, 0);
      addCyl(g, matAmber, 0.055, 0.42, x + inward * 0.75, 4.8, 0, "x");

      // Cable dropping to a D-handle
      addCyl(g, matChrome, 0.022, 2.0, x + inward * 0.42, 5.9, 0);
      addCyl(g, matChrome, 0.03, 0.5, x + inward * 0.42, 4.72, 0);
      addCyl(g, matGrip, 0.075, 0.62, x + inward * 0.42, 4.4, 0, "x");
    });

    // Top span with multi-grip pull-up handles
    addBox(g, matFrame, TX * 2, 0.26, 0.34, 0, H, 0);
    addBox(g, matFrame, TX * 2 - 0.4, 0.16, 0.16, 0, H - 0.42, 0.55);
    [-1, 1].forEach((s) => {
      addCyl(g, matFrame, 0.07, 1.3, s * 1.5, H + 0.02, 0.75, "x", TUBE);
      addCyl(g, matFrame, 0.07, 0.9, s * 2.15, H + 0.02, 0.35, "z", TUBE);
      addCyl(g, matFrame, 0.07, 0.75, s * 0.55, H + 0.02, 0.9, "z", TUBE);
    });

    // Centre accessory rail with hanging strap handles
    addBox(g, matFrame, 1.9, 0.16, 0.16, 0, 4.4, 0);
    [-0.35, 0.35].forEach((dx) => {
      addCyl(g, matGrip, 0.03, 1.0, dx, 3.9, 0);
      addCyl(g, matGrip, 0.08, 0.5, dx, 3.4, 0, "x");
    });

    return g;
  }

  // ── Treadmill ─────────────────────────────────────────────
  function buildTreadmill() {
    const g = new THREE.Group();

    // Deck: belt flanked by raised side rails, sitting on a low chassis
    addBox(g, matFrame, 3.0, 0.4, 6.0, 0, 0.5, 0);
    addBox(g, matRubber, 2.0, 0.14, 5.5, 0, 0.77, 0);
    for (let i = -2; i <= 2; i++) addBox(g, matGrip, 1.9, 0.02, 0.05, 0, 0.845, i * 1.05);
    [-1.24, 1.24].forEach((x) => addBox(g, matFrameLight, 0.55, 0.22, 5.6, x, 0.82, 0));

    // Curved front cowling over the motor, plus the rear roller housing
    addCyl(g, matFrameLight, 0.62, 2.9, 0, 0.72, -3.05, "x");
    addBox(g, matFrame, 2.9, 0.5, 0.7, 0, 0.5, -3.05);
    addCyl(g, matFrameLight, 0.34, 2.9, 0, 0.6, 2.95, "x");
    [-1.35, 1.35].forEach((x) => addBox(g, matFrame, 0.35, 0.3, 0.5, x, 0.2, 3.1));

    // Console posts rake forward, as on the reference
    [-1.2, 1.2].forEach((x) => {
      addBox(g, matFrameLight, 0.26, 3.5, 0.3, x, 2.5, -2.85, [0.12, 0, 0]);
      // Handrail running back along the deck
      addCyl(g, matFrameLight, 0.11, 2.4, x, 3.0, -1.75, "z");
      addCyl(g, matGrip, 0.125, 1.1, x, 3.0, -1.0, "z");
    });

    // Console head + screen
    addBox(g, matFrame, 3.0, 1.4, 0.45, 0, 4.5, -3.15, [0.2, 0, 0]);
    addBox(g, matScreen, 2.3, 0.95, 0.06, 0, 4.56, -2.92, [0.2, 0, 0]);
    addBox(g, matFrame, 3.0, 0.35, 0.55, 0, 3.72, -3.0, [0.2, 0, 0]);
    [-0.95, 0.95].forEach((x) => addBox(g, matAmber, 0.5, 0.12, 0.06, x, 3.68, -2.83, [0.2, 0, 0]));

    return g;
  }

  // ── Leg Press ─────────────────────────────────────────────
  function buildLegPress() {
    const g = new THREE.Group();
    const ANGLE = -Math.PI / 4;

    // The 45° rails the sled rides on
    const rails = new THREE.Group();
    [-1.05, 1.05].forEach((x) => addBox(rails, matFrame, 0.26, 9.0, 0.26, x, 0, 0));
    addBox(rails, matFrame, 2.1, 0.18, 0.18, 0, -3.6, 0);
    addBox(rails, matFrame, 2.1, 0.18, 0.18, 0, 2.6, 0);
    rails.rotation.x = ANGLE;
    rails.position.set(0, 3.9, -0.9);
    g.add(rails);

    // Carriage + footplate, square to the rails. One plate only — an earlier
    // version built two overlapping ones, which read as broken geometry.
    const sled = new THREE.Group();
    addBox(sled, matFrame, 2.7, 0.45, 1.1, 0, 0, 0);
    addBox(sled, matGrip, 2.5, 2.6, 0.2, 0, 1.2, 0.45);
    // Grip ribbing across the footplate face
    for (let i = 0; i < 6; i++) addBox(sled, matFrameLight, 2.3, 0.06, 0.05, 0, 0.35 + i * 0.34, 0.56);
    sled.rotation.x = ANGLE;
    sled.position.set(0, 5.15, 1.5);
    g.add(sled);

    // Weight horns, loaded
    [-1, 1].forEach((s) => {
      addCyl(g, matFrameLight, 0.085, 1.5, s * 1.55, 5.0, 1.1, "x");
      [0.35, 0.62, 0.89].forEach((o) =>
        addCyl(g, matRubber, 0.68, 0.2, s * (1.55 + o), 5.0, 1.1, "x"),
      );
    });

    // Seat: pad plus reclined back, on a stepped frame
    addBox(g, matGrip, 2.0, 0.34, 2.0, 0, 1.55, 3.3);
    addBox(g, matGrip, 2.0, 2.3, 0.34, 0, 2.55, 4.35, [0.34, 0, 0]);
    addBox(g, matFrame, 0.24, 1.5, 0.24, 0, 0.75, 3.3);

    // Base frame and grab handles
    addBox(g, matFrame, 0.3, 0.26, 7.4, -1.15, 0.13, 1.4);
    addBox(g, matFrame, 0.3, 0.26, 7.4, 1.15, 0.13, 1.4);
    addBox(g, matFrame, 2.6, 0.26, 0.3, 0, 0.13, 4.9);
    [-1, 1].forEach((s) => addCyl(g, matGrip, 0.09, 1.3, s * 1.25, 2.15, 3.2, "z"));

    return g;
  }

  const builders = { rack: buildRack, cable: buildCable, treadmill: buildTreadmill, legpress: buildLegPress };

  const pivot = new THREE.Group();
  scene.add(pivot);

  let current = null;
  let currentKey = null;
  let metrics = null; // bounds of the showing model, used to frame the camera

  // How much of the frame the model should occupy (1 = exactly touching the
  // edges). Leaves a small margin so nothing clips as it spins.
  const FILL = 0.9;

  /**
   * Centres the model on the pivot's origin and records its dimensions.
   *
   * Centring matters for more than tidiness: the pivot rotates about its own
   * origin, so a model centred there spins in place and stays fully framed
   * through a full 360°. Left at its build position it would orbit the origin
   * and swing out of shot.
   */
  function frameModel(group) {
    group.updateMatrixWorld(true);
    const bbox = new THREE.Box3().setFromObject(group);
    const size = bbox.getSize(new THREE.Vector3());
    const center = bbox.getCenter(new THREE.Vector3());

    // Normalise every machine to the same nominal size so a treadmill and a
    // power rack read at comparable scale.
    const scale = 6 / Math.max(size.x, size.y, size.z);
    group.scale.setScalar(scale);
    group.position.set(-center.x * scale, -center.y * scale, -center.z * scale);

    const s = size.clone().multiplyScalar(scale);
    const hx = s.x / 2, hy = s.y / 2, hz = s.z / 2;

    // The eight bounding-box corners, in pivot space. Spinning these and
    // projecting them is far cheaper than re-deriving a Box3 per test angle,
    // and it's what the camera fit below measures against.
    const corners = [];
    for (const x of [-hx, hx]) for (const y of [-hy, hy]) for (const z of [-hz, hz]) {
      corners.push(new THREE.Vector3(x, y, z));
    }

    return {
      halfHeight: hy,
      // Widest horizontal reach at any Y rotation — the diagonal of the
      // footprint, not just its width, or the model clips when turned 45°.
      halfWidth: Math.hypot(s.x, s.z) / 2,
      footprint: Math.max(s.x, s.z),
      corners,
    };
  }

  /**
   * Pulls the camera back just far enough to hold the model at any angle.
   *
   * Two things make the naive "distance = halfHeight / tan(fov/2)" wrong here:
   *
   *  - The camera is raised slightly, so the *bottom* of the model is further
   *    from the view axis than the top — the vertical reach to cover is
   *    halfHeight plus that lift, not halfHeight.
   *  - Perspective magnifies whatever is nearest. As the model spins, its
   *    leading corner swings up to `halfWidth` closer to the camera than the
   *    centre, and that near face is what clips first. So the near reach has
   *    to be added on top of the centre distance, not averaged in.
   */
  const _v = new THREE.Vector3();

  /**
   * Worst-case screen extent (in normalised device coords, where 1.0 is the
   * frame edge) across a full turn, for a given camera distance.
   */
  function worstExtent(dist, lift) {
    camera.position.set(0, lift, dist);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld(true);

    let worst = 0;
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const cos = Math.cos(a), sin = Math.sin(a);
      for (const c of metrics.corners) {
        _v.set(c.x * cos + c.z * sin, c.y, -c.x * sin + c.z * cos).project(camera);
        worst = Math.max(worst, Math.abs(_v.x), Math.abs(_v.y));
      }
    }
    return worst;
  }

  function frameCamera() {
    if (!metrics) return;
    const tan = Math.tan((camera.fov * Math.PI) / 180 / 2);
    const lift = metrics.halfHeight * 0.15;

    // Analytic starting guess, then converge on the exact fit by measuring the
    // real projection. Closed-form bounds are necessarily conservative — they
    // assume the worst corner and worst angle coincide — which left the models
    // filling only ~70% of the frame. Screen extent scales almost exactly
    // inversely with distance, so this settles in two or three passes.
    let dist = (metrics.halfHeight + lift) / tan + metrics.halfWidth;

    for (let i = 0; i < 6; i++) {
      const worst = worstExtent(dist, lift);
      if (Math.abs(worst - FILL) < 0.005) break;
      dist *= worst / FILL;
    }

    camera.position.set(0, lift, dist);
    camera.lookAt(0, 0, 0);
  }

  function show(key) {
    if (!builders[key] || key === currentKey) return;
    if (current) {
      pivot.remove(current);
      current.traverse((o) => o.isInstancedMesh && o.dispose?.());
    }

    current = builders[key]();
    pivot.add(current);
    metrics = frameModel(current);

    // Seat the disc exactly at the model's base, sized to its footprint.
    floor.position.y = -metrics.halfHeight - 0.01;
    floor.scale.setScalar(metrics.footprint * 0.85);

    frameCamera();
    currentKey = key;
  }

  // ── Drag to rotate ────────────────────────────────────────
  const rot = { y: -0.55, x: 0.06, ty: -0.55, tx: 0.06 };
  let dragging = false;
  let last = { x: 0, y: 0 };
  let hasDragged = false;
  let idle = true;

  const onDown = (e) => {
    dragging = true;
    idle = false;
    last = { x: e.clientX, y: e.clientY };
    viewport.setPointerCapture?.(e.pointerId);
  };

  const onMove = (e) => {
    if (!dragging) return;
    const dx = e.clientX - last.x;
    const dy = e.clientY - last.y;
    last = { x: e.clientX, y: e.clientY };
    rot.ty += dx * 0.008;
    // Clamped so the model can't be flipped upside down.
    rot.tx = Math.max(-0.45, Math.min(0.65, rot.tx + dy * 0.005));
    if (Math.abs(dx) > 2) hasDragged = true;
  };

  const onUp = (e) => {
    dragging = false;
    viewport.releasePointerCapture?.(e.pointerId);
  };

  viewport.addEventListener("pointerdown", onDown);
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);

  // ── Render loop ───────────────────────────────────────────
  function resize() {
    const w = viewport.clientWidth;
    const h = viewport.clientHeight;
    if (!w || !h) return;
    if (canvas.width !== w || canvas.height !== h) {
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      // Aspect drives the horizontal fit, so re-frame whenever it changes —
      // otherwise a narrow viewport crops the model's sides.
      frameCamera();
    }
  }

  function render() {
    resize();
    // Slow auto-spin until the user takes over, so the viewer reads as 3D
    // immediately without requiring interaction.
    if (idle) rot.ty += 0.0035;
    rot.y += (rot.ty - rot.y) * 0.1;
    rot.x += (rot.tx - rot.x) * 0.1;
    pivot.rotation.y = rot.y;
    pivot.rotation.x = rot.x;
    renderer.render(scene, camera);
  }

  show("rack");
  render();

  return {
    render,
    show,
    hasDragged: () => hasDragged,
    // Exposed for development checks — lets the framing be verified by
    // projecting the live model bounds rather than reading back pixels.
    debug: { camera, pivot, getCurrent: () => current, getMetrics: () => metrics, THREE },
  };
}
