import * as k from "@/components/iso/iso-kit";

/*
 * An all-in-one Macintosh 128K in the Anatomy style: the case on its plinth with a
 * carry handle, vents and its seams; a bezel and CRT recessed into the front, a
 * striped badge, a floppy drive and the keyboard jack below; a 58-key keyboard on
 * its coiled cord and a one-button mouse whose cord runs round to the back. Depth
 * comes from the kit's tones by facing and fine edge lines (styled in intro.css).
 * While the page loads, the CRT shows a spinner and the percentage.
 *
 * World units are about 2 mm. x runs left to right, y back to front, z up.
 * Everything here runs once, on the server; the page receives finished markup.
 */

export const VIEW = { w: 1000, h: 800 };
const FIT = { w: 600, h: 510 };

const CASE = { x: -62, y: -69, w: 124, d: 138, r: 8 };
const FRONT = CASE.y + CASE.d;
const SIDE = CASE.x + CASE.w;
const PLINTH_H = 4;
const TOP = 172;
const SEAM = FRONT - 14;

const BEZEL = { x0: -50, x1: 50, z0: 74, z1: 160, r: 7, depth: 1.8 };
const CRT = { x0: -42, x1: 42, z0: 82, z1: 152, r: 9, depth: 4 };
const GLASS_Y = FRONT - BEZEL.depth - CRT.depth;
const CRT_MID = (CRT.z0 + CRT.z1) / 2;
const SLOT = { x0: 6, x1: 46, z0: 44, z1: 49.5, r: 2.4, depth: 4 };
const BADGE = { x0: -48, x1: -40, z0: 41, z1: 51, r: 1.6, depth: 0.6 };
const JACK = { x0: -52, x1: -44, z0: 8, z1: 13.5, r: 1.2, depth: 3 };

const KB = { x: -72, y: 86, w: 144, d: 56, r: 4 };
const KB_Z = 1.6;
const KB_TOP = 8.6;
const U = 9;
const KEYS_X = -U * 7.5;
const KEYS_Y = 90.5;
const ROWS: [string, number][][] = [
  [["`", 1], ["1", 1], ["2", 1], ["3", 1], ["4", 1], ["5", 1], ["6", 1], ["7", 1], ["8", 1], ["9", 1], ["0", 1], ["-", 1], ["=", 1], ["backspace", 2]],
  [["tab", 1.5], ["q", 1], ["w", 1], ["e", 1], ["r", 1], ["t", 1], ["y", 1], ["u", 1], ["i", 1], ["o", 1], ["p", 1], ["[", 1], ["]", 1], ["\\", 1.5]],
  [["caps", 1.75], ["a", 1], ["s", 1], ["d", 1], ["f", 1], ["g", 1], ["h", 1], ["j", 1], ["k", 1], ["l", 1], [";", 1], ["'", 1], ["return", 2.25]],
  [["shift", 2.25], ["z", 1], ["x", 1], ["c", 1], ["v", 1], ["b", 1], ["n", 1], ["m", 1], [",", 1], [".", 1], ["/", 1], ["shift-r", 2.75]],
  [["option", 1.5], ["command", 1.5], ["space", 9], ["enter", 1.5], ["option-r", 1.5]],
];
const ROW_H = [5.6, 5.2, 4.8, 4.4, 4];

const MOUSE = { x: 88, y: 98, w: 30, d: 50, r: 8 };
const MOUSE_H = 10;
const COIL = { x: -48, z: 4.2, r: 2.2, from: 75, to: 84, turns: 7 };

const P = (() => {
  const fit = k.fitProjection(
    [...k.boxCorners(CASE, 0, TOP), ...k.boxCorners(KB, 0, KB_TOP + 6), ...k.boxCorners(MOUSE, 0, MOUSE_H)],
    FIT.w,
    FIT.h,
    { pad: 0, azimuth: 58 },
  );
  return { ...fit, origin: [fit.origin[0] + (VIEW.w - FIT.w) / 2, fit.origin[1] + (VIEW.h - FIT.h) / 2] as k.Flat };
})();

const at = (point: k.Point3) => k.iso(point, P);
const S = (paths: k.SolidPaths, style?: k.SolidStyle) => k.solidSvg(paths, style);
const L = (d: string, style?: k.LineStyle) => k.lineSvg(d, style);
/** A groove cut into a surface: a dark line, not a drawn one. */
const G = (d: string) => k.lineSvg(d, { tone: "lo", className: "mac-groove" });
const planeOf = (y: number) => k.sideMatrix([0, y], 0, P, "left");
const curve = (points: k.Point3[]) => k.pathOf(points.map(at));

/*
 * The build: while the page loads, the machine is put together part by part (live.ts
 * plays it from the loading progress, with a camera directing it). Each part is a
 * group carrying when it comes in, as fractions of the build, and where from: a world
 * offset (x, y, z) it travels home from, projected here to the screen.
 *
 *   kind   "move" travels home; "draw" is a cord drawing along; "shadow" tightens
 *          and darkens on the floor as the part above it comes down
 *   flags  "f" fades in (small parts appearing in frame); "h" is heavy: it falls
 *          under gravity, lands with a small rebound and jolts the camera
 */
type Kind = "move" | "draw" | "shadow";
const part = (start: number, dur: number, from: k.Point3, html: string, kind: Kind = "move", flags = "f") => {
  const [vx, vy] = k.axisVector(P, from);
  return `<g data-b="${start.toFixed(3)} ${dur.toFixed(3)} ${vx.toFixed(2)} ${vy.toFixed(2)} ${flags || "-"}" data-kind="${kind}">${html}</g>`;
};
const STILL: k.Point3 = [0, 0, 0];
const sideSlot = (y: number, z0: number, z1: number, half = 0.8) =>
  k.pathOf(
    k.roundedPlan({ x: y - half, y: z0, w: half * 2, d: z1 - z0, r: half }, 4).map(([u, z]) => at([SIDE, u, z])),
    true,
  );
const byDepth = (points: k.Plane[]) => [...points].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));

/** A rounded rectangle in a face's flat (x, -z) coordinates. */
const flat = (x0: number, z0: number, x1: number, z1: number, r: number, steps = 6) =>
  k.pathOf(
    k.roundedPlan({ x: x0, y: z0, w: x1 - x0, d: z1 - z0, r }, steps).map(([u, z]) => [u, -z] as k.Flat),
    true,
  );

interface Opening {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
  r: number;
  depth: number;
}

/**
 * A recess in the front face: clipped to its outline in the face plane, inner walls
 * shaded by facing, the back plane filled with `backClass` and carrying `back`.
 */
let clips = 0;
function recess(o: Opening, y: number, back = "", backClass = "mac-well", inside = "", backAttrs = "") {
  const id = `mac-clip-${clips++}`;
  const ring = k.roundedPlan({ x: o.x0, y: o.z0, w: o.x1 - o.x0, d: o.z1 - o.z0, r: o.r }, 6);
  const cx = (o.x0 + o.x1) / 2;
  const cz = (o.z0 + o.z1) / 2;
  const { sinA } = k.cameraOf(P);
  const tops: string[] = [];
  const sides: string[][] = [[], [], [], []];
  ring.forEach(([ax, az], index) => {
    const [bx, bz] = ring[(index + 1) % ring.length]!;
    const length = Math.hypot(bx - ax, bz - az) || 1;
    let nx = (bz - az) / length;
    let nz = -(bx - ax) / length;
    if (nx * (cx - (ax + bx) / 2) + nz * (cz - (az + bz) / 2) < 0) [nx, nz] = [-nx, -nz];
    if (nx <= 0 && nz <= 0) return;
    const quad = k.pathOf([at([ax, y, az]), at([bx, y, bz]), at([bx, y - o.depth, bz]), at([ax, y - o.depth, az])], true);
    if (nz >= nx) tops.push(quad);
    else sides[Math.min(3, Math.max(0, Math.floor(((nx * -sinA + 1) / 2) * 4)))]!.push(quad);
  });
  const shape = flat(o.x0, o.z0, o.x1, o.z1, o.r);
  return [
    `<clipPath id="${id}"><path transform="${planeOf(y)}" d="${shape}"/></clipPath>`,
    `<g clip-path="url(#${id})">`,
    tops.length ? `<path class="iso-top" d="${tops.join("")}"/>` : "",
    ...sides.map((d, shade) => (d.length ? `<path class="iso-shade" data-shade="${shade}" d="${d.join("")}"/>` : "")),
    `<g transform="${planeOf(y - o.depth)}"${backAttrs}><path class="${backClass}" d="${shape}"/>${back}<path class="iso-line" data-tone="faint" d="${shape}"/></g>`,
    inside,
    `</g>`,
    `<g transform="${planeOf(y)}"><path class="iso-line" data-tone="lo" d="${shape}"/></g>`,
  ].join("");
}

/* ------------------------------------------------------------------ screen */

const GLASS = { u0: CRT.x0, u1: CRT.x1, v0: -CRT.z1, v1: -CRT.z0 };

/*
 * The CRT, in glass-face coordinates (x, -z): dark while the machine is built, then
 * it warms up to a soft glow with the tube's darker corners, and the page appears.
 */
function screenContent() {
  const glass = { x: CRT.x0, y: -CRT.z1, width: CRT.x1 - CRT.x0, height: CRT.z1 - CRT.z0 };
  const rect = (attrs: string) => `<rect x="${glass.x}" y="${glass.y}" width="${glass.width}" height="${glass.height}" ${attrs}/>`;

  const crt = [
    `<defs>`,
    `<radialGradient id="mac-glow"><stop offset="0" stop-color="#e6ecf4" stop-opacity=".07"/><stop offset="1" stop-color="#e6ecf4" stop-opacity="0"/></radialGradient>`,
    `<radialGradient id="mac-vignette" r=".72"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".55"/></radialGradient>`,
    `</defs>`,
    rect('fill="url(#mac-glow)"'),
    rect('fill="url(#mac-vignette)"'),
  ].join("");

  return [
    `<g data-part="crt" transform="translate(0 ${-CRT_MID}) scale(0 0) translate(0 ${CRT_MID})">${crt}</g>`,
    `<rect class="mac-sheen" x="${CRT.x0}" y="${-CRT.z1}" width="${CRT.x1 - CRT.x0}" height="${CRT.z1 - CRT.z0}" fill="url(#mac-sheen)"/>`,
    `<g data-part="mini" class="mac-mini"></g>`,
    `<path class="mac-beam" data-part="beam" d="M${CRT.x0 + 4} ${-CRT_MID}H${CRT.x1 - 4}" style="opacity:0"/>`,
    `<path class="iso-line mac-shine" data-tone="lo" d="M${CRT.x0 + 6} ${-(CRT.z1 - 16)}Q${CRT.x0 + 7} ${-(CRT.z1 - 7)} ${CRT.x0 + 16} ${-(CRT.z1 - 6)}"/>`,
  ].join("");
}

function screen() {
  const glass = recess(CRT, FRONT - BEZEL.depth, screenContent(), "mac-glass", "", ` data-part="glass-plane"`);
  return recess(BEZEL, FRONT, "", "mac-bezel", glass);
}

/* -------------------------------------------------------------------- case */

function computer() {
  const out: string[] = [];
  // The plinth settles onto the floor, then the case comes down onto it.
  out.push(part(0.02, 0.12, [0, 0, 26], S(k.slabOf(k.insetPlan(CASE, 3), 0, PLINTH_H, P, 8), { tone: "lo" }), "move", "fh"));
  out.push(part(0.12, 0.2, [0, 0, 240], S(k.slabOf(CASE, PLINTH_H, TOP - PLINTH_H, P, 12, 2.4), { tone: "mid", crease: "hi", className: "mac-body" }), "move", "h"));

  const details: string[] = [];
  // Top: the carry handle, a recess at the back, and the vents in front of it.
  const handle = { x: -42, y: CASE.y + 8, w: 84, d: 12, r: 6 };
  details.push(`<path class="mac-hole" d="${k.planOutline(handle, TOP, P, 8)}"/>`);
  details.push(`<path class="mac-hole" d="${k.planOutline(k.insetPlan(handle, 2.4), TOP, P, 8)}"/>`);
  details.push(`<path class="mac-hole" d="${Array.from({ length: 9 }, (_, i) => k.planOutline({ x: -34, y: CASE.y + 28 + i * 3.4, w: 68, d: 1.4, r: 0.7 }, TOP, P, 4)).join("")}"/>`);
  // The back cover meets the front moulding over the top and down the side, and the
  // moulding's lower lip wraps the visible corner.
  details.push(G(k.lineOnTop([CASE.x, SEAM], [SIDE, SEAM], TOP, P) + k.segment([SIDE, SEAM, TOP], [SIDE, SEAM, PLINTH_H], P)));
  details.push(G(k.sideSeam(CASE, 20, P)));
  // Side vents: a tall grille high at the back and a short one low down.
  const rowOf = (from: number, to: number) => Array.from({ length: Math.floor((to - from) / 3.2 + 1e-9) + 1 }, (_, i) => from + i * 3.2);
  details.push(`<path class="mac-hole" d="${rowOf(CASE.y + 12, CASE.y + 58).map((y) => sideSlot(y, TOP - 46, TOP - 14)).join("")}"/>`);
  details.push(`<path class="mac-hole" d="${rowOf(CASE.y + 12, CASE.y + 40).map((y) => sideSlot(y, 28, 42)).join("")}"/>`);
  details.push(`<g transform="${planeOf(FRONT)}"><path class="iso-line mac-groove" data-tone="lo" d="${flat(CASE.x + 4, 24, SIDE - 4, TOP - 4, 6)}"/></g>`);
  out.push(part(0.3, 0.14, [0, 0, 4], details.join("")));

  // The front: the screen presses in, then the badge, the floppy drive and the jack.
  out.push(part(0.36, 0.16, [0, 16, 0], screen()));
  const stripes = ["#6fae5c", "#d9b44a", "#d98a3d", "#c85550", "#8d5aa0", "#4f8fc9"];
  const band = (BADGE.z1 - BADGE.z0 - 2) / stripes.length;
  const badge = stripes.map((fill, i) => `<rect x="${BADGE.x0 + 1}" y="${-(BADGE.z1 - 1 - i * band)}" width="${BADGE.x1 - BADGE.x0 - 2}" height="${band.toFixed(2)}" fill="${fill}"/>`).join("");
  out.push(part(0.46, 0.1, [0, 6, 0], recess(BADGE, FRONT, `<g class="mac-badge">${badge}</g>`, "mac-well")));
  out.push(part(0.49, 0.1, [0, 6, 0], recess(SLOT, FRONT, `<path class="iso-line" data-tone="lo" d="M${SLOT.x0 + 2} ${-(SLOT.z0 + 1.8)}H${SLOT.x1 - 2}"/>`, "mac-dark")));
  out.push(part(0.52, 0.08, [0, 4, 0], `<path class="mac-hole" d="${k.pathOf(k.circleRing(SLOT.x1 + 5, SLOT.z0 + 1, 0.9, 14).map(([x, z]) => at([x, FRONT, z])), true)}"/>`));
  out.push(part(0.54, 0.08, [0, 6, 0], recess(JACK, FRONT, `<path class="iso-line" data-tone="faint" d="M${JACK.x0 + 2} ${-(JACK.z0 + 1.6)}H${JACK.x1 - 2}"/>`, "mac-dark")));
  return `<g class="mac-computer">${out.join("")}</g>`;
}

/* ---------------------------------------------------------------- keyboard */

function keyboardCord() {
  const out: string[] = [];
  // The plug sits in the jack on the front and stands proud of it.
  out.push(part(0.82, 0.06, [0, 8, 0], S(k.slabOf({ x: JACK.x0 + 1, y: FRONT, w: JACK.x1 - JACK.x0 - 2, d: 4, r: 0.8 }, JACK.z0 + 0.6, JACK.z1 - JACK.z0 - 1.2, P, 3, 0.3), { tone: "mid" })));
  const start: k.Point3 = [COIL.x + COIL.r, COIL.from, COIL.z];
  const end: k.Point3 = [COIL.x + COIL.r, COIL.to, COIL.z];
  out.push(part(0.84, 0.05, STILL, `<path class="iso-line mac-cord" data-tone="mid" d="${curve([[COIL.x, FRONT + 4, (JACK.z0 + JACK.z1) / 2], [COIL.x + 1, FRONT + 5.2, 9], [COIL.x + 2, COIL.from - 0.6, 6.4], start])}"/>`, "draw"));
  // The coil springs out along the cord.
  const spring = k.coil(COIL.from, COIL.to, [COIL.x, COIL.z], COIL.r, COIL.turns, "y", P);
  out.push(part(0.88, 0.06, [0, -6, 0], L(spring.back, { tone: "lo" }) + L(spring.front, { tone: "mid" })));
  out.push(part(0.92, 0.04, STILL, `<path class="iso-line mac-cord" data-tone="mid" d="${curve([end, [COIL.x + 1.4, COIL.to + 1.2, COIL.z], [COIL.x, KB.y - 1.4, 4.6]])}"/>`, "draw"));
  return out.join("");
}

function keyboard() {
  const out: string[] = [];
  // The keyboard slides in from the front, empty.
  const base: string[] = [];
  for (const [x, y] of byDepth(k.corners(KB, 8))) base.push(S(k.cylinder(x, y, 2.8, 0, KB_Z, P, 16), { tone: "lo" }));
  base.push(S(k.slabOf(KB, KB_Z, KB_TOP - KB_Z, P, 8, 1), { tone: "mid", crease: "hi", className: "mac-body" }));
  // The cord's strain relief on the back edge.
  base.push(S(k.slabOf({ x: COIL.x - 3, y: KB.y - 2, w: 6, d: 2, r: 0.8 }, 2.4, 4.4, P, 3), { tone: "mid" }));
  const well = { x: KEYS_X - 1.4, y: KEYS_Y - 1.4, w: U * 15 + 2.8, d: U * 5 + 2.8, r: 2 };
  base.push(`<path class="mac-hole" d="${k.planOutline(well, KB_TOP, P, 4)}"/>`);
  out.push(part(0.56, 0.12, [0, 120, 0], base.join(""), "move", ""));
  // Then the keys drop into it in a ripple, row by row from the back.
  ROWS.forEach((row, r) => {
    let x = KEYS_X;
    row.forEach(([, width], c) => {
      const plan = { x: x + 0.7, y: KEYS_Y + r * U + 0.7, w: width * U - 1.4, d: U - 1.4, r: 1.4 };
      const h = ROW_H[r]!;
      out.push(part(0.64 + r * 0.03 + c * 0.006, 0.06, [0, 0, 14], S(k.slabOf(plan, KB_TOP, h, P, 3, 0.4), { tone: "lo", crease: "hi", className: "mac-key" })));
      x += width * U;
    });
  });
  return out.join("");
}

/* ------------------------------------------------------------------- mouse */

function mouseCord() {
  // From the mouse's nose, round the right of the case, to the port on the back.
  const cx = MOUSE.x + MOUSE.w / 2;
  return part(0.84, 0.12, STILL, `<path class="iso-line mac-cord" data-tone="mid" d="${curve([
    [cx, MOUSE.y + 1, 4],
    [cx, MOUSE.y - 3, 1.4],
    [cx - 3, MOUSE.y - 12, 0.9],
    [86, 60, 0.9],
    [78, 20, 0.9],
    [74, -30, 0.9],
    [70, -64, 0.9],
    [60, -80, 2],
    [40, -78, 10],
  ])}"/>`, "draw");
}

function mouse() {
  const out: string[] = [];
  // The cord's boot at the nose, behind the body.
  out.push(S(k.slabOf({ x: MOUSE.x + MOUSE.w / 2 - 2, y: MOUSE.y - 2.4, w: 4, d: 3, r: 1.2 }, 2.6, 3, P, 3), { tone: "mid" }));
  out.push(S(k.slabOf(k.insetPlan(MOUSE, 2), 0, 1.2, P, 6), { tone: "lo" }));
  out.push(S(k.slabOf(MOUSE, 1.2, MOUSE_H - 1.2, P, 10, 1.2), { tone: "mid", crease: "hi", className: "mac-body" }));
  // The one button: a separate plate across the back third, a seam in front of it.
  const button = { x: MOUSE.x + 3, y: MOUSE.y + 3, w: MOUSE.w - 6, d: 15, r: 2.4 };
  out.push(S(k.slabOf(button, MOUSE_H, 0.7, P, 4, 0.3), { tone: "lo", crease: "hi", className: "mac-key" }));
  out.push(G(k.sideSeam(MOUSE, 4.2, P)));
  // The mouse slides in from the right.
  return part(0.76, 0.1, [110, 0, 0], out.join(""), "move", "");
}

/* -------------------------------------------------------------- assembly */

export interface ScreenGeometry {
  /** Maps the glass plane's flat (u = x, v = -z) coordinates to the svg's user space. */
  plane: [number, number, number, number, number, number];
  /** The part of the glass that stays visible through the recess, inset off its rounded corners. */
  view: { u0: number; u1: number; v0: number; v1: number };
  mid: number;
}

function screenGeometry(): ScreenGeometry {
  const origin = at([0, GLASS_Y, 0]);
  const ax = at([1, GLASS_Y, 0]);
  const up = at([0, GLASS_Y, 1]);
  const X: k.Flat = [ax[0] - origin[0], ax[1] - origin[1]];
  const Dn: k.Flat = [origin[0] - up[0], origin[1] - up[1]];
  // The front opening is the glass outline moved CRT.depth toward the viewer; in glass
  // coordinates that is a shift (du, dv), and only the overlap of the two is visible.
  const [sx, sy] = k.axisVector(P, [0, CRT.depth, 0]);
  const det = X[0] * Dn[1] - Dn[0] * X[1];
  const du = (sx * Dn[1] - Dn[0] * sy) / det;
  const dv = (X[0] * sy - sx * X[1]) / det;
  const inset = CRT.r * 0.3 + 0.6;
  return {
    plane: [X[0], X[1], Dn[0], Dn[1], origin[0], origin[1]],
    view: {
      u0: GLASS.u0 + Math.max(0, du) + inset,
      u1: GLASS.u1 + Math.min(0, du) - inset,
      v0: GLASS.v0 + Math.max(0, dv) + inset,
      v1: GLASS.v1 + Math.min(0, dv) - inset,
    },
    mid: -CRT_MID,
  };
}

/*
 * The light the screen throws when it powers on: a soft pool on the floor and the
 * keyboard in front of it. live.ts brings it up with the picture.
 */
function spill() {
  const ring = k.circleRing(0, FRONT + 34, 1, 48).map(([x, y]) => [x * 92, FRONT + 34 + (y - FRONT - 34) * 52] as k.Plane);
  const d = k.onTop(ring, 6, P, true);
  return [
    `<defs><radialGradient id="mac-spill"><stop offset="0" stop-color="#dfe8f5" stop-opacity=".34"/><stop offset=".5" stop-color="#dfe8f5" stop-opacity=".12"/><stop offset="1" stop-color="#dfe8f5" stop-opacity="0"/></radialGradient></defs>`,
    `<path data-part="spill" class="mac-spill" d="${d}" fill="url(#mac-spill)" style="opacity:0"/>`,
  ].join("");
}

/*
 * The camera's shots for the build, as [progress, x, y, scale]: the point of the
 * drawing at the centre of the frame and how close. The last is the full figure at
 * rest (the drawing's own centre, scale 1), where the zoom into the screen starts.
 */
function shots(): [number, number, number, number][] {
  const shot = (p: number, point: k.Point3, scale: number): [number, number, number, number] => {
    const [x, y] = at(point);
    return [p, +x.toFixed(1), +y.toFixed(1), scale];
  };
  const hero: [number, number, number, number] = [0, VIEW.w / 2, VIEW.h / 2, 1];
  const kbMid = KB.y + KB.d / 2;
  return [
    shot(0, [0, CASE.y + CASE.d / 2, 6], 2.7), //   low and close on the floor: the plinth settles
    shot(0.12, [0, CASE.y + CASE.d / 2, 18], 2.5), //  waiting for the case
    shot(0.33, [0, 0, 96], 1.45), //                     pulled back as it lands
    shot(0.42, [0, FRONT, 112], 2.1), //                 pushing in on the face: the screen seats
    shot(0.54, [-14, FRONT, 52], 2.6), //                down the face: badge, floppy slot, jack
    shot(0.64, [0, kbMid, 6], 2.2), //                   down to the floor: the keyboard slides in
    shot(0.76, [16, kbMid, 6], 2.6), //                  following the keys as they ripple in
    shot(0.86, [MOUSE.x + MOUSE.w / 2, MOUSE.y + MOUSE.d / 2, 4], 2.4), // the mouse arrives
    [0.96, hero[1], hero[2], 1], //                      pulled out: the whole machine, cords drawing
    [1, hero[1], hero[2], 1],
  ];
}

export function buildMacintosh() {
  clips = 0;
  const grad = (id: string, [x1, y1, x2, y2]: number[], stops: [number, string][]) =>
    `<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stops.map(([o, c]) => `<stop offset="${o}" style="stop-color:${c}"/>`).join("")}</linearGradient>`;
  const defs = [
    "<defs>",
    // Light falls from the front left: tops brighten toward the front edge, fronts
    // fade toward the floor, sides fade into shadow toward the back.
    grad("mac-top", [0.15, 1, 0.75, 0], [[0, "var(--mac-top-a)"], [1, "var(--mac-top-b)"]]),
    grad("mac-front", [0, 0, 0, 1], [[0, "var(--mac-front-a)"], [1, "var(--mac-front-b)"]]),
    grad("mac-side", [0, 0, 1, 0.25], [[0, "var(--mac-side-a)"], [1, "var(--mac-side-b)"]]),
    grad("mac-key-top", [0, 1, 0.6, 0], [[0, "var(--mac-key-a)"], [1, "var(--mac-key-b)"]]),
    grad("mac-sheen", [0, 0, 1, 1], [[0, "rgba(255,255,255,.075)"], [0.42, "rgba(255,255,255,.02)"], [0.5, "rgba(255,255,255,0)"]]),
    `<radialGradient id="mac-contact"><stop offset="0" style="stop-color:#000;stop-opacity:.55"/><stop offset=".7" style="stop-color:#000;stop-opacity:.18"/><stop offset="1" style="stop-color:#000;stop-opacity:0"/></radialGradient>`,
    "</defs>",
  ].join("");
  // Contact shadows: plain gradients (no blur), so they stay through the zoom.
  const contact = (plan: k.Plan, grow: number) => `<path class="mac-contact" d="${k.haloOf(k.insetPlan(plan, -grow), 0, 0, P)}"/>`;
  const body = [
    defs,
    part(0.02, 0.3, STILL, contact(CASE, 16), "shadow"),
    part(0.56, 0.12, [0, 120, 0], contact(KB, 8), "move", ""),
    part(0.76, 0.1, [110, 0, 0], contact(MOUSE, 6), "move", ""),
    mouseCord(),
    computer(),
    keyboardCord(),
    keyboard(),
    mouse(),
    spill(),
  ].join("");
  const svg = k.figureSvg({
    width: VIEW.w,
    height: VIEW.h,
    className: "intro-svg",
    label: "A Macintosh being put together part by part while the page loads, then switching on.",
    body: `<g data-part="zoom" data-shots='${JSON.stringify(shots())}'>${body}</g>`,
  });
  return { svg, screen: screenGeometry() };
}
