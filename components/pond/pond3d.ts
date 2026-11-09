import * as THREE from "three";

/*
 * The pond: the page's background is the surface of dark water, with koi and a
 * school of small fry beneath it.
 *
 *  - The water is a height field simulated on the GPU (a wave equation on a grid a
 *    third of the window's size). Its slope bends what lies under it, the page's own
 *    dot grid and the fish, and catches a soft light on the crests. When it is still
 *    the picture is exactly the page's background, so the pond adds nothing until
 *    something moves.
 *  - Each fish is a spine of points that follows its head, so a turn travels down
 *    the body, with a tail beat running along it. The 3D body, fins and coat are
 *    built once in the fish's own coordinates and bent onto the spine on the GPU.
 *  - Koi meander with a swim-and-glide rhythm, keep off the edges and out of each
 *    other's way, gulp at the surface now and then, and drift over to a resting
 *    cursor. The fry school: they keep together, turn together, keep clear of the
 *    koi and nip at the surface.
 *  - A click is a drop: a ring, droplets landing round it, the rebound falling back.
 *    The nearest fish react first; the fry scatter at once, the koi bolt and calm.
 *    Dragging trails a finger through the water.
 *
 * Under reduced motion the pond is drawn once, still.
 */

const SPINE = 24;
const MAX_DROPS = 24;
const SIM = 3; // css px per water cell

type V3 = [number, number, number];
const WHITE: V3 = [0.9, 0.89, 0.86];
const ORANGE: V3 = [0.95, 0.46, 0.15];
const RED: V3 = [0.84, 0.24, 0.1];
const INK: V3 = [0.06, 0.06, 0.07];
const GOLD: V3 = [0.95, 0.71, 0.27];
const PLATINUM: V3 = [0.8, 0.81, 0.83];
const SILVER: V3 = [0.66, 0.7, 0.67];

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const wrap = (x: number) => Math.atan2(Math.sin(x), Math.cos(x));

/* ------------------------------------------------------------ shaders */

const FISH_VERT = /* glsl */ `
  uniform vec4 uSpine[${SPINE}];
  uniform float uLength;
  uniform float uZ;
  uniform vec2 uFlap;
  uniform vec4 uTail;
  uniform vec3 uTailShape;
  attribute vec3 aLocal;
  attribute vec3 aNorm;
  attribute vec2 aCoord;
  attribute float aKind;
  attribute vec3 aFin;
  varying vec3 vN;
  varying vec2 vCoord;
  varying float vKind;
  varying float vSheen;
  void main() {
    vec3 loc = aLocal;
    vSheen = 0.0;
    if (aKind > 0.5 && aKind < 1.5) {
      // The tail: a fan of rays from the root of the tail, two rounded lobes and a
      // shallow fork. It spreads or narrows (uTail.y), trails behind the body's swing
      // and curls more toward its edge (uTail.x), and a ripple runs out along the
      // rays (phase uTail.z, angle uTail.w).
      float a = aFin.x;
      float rn = aFin.y;
      float aa = abs(a);
      float reach = uTailShape.x * (0.68 + 0.4 * sin(aa * 1.95)) * sqrt(max(0.0, 1.0 - pow(aa, 8.0)));
      float r = reach * rn;
      float wave = uTail.z - rn * 5.0 + a * 1.4;
      float th = a * uTailShape.z * uTail.y + uTail.x * rn * (0.55 + 0.45 * rn) + uTail.w * rn * rn * sin(wave);
      loc.x += cos(th) * r / uLength;
      loc.y += a * uTailShape.y + sin(th) * r;
      vSheen = cos(wave) * rn;
    } else if (aKind > 1.5 && aKind < 2.5) {
      // A paired fin, sculling about its root.
      float sgn = aFin.z;
      float flap = sgn > 0.0 ? uFlap.x : uFlap.y;
      float phi = aFin.x + flap;
      float r = aFin.y * (0.86 + 0.14 * cos(flap * 2.0));
      loc.x += cos(phi) * r / uLength;
      loc.y += sgn * sin(phi) * r;
    }
    float f = clamp(loc.x, 0.0, 1.0) * ${SPINE - 1}.0;
    float fi = min(floor(f), ${SPINE - 2}.0);
    int i = int(fi);
    float t = f - fi;
    vec4 a = uSpine[i];
    vec4 b = uSpine[i + 1];
    vec2 T = normalize(mix(a.zw, b.zw, t));
    vec2 P = mix(a.xy, b.xy, t) - T * (loc.x - clamp(loc.x, 0.0, 1.0)) * uLength;
    vec2 N = vec2(-T.y, T.x);
    vN = vec3(-T * aNorm.x + N * aNorm.y, aNorm.z);
    vCoord = aCoord;
    vKind = aKind;
    gl_Position = projectionMatrix * viewMatrix * vec4(P + N * loc.y, uZ + loc.z, 1.0);
  }
`;

const FISH_FRAG = /* glsl */ `
  uniform vec3 uBase;
  uniform vec4 uPatch[6];
  uniform vec3 uPatchCol[6];
  uniform float uSeed;
  uniform float uClarity;
  uniform float uLength;
  uniform float uWidth;
  uniform float uSheen;
  uniform float uBack;
  uniform float uEye;
  uniform vec3 uTailRoot;
  varying vec3 vN;
  varying vec2 vCoord;
  varying float vKind;
  varying float vSheen;
  const vec3 WATER = vec3(0.024, 0.031, 0.043);
  const vec3 L = vec3(-0.46, 0.56, 0.69);
  float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + 1.0), f.x), f.y);
  }
  void main() {
    vec2 c = vCoord;
    if (vKind < 0.5) {
      // The coat: the base, then each patch, with ragged edges.
      vec3 col = uBase;
      col = mix(col * 0.5, col, mix(1.0, smoothstep(0.05, 0.65, abs(c.y)), uBack));
      for (int i = 0; i < 6; i++) {
        vec4 p = uPatch[i];
        if (p.z <= 0.0) continue;
        vec2 d = vec2((c.x - p.x) / p.z, (c.y - p.y) / p.w);
        float n = 0.5 * noise(c * vec2(16.0, 4.0) + uSeed + float(i) * 7.0) + 0.3 * noise(c * vec2(42.0, 10.0) + uSeed * 1.7);
        float m = smoothstep(0.06, -0.06, dot(d, d) - (0.62 + n));
        col = mix(col, uPatchCol[i], m);
      }
      // Scales: a fine net over the body, behind the head.
      float k = uLength * 0.42;
      float sc = sin(c.x * k + c.y * 7.0) * sin(c.x * k - c.y * 7.0);
      col *= 1.0 - 0.07 * smoothstep(0.2, 0.9, sc) * smoothstep(0.14, 0.24, c.x);
      // The eyes, with a glint.
      vec2 e = vec2((c.x - 0.075) * uLength, (abs(c.y) - 0.72) * uWidth);
      float eye = 1.0 - smoothstep(uWidth * uEye * 0.8, uWidth * uEye, length(e));
      col = mix(col, vec3(0.02), eye);
      vec3 n = normalize(vN);
      vec3 h = normalize(L + vec3(0.0, 0.0, 1.0));
      float dif = 0.4 + 0.6 * max(dot(n, L), 0.0);
      float spec = pow(max(dot(n, h), 0.0), 26.0) * uSheen;
      vec3 lit = col * dif + spec * vec3(1.0, 0.98, 0.95) + eye * pow(max(dot(n, h), 0.0), 60.0) * 0.8;
      lit *= 0.55 + 0.45 * n.z;
      gl_FragColor = vec4(mix(WATER, lit, uClarity), 1.0);
    } else if (vKind < 1.5) {
      // The tail: fine rays in a thin membrane, densest at the root and nearly clear
      // at the edge, which frays a little between the rays. Tinted by the body where
      // it joins, the colour running out along the rays; a sheen on the ripple.
      float rn = c.x;
      float a = c.y;
      float x = a * 9.0;
      float fw = fwidth(x);
      float dRay = abs(fract(x + 0.5) - 0.5);
      float ray = (1.0 - smoothstep(0.045, 0.045 + fw, dRay)) * (1.0 - smoothstep(0.22, 0.45, fw)) * smoothstep(90.0, 160.0, uLength);
      float fray = noise(vec2(a * 40.0, uSeed)) * 0.06 + noise(vec2(a * 110.0, uSeed * 1.3)) * 0.03;
      float limit = 1.0 - fray * 0.6 - 0.008 * (1.0 - ray);
      float ew = max(fwidth(rn) * 1.5, 0.015);
      float edge = 1.0 - smoothstep(limit - ew, limit, rn);
      float grow = smoothstep(0.0, 0.16, rn);
      float alpha = (mix(0.74, 0.36, smoothstep(0.0, 0.95, rn)) + 0.14 * ray) * grow * edge;
      float away = smoothstep(0.05, 0.75, rn);
      vec3 col = mix(uTailRoot, vec3(0.86, 0.9, 0.94), away * 0.8);
      col = mix(col, uTailRoot * 0.9 + 0.08, ray * 0.3 * (1.0 - away * 0.4));
      // The membrane folds a little between the rays: faintly lighter on one side.
      col *= 0.95 + 0.07 * sin(x * 6.2832);
      col *= 0.8 + 0.28 * (1.0 - rn);
      col += vec3(1.0, 0.98, 0.95) * pow(max(vSheen, 0.0), 3.0) * 0.4 * uSheen;
      alpha *= mix(0.6, 1.0, uClarity);
      col = mix(WATER, col, uClarity);
      gl_FragColor = vec4(col * alpha, alpha);
    } else {
      // The fins: thin and translucent, ribbed with rays.
      float t = c.x;
      float u = c.y;
      float a;
      vec3 fc = mix(uBase, vec3(0.95), 0.35);
      if (vKind < 2.5) {
        a = 0.46 * (0.72 + 0.28 * sin(u * 22.0)) * (1.0 - smoothstep(0.8, 1.0, t)) * (1.0 - smoothstep(0.8, 1.0, abs(u)));
      } else {
        // The dorsal fin, seen edge on along the back.
        fc *= 0.55;
        a = 0.6 * (1.0 - smoothstep(0.5, 1.0, abs(u))) * smoothstep(0.0, 0.15, t) * (1.0 - smoothstep(0.85, 1.0, t));
      }
      a *= mix(0.6, 1.0, uClarity);
      vec3 col = mix(WATER, fc * 0.85, uClarity);
      gl_FragColor = vec4(col * a, a);
    }
  }
`;

const QUAD_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const WATER_FRAG = /* glsl */ `
  uniform sampler2D tPrev;
  uniform vec2 uTexel;
  uniform vec2 uSize;
  uniform vec4 uDrops[${MAX_DROPS}];
  uniform int uCount;
  varying vec2 vUv;
  void main() {
    vec4 info = texture2D(tPrev, vUv);
    vec2 px = vUv * uSize;
    for (int i = 0; i < ${MAX_DROPS}; i++) {
      if (i >= uCount) break;
      vec4 d = uDrops[i];
      float k = max(0.0, 1.0 - length(px - d.xy) / d.z);
      info.r += (0.5 - cos(k * 3.14159) * 0.5) * d.w;
    }
    float avg = (
      texture2D(tPrev, vUv - vec2(uTexel.x, 0.0)).r +
      texture2D(tPrev, vUv + vec2(uTexel.x, 0.0)).r +
      texture2D(tPrev, vUv - vec2(0.0, uTexel.y)).r +
      texture2D(tPrev, vUv + vec2(0.0, uTexel.y)).r
    ) * 0.25;
    info.g += (avg - info.r) * 2.0;
    info.g *= 0.994;
    info.r += info.g;
    info.r *= 0.999;
    gl_FragColor = info;
  }
`;

const COMPOSE_FRAG = /* glsl */ `
  uniform sampler2D tFish;
  uniform sampler2D tWater;
  uniform vec2 uRes;
  uniform vec2 uTexel;
  uniform float uDpr;
  uniform float uColumn;
  varying vec2 vUv;
  const vec3 BG = vec3(6.0, 8.0, 11.0) / 255.0;
  const vec3 DOT = vec3(18.0, 20.0, 24.0) / 255.0;
  void main() {
    vec2 px = vec2(vUv.x * uRes.x, (1.0 - vUv.y) * uRes.y);
    float h = texture2D(tWater, vUv).r;
    float hl = texture2D(tWater, vUv - vec2(uTexel.x, 0.0)).r;
    float hr = texture2D(tWater, vUv + vec2(uTexel.x, 0.0)).r;
    float hd = texture2D(tWater, vUv - vec2(0.0, uTexel.y)).r;
    float hu = texture2D(tWater, vUv + vec2(0.0, uTexel.y)).r;
    vec2 g = vec2(hr - hl, hu - hd);
    vec2 off = g * 18.0;
    // The page's dot grid on the pond floor, bent by the surface.
    vec2 q = px + vec2(off.x, -off.y) * 0.7;
    vec2 m = mod(q, 16.0) - 8.0;
    float aa = 0.6 / uDpr;
    vec3 col = mix(BG, DOT, 1.0 - smoothstep(1.0 - aa, 1.0 + aa, length(m)));
    // The fish, bent the same way; light gathers under the crests.
    vec4 fish = texture2D(tFish, vUv + off / uRes);
    float lap = hl + hr + hu + hd - 4.0 * h;
    fish.rgb *= 1.0 + clamp(-lap * 6.0, -0.15, 0.4);
    // Deeper under the reading column, so the words stay clear.
    float colm = 1.0 - smoothstep(uColumn, uColumn + 170.0, abs(px.x - uRes.x * 0.5));
    fish *= 1.0 - 0.48 * colm;
    col = col * (1.0 - fish.a) + fish.rgb;
    // The surface: light on the slopes facing it, shade on the others.
    float band = dot(g, vec2(-0.55, 0.835));
    col += vec3(0.6, 0.66, 0.75) * clamp(band * 0.9, 0.0, 0.16);
    col *= 1.0 - clamp(-band * 0.7, 0.0, 0.22);
    gl_FragColor = vec4(col, 1.0);
  }
`;

/* -------------------------------------------------------------- geometry */

/** Half-width along the body, as a share of the widest (s: 0 nose, 1 tail tip). */
function profile(s: number) {
  if (s < 0) return 0;
  if (s < 0.16) {
    const k = (0.16 - s) / 0.16;
    return 0.9 * Math.sqrt(Math.max(0, 1 - k * k));
  }
  if (s < 0.32) return 0.9 + 0.1 * Math.sin(((s - 0.16) / 0.16) * (Math.PI / 2));
  return Math.max(0.02, 1 - 0.86 * Math.pow((s - 0.32) / 0.54, 1.7));
}

class Builder {
  local: number[] = [];
  norm: number[] = [];
  coord: number[] = [];
  kind: number[] = [];
  fin: number[] = [];
  index: number[] = [];
  v(local: V3, norm: V3, coord: [number, number], kind: number, fin: V3 = [0, 0, 0]) {
    this.local.push(...local);
    this.norm.push(...norm);
    this.coord.push(...coord);
    this.kind.push(kind);
    this.fin.push(...fin);
    return this.kind.length - 1;
  }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(this.local, 3));
    g.setAttribute("aLocal", new THREE.Float32BufferAttribute(this.local, 3));
    g.setAttribute("aNorm", new THREE.Float32BufferAttribute(this.norm, 3));
    g.setAttribute("aCoord", new THREE.Float32BufferAttribute(this.coord, 2));
    g.setAttribute("aKind", new THREE.Float32BufferAttribute(this.kind, 1));
    g.setAttribute("aFin", new THREE.Float32BufferAttribute(this.fin, 3));
    g.setIndex(this.index);
    return g;
  }
}

/** The body: the top half of a lofted, rounded section, nose to the root of the tail. */
function bodyGeometry(L: number, W: number, H: number, rings: number, segs: number) {
  const b = new Builder();
  const END = 0.86;
  for (let r = 0; r <= rings; r++) {
    const s = END * (1 - Math.cos((r / rings) * (Math.PI / 2))) ** 0.85;
    const w = Math.max(0.3, W * profile(s));
    const h = Math.max(0.3, H * profile(s));
    const e = 0.004;
    const slope = ((profile(s + e) - profile(s - e)) / (2 * e)) * (W / L);
    for (let k = 0; k <= segs; k++) {
      const th = (Math.PI * k) / segs;
      const cx = Math.cos(th) * h;
      const cy = Math.sin(th) * w;
      const cl = Math.hypot(cx, cy) || 1;
      const n: V3 = [-slope * 0.8, cx / cl, cy / cl];
      const nl = Math.hypot(...n);
      b.v([s, Math.cos(th) * w, Math.sin(th) * h], [n[0] / nl, n[1] / nl, n[2] / nl], [s, Math.cos(th)], 0);
    }
  }
  for (let r = 0; r < rings; r++) {
    for (let k = 0; k < segs; k++) {
      const a = r * (segs + 1) + k;
      const c = a + segs + 1;
      b.index.push(a, c, a + 1, a + 1, c, c + 1);
    }
  }
  return b;
}

/** Where the tail's fan starts, along the body; its reach, as a share of the length. */
const TAIL_ROOT = 0.8;
const TAIL_REACH = { koi: 0.3, fry: 0.25 };

/** The tail: a grid over the fan (rays across, root to edge out); the vertex shader shapes it. */
function addTail(b: Builder) {
  const M = 28;
  const K = 16;
  const base = b.kind.length;
  for (let i = 0; i <= M; i++) {
    const a = (i / M) * 2 - 1;
    for (let j = 0; j <= K; j++) {
      const rn = j / K;
      b.v([TAIL_ROOT, 0, -1], [0, 0, 1], [rn, a], 1, [a, rn, 0]);
    }
  }
  for (let i = 0; i < M; i++)
    for (let j = 0; j < K; j++) {
      const q = base + i * (K + 1) + j;
      const n = q + K + 1;
      b.index.push(q, n, q + 1, q + 1, n, n + 1);
    }
}

function addPairedFin(b: Builder, s0: number, W: number, H: number, reach: number, phiA: number, phiB: number) {
  for (const sgn of [-1, 1]) {
    const root: V3 = [s0, sgn * W * profile(s0) * 0.82, -2];
    const centre = b.v(root, [0, 0, 1], [0, 0], 2, [0, 0, sgn]);
    const M = 10;
    const ring: number[] = [];
    for (let i = 0; i <= M; i++) {
      const k = i / M;
      const phi = phiA + (phiB - phiA) * k;
      // A rounded fan: longest in the middle of its sweep.
      const r = reach * (0.55 + 0.45 * Math.sin(Math.PI * Math.min(1, k * 1.15)));
      ring.push(b.v(root, [0, 0, 1], [1, k * 2 - 1], 2, [phi, r, sgn]));
    }
    // Inner ring so the alpha falls off from the root rather than across one triangle.
    const inner: number[] = [];
    for (let i = 0; i <= M; i++) {
      const k = i / M;
      const phi = phiA + (phiB - phiA) * k;
      const r = reach * 0.5 * (0.55 + 0.45 * Math.sin(Math.PI * Math.min(1, k * 1.15)));
      inner.push(b.v(root, [0, 0, 1], [0.5, k * 2 - 1], 2, [phi, r, sgn]));
    }
    for (let i = 0; i < M; i++) {
      b.index.push(centre, inner[i]!, inner[i + 1]!);
      b.index.push(inner[i]!, ring[i]!, inner[i + 1]!, inner[i + 1]!, ring[i]!, ring[i + 1]!);
    }
    void H;
  }
}

function addDorsal(b: Builder, W: number, H: number) {
  const rows = 12;
  const base = b.kind.length;
  for (let r = 0; r <= rows; r++) {
    const t = r / rows;
    const s = 0.3 + 0.36 * t;
    for (const u of [-1, 1]) b.v([s, u * W * 0.07, H * profile(s) + 1.2], [0, 0, 1], [t, u], 3);
  }
  for (let r = 0; r < rows; r++) {
    const a = base + r * 2;
    b.index.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
  }
}

/* ----------------------------------------------------------------- coats */

interface Patch {
  s: number;
  a: number;
  rs: number;
  ra: number;
  c: V3;
}

function koiCoat(): { base: V3; patches: Patch[]; sheen: number } {
  const patches: Patch[] = [];
  const spots = (n: number, c: V3, s0: number, s1: number, rs: [number, number], ra: [number, number]) => {
    for (let i = 0; i < n && patches.length < 6; i++) patches.push({ s: rand(s0, s1), a: rand(-0.4, 0.4), rs: rand(...rs), ra: rand(...ra), c });
  };
  const kind = Math.random();
  if (kind < 0.3) {
    // Kohaku: white with red patches.
    spots(Math.round(rand(2, 4)), Math.random() < 0.6 ? RED : ORANGE, 0.06, 0.72, [0.07, 0.14], [0.6, 1.4]);
    return { base: WHITE, patches, sheen: 0.32 };
  }
  if (kind < 0.42) {
    // Tancho: white, one red spot on the head.
    patches.push({ s: 0.1, a: 0, rs: 0.055, ra: 0.45, c: RED });
    return { base: WHITE, patches, sheen: 0.32 };
  }
  if (kind < 0.62) {
    // Sanke: kohaku with small ink marks.
    spots(Math.round(rand(2, 3)), ORANGE, 0.08, 0.7, [0.07, 0.13], [0.6, 1.3]);
    spots(Math.round(rand(2, 3)), INK, 0.22, 0.78, [0.025, 0.05], [0.25, 0.45]);
    return { base: WHITE, patches, sheen: 0.32 };
  }
  if (kind < 0.76) {
    // Orange, a few pale patches.
    spots(Math.round(rand(0, 2)), WHITE, 0.3, 0.75, [0.05, 0.1], [0.4, 0.9]);
    return { base: ORANGE, patches, sheen: 0.38 };
  }
  if (kind < 0.86) {
    // Yamabuki: metallic gold.
    return { base: GOLD, patches, sheen: 0.6 };
  }
  if (kind < 0.94) {
    // Showa: ink, with white and red.
    spots(2, WHITE, 0.1, 0.7, [0.07, 0.12], [0.6, 1.2]);
    spots(2, RED, 0.05, 0.6, [0.05, 0.1], [0.5, 1]);
    return { base: INK, patches, sheen: 0.45 };
  }
  // Platinum.
  return { base: PLATINUM, patches, sheen: 0.7 };
}

/* -------------------------------------------------------------- the fish */

type Kind = "koi" | "fry";
const KINDS = {
  koi: { turn: 1.1, meander: 1, vb: [24, 40], glide: [1.6, 3.4], stroke: [1.8, 4], burst: 7, react: 1600, R: 360, amp: 0.045, beat: 0.45, beatK: 1 / 75, edge: 0.35, band: 260, bend: 0.4 },
  fry: { turn: 3.4, meander: 2.4, vb: [42, 64], glide: [0.3, 1.0], stroke: [0.4, 1.3], burst: 6, react: 3200, R: 440, amp: 0.075, beat: 1.4, beatK: 1 / 28, edge: 0.15, band: 130, bend: 0.6 },
};

interface Fish {
  kind: Kind;
  L: number;
  W: number;
  depth: number;
  seg: number;
  p: Float32Array;
  a: number;
  v: number;
  vb: number;
  beat: number;
  amp: number;
  flap: number;
  wander: number[];
  gliding: boolean;
  rhythm: number;
  startle: number;
  boost: number;
  flee: number;
  pending: { at: number; dir: number; strength: number } | null;
  travel: number;
  /** The tail's own motion: lag (bend, its speed), spread, ripple phase, and where the
   *  tail's end was last frame across the body (NaN until the first frame). */
  tail: { bend: number; bendV: number; spread: number; phase: number; lat: number };
  uniforms: Record<string, THREE.IUniform>;
  meshes: THREE.Mesh[];
}

export function canRunPond() {
  try {
    const c = document.createElement("canvas");
    return !!c.getContext("webgl2");
  } catch {
    return false;
  }
}

export function mountPond(canvas: HTMLCanvasElement) {
  const html = document.documentElement;
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: "low-power" });
  renderer.autoClear = false;
  let dpr = Math.min(devicePixelRatio || 1, 2);
  renderer.setPixelRatio(dpr);

  let vw = innerWidth;
  let vh = innerHeight;

  /* The fish scene: a top-down orthographic view, one css px to a unit, y up. */
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(0, vw, 0, -vh, 1, 5000);
  camera.position.z = 2500;
  const fishTarget = new THREE.WebGLRenderTarget(1, 1, { samples: 4 });

  /* The water: two height fields in turn (height, velocity). */
  const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const quad = new THREE.PlaneGeometry(2, 2);
  const simOpts = { type: THREE.HalfFloatType, format: THREE.RGBAFormat, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false } as const;
  let waterA = new THREE.WebGLRenderTarget(1, 1, simOpts);
  let waterB = new THREE.WebGLRenderTarget(1, 1, simOpts);
  const waterMat = new THREE.ShaderMaterial({
    vertexShader: QUAD_VERT,
    fragmentShader: WATER_FRAG,
    uniforms: {
      tPrev: { value: null },
      uTexel: { value: new THREE.Vector2() },
      uSize: { value: new THREE.Vector2() },
      uDrops: { value: Array.from({ length: MAX_DROPS }, () => new THREE.Vector4()) },
      uCount: { value: 0 },
    },
    depthTest: false,
    depthWrite: false,
  });
  const waterScene = new THREE.Scene();
  waterScene.add(new THREE.Mesh(quad, waterMat));

  const composeMat = new THREE.ShaderMaterial({
    vertexShader: QUAD_VERT,
    fragmentShader: COMPOSE_FRAG,
    uniforms: {
      tFish: { value: fishTarget.texture },
      tWater: { value: waterA.texture },
      uRes: { value: new THREE.Vector2() },
      uTexel: { value: new THREE.Vector2() },
      uDpr: { value: dpr },
      uColumn: { value: 280 },
    },
    depthTest: false,
    depthWrite: false,
  });
  const composeScene = new THREE.Scene();
  composeScene.add(new THREE.Mesh(quad, composeMat));

  function size() {
    vw = innerWidth;
    vh = innerHeight;
    dpr = Math.min(devicePixelRatio || 1, 2);
    renderer.setPixelRatio(dpr);
    renderer.setSize(vw, vh, false);
    camera.right = vw;
    camera.bottom = -vh;
    camera.updateProjectionMatrix();
    fishTarget.setSize(Math.round(vw * dpr), Math.round(vh * dpr));
    const sw = Math.ceil(vw / SIM);
    const sh = Math.ceil(vh / SIM);
    waterA.dispose();
    waterB.dispose();
    waterA = new THREE.WebGLRenderTarget(sw, sh, simOpts);
    waterB = new THREE.WebGLRenderTarget(sw, sh, simOpts);
    for (const t of [waterA, waterB]) {
      renderer.setRenderTarget(t);
      renderer.setClearColor(0x000000, 0);
      renderer.clear();
    }
    renderer.setRenderTarget(null);
    waterMat.uniforms.uTexel!.value.set(1 / sw, 1 / sh);
    waterMat.uniforms.uSize!.value.set(vw, vh);
    composeMat.uniforms.uTexel!.value.set(1 / sw, 1 / sh);
    composeMat.uniforms.uRes!.value.set(vw, vh);
    composeMat.uniforms.uDpr!.value = dpr;
    composeMat.uniforms.uColumn!.value = Math.min(560, vw - 32) / 2;
  }

  /* ------------------------------------------------------------ the school */

  const fish: Fish[] = [];
  const koi: Fish[] = [];
  const fry: Fish[] = [];
  const school = { x: 0, y: 0, a: rand(0, 6.28), w: [rand(0, 6.28), rand(0, 6.28)] };

  function makeFish(kind: Kind, x: number, y: number, a: number, scale: number): Fish {
    const k = KINDS[kind];
    const depth = kind === "koi" ? Math.random() : 1;
    const L = kind === "koi" ? rand(188, 272) * scale * (0.86 + 0.2 * depth) : rand(20, 29) * Math.max(0.8, scale);
    const W = L * (kind === "koi" ? 0.145 : 0.12);
    const H = W * (kind === "koi" ? 0.85 : 0.8);
    const coat = kind === "koi" ? koiCoat() : { base: SILVER, patches: [], sheen: 0.75 };
    const b = bodyGeometry(L, W, H, kind === "koi" ? 40 : 16, kind === "koi" ? 16 : 8);
    const bodyGeo = b.build();
    const fins = new Builder();
    addTail(fins);
    if (kind === "koi") {
      addPairedFin(fins, 0.22, W, H, L * 0.15, 0.32, 1.25);
      addPairedFin(fins, 0.5, W, H, L * 0.075, 0.25, 0.85);
      addDorsal(fins, W, H);
    } else {
      addPairedFin(fins, 0.24, W, H, L * 0.1, 0.4, 1.1);
    }
    const patch = Array.from({ length: 6 }, (_, i) => {
      const p = coat.patches[i];
      return p ? new THREE.Vector4(p.s, p.a, p.rs, p.ra) : new THREE.Vector4(0, 0, 0, 0);
    });
    const patchCol = Array.from({ length: 6 }, (_, i) => new THREE.Vector3(...(coat.patches[i]?.c ?? WHITE)));
    const uniforms: Record<string, THREE.IUniform> = {
      uSpine: { value: Array.from({ length: SPINE }, () => new THREE.Vector4()) },
      uLength: { value: L },
      uWidth: { value: W },
      uZ: { value: 0 },
      uFlap: { value: new THREE.Vector2() },
      uBase: { value: new THREE.Vector3(...coat.base) },
      uPatch: { value: patch },
      uPatchCol: { value: patchCol },
      uSeed: { value: rand(0, 100) },
      uClarity: { value: kind === "koi" ? 0.5 + 0.38 * depth : rand(0.62, 0.8) },
      uSheen: { value: coat.sheen },
      uBack: { value: kind === "fry" ? 1 : 0 },
      uEye: { value: kind === "fry" ? 0.2 : 0.12 },
      uTail: { value: new THREE.Vector4(0, 1, rand(0, 6.28), 0.05) },
      uTailShape: { value: new THREE.Vector3(L * TAIL_REACH[kind], W * profile(TAIL_ROOT) * 0.9, 0.6) },
      // The colour where the tail joins the body.
      uTailRoot: { value: new THREE.Vector3(...(coat.patches.find((p) => Math.abs(p.s - 0.76) < p.rs * 1.4)?.c ?? coat.base)) },
    };
    const body = new THREE.Mesh(bodyGeo, new THREE.ShaderMaterial({ vertexShader: FISH_VERT, fragmentShader: FISH_FRAG, uniforms }));
    const finMesh = new THREE.Mesh(
      fins.build(),
      new THREE.ShaderMaterial({
        vertexShader: FISH_VERT,
        fragmentShader: FISH_FRAG,
        uniforms,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.CustomBlending,
        blendSrc: THREE.OneFactor,
        blendDst: THREE.OneMinusSrcAlphaFactor,
      }),
    );
    for (const m of [body, finMesh]) {
      m.frustumCulled = false;
      scene.add(m);
    }
    const seg = L / (SPINE - 1);
    const p = new Float32Array(SPINE * 2);
    for (let i = 0; i < SPINE; i++) {
      p[i * 2] = x - Math.cos(a) * seg * i;
      p[i * 2 + 1] = y - Math.sin(a) * seg * i;
    }
    const vb = rand(k.vb[0]!, k.vb[1]!) * (0.8 + 0.2 * scale);
    const m = k.meander;
    return {
      kind,
      L,
      W,
      depth,
      seg,
      p,
      a,
      v: vb,
      vb,
      beat: rand(0, 6.28),
      amp: k.amp,
      flap: rand(0, 6.28),
      wander: [rand(0.05, 0.09) * m, rand(0, 6.28), rand(0.13, 0.2) * m, rand(0, 6.28), rand(0.27, 0.4) * m, rand(0, 6.28)],
      gliding: false,
      rhythm: rand(0.5, 2),
      startle: 0,
      boost: 0.2,
      flee: 0,
      pending: null,
      travel: 0,
      tail: { bend: 0, bendV: 0, spread: 1, phase: rand(0, 6.28), lat: NaN },
      uniforms,
      meshes: [body, finMesh],
    };
  }

  function populate(inside: boolean) {
    const scale = Math.min(1, Math.max(0.62, Math.min(vw, vh * 1.4) / 1150));
    const count = Math.round(Math.min(6, Math.max(3, (vw * vh) / 260000)));
    const start = (Math.random() * 4) | 0;
    const entry = (edge: number, along: number, out: number): [number, number] => [
      edge === 0 ? -out : edge === 1 ? vw + out : (0.1 + 0.8 * along) * vw,
      edge === 2 ? -out : edge === 3 ? vh + out : (0.15 + 0.7 * along) * vh,
    ];
    for (let i = 0; i < count; i++) {
      const [x, y] = inside ? [rand(0.1, 0.9) * vw, rand(0.15, 0.85) * vh] : entry((start + i) % 4, (i + rand(0.2, 0.8)) / count, rand(0, 90) + i * 30);
      const a = inside ? rand(-Math.PI, Math.PI) : Math.atan2(vh * rand(0.3, 0.7) - y, vw * rand(0.3, 0.7) - x);
      const f = makeFish("koi", x, y, a, scale);
      koi.push(f);
    }
    // Shallower koi over deeper ones.
    [...koi].sort((a, b) => a.depth - b.depth).forEach((f, i) => {
      f.uniforms.uZ!.value = 100 + i * 140;
      f.meshes.forEach((m) => (m.renderOrder = i * 2 + (m === f.meshes[1] ? 1 : 0)));
    });
    // The fry, near the surface, coming in together from one side.
    const n = vw < 700 ? 9 : 15;
    const edge = (start + 2) % 4;
    const [sx, sy] = inside ? [vw * 0.7, vh * 0.3] : entry(edge, rand(0.3, 0.7), 60);
    school.x = vw * rand(0.3, 0.7);
    school.y = vh * rand(0.3, 0.7);
    const heading = Math.atan2(school.y - sy, school.x - sx);
    for (let i = 0; i < n; i++) {
      const f = makeFish("fry", sx + rand(-70, 70), sy + rand(-70, 70), heading + rand(-0.3, 0.3), scale);
      f.uniforms.uZ!.value = 100 + 8 * 140 + i * 10;
      f.meshes.forEach((m) => (m.renderOrder = 100 + i * 2 + (m === f.meshes[1] ? 1 : 0)));
      fry.push(f);
    }
    fish.push(...koi, ...fry);
  }

  /* ------------------------------------------------------------- swimming */

  let time = 0;
  const cursor = { x: -1e4, y: -1e4, still: 0, mouse: false };
  const drops: number[] = [];
  const later: { at: number; x: number; y: number; r: number; s: number }[] = [];
  const drop = (x: number, y: number, r: number, s: number) => {
    if (drops.length < MAX_DROPS * 4) drops.push(x, y, r, s);
  };

  function swim(f: Fish, dt: number) {
    const k = KINDS[f.kind];
    const hx = f.p[0]!;
    const hy = f.p[1]!;
    if (f.pending && time >= f.pending.at) {
      f.flee = f.pending.dir;
      f.startle = Math.max(f.startle, f.pending.strength);
      f.boost = Math.max(f.boost, f.pending.strength);
      f.gliding = false;
      f.rhythm = rand(1, 2);
      f.pending = null;
    }

    let sx = Math.cos(f.a);
    let sy = Math.sin(f.a);
    const m = -f.L * k.edge;
    const push = (d: number) => {
      const q = clamp01((k.band - d) / k.band);
      return q * q * 2.4;
    };
    sx += push(hx - m) - push(vw - m - hx);
    sy += push(hy - m) - push(vh - m - hy);

    if (f.kind === "koi") {
      for (const g of koi) {
        if (g === f) continue;
        const near = 0.35 + 0.65 * (1 - Math.abs(g.depth - f.depth));
        const r = Math.max(f.W, g.W) * 3.6;
        for (let i = 0; i < SPINE; i += 3) {
          const dx = hx - g.p[i * 2]!;
          const dy = hy - g.p[i * 2 + 1]!;
          const d = Math.hypot(dx, dy);
          if (d > 1 && d < r) {
            const q = (1 - d / r) ** 2 * 2.4 * near;
            sx += (dx / d) * q;
            sy += (dy / d) * q;
          }
        }
      }
      if (cursor.mouse && cursor.still > 1.2 && f.startle < 0.05) {
        const dx = cursor.x - hx;
        const dy = cursor.y - hy;
        const d = Math.hypot(dx, dy);
        if (d < 440 && d > f.L * 0.2) {
          const q = 0.55 * (1 - d / 440) * clamp01((cursor.still - 1.2) / 1.5);
          sx += (dx / d) * q;
          sy += (dy / d) * q;
        }
      }
    } else {
      // The school: together, the same way, not too close; toward where it is going.
      let cx = 0;
      let cy = 0;
      let ax = 0;
      let ay = 0;
      let n = 0;
      for (const g of fry) {
        if (g === f) continue;
        const dx = g.p[0]! - hx;
        const dy = g.p[1]! - hy;
        const d = Math.hypot(dx, dy);
        if (d > 150) continue;
        cx += dx;
        cy += dy;
        ax += Math.cos(g.a);
        ay += Math.sin(g.a);
        n++;
        if (d < 24 && d > 0.01) {
          sx -= (dx / d) * ((24 - d) / 24) * 3;
          sy -= (dy / d) * ((24 - d) / 24) * 3;
        }
      }
      if (n) {
        sx += (cx / n / 150) * 1.4 + (ax / n) * 0.9;
        sy += (cy / n / 150) * 1.4 + (ay / n) * 0.9;
      }
      const tx = school.x - hx;
      const ty = school.y - hy;
      const td = Math.hypot(tx, ty) || 1;
      sx += (tx / td) * 0.45;
      sy += (ty / td) * 0.45;
      // Out of the koi's way.
      for (const g of koi) {
        for (let i = 0; i < SPINE; i += 3) {
          const dx = hx - g.p[i * 2]!;
          const dy = hy - g.p[i * 2 + 1]!;
          const d = Math.hypot(dx, dy);
          const r = g.W * 2.4;
          if (d > 0.01 && d < r) {
            sx += (dx / d) * (1 - d / r) * 3;
            sy += (dy / d) * (1 - d / r) * 3;
          }
        }
      }
    }
    if (f.startle > 0.02) {
      sx += Math.cos(f.flee) * 7 * f.startle;
      sy += Math.sin(f.flee) * 7 * f.startle;
    }

    const w = f.wander;
    const meander = 0.42 * Math.sin(time * w[0]! * 6.28 + w[1]!) + 0.26 * Math.sin(time * w[2]! * 6.28 + w[3]!) + 0.12 * Math.sin(time * w[4]! * 6.28 + w[5]!);
    const maxTurn = k.turn + 9 * f.startle;
    let turn = meander * (f.kind === "fry" ? 1.4 : 1) * (1 - f.startle) + wrap(Math.atan2(sy, sx) - f.a) * (1.6 + 6 * f.startle);
    turn = Math.max(-maxTurn, Math.min(maxTurn, turn));
    f.a = wrap(f.a + turn * dt);

    f.rhythm -= dt;
    if (f.rhythm <= 0) {
      f.gliding = !f.gliding;
      f.rhythm = f.gliding ? rand(k.glide[0]!, k.glide[1]!) : rand(k.stroke[0]!, k.stroke[1]!);
    }
    const target = f.vb * ((f.gliding ? 0.55 : 1.15) + k.burst * f.boost);
    f.v += (target - f.v) * (1 - Math.exp(-dt / (target > f.v ? (f.boost > 0.1 ? 0.07 : 0.28) : 1.5)));
    const thrust = f.gliding && f.boost < 0.05 ? k.amp * 0.3 : k.amp + 0.07 * f.boost;
    f.amp += (thrust - f.amp) * (1 - Math.exp(-dt / 0.4));
    f.beat += dt * 6.28 * (k.beat + Math.min(f.v, 260) * k.beatK);
    f.flap += dt * 6.28 * (f.gliding ? 0.35 : 0.6) * (f.kind === "fry" ? 2 : 1);
    f.startle *= Math.exp(-dt / 0.9);
    f.boost *= Math.exp(-dt / 0.75);

    const step = f.v * dt;
    f.p[0] = hx + Math.cos(f.a) * step;
    f.p[1] = hy + Math.sin(f.a) * step;
    let prev = f.a;
    for (let i = 1; i < SPINE; i++) {
      const dx = f.p[(i - 1) * 2]! - f.p[i * 2]!;
      const dy = f.p[(i - 1) * 2 + 1]! - f.p[i * 2 + 1]!;
      let ang = Math.atan2(dy, dx);
      const bend = wrap(ang - prev);
      if (bend > k.bend) ang = prev + k.bend;
      else if (bend < -k.bend) ang = prev - k.bend;
      f.p[i * 2] = f.p[(i - 1) * 2]! - Math.cos(ang) * f.seg;
      f.p[i * 2 + 1] = f.p[(i - 1) * 2 + 1]! - Math.sin(ang) * f.seg;
      prev = ang;
    }

    // A koi near the surface leaves a faint wake.
    if (f.kind === "koi" && f.depth > 0.45) {
      f.travel += step;
      if (f.travel > 22) {
        f.travel = 0;
        drop(hx - Math.cos(f.a) * f.L * 0.1, hy - Math.sin(f.a) * f.L * 0.1, f.W * 0.5, 0.012 * (f.depth - 0.3) * Math.min(3, f.v / f.vb));
      }
    }
  }

  function wanderSchool(dt: number) {
    school.a += dt * (0.5 * Math.sin(time * 0.21 + school.w[0]!) + 0.3 * Math.sin(time * 0.53 + school.w[1]!));
    const mx = vw * 0.15;
    const my = vh * 0.15;
    let dx = Math.cos(school.a);
    let dy = Math.sin(school.a);
    if (school.x < mx) dx += 1.5;
    if (school.x > vw - mx) dx -= 1.5;
    if (school.y < my) dy += 1.5;
    if (school.y > vh - my) dy -= 1.5;
    school.a = Math.atan2(dy, dx);
    school.x += Math.cos(school.a) * 46 * dt;
    school.y += Math.sin(school.a) * 46 * dt;
  }

  function fright(x: number, y: number, power: number) {
    for (const f of fish) {
      const k = KINDS[f.kind];
      let d = Infinity;
      let nx = 0;
      let ny = 0;
      for (let i = 0; i < SPINE; i += 2) {
        const px = f.p[i * 2]!;
        const py = f.p[i * 2 + 1]!;
        const dd = Math.hypot(px - x, py - y);
        if (dd < d) [d, nx, ny] = [dd, px, py];
      }
      const R = k.R * power;
      if (d > R * 1.8) continue;
      const strength = (d < R ? 0.55 + 0.45 * (1 - d / R) : 0.3 * (1 - (d - R) / (R * 0.8))) * Math.min(1, power + 0.2);
      let dir = Math.atan2(f.p[1]! - y + (f.p[1]! - ny) * 0.5, f.p[0]! - x + (f.p[0]! - nx) * 0.5);
      dir += rand(-0.35, 0.35);
      if (!f.pending || f.pending.strength < strength) f.pending = { at: time + 0.03 + d / k.react + rand(0, 0.05), dir, strength };
    }
    // The school regroups away from it.
    const a = Math.atan2(school.y - y, school.x - x);
    school.x = Math.min(vw * 0.85, Math.max(vw * 0.15, x + Math.cos(a) * 380));
    school.y = Math.min(vh * 0.85, Math.max(vh * 0.15, y + Math.sin(a) * 380));
  }

  function splash(x: number, y: number) {
    // The drop, the droplets thrown up landing round it, then the rebound falling back.
    drop(x, y, 20, 0.85);
    const n = 6;
    const a0 = rand(0, 6.28);
    for (let i = 0; i < n; i++) {
      const a = a0 + (i / n) * 6.28 + rand(-0.3, 0.3);
      const r = rand(28, 64);
      later.push({ at: time + rand(0.12, 0.32), x: x + Math.cos(a) * r, y: y + Math.sin(a) * r, r: rand(4, 6), s: rand(0.18, 0.3) });
    }
    later.push({ at: time + 0.42, x, y, r: 9, s: 0.4 });
    fright(x, y, 1);
  }

  /* Life on the surface: the fry nip at it, a koi gulps now and then. */
  let nip = rand(1.5, 3.5);
  let gulp = rand(6, 11);
  function surface(dt: number) {
    nip -= dt;
    if (nip <= 0 && fry.length) {
      nip = rand(1.2, 4);
      const f = fry[(Math.random() * fry.length) | 0]!;
      drop(f.p[0]!, f.p[1]!, 4, 0.22);
    }
    gulp -= dt;
    if (gulp <= 0 && koi.length) {
      gulp = rand(7, 14);
      const f = [...koi].sort((a, b) => b.depth - a.depth)[(Math.random() * Math.min(2, koi.length)) | 0]!;
      const x = f.p[0]! + Math.cos(f.a) * 4;
      const y = f.p[1]! + Math.sin(f.a) * 4;
      drop(x, y, 8, 0.35);
      later.push({ at: time + 0.35, x, y, r: 7, s: 0.25 });
    }
  }

  /* -------------------------------------------------------------- drawing */

  const posed = new Float32Array(SPINE * 2);
  function pose(f: Fish, dt: number) {
    for (let i = 0; i < SPINE; i++) {
      const j = Math.min(i, SPINE - 2);
      const dx = f.p[j * 2]! - f.p[(j + 1) * 2]!;
      const dy = f.p[j * 2 + 1]! - f.p[(j + 1) * 2 + 1]!;
      const l = Math.hypot(dx, dy) || 1;
      const s = i / (SPINE - 1);
      // The tail beat, growing toward the tail, with a little recoil at the head.
      const off = f.L * f.amp * (Math.pow(s, 1.6) * Math.sin(f.beat - s * 5) - 0.12 * (1 - s) * Math.sin(f.beat));
      posed[i * 2] = f.p[i * 2]! - (dy / l) * off;
      posed[i * 2 + 1] = f.p[i * 2 + 1]! + (dx / l) * off;
    }
    const spine = f.uniforms.uSpine!.value as THREE.Vector4[];
    for (let i = 0; i < SPINE; i++) {
      const a = Math.max(0, i - 1);
      const b = Math.min(SPINE - 1, i + 1);
      const tx = posed[a * 2]! - posed[b * 2]!;
      const ty = posed[a * 2 + 1]! - posed[b * 2 + 1]!;
      const l = Math.hypot(tx, ty) || 1;
      spine[i]!.set(posed[i * 2]!, -posed[i * 2 + 1]!, tx / l, -ty / l);
    }
    (f.uniforms.uFlap!.value as THREE.Vector2).set(0.3 * Math.sin(f.flap), 0.3 * Math.sin(f.flap + Math.PI));

    // The tail is a membrane, not part of the spine: it trails the sideways swing of
    // the body's end and overshoots a little as it catches up (an underdamped spring),
    // spreads wide in a glide and folds narrow in a burst, and ripples faster the
    // faster the fish goes.
    const t = f.tail;
    const q = spine[Math.round(TAIL_ROOT * (SPINE - 1))]!;
    const e = spine[SPINE - 1]!;
    const lat = (e.x - q.x) * -q.w + (e.y - q.y) * q.z;
    if (dt > 0 && !Number.isNaN(t.lat)) {
      const reach = f.L * TAIL_REACH[f.kind];
      const target = Math.max(-0.7, Math.min(0.7, (-0.28 * (lat - t.lat)) / dt / reach));
      t.bendV += (70 * (target - t.bend) - 7 * t.bendV) * dt;
      t.bend += t.bendV * dt;
      const pace = f.v / f.vb;
      const spread = f.boost > 0.15 ? 0.78 : f.gliding ? 1.08 : 1;
      t.spread += (spread - t.spread) * (1 - Math.exp(-dt / 0.35));
      t.phase += dt * 6.283 * (1.1 + 0.5 * Math.min(pace, 4));
    }
    t.lat = lat;
    const flutter = 0.04 + 0.03 * Math.min(1, f.v / f.vb) + 0.05 * f.boost;
    (f.uniforms.uTail!.value as THREE.Vector4).set(t.bend, t.spread, t.phase, flutter);
  }

  function stepWater(substeps: number) {
    const list = waterMat.uniforms.uDrops!.value as THREE.Vector4[];
    const count = Math.min(MAX_DROPS, drops.length / 4);
    for (let i = 0; i < count; i++) list[i]!.set(drops[i * 4]!, vh - drops[i * 4 + 1]!, drops[i * 4 + 2]!, drops[i * 4 + 3]!);
    drops.length = 0;
    for (let s = 0; s < substeps; s++) {
      waterMat.uniforms.uCount!.value = s === 0 ? count : 0;
      waterMat.uniforms.tPrev!.value = waterA.texture;
      renderer.setRenderTarget(waterB);
      renderer.render(waterScene, quadCam);
      [waterA, waterB] = [waterB, waterA];
    }
  }

  function draw(dt = 0) {
    for (const f of fish) pose(f, dt);
    renderer.setRenderTarget(fishTarget);
    renderer.setClearColor(0x000000, 0);
    renderer.clear();
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    composeMat.uniforms.tWater!.value = waterA.texture;
    renderer.render(composeScene, quadCam);
  }

  /* ----------------------------------------------------------------- loop */

  let frame = 0;
  let previous = 0;
  // It swims on behind an open project (blurred with the page, at half the frame
  // rate), but only takes clicks on the page itself.
  const active = () => html.dataset.intro !== "on" && !document.hidden;
  const interactive = () => active() && html.dataset.project !== "open";
  function tick(now: number) {
    // Half rate behind an open project, and on phones while the cards slide over it
    // (the stage sets data-sliding then): they get the GPU.
    const easing = !interactive() || html.dataset.sliding !== undefined;
    if (easing && previous && now - previous < 30) {
      frame = active() ? requestAnimationFrame(tick) : 0;
      return;
    }
    const dt = previous ? Math.min((now - previous) / 1000, 1 / 30) : 1 / 60;
    previous = now;
    time += dt;
    if (cursor.mouse && interactive()) cursor.still += dt;
    wanderSchool(dt);
    for (const f of fish) swim(f, dt);
    surface(dt);
    for (let i = later.length - 1; i >= 0; i--) {
      const l = later[i]!;
      if (time >= l.at) {
        drop(l.x, l.y, l.r, l.s);
        later.splice(i, 1);
      }
    }
    stepWater(Math.max(1, Math.min(4, Math.round(dt * 120))));
    draw(dt);
    frame = active() ? requestAnimationFrame(tick) : 0;
  }
  function resume() {
    if (still || frame || !active()) return;
    previous = 0;
    frame = requestAnimationFrame(tick);
  }

  /* ---------------------------------------------------------------- input */

  let pressed = false;
  let lastX = 0;
  let lastY = 0;
  const onDown = (e: PointerEvent) => {
    if (still || !interactive()) return;
    pressed = true;
    lastX = e.clientX;
    lastY = e.clientY;
    splash(e.clientX, e.clientY);
  };
  const onMove = (e: PointerEvent) => {
    cursor.mouse = e.pointerType === "mouse";
    if (Math.hypot(e.clientX - cursor.x, e.clientY - cursor.y) > 3) cursor.still = 0;
    cursor.x = e.clientX;
    cursor.y = e.clientY;
    if (!pressed || still || !interactive()) return;
    // A finger trailing through the water.
    const d = Math.hypot(e.clientX - lastX, e.clientY - lastY);
    if (d > 14) {
      drop(e.clientX, e.clientY, 9, 0.28);
      fright(e.clientX, e.clientY, 0.45);
      lastX = e.clientX;
      lastY = e.clientY;
    }
  };
  const onUp = () => (pressed = false);
  const onLeave = () => (cursor.mouse = false);
  let resizeTimer = 0;
  const onResize = () => {
    clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      size();
      if (still) draw();
    }, 120);
  };
  const onLost = (e: Event) => {
    e.preventDefault();
    cancelAnimationFrame(frame);
    frame = 0;
    canvas.removeAttribute("data-ready");
  };

  size();
  populate(still);
  if (still) {
    // A still pond: each body laid along a gentle curve, drawn once.
    for (let i = 0; i < 40; i++) for (const f of fish) swim(f, 1 / 30);
    for (const f of fish) f.amp = KINDS[f.kind].amp * 0.4;
    draw();
  }
  canvas.dataset.ready = "";
  const watch = new MutationObserver(resume);
  watch.observe(html, { attributes: true, attributeFilter: ["data-intro", "data-project"] });
  document.addEventListener("visibilitychange", resume);
  addEventListener("pointerdown", onDown, { passive: true, capture: true });
  addEventListener("pointermove", onMove, { passive: true });
  addEventListener("pointerup", onUp, { passive: true });
  addEventListener("pointercancel", onUp, { passive: true });
  html.addEventListener("pointerleave", onLeave);
  addEventListener("resize", onResize);
  canvas.addEventListener("webglcontextlost", onLost);
  resume();

  return () => {
    cancelAnimationFrame(frame);
    watch.disconnect();
    document.removeEventListener("visibilitychange", resume);
    removeEventListener("pointerdown", onDown, { capture: true });
    removeEventListener("pointermove", onMove);
    removeEventListener("pointerup", onUp);
    removeEventListener("pointercancel", onUp);
    html.removeEventListener("pointerleave", onLeave);
    removeEventListener("resize", onResize);
    canvas.removeEventListener("webglcontextlost", onLost);
    for (const f of fish)
      for (const m of f.meshes) {
        m.geometry.dispose();
        (m.material as THREE.Material).dispose();
      }
    quad.dispose();
    waterMat.dispose();
    composeMat.dispose();
    fishTarget.dispose();
    waterA.dispose();
    waterB.dispose();
    renderer.dispose();
  };
}
