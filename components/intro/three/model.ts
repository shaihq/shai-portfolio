import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

/*
 * A late-70s colour monitor, keyboard and mouse as a real 3D model, built part by
 * part so the loader can assemble it: a light grey shell with a dark face and
 * the tube set into it, a control strip below (speaker grille, toggle switches, a
 * tuning drum behind a window, a volume knob, the colour badge), a dark CRT housing
 * behind; a tenkeyless keyboard in two tones on a sloped case; a two-button mouse
 * whose cord loops round to the back. Units are about 2 mm: x right, y up, z toward
 * the viewer; the shell's front is at z = FRONT.
 *
 * Every part is a group with a build entry: when it comes in (fractions of the
 * build) and how: travelling home from an offset, drawing along (cords), or, for
 * the contact shadows, darkening as the part above comes down. The monitor comes
 * down whole; the keyboard and mouse slide in; the keys are set down one by one;
 * the cords draw in last. Every part is rigid, in its final shape throughout.
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
  settle?: { mesh: THREE.Mesh; tilt: [number, number]; pitch?: number };
  /** A contact shadow: darkens with the part above it. */
  shadow?: THREE.Mesh;
}

/** The monitor's putty shell: the front part, ahead of the dark tube housing. */
export const CASE = { w: 136, d: 64, top: 150, plinth: 5 };
export const FRONT = 69;
const SHELL_Z0 = FRONT - CASE.d;
/** The dark face plate, the darker surround the tube sits in, and the tube. */
const PANEL = { x0: -60, x1: 60, y0: 44, y1: 140, r: 4 };
const SURROUND = { x0: -51, x1: 51, y0: 53, y1: 135, r: 8 };
const CRT = { x0: -42, x1: 42, y0: 59, y1: 129, r: 9 };
/** The control strip runs from the plinth up to this seam. */
const BAND_TOP = 40;
const GRILLE = { x0: -62, x1: -26, y0: 11, y1: 35 };
const SWITCHES = { x: -11, y: 25, w: 22, h: 12 };
const TUNING = { x0: 4, x1: 36, y0: 21, y1: 35 };
const KNOB = { x: 51, y: 25 };
const BADGE = { x0: 6, x1: 20, y0: 11.5, y1: 16 };

/* The keyboard: a tenkeyless board on a case that rises toward the back. */
const U = 8.4;
const KB = { x: -84, z0: 84, w: 168, d: 70 };
const KB_FOOT = 0.8;
const KB_FRONT_H = 6;
const KB_BACK_H = 12.5;
const KB_PITCH = Math.atan((KB_BACK_H - KB_FRONT_H) / KB.d);
/** The case top's height at depth z. */
const kbTop = (z: number) => KB_FRONT_H + ((KB_BACK_H - KB_FRONT_H) * (KB.z0 + KB.d - z)) / KB.d;
const KEYS_X = -U * 9.125;
const KEYS_Z = KB.z0 + 9;
const NAV_X = U * 15.25;
const D = true;
type Key = [width: number, dark?: boolean];
const n = (count: number, width = 1, dark = false): Key[] => Array.from({ length: count }, () => [width, dark]);
/** Rows from the back, as [width in keys, dark]; a negative width is a gap. */
const MAIN: Key[][] = [
  [[1, D], [-1], ...n(4), [-0.5], ...n(4, 1, D), [-0.5], ...n(4)],
  [...n(13), [2, D]],
  [[1.5, D], ...n(12), [1.5, D]],
  [[1.75, D], ...n(11), [2.25, D]],
  [[2.25, D], ...n(10), [2.75, D]],
  [...n(3, 1.25, D), [6.25], ...n(4, 1.25, D)],
];
const NAV: Key[][] = [n(3, 1, D), n(3, 1, D), n(3, 1, D), [], [[-1], [1, D]], n(3, 1, D)];
const KEY_H = [4.6, 5.2, 4.9, 4.6, 4.6, 4.9];

const MOUSE = { x: 96, z0: 104, w: 30, d: 46, h: 11 };

/** The screen as the camera ends on it: its centre, plane and size. */
export const SCREEN = {
  // Just proud of the surround it sits in, so the glass sits back in the face.
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

/** Fine ribs round a drum: stripes across a texture that wraps round a cylinder. */
function ribTexture() {
  const c = document.createElement("canvas");
  c.width = 8;
  c.height = 2;
  const g = c.getContext("2d")!;
  g.fillStyle = "#e4e2dd";
  g.fillRect(0, 0, 8, 2);
  g.fillStyle = "#8f8d88";
  g.fillRect(0, 0, 3, 2);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.repeat.set(64, 1);
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
    // A cool grey family, from the same blue-charcoal as the room: light grey shells
    // and keys, slate for the modifiers, the room's own charcoal for the housing.
    shell: plastic("#868b92", 0.5),
    housing: plastic("#1e2126", 0.5),
    plinth: plastic("#15171a", 0.7),
    face: plastic("#15171a", 0.42),
    surround: plastic("#0c0e10", 0.5),
    key: plastic("#959aa1", 0.55),
    keyDark: plastic("#454a51", 0.55),
    keyboard: plastic("#81868d", 0.5),
    well: plastic("#3d4248", 0.6),
    metal: new THREE.MeshPhysicalMaterial({ color: "#c9c8c4", metalness: 0.75, roughness: 0.3, clearcoat: 0.3 }),
    drum: new THREE.MeshStandardMaterial({ map: ribTexture(), roughness: 0.45, metalness: 0.3 }),
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
    cord: new THREE.MeshStandardMaterial({ color: "#7d838a", roughness: 0.5 }),
  };
}
export type Materials = ReturnType<typeof materials>;

/* -------------------------------------------------------------- helpers */

/** A rounded box. Every part is rigid: it arrives in its final shape. */
const box = (w: number, h: number, d: number, r: number, mat: THREE.Material, segments = 4) => {
  const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, segments, Math.min(r, w / 2, h / 2, d / 2) * 0.999), mat);
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

/** A polygon with each corner rounded by its own radius (counter-clockwise points). */
function roundedPolygon(points: [number, number][], radii: number[]) {
  const s = new THREE.Shape();
  const count = points.length;
  points.forEach((p, i) => {
    const prev = points[(i + count - 1) % count]!;
    const next = points[(i + 1) % count]!;
    const r = radii[i]!;
    const towards = (q: [number, number]) => {
      const len = Math.hypot(q[0] - p[0], q[1] - p[1]);
      return [p[0] + ((q[0] - p[0]) * r) / len, p[1] + ((q[1] - p[1]) * r) / len] as const;
    };
    const a = towards(prev);
    const b = towards(next);
    if (i === 0) s.moveTo(a[0], a[1]);
    else s.lineTo(a[0], a[1]);
    s.quadraticCurveTo(p[0], p[1], b[0], b[1]);
  });
  s.closePath();
  return s;
}

/** A flat rounded rectangle with UVs from 0 to 1 across it. */
function roundedPlane(w: number, h: number, r: number) {
  const g = new THREE.ShapeGeometry(roundedShape(-w / 2, -h / 2, w / 2, h / 2, r), 8);
  const pos = g.attributes.position!;
  const uv = g.attributes.uv!;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / w + 0.5, pos.getY(i) / h + 0.5);
  return g;
}

/** A plate with a rounded outline and a rounded hole, `depth` thick, its back at z = 0. */
function frame(
  outer: { x0: number; y0: number; x1: number; y1: number; r: number },
  inner: { x0: number; y0: number; x1: number; y1: number; r: number },
  depth: number,
  mat: THREE.Material,
) {
  const shape = roundedShape(outer.x0, outer.y0, outer.x1, outer.y1, outer.r);
  shape.holes.push(roundedHole(inner.x0, inner.y0, inner.x1, inner.y1, inner.r));
  const m = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 12 }), mat);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/**
 * Printing on a face: a transparent decal over the rectangle (x0, y0)–(x1, y1) of the
 * face plane, drawn in the model's own units (y up, as on the face).
 */
function printed(x0: number, y0: number, x1: number, y1: number, z: number, draw: (g: CanvasRenderingContext2D, at: (x: number, y: number) => [number, number]) => void) {
  const ppu = 28;
  const c = document.createElement("canvas");
  c.width = Math.round((x1 - x0) * ppu);
  c.height = Math.round((y1 - y0) * ppu);
  const g = c.getContext("2d")!;
  g.scale(ppu, ppu);
  g.textAlign = "center";
  g.textBaseline = "middle";
  draw(g, (x, y) => [x - x0, y1 - y]);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(x1 - x0, y1 - y0),
    new THREE.MeshStandardMaterial({ map: tex, transparent: true, depthWrite: false, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -2 }),
  );
  m.position.set((x0 + x1) / 2, (y0 + y1) / 2, z);
  m.receiveShadow = true;
  return m;
}
const TYPE = "Helvetica Neue, Helvetica, Arial, sans-serif";

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
  const strip = (w: number, h: number, d: number, x: number, y: number, z: number, material: THREE.Material = mat.groove) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    m.position.set(x, y, z);
    m.receiveShadow = true;
    return m;
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

  /* The monitor, finished, plinth and controls and all: it comes down in one piece. */
  const caseShadow = contact(CASE.w * 1.5, 150, 0, 4);
  add(caseShadow, 0, 0.22, [0, 0, 0], { shadow: caseShadow });
  const monitor = new THREE.Group();
  const plinth = box(CASE.w - 14, CASE.plinth, CASE.d - 8, 1.5, mat.plinth, 4);
  plinth.position.set(0, CASE.plinth / 2, SHELL_Z0 + CASE.d / 2 - 1);
  monitor.add(plinth);

  const shellH = CASE.top - CASE.plinth;
  const shell = box(CASE.w, shellH, CASE.d, 5, mat.shell, 6);
  shell.position.set(0, CASE.plinth + shellH / 2, SHELL_Z0 + CASE.d / 2);
  // The tube's housing behind it, stepping down toward the neck.
  const housing = box(128, 134, 48, 10, mat.housing, 6);
  housing.position.set(0, CASE.plinth + 67, SHELL_Z0 - 22);
  const neck = box(92, 96, 34, 12, mat.housing, 6);
  neck.position.set(0, CASE.plinth + 62, SHELL_Z0 - 56);
  monitor.add(shell, housing, neck);

  /* Details on the shell. */
  const details = new THREE.Group();
  // The control strip's seam round the front and sides, standing a clear 0.1 off the
  // surface (closer, and the shell shows through it in flecks).
  details.add(strip(CASE.w - 10, 0.5, 0.3, 0, BAND_TOP, FRONT + 0.1));
  details.add(strip(0.3, 0.5, CASE.d - 8, CASE.w / 2 + 0.1, BAND_TOP, SHELL_Z0 + CASE.d / 2));
  details.add(strip(0.3, 0.5, CASE.d - 8, -CASE.w / 2 - 0.1, BAND_TOP, SHELL_Z0 + CASE.d / 2));
  monitor.add(details);
  // Cooling fins standing off the side, low at the front.
  const fins = new THREE.Group();
  for (let i = 0; i < 5; i++) {
    const fin = box(2.4, 13, 1.7, 0.7, mat.shell, 3);
    fin.position.set(CASE.w / 2 + 0.6, 21, FRONT - 7 - i * 3.6);
    fins.add(fin);
  }
  monitor.add(fins);

  /*
   * The face: a dark plate, the darker surround, a fine black frame, and the tube.
   * Flat rings, one a clear 0.1 in front of the next, with no walls between them: a
   * step's wall here is a fraction of a pixel wide (less on a phone), and a line that
   * thin breaks into beads that crawl as the camera moves. Each ring tucks its outer
   * edge under the one in front, so no two edges coincide.
   */
  type Rect = { x0: number; y0: number; x1: number; y1: number; r: number };
  const grow = (o: Rect, by: number): Rect => ({ x0: o.x0 - by, y0: o.y0 - by, x1: o.x1 + by, y1: o.y1 + by, r: o.r + by });
  const ring = (outer: Rect, inner: Rect, z: number, material: THREE.Material) => {
    const shape = roundedShape(outer.x0, outer.y0, outer.x1, outer.y1, outer.r);
    shape.holes.push(roundedHole(inner.x0, inner.y0, inner.x1, inner.y1, inner.r));
    const m = new THREE.Mesh(new THREE.ShapeGeometry(shape, 16), material);
    m.position.z = z;
    m.receiveShadow = true;
    return m;
  };
  const plate = ring(PANEL, SURROUND, FRONT + 0.3, mat.face);
  const surround = ring(grow(SURROUND, 0.4), grow(CRT, 1.4), FRONT + 0.2, mat.surround);
  // Solid, not a ring: through a hole the size of the glass, the light shell would show
  // in a sliver beside the glass, which stands in front of it.
  const backing = grow(CRT, 1.8);
  const glassFrame = new THREE.Mesh(new THREE.ShapeGeometry(roundedShape(backing.x0, backing.y0, backing.x1, backing.y1, backing.r), 16), mat.groove);
  glassFrame.position.z = FRONT + 0.1;
  glassFrame.receiveShadow = true;
  // The face's printing: the channel scale under the tube, the supply at the top right.
  // Kept off the tube, so nothing transparent ever lies over the glass.
  const scalePrint = printed(PANEL.x0 + 2, PANEL.y0 + 1, PANEL.x1 - 2, SURROUND.y0 - 0.5, FRONT + 0.4, (g, to) => {
    g.fillStyle = "rgba(170,170,166,0.7)";
    g.font = `500 1.5px ${TYPE}`;
    const scale = (y: number, labels: string[]) => labels.forEach((t, i) => t && g.fillText(t, ...to(-38 + i * 7.6, y)));
    scale(49.6, ["VHF", "3 4", "4", "6", "8", "", "", "7 9", "11", "13", "X-CH"]);
    scale(47.2, ["UHF", "14", "20", "30", "46", "16", "65", "70", "60", "80", "X-CHH"]);
  });
  const supplyPrint = printed(SURROUND.x1 + 0.5, SURROUND.y1 - 6, PANEL.x1 - 0.5, PANEL.y1 - 0.5, FRONT + 0.4, (g, to) => {
    g.font = `700 1.9px ${TYPE}`;
    g.fillStyle = "rgba(150,150,146,0.75)";
    g.fillText("AC/DC", ...to((SURROUND.x1 + PANEL.x1) / 2, PANEL.y1 - 2.4));
  });

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
  monitor.add(plate, surround, glassFrame, scalePrint, supplyPrint, glassBase, page, glow, glass);

  /* The control strip. */
  // The speaker grille: a dark well with putty slats standing in it.
  const grille = group();
  const grilleWell = box(GRILLE.x1 - GRILLE.x0, GRILLE.y1 - GRILLE.y0, 1, 1, mat.surround, 3);
  grilleWell.position.set((GRILLE.x0 + GRILLE.x1) / 2, (GRILLE.y0 + GRILLE.y1) / 2, FRONT - 0.3);
  grille.add(grilleWell);
  for (let i = 0; i < 12; i++) {
    const slat = box(1.7, GRILLE.y1 - GRILLE.y0, 2.4, 0.6, mat.shell, 3);
    slat.position.set(GRILLE.x0 + 1.4 + i * 3.02, (GRILLE.y0 + GRILLE.y1) / 2, FRONT + 0.4);
    grille.add(slat);
  }
  monitor.add(grille);

  // Three toggle switches in a grey well.
  const switches = group();
  const switchWell = box(SWITCHES.w, SWITCHES.h, 1.2, 1, mat.well);
  switchWell.position.set(SWITCHES.x, SWITCHES.y, FRONT);
  switches.add(switchWell);
  for (let i = -1; i <= 1; i++) {
    const toggle = box(4.2, 9, 3.4, 0.8, mat.key);
    toggle.position.set(SWITCHES.x + i * 7, SWITCHES.y, FRONT + 1.3);
    switches.add(toggle);
  }
  monitor.add(switches);

  // The tuning drum, ribbed, turning behind a window in a raised frame.
  const tuning = group();
  const pane = { x0: TUNING.x0 + 2, y0: TUNING.y0 + 2, x1: TUNING.x1 - 2, y1: TUNING.y1 - 2, r: 1 };
  const tuningFrame = frame({ ...TUNING, r: 2 }, pane, 1.8, mat.shell);
  tuningFrame.position.z = FRONT - 0.1;
  const tuningWell = strip(pane.x1 - pane.x0, pane.y1 - pane.y0, 0.4, (pane.x0 + pane.x1) / 2, (pane.y0 + pane.y1) / 2, FRONT, mat.surround);
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(5.4, 5.4, pane.x1 - pane.x0 - 2, 64), mat.drum);
  drum.rotation.z = Math.PI / 2;
  drum.position.set((pane.x0 + pane.x1) / 2, (pane.y0 + pane.y1) / 2, FRONT - 4);
  drum.castShadow = drum.receiveShadow = true;
  tuning.add(tuningFrame, tuningWell, drum);
  monitor.add(tuning);

  // The volume knob in its own well.
  const knob = group();
  const knobWell = box(16, 13, 1.2, 1.2, mat.well);
  knobWell.position.set(KNOB.x, KNOB.y, FRONT);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(3.8, 4.2, 4.2, 40), mat.metal);
  cap.rotation.x = Math.PI / 2;
  cap.position.set(KNOB.x, KNOB.y, FRONT + 2.4);
  cap.castShadow = cap.receiveShadow = true;
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(5, 5, 0.8, 40), mat.surround);
  collar.rotation.x = Math.PI / 2;
  collar.position.set(KNOB.x, KNOB.y, FRONT + 0.6);
  knob.add(knobWell, collar, cap);
  monitor.add(knob);

  // The colour badge, and the strip's printing.
  const stripes = (g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) => {
    g.fillStyle = "#1a1a1b";
    g.fillRect(x, y, w, h);
    ["#c8473c", "#4d9a5a", "#3d68b8"].forEach((c, i) => {
      g.fillStyle = c;
      g.fillRect(x + 0.5 + (i * (w - 1)) / 3, y + 0.5, (w - 1) / 3 - 0.25, h - 1);
    });
  };
  const bandPrint = printed(-64, CASE.plinth + 3, 64, BAND_TOP - 0.6, FRONT + 0.1, (g, at) => {
    g.fillStyle = "rgba(58,55,50,0.85)";
    g.font = `600 1.5px ${TYPE}`;
    ["AFC", "RECALL", "BAND"].forEach((t, i) => g.fillText(t, ...at(SWITCHES.x + (i - 1) * 7, SWITCHES.y + 8)));
    ["OFF", "ON", "OFF"].forEach((t, i) => g.fillText(t, ...at(SWITCHES.x + (i - 1) * 7, SWITCHES.y - 8)));
    g.fillText("◂  TUNING  ▸", ...at((TUNING.x0 + TUNING.x1) / 2, TUNING.y1 + 2));
    g.fillText("PULL-ON/VOL", ...at(KNOB.x, KNOB.y + 8.6));
    const [bx, by] = at(BADGE.x0, BADGE.y1);
    stripes(g, bx, by, BADGE.x1 - BADGE.x0, BADGE.y1 - BADGE.y0);
  });
  monitor.add(bandPrint);
  add(monitor, 0.02, 0.2, [0, 280, 0], { heavy: true });

  /* The keyboard slides in from the front, then its keys drop in, row by row. */
  const kbCx = KB.x + KB.w / 2;
  const kbCz = KB.z0 + KB.d / 2;
  const kbShadow = contact(KB.w * 1.2, KB.d * 1.5, kbCx, kbCz);
  const kbBase = group();
  for (const [x, z] of [
    [KB.x + 10, KB.z0 + 8],
    [KB.x + KB.w - 10, KB.z0 + 8],
    [KB.x + 10, KB.z0 + KB.d - 8],
    [KB.x + KB.w - 10, KB.z0 + KB.d - 8],
  ]) {
    const f = new THREE.Mesh(new THREE.CylinderGeometry(2.8, 2.8, KB_FOOT, 16), mat.plinth);
    f.position.set(x!, KB_FOOT / 2, z!);
    kbBase.add(f);
  }
  // The case: its side profile, low at the front and rising toward the back, pushed
  // across the board's width. Profile x is depth (toward the viewer), y height.
  const bevel = 1.2;
  const profile = roundedPolygon(
    [
      [KB.z0 + bevel, KB_FOOT + bevel],
      [KB.z0 + KB.d - bevel, KB_FOOT + bevel],
      [KB.z0 + KB.d - bevel, KB_FRONT_H - bevel],
      [KB.z0 + bevel, KB_BACK_H - bevel],
    ],
    [1, 1, 2.6, 2.6],
  );
  const kbGeo = new THREE.ExtrudeGeometry(profile, { depth: KB.w - 2 * bevel, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 8 });
  // Extruded along z; turn it so the profile's x runs along depth and the extrusion along x.
  kbGeo.rotateY(-Math.PI / 2);
  kbGeo.translate(KB.x + KB.w - bevel, 0, 0);
  const kbBody = new THREE.Mesh(kbGeo, mat.keyboard);
  kbBody.castShadow = kbBody.receiveShadow = true;
  kbBase.add(kbBody);
  // The dark well the keys stand in, on the slope.
  const keysW = U * 18.25 + 2.4;
  const keysD = U * 6.35 + 2.4;
  const wellZ = KEYS_Z - 1.2 + keysD / 2;
  const well = box(keysW, 0.6, keysD, 1.6, mat.surround, 3);
  well.castShadow = false;
  well.rotation.x = KB_PITCH;
  well.position.set(KEYS_X - 1.2 + keysW / 2, kbTop(wellZ) - 0.1, wellZ);
  kbBase.add(well);
  // The colour badge on the front edge, at the right.
  const kbBadge = printed(KB.x + KB.w - 26, 2, KB.x + KB.w - 14, 4.4, KB.z0 + KB.d + 0.1, (g, at) => {
    const [x, y] = at(KB.x + KB.w - 26, 4.4);
    stripes(g, x, y, 12, 2.4);
  });
  kbBase.add(kbBadge);
  kbShadow.material.opacity = 1;
  kbBase.add(kbShadow);
  add(kbBase, 0.3, 0.12, [0, 0, 150]);

  const keyGeo = new Map<string, RoundedBoxGeometry>();
  const placeRow = (row: Key[], r: number, x0: number) => {
    let x = x0;
    const z = KEYS_Z + (r === 0 ? 0 : (r + 0.35) * U) + U / 2;
    row.forEach(([width, dark], c) => {
      if (width < 0) {
        x -= width * U;
        return;
      }
      const w = width * U - 1.4;
      const h = KEY_H[r]!;
      const k = `${w}|${h}`;
      if (!keyGeo.has(k)) keyGeo.set(k, new RoundedBoxGeometry(w, h, U - 1.4, 3, 1.1));
      // Its own copy of the material, to fade in on its own.
      const key = new THREE.Mesh(keyGeo.get(k)!, (dark ? mat.keyDark : mat.key).clone());
      key.castShadow = key.receiveShadow = true;
      key.position.set(x + (width * U) / 2, kbTop(z) - 1.2 + h / 2, z);
      // Each key is set down onto its switch from just above, in a sweep from the
      // back left to the front right, a touch irregular, as if by hand.
      const column = (x - KEYS_X) / U;
      const start = 0.4 + r * 0.028 + column * 0.0055 + Math.random() * 0.006;
      add(group(key), start, 0.085, [0, 10, 0], {
        settle: { mesh: key, tilt: [(Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.3], pitch: KB_PITCH },
      });
      x += width * U;
    });
  };
  MAIN.forEach((row, r) => placeRow(row, r, KEYS_X));
  NAV.forEach((row, r) => placeRow(row, r, KEYS_X + NAV_X));

  /* The mouse slides in from the right. */
  const mouse = group();
  const mcx = MOUSE.x + MOUSE.w / 2;
  const skirt = box(MOUSE.w - 3, 1.4, MOUSE.d - 3, 0.6, mat.plinth, 3);
  skirt.position.set(mcx, 0.7, MOUSE.z0 + MOUSE.d / 2);
  const mouseBody = box(MOUSE.w, MOUSE.h - 1, MOUSE.d, 4.5, mat.keyboard, 6);
  mouseBody.position.set(mcx, 1 + (MOUSE.h - 1) / 2, MOUSE.z0 + MOUSE.d / 2);
  // Two buttons across the back, toward the cord, with a seam between and in front.
  const buttons = [-1, 1].map((side) => {
    const b = box(MOUSE.w / 2 - 3.2, 1.6, 15, 1, mat.keyDark);
    b.position.set(mcx + side * (MOUSE.w / 4 - 0.3), MOUSE.h - 0.1, MOUSE.z0 + 3 + 7.5);
    return b;
  });
  const mouseBadge = printed(MOUSE.z0 + MOUSE.d - 15, 4.2, MOUSE.z0 + MOUSE.d - 5, 6.4, 0, (g, at) => {
    const [x, y] = at(MOUSE.z0 + MOUSE.d - 15, 6.4);
    stripes(g, x, y, 10, 2.2);
  });
  mouseBadge.rotation.y = Math.PI / 2;
  mouseBadge.position.set(MOUSE.x + MOUSE.w + 0.1, 5.3, MOUSE.z0 + MOUSE.d - 10);
  const mouseShadow = contact(MOUSE.w * 1.7, MOUSE.d * 1.5, mcx, MOUSE.z0 + MOUSE.d / 2);
  mouseShadow.material.opacity = 1;
  mouse.add(skirt, mouseBody, ...buttons, mouseBadge, mouseShadow);
  add(mouse, 0.7, 0.1, [140, 0, 0]);

  /* Cords: they draw along their length. */
  const tube = (points: [number, number, number][], radius = 0.8, segments = 140) => {
    const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
    const m = new THREE.Mesh(new THREE.TubeGeometry(curve, segments, radius, 8, false), mat.cord);
    m.castShadow = true;
    m.geometry.setDrawRange(0, 0);
    return m;
  };
  // From the mouse's back, up in a loose loop and down to the floor, round to the
  // tube housing's side.
  const mouseCord = tube([
    [mcx, 4.5, MOUSE.z0 + 1],
    [mcx, 6, MOUSE.z0 - 3],
    [mcx - 2, 7, MOUSE.z0 - 10],
    [mcx - 6, 3, MOUSE.z0 - 18],
    [mcx - 10, 0.9, MOUSE.z0 - 28],
    [96, 0.9, 50],
    [84, 0.9, 20],
    [72, 0.9, -6],
    [64, 3, -18],
    [56, 9, -22],
  ]);
  add(group(mouseCord), 0.8, 0.12, [0, 0, 0], { draw: [mouseCord] });

  // The keyboard's cord, from its back edge in under the monitor.
  const kbCord = tube([
    [-34, 4, KB.z0 + 1],
    [-34, 2.4, KB.z0 - 4],
    [-36, 0.9, KB.z0 - 10],
    [-38, 0.9, FRONT - 6],
  ], 0.75, 40);
  add(group(kbCord), 0.77, 0.06, [0, 0, 0], { draw: [kbCord] });

  const screen: Screen = { page, glow, glass };
  return { root, parts, screen };
}
