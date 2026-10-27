import { domToPng } from "modern-screenshot";
import { fitIntro } from "@/components/stage/fit";
import type { ScreenGeometry } from "./macintosh";

/*
 * The intro's timeline, written straight onto the server-rendered svg (no React
 * re-renders per frame):
 *
 *   load    the machine is put together part by part, its progress following
 *           real loading (fonts, images), never faster than MIN_LOAD so the
 *           build can be watched. If loading is slow it waits near the end.
 *           A camera directs it: close on each part as it arrives, pulling out
 *           to the whole machine at the end. It can't be skipped.
 *   power   the finished machine switches on: the CRT warms up, a line and then
 *           the picture opening out
 *   boot    the screen swaps the boot window for a miniature of the page, built
 *           from where the real page's elements sit
 *   zoom    the camera falls into the screen until the glass is the viewport; the
 *           miniature lands exactly on the real page
 *   fade    the real page shows through and the overlay fades out
 */

const SVG_NS = "http://www.w3.org/2000/svg";
const MIN_LOAD = 3.9;
const POWER = 0.38;
const POWER_HOLD = 0.25; // the lit, empty screen before the page appears on it
const HOLD = 0.25;
const BOOT_HOLD = 0.6;
const SNAPSHOT_WAIT = 2;
const ZOOM = 1.3;
const FADE = 0.45;

type Phase = "power" | "load" | "boot" | "zoom" | "fade" | "done";

const ease3 = (t: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);
const easeInOut = (t: number) => {
  const x = Math.min(1, Math.max(0, t));
  return x < 0.5 ? 8 * x * x * x * x : 1 - Math.pow(-2 * x + 2, 4) / 2;
};

function make<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
  return node;
}

const fmt = (m: DOMMatrix) => `matrix(${[m.a, m.b, m.c, m.d, m.e, m.f].map((n) => +n.toFixed(5)).join(" ")})`;

/*
 * The signature is written after the landing: each stroke draws at one pen speed,
 * in document order, with a short lift between strokes. The CSS animation starts
 * when html[data-intro="done"] is set; this only measures and sets the timings.
 */
const PEN_SPEED = 1700; // signature viewBox units per second
const PEN_LIFT = 0.1;
const WRITE_AFTER = 0.35; // after the overlay starts to fade

export function primeSignature() {
  let at = WRITE_AFTER;
  document.querySelectorAll<SVGPathElement>(".signature path").forEach((path) => {
    const len = path.getTotalLength();
    const dur = Math.max(0.12, len / PEN_SPEED);
    path.style.setProperty("--len", len.toFixed(1));
    path.style.setProperty("--dur", `${dur.toFixed(3)}s`);
    path.style.setProperty("--delay", `${at.toFixed(3)}s`);
    at += dur + PEN_LIFT;
  });
  // When the last stroke lands, the project cards and the fader come in (stage.css).
  document.documentElement.style.setProperty("--sig-end", `${(at + 0.1).toFixed(3)}s`);
}

export function runIntro(root: HTMLElement, screen: ScreenGeometry, finish: () => void) {
  primeSignature();
  const svg = root.querySelector("svg")!;
  const pick = <T extends Element>(part: string) => svg.querySelector<T>(`[data-part="${part}"]`)!;
  const zoom = pick<SVGGElement>("zoom");
  const crt = pick<SVGGElement>("crt");
  const beam = pick<SVGPathElement>("beam");
  const mini = pick<SVGGElement>("mini");
  const spill = pick<SVGPathElement>("spill");
  // The build's parts, each with its timing (fractions of the build) and the screen
  // offset it travels home from (macintosh.ts, part()).
  const parts = Array.from(svg.querySelectorAll<SVGGElement>("[data-b]")).map((el) => {
    const bits = el.dataset.b!.split(" ");
    const [start, dur, vx, vy] = bits.slice(0, 4).map(Number) as [number, number, number, number];
    const flags = bits[4] ?? "";
    const kind = el.dataset.kind;
    const draw = kind === "draw" ? Array.from(el.querySelectorAll<SVGPathElement>("path")).map((p) => ({ p, len: p.getTotalLength() })) : null;
    let centre: [number, number] = [0, 0];
    if (kind === "shadow") {
      const b = el.getBBox();
      centre = [b.x + b.width / 2, b.y + b.height / 2];
    }
    return { el, start, dur, vx, vy, kind, draw, centre, fade: flags.includes("f"), heavy: flags.includes("h"), landed: false, done: false };
  });

  /*
   * The camera: a scale and a point of the drawing held at the centre of the frame,
   * written onto the zoom group. Its target follows the build through the shots
   * (macintosh.ts, shots()), eased between them; the camera itself follows the
   * target on a critically damped spring, so it glides and never snaps, and a heavy
   * landing gives it a small downward jolt.
   */
  const shots = JSON.parse(zoom.dataset.shots ?? "[]") as [number, number, number, number][];
  const HOME = shots[shots.length - 1] ?? [1, 500, 400, 1];
  const camera = { x: HOME[1], y: HOME[2], s: Math.log(HOME[3]), vx: 0, vy: 0, vs: 0 };
  const CAM = { k: 26, c: 2 * Math.sqrt(26) };
  const smoothstep = (t: number) => t * t * (3 - 2 * t);
  function shotAt(p: number) {
    let i = 0;
    while (i + 1 < shots.length - 1 && shots[i + 1]![0] <= p) i++;
    const a = shots[i]!;
    const b = shots[Math.min(i + 1, shots.length - 1)]!;
    const t = b[0] > a[0] ? smoothstep(Math.min(1, Math.max(0, (p - a[0]) / (b[0] - a[0])))) : 1;
    return { x: a[1] + (b[1] - a[1]) * t, y: a[2] + (b[2] - a[2]) * t, s: Math.log(a[3]) + (Math.log(b[3]) - Math.log(a[3])) * t };
  }
  function writeCamera() {
    const s = Math.exp(camera.s);
    const [cx, cy] = [HOME[1], HOME[2]];
    zoom.setAttribute("transform", `matrix(${s.toFixed(5)} 0 0 ${s.toFixed(5)} ${(cx - s * camera.x).toFixed(3)} ${(cy - s * camera.y).toFixed(3)})`);
    // The lens darkens the edges in close-ups.
    root.style.setProperty("--vig", Math.min(1, Math.max(0, (s - 1) / 1.4)).toFixed(3));
  }
  function moveCamera(dt: number, target: { x: number; y: number; s: number }) {
    for (let left = dt; left > 1e-6; left -= 1 / 240) {
      const h = Math.min(left, 1 / 240);
      camera.vx += (CAM.k * (target.x - camera.x) - CAM.c * camera.vx) * h;
      camera.vy += (CAM.k * (target.y - camera.y) - CAM.c * camera.vy) * h;
      camera.vs += (CAM.k * (target.s - camera.s) - CAM.c * camera.vs) * h;
      camera.x += camera.vx * h;
      camera.y += camera.vy * h;
      camera.s += camera.vs * h;
    }
    writeCamera();
  }
  const cameraHome = () => Math.abs(camera.s) < 0.004 && Math.abs(camera.x - HOME[1]) < 0.6 && Math.abs(camera.y - HOME[2]) < 0.6;
  function resetCamera() {
    Object.assign(camera, { x: HOME[1], y: HOME[2], s: 0, vx: 0, vy: 0, vs: 0 });
    zoom.removeAttribute("transform");
    root.style.setProperty("--vig", "0");
  }
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;

  let ready = false;
  const loaded = document.readyState === "complete" ? Promise.resolve() : new Promise<void>((done) => addEventListener("load", () => done(), { once: true }));
  Promise.race([Promise.all([loaded, document.fonts?.ready]), new Promise((done) => setTimeout(done, 8000))]).then(() => {
    ready = true;
    takeSnapshot();
  });

  /*
   * What the screen shows as the camera falls in: a picture of the real page, taken
   * once it has loaded, so the landing is pixel for pixel what is underneath (the
   * chips' and the slider's shading included). The project cards are left out (they
   * come in after the signature, which is not drawn yet either). If the picture
   * can't be taken in time, the screen falls back to a drawn copy of the page.
   */
  let snapshot: string | null = null;
  let snapshotSettled = false;
  let snapshotWait = 0;
  function takeSnapshot() {
    fitIntro();
    const page = document.querySelector<HTMLElement>(".page");
    if (!page || still) {
      snapshotSettled = true;
      return;
    }
    domToPng(page, {
      width: innerWidth,
      height: innerHeight,
      scale: Math.min(2, devicePixelRatio || 1),
      style: { opacity: "1" },
      // The cards and the contact keys arrive after the signature, so not on the glass.
      filter: (node) => !(node instanceof HTMLElement && (node.classList.contains("card") || node.classList.contains("contact"))),
      // Never hang on an image that won't load (a lazy one offscreen would wait 30 s).
      timeout: 1500,
    })
      .then((url) => (snapshot = url))
      .catch(() => (snapshot = null))
      .finally(() => (snapshotSettled = true));
  }

  let phase: Phase = "load";
  let clock = 0;
  let loadClock = 0;
  let shown = 0;
  let held = 0;
  let frame = 0;
  let previous = 0;
  let path: ((t: number) => DOMMatrix) | null = null;

  const glassPlane = new DOMMatrix(screen.plane);
  const mid = screen.mid;

  function setCrt(sx: number, sy: number, beamAt: number) {
    crt.setAttribute("transform", `translate(0 ${mid}) scale(${sx.toFixed(3)} ${sy.toFixed(3)}) translate(0 ${-mid})`);
    beam.setAttribute("transform", `translate(0 ${mid}) scale(${Math.max(sx, 0.001).toFixed(3)} 1) translate(0 ${-mid})`);
    beam.style.opacity = beamAt.toFixed(2);
  }

  /*
   * The build at progress p (0–1): each part fades in quickly and travels home on an
   * ease that lands just past and settles back, like something with weight. Parts
   * that are home are left alone.
   */
  const land = (t: number) => {
    const c = 0.9; // a gentle overshoot
    const x = t - 1;
    return 1 + (c + 1) * x * x * x + c * x * x;
  };
  /** Falling under gravity, then a small rebound off the floor. */
  const IMPACT = 0.72;
  const drop = (t: number) => {
    if (t < IMPACT) return (t / IMPACT) ** 2;
    const u = (t - IMPACT) / (1 - IMPACT);
    return 1 - 0.035 * Math.sin(u * Math.PI) * (1 - u * 0.5);
  };
  function setBuild(p: number) {
    for (const part of parts) {
      if (part.done) continue;
      const t = Math.min(1, Math.max(0, (p - part.start) / part.dur));
      if (part.draw) {
        const e = ease3(t);
        part.el.style.opacity = t > 0 ? "1" : "0";
        for (const { p: path, len } of part.draw) {
          // Cords keep a constant line width (non-scaling stroke), so their dashes
          // are measured on screen, where the camera's zoom counts too.
          const l = len * (path.getScreenCTM()?.a || 1) + 2;
          path.style.strokeDasharray = `${l} ${l}`;
          path.style.strokeDashoffset = `${l * (1 - e)}`;
        }
      } else if (part.kind === "shadow") {
        // Tighter and darker as the part above comes down.
        const e = smoothstep(t);
        const k = 1.45 - 0.45 * e;
        const [cx, cy] = part.centre;
        part.el.style.opacity = (e * e).toFixed(3);
        part.el.setAttribute("transform", `matrix(${k.toFixed(4)} 0 0 ${k.toFixed(4)} ${(cx - k * cx).toFixed(2)} ${(cy - k * cy).toFixed(2)})`);
      } else {
        const e = t >= 1 ? 1 : part.heavy ? drop(t) : land(t);
        part.el.style.opacity = !part.fade ? (t > 0 ? "1" : "0") : Math.min(1, t / 0.3).toFixed(3);
        part.el.setAttribute("transform", `translate(${(part.vx * (1 - e)).toFixed(2)} ${(part.vy * (1 - e)).toFixed(2)})`);
        if (part.heavy && !part.landed && t >= IMPACT) {
          part.landed = true;
          // The weight lands: a small jolt, more for a longer fall.
          camera.vy += Math.min(90, Math.hypot(part.vx, part.vy) * 0.35);
        }
      }
      if (t >= 1) {
        part.done = true;
        part.el.style.opacity = "1";
        part.el.removeAttribute("transform");
        part.draw?.forEach(({ p: path }) => {
          path.style.strokeDasharray = "";
          path.style.strokeDashoffset = "";
        });
      }
    }
  }
  function finishBuild() {
    setBuild(2);
    root.toggleAttribute("data-built", true);
  }

  /** Where the glass lands: face coordinates → viewport pixels, covering the viewport. */
  function landing() {
    const { u0, u1, v0, v1 } = screen.view;
    const vw = innerWidth;
    const vh = innerHeight;
    const k = Math.max(vw / (u1 - u0), vh / (v1 - v0));
    const uc = (u0 + u1) / 2;
    const vc = (v0 + v1) / 2;
    const toView = new DOMMatrix([k, 0, 0, k, vw / 2 - k * uc, vh / 2 - k * vc]);
    return { k, vw, vh, toView, toFace: toView.inverse() };
  }

  /** Draws the page in miniature on the glass, from the real page's layout. */
  function buildMini() {
    fitIntro();
    const { k, vw, vh, toFace } = landing();
    const css = getComputedStyle(document.documentElement);
    const box = (r: DOMRect) => {
      const a = toFace.transformPoint(new DOMPoint(r.left, r.top));
      const b = toFace.transformPoint(new DOMPoint(r.right, r.bottom));
      return { x: a.x, y: a.y, w: b.x - a.x, h: b.y - a.y };
    };
    const nodes: SVGElement[] = [];

    // The page background and its dot grid, registered to the viewport's 16px tiles.
    const corner = toFace.transformPoint(new DOMPoint(0, 0));
    const far = toFace.transformPoint(new DOMPoint(vw, vh));
    const pattern = make("pattern", { id: "mac-dots", patternUnits: "userSpaceOnUse", x: corner.x, y: corner.y, width: 16 / k, height: 16 / k });
    pattern.appendChild(make("circle", { cx: 8 / k, cy: 8 / k, r: 1 / k, fill: "var(--dot)" }));
    nodes.push(make("defs", {}));
    nodes[0]!.appendChild(pattern);
    nodes.push(make("rect", { x: corner.x - 20, y: corner.y - 20, width: far.x - corner.x + 40, height: far.y - corner.y + 40, fill: "var(--bg)" }));
    nodes.push(make("rect", { x: corner.x, y: corner.y, width: far.x - corner.x, height: far.y - corner.y, fill: "url(#mac-dots)" }));

    if (snapshot) {
      nodes.push(make("image", { href: snapshot, x: corner.x, y: corner.y, width: far.x - corner.x, height: far.y - corner.y, preserveAspectRatio: "none" }));
      mini.replaceChildren(...nodes);
      return;
    }

    // The signature is left off: it is written on the real page once the camera lands.

    // Images (the avatar, the project cards) as the images themselves, clipped to their corners.
    const visible = (r: DOMRect) => r.width > 0 && r.right > 0 && r.left < vw && r.bottom > 0 && r.top < vh;
    let clipId = 0;
    const image = (el: HTMLImageElement) => {
      const r = el.getBoundingClientRect();
      if (!visible(r)) return;
      const b = box(r);
      const style = getComputedStyle(el);
      const radius = parseFloat(style.borderTopLeftRadius) / k;
      const id = `mac-clip-image-${clipId++}`;
      const clip = make("clipPath", { id });
      clip.appendChild(make("rect", { x: b.x, y: b.y, width: b.w, height: b.h, rx: radius }));
      nodes[0]!.appendChild(clip);
      const copy = make("image", { href: el.currentSrc || el.src, x: b.x, y: b.y, width: b.w, height: b.h, preserveAspectRatio: "xMidYMid slice", "clip-path": `url(#${id})` });
      if (style.filter !== "none") copy.style.filter = style.filter;
      nodes.push(copy);
      nodes.push(make("rect", { x: b.x, y: b.y, width: b.w, height: b.h, rx: radius, fill: "none", stroke: "rgba(255,255,255,.12)", "stroke-width": 1 / k }));
    };
    document.querySelectorAll<HTMLImageElement>('.intro [data-mini="image"]').forEach(image);

    // Text is set word by word where the page set it, in the page's own font, so the
    // landing is exact whatever the line breaks.
    const measure = document.createElement("canvas").getContext("2d")!;
    const words = (node: Text, color: string) => {
      const style = getComputedStyle(node.parentElement!);
      measure.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      const ascent = measure.measureText("Hg").fontBoundingBoxAscent;
      const spacing = parseFloat(style.letterSpacing) || 0;
      const text = node.textContent ?? "";
      const range = document.createRange();
      for (const match of text.matchAll(/\S+/g)) {
        range.setStart(node, match.index!);
        range.setEnd(node, match.index! + match[0].length);
        const r = range.getBoundingClientRect();
        if (!r.width) continue;
        const p = toFace.transformPoint(new DOMPoint(r.left, r.top + ascent));
        const word = make("text", {
          x: p.x,
          y: p.y,
          "font-size": parseFloat(style.fontSize) / k,
          "font-family": style.fontFamily,
          "font-weight": style.fontWeight,
          "letter-spacing": spacing / k,
          fill: color,
        });
        word.textContent = match[0];
        nodes.push(word);
      }
    };
    const walk = (el: Element, color: string) => {
      el.childNodes.forEach((child) => {
        if (child instanceof Text) {
          if (child.textContent?.trim()) words(child, color);
        } else if (child instanceof HTMLElement && child.classList.contains("pill")) {
          const b = box(child.getBoundingClientRect());
          nodes.push(make("rect", { x: b.x, y: b.y, width: b.w, height: b.h, rx: parseFloat(getComputedStyle(child).borderTopLeftRadius) / k, fill: "var(--pill-bg)" }));
          const icon = child.querySelector("svg");
          if (icon) {
            const i = box(icon.getBoundingClientRect());
            const copy = icon.cloneNode(true) as SVGSVGElement;
            copy.removeAttribute("class");
            for (const [key, value] of Object.entries({ x: i.x, y: i.y, width: i.w, height: i.h })) copy.setAttribute(key, String(value));
            nodes.push(copy);
          }
          walk(child, "var(--text-strong)");
        } else if (child instanceof Element) {
          walk(child, color);
        }
      });
    };
    const name = document.querySelector(".name");
    const tagline = document.querySelector(".tagline");
    const bio = document.querySelector(".bio");
    if (name) walk(name, "var(--text-strong)");
    if (tagline) walk(tagline, "var(--text-muted)");
    if (bio) walk(bio, "var(--text)");

    // The project cards are left off too: they come in after the signature is written.
    // The slider is always on the page, so it is drawn here as it sits: the well (lit
    // like the real one), the ball and the stop numbers.
    const well = document.querySelector<HTMLElement>(".slider-well");
    if (well && visible(well.getBoundingClientRect())) {
      const b = box(well.getBoundingClientRect());
      const shade = make("linearGradient", { id: "mac-well", x1: 0, y1: 0, x2: 0, y2: 1 });
      for (const [offset, color] of [[0, "#0b0d10"], [0.3, "#0f1114"], [0.62, "#0f1114"], [0.88, "#17191c"], [1, "#101215"]] as const) {
        shade.appendChild(make("stop", { offset, "stop-color": color }));
      }
      nodes[0]!.appendChild(shade);
      nodes.push(make("rect", { x: b.x, y: b.y, width: b.w, height: b.h, rx: b.h / 2, fill: "url(#mac-well)" }));
      nodes.push(make("rect", { x: b.x, y: b.y + 1 / k, width: b.w, height: b.h, rx: b.h / 2, fill: "none", stroke: "rgba(255,255,255,.12)", "stroke-width": 1 / k }));
      const groove = document.querySelector<HTMLElement>(".slider-groove");
      if (groove) {
        const g = box(groove.getBoundingClientRect());
        nodes.push(make("rect", { x: g.x, y: g.y, width: g.w, height: g.h, rx: g.h / 2, fill: "#000" }));
      }
      const cap = document.querySelector<HTMLElement>(".slider-cap");
      if (cap) {
        const c = box(cap.getBoundingClientRect());
        const ball = make("radialGradient", { id: "mac-ball", cx: 0.4, cy: 0.3, r: 0.7 });
        for (const [offset, color] of [[0, "#5b5f65"], [0.3, "#3c3f44"], [0.65, "#25282c"], [1, "#121417"]] as const) {
          ball.appendChild(make("stop", { offset, "stop-color": color }));
        }
        nodes[0]!.appendChild(ball);
        nodes.push(make("circle", { cx: c.x + c.w / 2, cy: c.y + c.h / 2, r: c.w / 2, fill: "url(#mac-ball)" }));
      }
      document.querySelectorAll<HTMLElement>(".slider-stop").forEach((stop) => walk(stop, getComputedStyle(stop).color));
    }

    mini.replaceChildren(...nodes);
  }

  /** The camera path from the figure at rest to the glass filling the viewport. */
  function planZoom() {
    const { toView } = landing();
    const ctm = svg.getScreenCTM();
    if (!ctm) return null;
    const toClient = DOMMatrix.fromMatrix(ctm);
    // Z maps user space to user space so that the glass lands where toView puts it.
    const Z = toClient.inverse().multiply(toView).multiply(glassPlane.inverse());
    const { u0, u1, v0, v1 } = screen.view;
    const centre = glassPlane.transformPoint(new DOMPoint((u0 + u1) / 2, (v0 + v1) / 2));
    const target = Z.transformPoint(centre);
    const scale = Math.sqrt(Math.abs(Z.a * Z.d - Z.b * Z.c));
    const [na, nb, nc, nd] = [Z.a / scale, Z.b / scale, Z.c / scale, Z.d / scale];
    // Scale grows geometrically (an even fall), the shear straightens linearly.
    return (e: number) => {
      const s = Math.pow(scale, e);
      const a = (1 + (na - 1) * e) * s;
      const b = nb * e * s;
      const c = nc * e * s;
      const d = (1 + (nd - 1) * e) * s;
      const x = centre.x + (target.x - centre.x) * e;
      const y = centre.y + (target.y - centre.y) * e;
      return new DOMMatrix([a, b, c, d, x - a * centre.x - c * centre.y, y - b * centre.x - d * centre.y]);
    };
  }

  function enter(next: Phase) {
    phase = next;
    clock = 0;
    if (next === "boot") {
      resetCamera();
      spill.style.opacity = "0.5";
      buildMini();
      root.dataset.stage = "boot";
    } else if (next === "zoom") {
      path = planZoom();
      root.dataset.stage = "zoom";
      if (!path) enter("fade");
    } else if (next === "fade") {
      document.documentElement.dataset.intro = "done";
      root.dataset.stage = "fade";
    } else if (next === "done") {
      finish();
    }
  }

  function tick(now: number) {
    const dt = previous ? Math.min((now - previous) / 1000, 1 / 30) : 1 / 60;
    previous = now;
    clock += dt;

    if (phase === "power") {
      const t = clock;
      moveCamera(dt, { x: HOME[1], y: HOME[2], s: 0 });
      // The tube's flash as it warms throws the most light; then it settles.
      const warm = Math.min(1, Math.max(0, (t - 0.12) / 0.26));
      spill.style.opacity = (warm * (1 - 0.45 * Math.max(0, (t - POWER) / POWER_HOLD))).toFixed(3);
      if (t < 0.14) setCrt(ease3(t / 0.14), 0.012, 1);
      else setCrt(1, 0.012 + 0.988 * ease3((t - 0.14) / 0.24), 1 - ease3((t - 0.14) / 0.24));
      if (t >= POWER + POWER_HOLD) {
        setCrt(1, 1, 0);
        enter("boot");
      } else if (t >= POWER) setCrt(1, 1, 0);
    } else if (phase === "load") {
      loadClock += dt;
      const target = ready && loadClock >= MIN_LOAD ? 1 : Math.min(0.92, (loadClock / MIN_LOAD) * 0.92);
      shown = still ? target : shown + (target - shown) * (1 - Math.exp(-dt / 0.16));
      if (still) finishBuild();
      else {
        setBuild(shown);
        moveCamera(dt, shotAt(shown));
      }
      if (target === 1 && shown > 0.995) {
        finishBuild();
        held += dt;
        // Wait for the page's picture, but never more than SNAPSHOT_WAIT.
        if (!snapshotSettled) snapshotWait += dt;
        if (held >= HOLD && (still || cameraHome()) && (snapshotSettled || snapshotWait > SNAPSHOT_WAIT)) {
          if (still) {
            setCrt(1, 1, 0);
            enter("boot");
          } else enter("power");
        }
      }
    } else if (phase === "boot") {
      if (clock >= BOOT_HOLD) enter(still ? "fade" : "zoom");
    } else if (phase === "zoom") {
      const e = easeInOut(clock / ZOOM);
      zoom.setAttribute("transform", fmt(path!(e)));
      if (clock >= ZOOM) {
        zoom.setAttribute("transform", fmt(path!(1)));
        enter("fade");
      }
    } else if (phase === "fade") {
      if (clock >= (still ? 0.3 : FADE)) enter("done");
    }

    frame = phase === "done" ? 0 : requestAnimationFrame(tick);
  }

  if (still) finishBuild();
  else {
    // Open on the first shot.
    const first = shotAt(0);
    Object.assign(camera, { x: first.x, y: first.y, s: first.s });
    writeCamera();
  }
  frame = requestAnimationFrame(tick);

  return () => cancelAnimationFrame(frame);
}
