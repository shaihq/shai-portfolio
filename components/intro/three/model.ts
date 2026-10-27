import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

/*
 * The Macintosh as a real 3D model, built part by part so the loader can assemble
 * it. Dimensions follow the illustration (macintosh.ts), in the same units (about
 * 2 mm): x right, y up, z toward the viewer; the case front is at z = FRONT.
 *
 * Every part is a group with a build entry: when it comes in (fractions of the
 * build) and how: travelling home from an offset, drawing along (cords), or, for
 * the contact shadows, darkening as the part above comes down. Parts never fade:
 * big ones arrive from out of frame, small ones emerge from inside the surface
 * they sit in, so nothing is ever see-through.
 */

export interface BuildPart {
  object: THREE.Object3D;
  start: number;
  dur: number;
  from: THREE.Vector3;
  /** Falls under gravity, lands with a rebound and jolts the camera. */
  heavy?: boolean;
  /** A cord: grows along its length. */
  draw?: THREE.Mesh[];
  /** Set down into place: a short fall, fading in, levelling from a slight tilt (the keys). */
  settle?: { mesh: THREE.Mesh; tilt: [number, number] };
  /** A contact shadow: darkens with the part above it. */
  shadow?: THREE.Mesh;
}

export const CASE = { w: 124, d: 138, top: 172, plinth: 4 };
export const FRONT = CASE.d / 2;
const CRT = { x0: -42, x1: 42, y0: 82, y1: 152, r: 9 };
const BEZEL = { x0: -50, x1: 50, y0: 74, y1: 160, r: 7 };
const SLOT = { x0: 6, x1: 46, y0: 44, y1: 49.5 };
const BADGE = { x0: -48, x1: -40, y0: 41, y1: 51 };
const JACK = { x0: -52, x1: -44, y0: 8, y1: 13.5 };
// Plans from the illustration: z0 is the back edge (toward the case), d runs to the front.
const KB = { x: -72, z0: 86, w: 144, d: 56 };
const KB_Z = 1.6;
const KB_TOP = 8.6;
const U = 9;
const KEYS_X = -U * 7.5;
const KEYS_Z = 90.5;
const ROWS = [
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2],
  [1.5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1.5],
  [1.75, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2.25],
  [2.25, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2.75],
  [1.5, 1.5, 9, 1.5, 1.5],
];
const ROW_H = [5.6, 5.2, 4.8, 4.4, 4];
const MOUSE = { x: 88, z0: 98, w: 30, d: 50, h: 10 };
const COIL = { x: -48, y: 4.2, r: 2.2, from: 75, to: 84, turns: 7 };
/** The illustration's (x, depth, height) as three's (x, height, depth). */
const ill = ([x, d, h]: [number, number, number]): [number, number, number] => [x, h, d];

/** The screen as the camera ends on it: its centre, plane and size. */
export const SCREEN = {
  // Just proud of the case's face and inside the bezel's raised rim (which stands to
  // FRONT + 1.6), so the glass sits back in it.
  centre: new THREE.Vector3((CRT.x0 + CRT.x1) / 2, (CRT.y0 + CRT.y1) / 2, FRONT + 0.3),
  w: CRT.x1 - CRT.x0,
  h: CRT.y1 - CRT.y0,
  r: CRT.r,
};

/* ------------------------------------------------------------- materials */

function noiseTexture(size = 256, amount = 18) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d")!;
  const img = g.createImageData(size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 128 + (Math.random() - 0.5) * amount * 2;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(6, 6);
  return t;
}

export function materials() {
  const grain = noiseTexture();
  const plastic = (color: string, roughness: number) =>
    new THREE.MeshPhysicalMaterial({
      color,
      roughness,
      metalness: 0,
      clearcoat: 0.12,
      clearcoatRoughness: 0.55,
      bumpMap: grain,
      bumpScale: 0.12,
      roughnessMap: grain,
    });
  return {
    shell: plastic("#3b3e43", 0.58),
    plinth: plastic("#2b2d31", 0.7),
    key: plastic("#44474c", 0.62),
    keyboard: plastic("#383b40", 0.6),
    groove: new THREE.MeshStandardMaterial({ color: "#121316", roughness: 0.9 }),
    slot: new THREE.MeshStandardMaterial({ color: "#07080a", roughness: 0.8 }),
    glassBase: new THREE.MeshStandardMaterial({ color: "#090b0e", roughness: 0.35 }),
    glass: new THREE.MeshPhysicalMaterial({
      color: "#000000",
      roughness: 0.06,
      metalness: 0,
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
      envMapIntensity: 1.4,
    }),
    cord: new THREE.MeshStandardMaterial({ color: "#2a2c30", roughness: 0.45 }),
  };
}
export type Materials = ReturnType<typeof materials>;

/* -------------------------------------------------------------- helpers */

/*
 * The morph: a rounded box carries a second, soft shape as a morph target, the same box
 * with its corners rounded nearly to a pebble and a few percent smaller. Weight 1 is
 * soft, 0 the crisp final shape (run.ts eases it as each part lands). RoundedBoxGeometry
 * has the same vertices for any radius, so the two shapes line up point for point.
 */
function withSoftShape(geo: RoundedBoxGeometry, w: number, h: number, d: number, segments: number, shrink = 0.94) {
  const soft = new RoundedBoxGeometry(w * shrink, h * shrink, d * shrink, segments, (Math.min(w, h, d) * shrink) / 2 * 0.98);
  geo.morphAttributes.position = [soft.attributes.position!];
  geo.morphAttributes.normal = [soft.attributes.normal!];
  geo.morphTargetsRelative = false;
  soft.dispose();
  return geo;
}

/** A rounded box. `soft` gives it the soft shape to firm up from; heavy parts stay rigid. */
const box = (w: number, h: number, d: number, r: number, mat: THREE.Material, segments = 4, soft = true) => {
  const geo = new RoundedBoxGeometry(w, h, d, segments, Math.min(r, w / 2, h / 2, d / 2) * 0.999);
  const m = new THREE.Mesh(soft ? withSoftShape(geo, w, h, d, segments) : geo, mat);
  if (soft) m.morphTargetInfluences = [0];
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
};

function roundedShape(x0: number, y0: number, x1: number, y1: number, r: number) {
  const s = new THREE.Shape();
  s.moveTo(x0 + r, y0);
  s.lineTo(x1 - r, y0);
  s.quadraticCurveTo(x1, y0, x1, y0 + r);
  s.lineTo(x1, y1 - r);
  s.quadraticCurveTo(x1, y1, x1 - r, y1);
  s.lineTo(x0 + r, y1);
  s.quadraticCurveTo(x0, y1, x0, y1 - r);
  s.lineTo(x0, y0 + r);
  s.quadraticCurveTo(x0, y0, x0 + r, y0);
  return s;
}

/** The same outline, drawn the other way round: a hole must wind against its shape. */
function roundedHole(x0: number, y0: number, x1: number, y1: number, r: number) {
  const p = new THREE.Path();
  p.moveTo(x0 + r, y0);
  p.quadraticCurveTo(x0, y0, x0, y0 + r);
  p.lineTo(x0, y1 - r);
  p.quadraticCurveTo(x0, y1, x0 + r, y1);
  p.lineTo(x1 - r, y1);
  p.quadraticCurveTo(x1, y1, x1, y1 - r);
  p.lineTo(x1, y0 + r);
  p.quadraticCurveTo(x1, y0, x1 - r, y0);
  p.lineTo(x0 + r, y0);
  return p;
}

/** A flat rounded rectangle with UVs from 0 to 1 across it. */
function roundedPlane(w: number, h: number, r: number) {
  const g = new THREE.ShapeGeometry(roundedShape(-w / 2, -h / 2, w / 2, h / 2, r), 8);
  const pos = g.attributes.position!;
  const uv = g.attributes.uv!;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / w + 0.5, pos.getY(i) / h + 0.5);
  return g;
}

function radialTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grad.addColorStop(0, "rgba(0,0,0,0.85)");
  grad.addColorStop(0.55, "rgba(0,0,0,0.4)");
  grad.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(c);
}

/*
 * The tube warming up, per pixel: a cool phosphor glow that is brighter in the
 * middle and falls off toward the curved corners, faint scanlines, fine grain that
 * shimmers every frame (heavier while the tube is cold), a slight flicker, and at
 * switch-on a thin line, hottest at its centre. Uniforms: uTime (s), uOpen (how far
 * the picture has opened, 0–1), uWarm (0 cold to 1 warm), uOpacity.
 */
function phosphor() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    toneMapped: false,
    uniforms: {
      uTime: { value: 0 },
      uOpen: { value: 0 },
      uWarm: { value: 0 },
      uOpacity: { value: 0 },
      uGrain: { value: new THREE.Vector2(340, 284) },
      // The glass's size on screen in device pixels (run.ts measures it each frame).
      uPixels: { value: new THREE.Vector2(2000, 2000) },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime, uOpen, uWarm, uOpacity;
      uniform vec2 uGrain;
      uniform vec2 uPixels;
      varying vec2 vUv;
      // Dave Hoskins' hash without sine: even, patternless noise at any scale.
      float hash(vec2 p) {
        vec3 p3 = fract(vec3(p.xyx) * 0.1031);
        p3 += dot(p3, p3.yzx + 33.33);
        return fract((p3.x + p3.y) * p3.z);
      }
      void main() {
        vec2 c = vUv - 0.5;
        // The curved tube: brightest in the middle, dimmer toward the corners.
        float r = length(c * vec2(1.0, 1.2));
        float falloff = pow(smoothstep(0.78, 0.0, r), 1.6);
        // Scanlines, a couple of hundred across the picture.
        // Sized to the pixels the glass covers, one size for the whole glass: on a
        // small screen (a phone) the full count would put several grains and
        // scanlines in one pixel, which shimmer.
        float lines = floor(min(uGrain.y, uPixels.y / 3.0));
        float scan = 0.9 + 0.1 * sin(vUv.y * lines * 3.14159);
        // Grain: a fresh pattern every frame, coarser and stronger while cold.
        float cells = mix(0.55, 1.0, uWarm);
        float frame = floor(uTime * 30.0);
        vec2 grains = floor(min(uGrain * cells, uPixels * 0.5));
        float n = hash(floor(vUv * grains) + vec2(frame * 37.0, frame * 91.0));
        float grain = 1.0 + (n - 0.5) * mix(0.75, 0.38, uWarm);
        float flicker = 0.97 + 0.03 * sin(uTime * 57.0) * sin(uTime * 13.0);
        vec3 phosphor = vec3(0.46, 0.54, 0.64);
        vec3 col = phosphor * (0.16 + 0.84 * falloff) * scan * grain * flicker * mix(0.55, 1.0, uWarm);
        // Switch-on: while the picture is a line, it burns hot at its centre.
        float line = (1.0 - smoothstep(0.0, 0.25, uOpen)) * exp(-c.x * c.x * 9.0);
        col *= 1.0 + 2.6 * line;
        gl_FragColor = vec4(col, uOpacity);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
}

/* --------------------------------------------------------------- model */

export interface Screen {
  /** The page, drawn into a canvas the camera lands on. */
  page: THREE.Mesh<THREE.ShapeGeometry, THREE.MeshBasicMaterial>;
  /** The tube's glow as it warms up (see phosphor()). */
  glow: THREE.Mesh<THREE.ShapeGeometry, THREE.ShaderMaterial>;
  /** The curved glass's reflection over everything. */
  glass: THREE.Mesh<THREE.ShapeGeometry, THREE.MeshPhysicalMaterial>;
}

export function buildModel(mat: Materials) {
  const root = new THREE.Group();
  const parts: BuildPart[] = [];
  const add = (object: THREE.Object3D, start: number, dur: number, from: [number, number, number], extra: Partial<BuildPart> = {}) => {
    root.add(object);
    parts.push({ object, start, dur, from: new THREE.Vector3(...from), ...extra });
    return object;
  };
  const group = (...children: THREE.Object3D[]) => {
    const g = new THREE.Group();
    children.forEach((c) => g.add(c));
    return g;
  };

  // Contact shadows: soft dark pools where things meet the floor.
  const shadowTex = radialTexture();
  const contact = (w: number, d: number, x: number, z: number) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, d),
      new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, opacity: 0, toneMapped: false }),
    );
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, 0.05, z);
    m.renderOrder = -1;
    return m;
  };

  /* The plinth, then the case dropping onto it. */
  const caseShadow = contact(CASE.w * 1.5, CASE.d * 1.45, 0, 0);
  add(caseShadow, 0, 0.22, [0, 0, 0], { shadow: caseShadow });
  // Heavy parts are rigid: a case that wobbles soft as it falls reads as jelly.
  const plinth = box(CASE.w - 6, CASE.plinth, CASE.d - 6, 2, mat.plinth, 4, false);
  plinth.position.set(0, CASE.plinth / 2, 0);
  add(group(plinth), 0, 0.08, [0, 26, 0], { heavy: true });

  const bodyH = CASE.top - CASE.plinth;
  const body = box(CASE.w, bodyH, CASE.d, 9, mat.shell, 6, false);
  body.position.set(0, CASE.plinth + bodyH / 2, 0);
  add(group(body), 0.05, 0.18, [0, 280, 0], { heavy: true });

  /* Details cut into the case: they rise out of its surfaces. */
  const details = new THREE.Group();
  const strip = (w: number, h: number, d: number, x: number, y: number, z: number) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat.groove);
    m.position.set(x, y, z);
    m.receiveShadow = true;
    details.add(m);
  };
  // The carry handle recess and the vents on top.
  const handle = box(84, 1.2, 12, 5.5, mat.groove, 4, false);
  handle.castShadow = false;
  handle.position.set(0, CASE.top - 0.45, -CASE.d / 2 + 14);
  details.add(handle);
  for (let i = 0; i < 9; i++) strip(68, 0.3, 1.4, 0, CASE.top + 0.02, -CASE.d / 2 + 28.7 + i * 3.4);
  // The back cover's seam over the top and down the sides, and the front lip.
  const seamZ = FRONT - 14;
  strip(CASE.w - 14, 0.3, 0.7, 0, CASE.top + 0.02, seamZ);
  strip(0.3, bodyH - 14, 0.7, CASE.w / 2 + 0.02, CASE.plinth + bodyH / 2, seamZ);
  strip(0.3, bodyH - 14, 0.7, -CASE.w / 2 - 0.02, CASE.plinth + bodyH / 2, seamZ);
  strip(CASE.w - 14, 0.6, 0.3, 0, 20, FRONT + 0.02);
  // Side vents on the right, high at the back and low down.
  for (let i = 0; i < 15; i++) strip(0.3, 32, 1.4, CASE.w / 2 + 0.02, CASE.top - 30, -CASE.d / 2 + 12 + i * 3.2);
  for (let i = 0; i < 10; i++) strip(0.3, 14, 1.4, CASE.w / 2 + 0.02, 35, -CASE.d / 2 + 12 + i * 3.2);
  add(details, 0.22, 0.14, [0, -1.2, 0]);

  /* The front: bezel and screen, then the badge, floppy drive and jack, each
     emerging from inside the case. */
  const bezelShape = roundedShape(BEZEL.x0, BEZEL.y0, BEZEL.x1, BEZEL.y1, BEZEL.r);
  bezelShape.holes.push(roundedHole(CRT.x0, CRT.y0, CRT.x1, CRT.y1, CRT.r));
  // As on the real 128K: a flat face with the screen set in by a crisp, shallow step,
  // not a raised, bevelled plate (whose rounded lower edge read as a tray under the
  // screen). A fine groove outlines the surround and a thin dark frame holds the glass.
  const bezelGeo = new THREE.ExtrudeGeometry(bezelShape, { depth: 0.5, bevelEnabled: false, curveSegments: 16 });
  const bezel = new THREE.Mesh(bezelGeo, mat.shell);
  bezel.castShadow = false;
  bezel.receiveShadow = true;
  bezel.position.z = FRONT - 0.1;
  const ring = (x0: number, y0: number, x1: number, y1: number, r: number, inset: number, z: number) => {
    const shape = roundedShape(x0, y0, x1, y1, r);
    shape.holes.push(roundedHole(x0 + inset, y0 + inset, x1 - inset, y1 - inset, Math.max(0.5, r - inset)));
    const m = new THREE.Mesh(new THREE.ShapeGeometry(shape, 16), mat.groove);
    m.position.z = z;
    m.receiveShadow = true;
    return m;
  };
  const groove = ring(BEZEL.x0 - 0.7, BEZEL.y0 - 0.7, BEZEL.x1 + 0.7, BEZEL.y1 + 0.7, BEZEL.r + 0.7, 0.55, FRONT + 0.02);
  const frame = ring(CRT.x0 - 1.4, CRT.y0 - 1.4, CRT.x1 + 1.4, CRT.y1 + 1.4, CRT.r + 1.4, 1.4, FRONT + 0.42);

  const screenW = SCREEN.w;
  const screenH = SCREEN.h;
  const at = <M extends THREE.Mesh>(m: M, dz: number) => {
    m.position.set(SCREEN.centre.x, SCREEN.centre.y, SCREEN.centre.z + dz);
    return m;
  };
  const glassBase = at(new THREE.Mesh(roundedPlane(screenW, screenH, CRT.r), mat.glassBase), -0.05);
  glassBase.receiveShadow = true;
  const page = at(
    new THREE.Mesh(roundedPlane(screenW, screenH, CRT.r), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, toneMapped: false, depthWrite: false })),
    0,
  );
  const glow = at(new THREE.Mesh(roundedPlane(screenW, screenH, CRT.r), phosphor()), 0.02);
  const glass = at(new THREE.Mesh(roundedPlane(screenW, screenH, CRT.r), mat.glass), 0.5);
  page.renderOrder = 1;
  glow.renderOrder = 2;
  glass.renderOrder = 3;
  add(group(groove, bezel, frame, glassBase, page, glow, glass), 0.29, 0.16, [0, 0, -9]);

  const badgeCanvas = document.createElement("canvas");
  badgeCanvas.width = 32;
  badgeCanvas.height = 48;
  const bg = badgeCanvas.getContext("2d")!;
  ["#6fae5c", "#d9b44a", "#d98a3d", "#c85550", "#8d5aa0", "#4f8fc9"].forEach((c, i) => {
    bg.fillStyle = c;
    bg.fillRect(0, i * 8, 32, 8);
  });
  const badgeTex = new THREE.CanvasTexture(badgeCanvas);
  badgeTex.colorSpace = THREE.SRGBColorSpace;
  const badge = new THREE.Mesh(new THREE.PlaneGeometry(BADGE.x1 - BADGE.x0 - 2, BADGE.y1 - BADGE.y0 - 2), new THREE.MeshStandardMaterial({ map: badgeTex, roughness: 0.4 }));
  badge.position.set((BADGE.x0 + BADGE.x1) / 2, (BADGE.y0 + BADGE.y1) / 2, FRONT + 0.15);
  const badgeWell = box(BADGE.x1 - BADGE.x0, BADGE.y1 - BADGE.y0, 1, 1.4, mat.groove);
  badgeWell.position.set(badge.position.x, badge.position.y, FRONT - 0.42);
  add(group(badgeWell, badge), 0.4, 0.1, [0, 0, -3]);

  const slot = box(SLOT.x1 - SLOT.x0, SLOT.y1 - SLOT.y0, 2, 2.2, mat.slot);
  slot.position.set((SLOT.x0 + SLOT.x1) / 2, (SLOT.y0 + SLOT.y1) / 2, FRONT - 0.85);
  const eject = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 1, 16), mat.slot);
  eject.rotation.x = Math.PI / 2;
  eject.position.set(SLOT.x1 + 5, SLOT.y0 + 1, FRONT - 0.4);
  add(group(slot, eject), 0.43, 0.1, [0, 0, -3]);

  const jack = box(JACK.x1 - JACK.x0, JACK.y1 - JACK.y0, 2, 1.1, mat.slot);
  jack.position.set((JACK.x0 + JACK.x1) / 2, (JACK.y0 + JACK.y1) / 2, FRONT - 0.85);
  add(group(jack), 0.48, 0.08, [0, 0, -3]);

  /* The keyboard slides in from the front, then its keys drop in, row by row. */
  const kbCx = KB.x + KB.w / 2;
  const kbCz = KB.z0 + KB.d / 2;
  const kbShadow = contact(KB.w * 1.25, KB.d * 1.6, kbCx, kbCz);
  const kbBase = group();
  const feet = [
    [KB.x + 8, KB.z0 + 8],
    [KB.x + KB.w - 8, KB.z0 + 8],
    [KB.x + 8, KB.z0 + KB.d - 8],
    [KB.x + KB.w - 8, KB.z0 + KB.d - 8],
  ];
  for (const [x, z] of feet) {
    const f = new THREE.Mesh(new THREE.CylinderGeometry(2.8, 2.8, KB_Z, 16), mat.plinth);
    f.position.set(x!, KB_Z / 2, z!);
    kbBase.add(f);
  }
  const kbBody = box(KB.w, KB_TOP - KB_Z, KB.d, 3.5, mat.keyboard);
  kbBody.position.set(kbCx, KB_Z + (KB_TOP - KB_Z) / 2, kbCz);
  kbBase.add(kbBody);
  const well = box(U * 15 + 2.8, 0.6, U * 5 + 2.8, 1.8, mat.groove);
  well.castShadow = false;
  well.position.set(0, KB_TOP - 0.2, KEYS_Z - 1.4 + (U * 5 + 2.8) / 2);
  kbBase.add(well);
  kbShadow.material.opacity = 1;
  kbBase.add(kbShadow);
  add(kbBase, 0.5, 0.12, [0, 0, 150]);

  const keyGeo = new Map<string, RoundedBoxGeometry>();
  ROWS.forEach((row, r) => {
    let x = KEYS_X;
    row.forEach((width, c) => {
      const w = width * U - 1.4;
      const h = ROW_H[r]!;
      const k = `${w}|${h}`;
      if (!keyGeo.has(k)) keyGeo.set(k, new RoundedBoxGeometry(w, h, U - 1.4, 3, 1.1));
      // Its own copy of the material, to fade in on its own.
      const key = new THREE.Mesh(keyGeo.get(k)!, mat.key.clone());
      key.castShadow = key.receiveShadow = true;
      key.position.set(x + (width * U) / 2, KB_TOP + h / 2, KEYS_Z + r * U + U / 2);
      // Each key is set down onto its switch from just above, in a sweep from the
      // back left to the front right, a touch irregular, as if by hand.
      const start = 0.58 + r * 0.022 + c * 0.0055 + Math.random() * 0.006;
      add(group(key), start, 0.085, [0, 10, 0], { settle: { mesh: key, tilt: [(Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.3] } });
      x += width * U;
    });
  });

  /* The mouse slides in from the right. */
  const mouse = group();
  const mouseBody = box(MOUSE.w, MOUSE.h, MOUSE.d, 7, mat.keyboard, 6);
  mouseBody.position.set(MOUSE.x + MOUSE.w / 2, MOUSE.h / 2, MOUSE.z0 + MOUSE.d / 2);
  // The one button across the back third, toward the cord.
  const button = box(MOUSE.w - 6, 1.2, 15, 2, mat.key);
  button.position.set(MOUSE.x + MOUSE.w / 2, MOUSE.h + 0.2, MOUSE.z0 + 3 + 7.5);
  const mouseShadow = contact(MOUSE.w * 1.7, MOUSE.d * 1.5, MOUSE.x + MOUSE.w / 2, MOUSE.z0 + MOUSE.d / 2);
  mouseShadow.material.opacity = 1;
  mouse.add(mouseBody, button, mouseShadow);
  add(mouse, 0.71, 0.1, [140, 0, 0]);

  /* Cords: they draw along their length. */
  const tube = (points: [number, number, number][], radius = 0.8, segments = 120) => {
    const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...ill(p))));
    const m = new THREE.Mesh(new THREE.TubeGeometry(curve, segments, radius, 8, false), mat.cord);
    m.castShadow = true;
    m.geometry.setDrawRange(0, 0);
    return m;
  };
  // From the mouse's nose, round the right of the case, to the port on the back.
  const cx = MOUSE.x + MOUSE.w / 2;
  const mouseCord = tube([
    [cx, MOUSE.z0 + 1, 4],
    [cx, MOUSE.z0 - 3, 1.4],
    [cx - 3, MOUSE.z0 - 12, 0.9],
    [86, 60, 0.9],
    [78, 20, 0.9],
    [74, -30, 0.9],
    [70, -64, 0.9],
    [60, -80, 2],
    [40, -78, 10],
  ]);
  add(group(mouseCord), 0.79, 0.11, [0, 0, 0], { draw: [mouseCord] });

  // The keyboard's plug seats in the jack; its cord runs down to the coil and on.
  const plug = box(JACK.x1 - JACK.x0 - 2, JACK.y1 - JACK.y0 - 1.2, 4, 0.8, mat.keyboard);
  plug.position.set((JACK.x0 + JACK.x1) / 2, (JACK.y0 + JACK.y1) / 2, FRONT + 2);
  add(group(plug), 0.76, 0.06, [0, 0, 10]);
  const lead = tube([
    [COIL.x, FRONT + 4, (JACK.y0 + JACK.y1) / 2],
    [COIL.x + 1, FRONT + 5.2, 9],
    [COIL.x + 2, COIL.from - 0.6, 6.4],
    [COIL.x + COIL.r, COIL.from, COIL.y],
  ], 0.7, 40);
  add(group(lead), 0.79, 0.05, [0, 0, 0], { draw: [lead] });
  const helix: [number, number, number][] = [];
  const n = COIL.turns * 16;
  for (let i = 0; i <= n; i++) {
    const a = (i / 16) * Math.PI * 2;
    helix.push([COIL.x + COIL.r * Math.cos(a), COIL.from + ((COIL.to - COIL.from) * i) / n, COIL.y + COIL.r * Math.sin(a)]);
  }
  const coil = tube(helix, 0.55, 300);
  add(group(coil), 0.82, 0.06, [0, 0, 0], { draw: [coil] });
  const tail = tube([
    [COIL.x + COIL.r, COIL.to, COIL.y],
    [COIL.x + 1.4, COIL.to + 1.2, COIL.y],
    [COIL.x, KB.z0 - 1.4, 4.6],
  ], 0.7, 20);
  add(group(tail), 0.86, 0.04, [0, 0, 0], { draw: [tail] });

  const screen: Screen = { page, glow, glass };
  return { root, parts, screen };
}
