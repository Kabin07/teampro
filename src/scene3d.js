import * as THREE from "three";

/**
 * The gym itself, as a real-time WebGL environment.
 *
 * Everything on the page sits in front of this canvas, so the whole site is
 * "inside" the 3D scene rather than layering a 3D widget onto a flat page.
 * The camera is driven entirely by scroll:
 *
 *   entry  — dollies forward through the doorway as the video dissolves
 *   tour   — strafes sideways past one equipment station per zone
 *   outro  — lifts and pulls back off the floor
 *
 * Geometry is built procedurally (no asset loading) and shared aggressively,
 * so the whole environment is a few dozen draw calls.
 */

const ACID = 0xccff33;
const STATION_GAP = 34; // world units between zone stations
const FLOOR_Y = 0;

export function initScene({ canvas, zoneCount = 4 }) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  } catch {
    return null; // No WebGL — caller falls back to the flat page.
  }
  if (!renderer.getContext()) return null;

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x07070a);
  scene.fog = new THREE.FogExp2(0x07070a, 0.017);

  const camera = new THREE.PerspectiveCamera(
    52,
    window.innerWidth / window.innerHeight,
    0.1,
    500,
  );

  const spanX = (zoneCount - 1) * STATION_GAP;

  // ── Shared materials ──────────────────────────────────────
  const matFloor = new THREE.MeshStandardMaterial({
    color: 0x111114,
    roughness: 0.42,
    metalness: 0.65,
  });
  const matSteel = new THREE.MeshStandardMaterial({
    color: 0x2a2a30,
    roughness: 0.5,
    metalness: 0.8,
  });
  const matDark = new THREE.MeshStandardMaterial({
    color: 0x141418,
    roughness: 0.85,
    metalness: 0.2,
  });
  const matRubber = new THREE.MeshStandardMaterial({
    color: 0x0d0d10,
    roughness: 0.95,
    metalness: 0,
  });
  const matGlow = new THREE.MeshBasicMaterial({ color: ACID });
  const matGlowDim = new THREE.MeshBasicMaterial({ color: 0x4a5f14 });

  // ── Floor + grid ──────────────────────────────────────────
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(spanX + 200, 160), matFloor);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(spanX / 2, FLOOR_Y, -20);
  scene.add(floor);

  const grid = new THREE.GridHelper(spanX + 200, Math.round((spanX + 200) / 4), 0x2c3318, 0x1a1c14);
  grid.position.set(spanX / 2, FLOOR_Y + 0.02, -20);
  grid.material.transparent = true;
  grid.material.opacity = 0.5;
  scene.add(grid);

  // ── Ceiling light strips ──────────────────────────────────
  const stripGeo = new THREE.BoxGeometry(9, 0.16, 0.5);
  for (let x = -40; x <= spanX + 50; x += 11) {
    const strip = new THREE.Mesh(stripGeo, matGlow);
    strip.position.set(x, 9.4, -18);
    scene.add(strip);

    const strip2 = new THREE.Mesh(stripGeo, matGlowDim);
    strip2.position.set(x + 5.5, 9.4, 6);
    scene.add(strip2);
  }

  // ── Back wall panels ──────────────────────────────────────
  const panelGeo = new THREE.BoxGeometry(7.5, 11, 0.6);
  for (let x = -40; x <= spanX + 50; x += 9) {
    const panel = new THREE.Mesh(panelGeo, matDark);
    panel.position.set(x, 5.5, -34);
    scene.add(panel);
  }

  // ── Doorway (the entry sequence passes through it) ────────
  const doorway = new THREE.Group();
  const jambGeo = new THREE.BoxGeometry(1, 11, 1.2);
  const jambL = new THREE.Mesh(jambGeo, matSteel);
  jambL.position.set(-6, 5.5, 0);
  const jambR = new THREE.Mesh(jambGeo, matSteel);
  jambR.position.set(6, 5.5, 0);
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(13, 1, 1.2), matSteel);
  lintel.position.set(0, 11, 0);
  const doorGlow = new THREE.Mesh(new THREE.BoxGeometry(12.6, 0.14, 0.3), matGlow);
  doorGlow.position.set(0, 10.3, 0.6);
  doorway.add(jambL, jambR, lintel, doorGlow);
  doorway.position.set(-16, 0, 16);
  scene.add(doorway);

  // ── Equipment stations, one per zone ──────────────────────
  const rackUprightGeo = new THREE.BoxGeometry(0.42, 8, 0.42);
  const rackCrossGeo = new THREE.BoxGeometry(5.2, 0.34, 0.34);
  const barGeo = new THREE.CylinderGeometry(0.11, 0.11, 7.4, 10);
  const plateGeo = new THREE.CylinderGeometry(1.05, 1.05, 0.32, 22);
  const benchGeo = new THREE.BoxGeometry(4.6, 0.42, 1.5);
  const benchLegGeo = new THREE.BoxGeometry(0.34, 1.5, 1.2);
  const dumbbellBarGeo = new THREE.CylinderGeometry(0.09, 0.09, 1.5, 8);
  const dumbbellEndGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.42, 14);

  /** A power rack with a loaded barbell. */
  function makeRack() {
    const g = new THREE.Group();
    [-2.6, 2.6].forEach((x) => {
      [-1.2, 1.2].forEach((z) => {
        const upright = new THREE.Mesh(rackUprightGeo, matSteel);
        upright.position.set(x, 4, z);
        g.add(upright);
      });
    });
    const cross = new THREE.Mesh(rackCrossGeo, matSteel);
    cross.position.set(0, 7.7, 0);
    g.add(cross);

    const bar = new THREE.Mesh(barGeo, matSteel);
    bar.rotation.z = Math.PI / 2;
    bar.position.set(0, 5.1, 0);
    g.add(bar);

    [-3.1, -2.6, 2.6, 3.1].forEach((x) => {
      const plate = new THREE.Mesh(plateGeo, matRubber);
      plate.rotation.z = Math.PI / 2;
      plate.position.set(x, 5.1, 0);
      g.add(plate);
    });
    return g;
  }

  /** A flat bench. */
  function makeBench() {
    const g = new THREE.Group();
    const top = new THREE.Mesh(benchGeo, matRubber);
    top.position.y = 1.7;
    g.add(top);
    [-1.8, 1.8].forEach((x) => {
      const leg = new THREE.Mesh(benchLegGeo, matSteel);
      leg.position.set(x, 0.85, 0);
      g.add(leg);
    });
    return g;
  }

  /** A short rack of dumbbells. */
  function makeDumbbellRack() {
    const g = new THREE.Group();
    const frame = new THREE.Mesh(new THREE.BoxGeometry(6, 0.36, 1.6), matSteel);
    frame.position.y = 1.5;
    g.add(frame);
    for (let i = 0; i < 6; i++) {
      const db = new THREE.Group();
      const bar = new THREE.Mesh(dumbbellBarGeo, matSteel);
      bar.rotation.z = Math.PI / 2;
      db.add(bar);
      [-0.72, 0.72].forEach((x) => {
        const end = new THREE.Mesh(dumbbellEndGeo, matRubber);
        end.rotation.z = Math.PI / 2;
        end.position.x = x;
        db.add(end);
      });
      db.position.set(-2.4 + i * 0.96, 1.95, 0);
      g.add(db);
    }
    return g;
  }

  const builders = [makeRack, makeRack, makeBench, makeDumbbellRack];

  for (let i = 0; i < zoneCount; i++) {
    const station = new THREE.Group();
    const x = i * STATION_GAP;

    // Far side of the walkway.
    const far = builders[i % builders.length]();
    far.position.set(0, 0, -22);
    station.add(far);

    // Near side, offset so the camera threads between them.
    const near = builders[(i + 1) % builders.length]();
    near.position.set(9, 0, -4);
    near.rotation.y = Math.PI;
    station.add(near);

    // A marker light per station — reads as the zone you're arriving at.
    const marker = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 26), matGlow);
    marker.position.set(-7, 0.06, -14);
    station.add(marker);

    const lamp = new THREE.PointLight(ACID, 55, 46, 2);
    lamp.position.set(1, 7.5, -12);
    station.add(lamp);

    station.position.x = x;
    scene.add(station);
  }

  // ── Lighting ──────────────────────────────────────────────
  scene.add(new THREE.AmbientLight(0x404050, 1.1));

  const key = new THREE.DirectionalLight(0xa8c8ff, 0.7);
  key.position.set(-14, 22, 14);
  scene.add(key);

  const travelLight = new THREE.PointLight(0xffffff, 60, 60, 2);
  travelLight.position.set(0, 6, 6);
  scene.add(travelLight);

  // ── Camera choreography ───────────────────────────────────
  const state = { entry: 0, tour: 0, outro: 0 };
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  const lerp = (a, b, t) => a + (b - a) * t;

  function updateCamera() {
    // Entry: dolly in through the doorway.
    const entryZ = lerp(46, 12, state.entry);
    // Tour: strafe along the stations.
    const tourX = state.tour * spanX;
    // Outro: lift and pull back.
    const outroY = state.outro * 7;
    const outroZ = state.outro * 20;

    camera.position.x = tourX - 3 + pointer.x * 1.6;
    camera.position.y = 3.6 + outroY + pointer.y * 0.8;
    camera.position.z = entryZ + outroZ;

    travelLight.position.set(camera.position.x + 1, 6.5, camera.position.z - 5);

    // Look straight down the hall, tilting slightly toward the direction of travel.
    camera.lookAt(
      camera.position.x + 4 + pointer.x * 2,
      2.4 + outroY * 0.55,
      camera.position.z - 26,
    );
    camera.rotation.z = pointer.x * 0.012;
  }

  function render() {
    pointer.x = lerp(pointer.x, pointer.tx, 0.06);
    pointer.y = lerp(pointer.y, pointer.ty, 0.06);
    updateCamera();
    renderer.render(scene, camera);
  }

  function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }

  function onPointerMove(e) {
    pointer.tx = (e.clientX / window.innerWidth - 0.5) * 2;
    pointer.ty = -(e.clientY / window.innerHeight - 0.5) * 2;
  }

  window.addEventListener("resize", onResize);
  window.addEventListener("pointermove", onPointerMove, { passive: true });

  updateCamera();
  render();

  return {
    render,
    setEntry: (p) => { state.entry = p; },
    setTour: (p) => { state.tour = p; },
    setOutro: (p) => { state.outro = p; },
  };
}
