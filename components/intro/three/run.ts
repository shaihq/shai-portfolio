import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { RectAreaLightUniformsLib } from "three/examples/jsm/lights/RectAreaLightUniformsLib.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { BokehPass } from "three/examples/jsm/postprocessing/BokehPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { domToPng } from "modern-screenshot";
import { fitIntro } from "@/components/stage/fit";
import { primeSignature } from "../live";
import { buildModel, materials, SCREEN, type BuildPart } from "./model";

/*
 * The intro in real 3D. The Macintosh is assembled part by part while the page
 * loads, filmed by a perspective camera that moves in close on each part (with a
 * shallow depth of field on desktop), lit by a studio light with soft shadows and
 * an environment for reflections. Once it is whole the tube warms up and lights
 * the keyboard and floor, the page appears on the screen, and the camera pushes in
 * until the screen fills the window exactly: then the overlay fades and the real
 * page is underneath, pixel for pixel.
 *
 *   load   build + camera, following real loading, never faster than MIN_LOAD
 *   hold   the whole machine, a beat
 *   power  the tube warms up: a line, then the picture, and its light on the room
 *   boot   the page fades in on the glass
 *   zoom   the camera pushes in, square to the glass
 *   fade   the overlay fades to the page
 */

const MIN_LOAD = 3.9;
const HOLD = 0.6; // long enough for the settle to finish
const POWER = 0.62;
const BOOT = 0.75;
const ZOOM = 1.5;
const FADE = 0.45;
const SNAPSHOT_WAIT = 2;
const FOV = 30;
const BG = "#1a1d21";

type Phase = "load" | "hold" | "power" | "boot" | "zoom" | "fade" | "done";

const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
const ease3 = (t: number) => 1 - Math.pow(1 - clamp01(t), 3);
const smoothstep = (t: number) => {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
};
const easeInOut = (t: number) => {
  const x = clamp01(t);
  return x < 0.5 ? 8 * x ** 4 : 1 - (-2 * x + 2) ** 4 / 2;
};
const land = (t: number) => {
  const c = 0.9;
  const x = t - 1;
  return 1 + (c + 1) * x ** 3 + c * x ** 2;
};
const IMPACT = 0.72;
const drop = (t: number) => {
  if (t < IMPACT) return (t / IMPACT) ** 2;
  const u = (t - IMPACT) / (1 - IMPACT);
  return 1 - 0.035 * Math.sin(u * Math.PI) * (1 - u * 0.5);
};

/*
 * Three's ACES filmic curve (as in its shader), for one linear colour. The depth of
 * field chain tone-maps the whole frame at the end, the room's background included,
 * which a direct render leaves alone. It also clears its buffer with the clear value
 * already encoded for the screen, which encodes it twice. So for that chain the
 * background is set to the colour that comes out as the room's own after both, and
 * the two paths show the same room.
 */
function aces([r, g, b]: number[], exposure: number) {
  const e = exposure / 0.6;
  const [x, y, z] = [r! * e, g! * e, b! * e];
  const i = [0.59719 * x + 0.35458 * y + 0.04823 * z, 0.076 * x + 0.90834 * y + 0.01566 * z, 0.0284 * x + 0.13383 * y + 0.83777 * z];
  const f = i.map((v) => (v * (v + 0.0245786) - 0.000090537) / (v * (0.983729 * v + 0.432951) + 0.238081));
  return [
    1.60475 * f[0]! - 0.53108 * f[1]! - 0.07367 * f[2]!,
    -0.10208 * f[0]! + 1.10813 * f[1]! - 0.00605 * f[2]!,
    -0.00327 * f[0]! - 0.07276 * f[1]! + 1.07602 * f[2]!,
  ].map((v) => Math.min(1, Math.max(0, v)));
}
function beforeACES(target: THREE.Color, exposure: number) {
  const want = [target.r, target.g, target.b];
  let guess = [...want];
  for (let n = 0; n < 60; n++) {
    const got = aces(guess, exposure);
    guess = guess.map((v, i) => Math.max(0, v * (want[i]! / Math.max(1e-6, got[i]!))));
  }
  return new THREE.Color(guess[0], guess[1], guess[2]);
}

/** Is real-time 3D available here? */
export function canRun3D() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

/*
 * The camera's shots: [progress, target (x, y, z), azimuth°, elevation°, distance as
 * a share of the full shot]. Azimuth turns from the front (0) toward the right side.
 */
type Shot = [number, [number, number, number], number, number, number];
const HERO: [[number, number, number], number, number, number] = [[4, 66, 34], 34, 22, 1];
const SHOTS: Shot[] = [
  // Three beats: the base (plinth and case), the face, the desk; then the whole.
  [0, [0, 4, 0], 24, 10, 0.42], //            low and close on the floor: the plinth settles
  [0.06, [0, 18, 0], 26, 12, 0.48], //        waiting for the case
  [0.2, [0, 92, 0], 32, 18, 0.86], //         pulled back as it lands
  [0.33, [0, 117, 69], 14, 8, 0.42], //       pushing in on the face: the screen seats
  [0.46, [-14, 46, 69], 20, 10, 0.32], //     down the face: badge, floppy slot, jack
  [0.57, [0, 8, 114], 26, 30, 0.44], //       down to the floor: the keyboard slides in
  [0.68, [16, 8, 114], 40, 36, 0.38], //      following the keys as they ripple in
  [0.8, [103, 5, 123], 52, 30, 0.34], //      the mouse arrives
  [0.92, ...HERO], //                         pulled out: the whole machine, held a beat
  [1, ...HERO],
];

export function run3D(root: HTMLElement, finish: () => void) {
  primeSignature();
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const small = matchMedia("(max-width: 640px), (pointer: coarse)").matches;
  const html = document.documentElement;

  /* ---------------------------------------------------------- renderer */
  const canvas = document.createElement("canvas");
  canvas.className = "intro-3d";
  root.appendChild(canvas);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, small ? 1.5 : 2));
  renderer.setClearColor(BG, 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = env;
  scene.environmentIntensity = 0.32;

  /* -------------------------------------------------------------- light */
  RectAreaLightUniformsLib.init();
  const key = new THREE.DirectionalLight("#fff4e8", 2.4);
  key.position.set(-170, 300, 260);
  key.castShadow = true;
  key.shadow.mapSize.set(small ? 1024 : 2048, small ? 1024 : 2048);
  Object.assign(key.shadow.camera, { left: -220, right: 220, top: 220, bottom: -220, near: 50, far: 900 });
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.6;
  key.shadow.radius = 4;
  scene.add(key);
  const rim = new THREE.DirectionalLight("#c9d6ea", 0.9);
  rim.position.set(240, 160, -260);
  scene.add(rim);
  scene.add(new THREE.HemisphereLight("#cdd6e2", "#0b0c0e", 0.32));
  // The tube's light on the room, brought up as it warms.
  const crtLight = new THREE.RectAreaLight("#cfdbec", 0, SCREEN.w, SCREEN.h);
  crtLight.position.copy(SCREEN.centre).add(new THREE.Vector3(0, 0, 0.8));
  crtLight.lookAt(SCREEN.centre.clone().add(new THREE.Vector3(0, 0, 10)));
  scene.add(crtLight);

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000), new THREE.ShadowMaterial({ opacity: 0.5 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  /* -------------------------------------------------------------- model */
  const { root: model, parts, screen } = buildModel(materials());
  scene.add(model);
  model.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (mesh.isMesh) mesh.frustumCulled = false;
  });
  const homes = new Map<THREE.Object3D, THREE.Vector3>();
  for (const p of parts) homes.set(p.object, p.object.position.clone());
  // The meshes in each part that carry a soft shape to morph from (model.ts, withSoftShape).
  const morphs = new Map<BuildPart, THREE.Mesh[]>();
  for (const p of parts) {
    const list: THREE.Mesh[] = [];
    p.object.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && m.morphTargetInfluences?.length) list.push(m);
    });
    if (list.length) morphs.set(p, list);
  }

  /* ------------------------------------------------------------- camera */
  const camera = new THREE.PerspectiveCamera(FOV, 1, 1, 5000);
  let heroDistance = 600;
  const cam = { tx: 0, ty: 0, tz: 0, az: 0, el: 0, ld: 0, vtx: 0, vty: 0, vtz: 0, vaz: 0, vel: 0, vld: 0 };
  const SPRING = { k: 24, c: 2 * Math.sqrt(24) };

  function size() {
    const w = innerWidth;
    const h = innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    composer?.setSize(w, h);
    // The whole machine (a sphere about 175 across) fills the frame at the hero
    // distance, whichever way the window is turned.
    const v = THREE.MathUtils.degToRad(FOV) / 2;
    const hz = Math.atan(Math.tan(v) * camera.aspect);
    heroDistance = 175 / Math.sin(Math.min(v, hz));
  }

  const shotAt = (p: number) => {
    let i = 0;
    while (i + 1 < SHOTS.length - 1 && SHOTS[i + 1]![0] <= p) i++;
    const a = SHOTS[i]!;
    const b = SHOTS[Math.min(i + 1, SHOTS.length - 1)]!;
    const t = b[0] > a[0] ? smoothstep((p - a[0]) / (b[0] - a[0])) : 1;
    const mix = (x: number, y: number) => x + (y - x) * t;
    return {
      tx: mix(a[1][0], b[1][0]),
      ty: mix(a[1][1], b[1][1]),
      tz: mix(a[1][2], b[1][2]),
      az: mix(a[2], b[2]),
      el: mix(a[3], b[3]),
      ld: Math.log(mix(a[4], b[4])),
    };
  };
  const hero = () => ({ tx: HERO[0][0], ty: HERO[0][1], tz: HERO[0][2], az: HERO[1], el: HERO[2], ld: 0 });

  function placeCamera(c: { tx: number; ty: number; tz: number; az: number; el: number; ld: number }, distance = heroDistance * Math.exp(c.ld)) {
    const az = THREE.MathUtils.degToRad(c.az);
    const el = THREE.MathUtils.degToRad(c.el);
    camera.position.set(c.tx + distance * Math.cos(el) * Math.sin(az), c.ty + distance * Math.sin(el), c.tz + distance * Math.cos(el) * Math.cos(az));
    camera.lookAt(c.tx, c.ty, c.tz);
    return distance;
  }
  function follow(dt: number, target: ReturnType<typeof hero>) {
    for (let left = dt; left > 1e-6; left -= 1 / 240) {
      const h = Math.min(left, 1 / 240);
      for (const k of ["tx", "ty", "tz", "az", "el", "ld"] as const) {
        const v = `v${k}` as const;
        cam[v] += (SPRING.k * (target[k] - cam[k]) - SPRING.c * cam[v]) * h;
        cam[k] += cam[v] * h;
      }
    }
  }
  const settled = () => {
    const h = hero();
    return Math.abs(cam.ld) < 0.004 && Math.abs(cam.az - h.az) < 0.2 && Math.abs(cam.el - h.el) < 0.2 && Math.abs(cam.tx - h.tx) + Math.abs(cam.ty - h.ty) + Math.abs(cam.tz - h.tz) < 1;
  };

  /* ------------------------------------------------- depth of field */
  let composer: EffectComposer | null = null;
  let bokeh: BokehPass | null = null;
  if (!small && !still) {
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    bokeh = new BokehPass(scene, camera, { focus: 300, aperture: 0, maxblur: 0.006 });
    composer.addPass(bokeh);
    composer.addPass(new OutputPass());
  }
  const setFocus = (distance: number, closeness: number) => {
    if (!bokeh) return;
    const u = bokeh.uniforms as Record<string, { value: number }>;
    u.focus!.value = distance;
    u.aperture!.value = 0.00006 * closeness;
  };

  /* ------------------------------------------------------ the build */
  function setBuild(p: number) {
    for (const part of parts) {
      const t = clamp01((p - part.start) / part.dur);
      applyPart(part, t);
    }
  }
  function applyPart(part: BuildPart, t: number) {
    const o = part.object;
    if (part.shadow) {
      (part.shadow.material as THREE.MeshBasicMaterial).opacity = smoothstep(t) ** 2;
      const k = 1.4 - 0.4 * smoothstep(t);
      part.shadow.scale.set(k, k, 1);
      return;
    }
    if (part.draw) {
      for (const m of part.draw) {
        const idx = m.geometry.index!.count;
        m.geometry.setDrawRange(0, Math.round((ease3(t) * idx) / 6) * 6);
      }
      return;
    }
    o.visible = t > 0;
    if (part.settle) return settle(part, t);
    const e = t >= 1 ? 1 : part.heavy ? drop(t) : land(t);
    o.position.copy(homes.get(o)!).addScaledVector(part.from, 1 - e);
    // Soft to crisp: a part travels soft and firms into its shape as it lands. Heavy
    // parts stay soft until they hit, then firm through the rebound.
    const firm = part.heavy ? smoothstep((t - IMPACT * 0.85) / (1 - IMPACT * 0.85)) : smoothstep((t - 0.25) / 0.75);
    const soft = t >= 1 ? 0 : 1 - firm;
    for (const m of morphs.get(part) ?? []) m.morphTargetInfluences![0] = soft;
    if (part.heavy && t >= IMPACT && !o.userData.landed) {
      o.userData.landed = true;
      // The weight lands: a small jolt.
      cam.vty -= Math.min(26, part.from.length() * 0.09);
    }
  }

  /*
   * A key set down: it fades in as it falls a short way, accelerating, levels from a
   * slight tilt as it comes, meets its switch, gives one small rebound and is still.
   * Opaque again once it lands, so it sorts and shadows like any other part.
   */
  function settle(part: BuildPart, t: number) {
    const { mesh, tilt } = part.settle!;
    const material = mesh.material as THREE.MeshPhysicalMaterial;
    const home = homes.get(part.object)!;
    const CONTACT = 0.64;
    let y = 0;
    let lean = 0;
    if (t < 1) {
      if (t < CONTACT) {
        const u = t / CONTACT;
        y = part.from.y * (1 - u * u);
        lean = 1 - smoothstep(u);
      } else {
        const u = (t - CONTACT) / (1 - CONTACT);
        y = part.from.y * 0.045 * Math.sin(Math.PI * u) * (1 - u);
        lean = -0.18 * Math.sin(Math.PI * u) * (1 - u);
      }
    }
    part.object.position.set(home.x, home.y + y, home.z);
    mesh.rotation.set(tilt[0] * lean, 0, tilt[1] * lean);
    const opacity = t >= 1 ? 1 : smoothstep(t / 0.5);
    const fading = opacity < 1;
    if (material.transparent !== fading) {
      material.transparent = fading;
      material.depthWrite = !fading;
      material.needsUpdate = true;
    }
    material.opacity = opacity;
    // No shadow from a key that is still mostly air.
    mesh.castShadow = opacity > 0.6;
  }

  /* ------------------------------------------------- the page on the glass */
  // Where the window sits on the glass when the camera has landed: the largest
  // rectangle of the window's shape that fits inside the screen, off its corners.
  function landingFrame() {
    const aspect = innerWidth / innerHeight;
    const gw = SCREEN.w - SCREEN.r * 0.8;
    const gh = SCREEN.h - SCREEN.r * 0.8;
    return aspect > gw / gh ? { w: gw, h: gw / aspect } : { w: gh * aspect, h: gh };
  }
  let snapshot: HTMLImageElement | null = null;
  let snapshotSettled = false;
  function takeSnapshot() {
    fitIntro();
    const page = document.querySelector<HTMLElement>(".page");
    if (!page) return void (snapshotSettled = true);
    domToPng(page, {
      width: innerWidth,
      height: innerHeight,
      scale: Math.min(2, devicePixelRatio || 1),
      style: { opacity: "1" },
      // The cards and the contact keys arrive after the signature, so not on the glass.
      filter: (node) => !(node instanceof HTMLElement && (node.classList.contains("card") || node.classList.contains("contact"))),
      timeout: 1500,
    })
      .then(
        (url) =>
          new Promise<void>((done) => {
            const img = new Image();
            img.onload = () => {
              snapshot = img;
              done();
            };
            img.onerror = () => done();
            img.src = url;
          }),
      )
      .catch(() => {})
      .finally(() => (snapshotSettled = true));
  }
  function paintPage() {
    const frame = landingFrame();
    const ppu = (innerWidth / frame.w) * Math.min(2, devicePixelRatio || 1); // canvas pixels per unit
    const c = document.createElement("canvas");
    c.width = Math.round(SCREEN.w * ppu);
    c.height = Math.round(SCREEN.h * ppu);
    const g = c.getContext("2d")!;
    const css = getComputedStyle(html);
    g.fillStyle = css.getPropertyValue("--bg").trim() || "#131518";
    g.fillRect(0, 0, c.width, c.height);
    // The window's rectangle, centred on the glass.
    const fx = (c.width - frame.w * ppu) / 2;
    const fy = (c.height - frame.h * ppu) / 2;
    const px = (frame.w * ppu) / innerWidth; // canvas pixels per window pixel
    // The page's dot grid, registered to the window's 16 px tiles.
    g.fillStyle = css.getPropertyValue("--dot").trim() || "#1f2226";
    for (let y = fy % (16 * px) - 16 * px; y < c.height; y += 16 * px) {
      for (let x = fx % (16 * px) - 16 * px; x < c.width; x += 16 * px) {
        g.beginPath();
        g.arc(x + 8 * px, y + 8 * px, px, 0, Math.PI * 2);
        g.fill();
      }
    }
    if (snapshot) g.drawImage(snapshot, fx, fy, frame.w * ppu, frame.h * ppu);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    screen.page.material.map = tex;
    screen.page.material.needsUpdate = true;
  }

  /* How big the glass is on screen, in device pixels, for the grain and scanlines. */
  const corner = new THREE.Vector3();
  const buffer = new THREE.Vector2();
  function measureGlass() {
    renderer.getDrawingBufferSize(buffer);
    corner.set(SCREEN.centre.x - SCREEN.w / 2, SCREEN.centre.y + SCREEN.h / 2, SCREEN.centre.z).project(camera);
    const [x0, y0] = [corner.x, corner.y];
    corner.set(SCREEN.centre.x + SCREEN.w / 2, SCREEN.centre.y - SCREEN.h / 2, SCREEN.centre.z).project(camera);
    screen.glow.material.uniforms.uPixels!.value.set((Math.abs(corner.x - x0) / 2) * buffer.x, (Math.abs(corner.y - y0) / 2) * buffer.y);
  }

  /* ---------------------------------------------------------- timeline */
  let ready = false;
  const loaded = document.readyState === "complete" ? Promise.resolve() : new Promise<void>((done) => addEventListener("load", () => done(), { once: true }));
  Promise.race([Promise.all([loaded, document.fonts?.ready]), new Promise((done) => setTimeout(done, 8000))]).then(() => {
    ready = true;
    takeSnapshot();
  });

  let phase: Phase = "load";
  let clock = 0;
  let loadClock = 0;
  let shown = 0;
  let snapshotWait = 0;
  let frame = 0;
  let previous = 0;
  let zoomFrom = hero();

  const enter = (next: Phase) => {
    phase = next;
    clock = 0;
    root.dataset.phase = next;
    if (next === "boot") paintPage();
    if (next === "zoom") zoomFrom = { tx: cam.tx, ty: cam.ty, tz: cam.tz, az: cam.az, el: cam.el, ld: cam.ld };
    if (next === "fade") {
      html.dataset.intro = "done";
      root.dataset.stage = "fade";
    }
    if (next === "done") finish();
  };

  const roomClear = new THREE.Color(BG);
  const fxClear = beforeACES(roomClear, renderer.toneMappingExposure).convertSRGBToLinear();
  function render() {
    if (composer && phase !== "zoom" && phase !== "fade") {
      renderer.setClearColor(fxClear, 1);
      composer.render();
    } else {
      renderer.setClearColor(roomClear, 1);
      renderer.render(scene, camera);
    }
  }

  function tick(now: number) {
    const dt = previous ? Math.min((now - previous) / 1000, 1 / 30) : 1 / 60;
    previous = now;
    clock += dt;
    screen.glow.material.uniforms.uTime!.value = now / 1000;
    measureGlass();

    if (phase === "load") {
      loadClock += dt;
      const target = ready && loadClock >= MIN_LOAD ? 1 : Math.min(0.94, (loadClock / MIN_LOAD) * 0.94);
      shown = still ? target : shown + (target - shown) * (1 - Math.exp(-dt / 0.16));
      setBuild(still ? 1 : shown);
      follow(dt, still ? hero() : shotAt(shown));
      if (target === 1 && shown > 0.995) {
        setBuild(1);
        if (!snapshotSettled) snapshotWait += dt;
        if ((still || settled()) && (snapshotSettled || snapshotWait > SNAPSHOT_WAIT)) enter("hold");
      }
    } else if (phase === "hold") {
      follow(dt, hero());
      // The settle: the whole machine gives one small breath as it comes together.
      const u = clamp01(clock / 0.55);
      const breath = Math.sin(u * Math.PI) * (1 - u * 0.4);
      model.scale.set(1 + 0.004 * breath, 1 - 0.012 * breath, 1 + 0.004 * breath);
      if (clock >= HOLD) model.scale.set(1, 1, 1);
      if (clock >= HOLD) enter("power");
    } else if (phase === "power") {
      follow(dt, hero());
      // The CRT warms up: a bright line opens out into the picture.
      const t = clock;
      const sx = t < 0.14 ? ease3(t / 0.14) : 1;
      const sy = t < 0.14 ? 0.012 : 0.012 + 0.988 * ease3((t - 0.14) / 0.3);
      screen.glow.scale.set(sx, sy, 1);
      const g = screen.glow.material.uniforms;
      g.uOpacity!.value = 1;
      g.uOpen!.value = (sy - 0.012) / 0.988;
      g.uWarm!.value = smoothstep(t / POWER);
      crtLight.intensity = 26 * sx * Math.sqrt(sy);
      if (t >= POWER) enter("boot");
    } else if (phase === "boot") {
      follow(dt, hero());
      // The page comes up on the glass; a dark page throws less light.
      const e = smoothstep(clock / 0.45);
      // The static clears into the page: the grain goes last.
      screen.page.material.opacity = e;
      screen.glow.material.uniforms.uOpacity!.value = (1 - e) ** 1.6;
      crtLight.intensity = 26 - 19 * e;
      if (clock >= BOOT) enter("zoom");
    } else if (phase === "zoom") {
      const e = easeInOut(clock / ZOOM);
      // Square to the glass, at the distance where the window's rectangle on it
      // exactly fills the frame.
      const fr = landingFrame();
      const end = (fr.h / 2) / Math.tan(THREE.MathUtils.degToRad(FOV) / 2);
      const from = heroDistance * Math.exp(zoomFrom.ld);
      const c = SCREEN.centre;
      const mix = (a: number, b: number) => a + (b - a) * e;
      placeCamera(
        { tx: mix(zoomFrom.tx, c.x), ty: mix(zoomFrom.ty, c.y), tz: mix(zoomFrom.tz, c.z), az: mix(zoomFrom.az, 0), el: mix(zoomFrom.el, 0), ld: 0 },
        Math.exp(Math.log(from) + (Math.log(end) - Math.log(from)) * e),
      );
      // The glass's reflection clears as it fills the view, so the page is exact.
      screen.glass.material.opacity = 0.22 * (1 - smoothstep(e * 1.4));
      root.style.setProperty("--vig", "0");
      if (clock >= ZOOM) enter("fade");
    } else if (phase === "fade") {
      if (clock >= (still ? 0.3 : FADE)) enter("done");
    }

    if (phase === "load" || phase === "hold" || phase === "power" || phase === "boot") {
      const d = placeCamera(cam);
      const closeness = clamp01((-cam.ld) / 1.1);
      setFocus(d, closeness);
      root.style.setProperty("--vig", closeness.toFixed(3));
    }
    render();
    frame = phase === "done" ? 0 : requestAnimationFrame(tick);
  }

  // Open on the first shot.
  const first = still ? hero() : shotAt(0);
  Object.assign(cam, first);
  size();
  setBuild(0);
  addEventListener("resize", size);
  root.dataset.mode = "3d";
  // Compile the fading keys' shader now, so the first key to appear doesn't stall.
  const warm = parts.find((p) => p.settle);
  if (warm) {
    const m = warm.settle!.mesh.material as THREE.MeshPhysicalMaterial;
    m.transparent = true;
    warm.object.visible = true;
    renderer.compile(scene, camera);
    m.transparent = false;
    m.needsUpdate = true;
    warm.object.visible = false;
  }
  frame = requestAnimationFrame(tick);

  return () => {
    cancelAnimationFrame(frame);
    removeEventListener("resize", size);
    renderer.dispose();
    pmrem.dispose();
    env.dispose();
    composer?.dispose();
  };
}
