import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

/*
 * Four small 3D scenes for the "what I'd do next" cards, drawn by ONE renderer into
 * ONE canvas laid over the grid: each card's stage is its own viewport (scissored),
 * so the page holds a single WebGL context however many cards there are. three.js
 * is already cached from the intro's computer, so this adds no download.
 *
 * Minimal and quiet: matte graphite pieces in the site's greys, a soft key light from
 * the upper left (as everywhere else), one orange accent each. It only renders while
 * the grid is on screen, and under reduced motion it draws a single still frame.
 */

export type Glyph = "fix" | "measure" | "talk" | "improve";

const ACCENT = "#f26b3a";

function graphite(shade = 0) {
  return new THREE.MeshStandardMaterial({ color: new THREE.Color("#4a4f57").offsetHSL(0, 0, shade), roughness: 0.62, metalness: 0.08 });
}
const accent = () => new THREE.MeshStandardMaterial({ color: ACCENT, roughness: 0.45, metalness: 0.05, emissive: ACCENT, emissiveIntensity: 0.18 });
const rbox = (w: number, h: number, d: number, r: number, m: THREE.Material) => new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 4, r), m);

type Scene = { scene: THREE.Scene; tick: (t: number) => void };

function lit(scene: THREE.Scene) {
  scene.add(new THREE.HemisphereLight("#dfe6f0", "#0c0d10", 0.9));
  const key = new THREE.DirectionalLight("#fff3e6", 2.2);
  key.position.set(-3, 5, 4);
  scene.add(key);
  const rim = new THREE.DirectionalLight("#b9c8de", 1.1);
  rim.position.set(4, 2, -4);
  scene.add(rim);
  return scene;
}

/** 01: a stack of blocks; one slips out of line and slides back into place. */
function fix(): Scene {
  const scene = lit(new THREE.Scene());
  const g = new THREE.Group();
  const blocks = [0, 1, 2].map((i) => {
    const b = rbox(1.6, 0.42, 1.6, 0.12, i === 1 ? accent() : graphite(i * 0.03));
    b.position.y = (i - 1) * 0.5;
    g.add(b);
    return b;
  });
  g.rotation.set(0.5, -0.7, 0);
  scene.add(g);
  return {
    scene,
    tick: (t) => {
      // Out of line, then eased back into place, then a rest.
      const p = (t % 4) / 4;
      const out = p < 0.25 ? Math.sin((p / 0.25) * Math.PI * 0.5) : p < 0.6 ? 1 - smooth((p - 0.25) / 0.35) : 0;
      blocks[1]!.position.x = out * 0.75;
      blocks[1]!.rotation.y = out * 0.35;
      g.rotation.y = -0.7 + Math.sin(t * 0.4) * 0.12;
    },
  };
}

/** 02: a small bar chart rising in a wave, the last bar in the accent. */
function measure(): Scene {
  const scene = lit(new THREE.Scene());
  const g = new THREE.Group();
  const base = rbox(2.6, 0.08, 1.1, 0.04, graphite(-0.06));
  base.position.y = -0.82;
  g.add(base);
  const bars = [0, 1, 2, 3].map((i) => {
    const b = rbox(0.42, 1, 0.42, 0.08, i === 3 ? accent() : graphite(0.02 * i));
    b.position.x = (i - 1.5) * 0.58;
    g.add(b);
    return b;
  });
  g.rotation.set(0.42, -0.62, 0);
  scene.add(g);
  const heights = [0.55, 0.85, 1.05, 1.45];
  return {
    scene,
    tick: (t) => {
      bars.forEach((b, i) => {
        const wave = 0.75 + 0.25 * Math.sin(t * 1.4 - i * 0.7);
        const h = heights[i]! * wave;
        b.scale.y = h;
        b.position.y = -0.78 + h / 2;
      });
      g.rotation.y = -0.62 + Math.sin(t * 0.35) * 0.1;
    },
  };
}

/** 03: two speech bubbles taking turns, typing dots in the second. */
function talk(): Scene {
  const scene = lit(new THREE.Scene());
  const g = new THREE.Group();
  const bubble = (w: number, m: THREE.Material, flip: boolean) => {
    const b = new THREE.Group();
    b.add(rbox(w, 0.62, 0.22, 0.2, m));
    const tail = rbox(0.2, 0.2, 0.18, 0.05, m);
    tail.position.set(flip ? w / 2 - 0.25 : -w / 2 + 0.25, -0.3, 0);
    tail.rotation.z = Math.PI / 4;
    b.add(tail);
    return b;
  };
  const a = bubble(1.5, graphite(0.02), false);
  a.position.set(-0.32, 0.38, 0);
  const b = bubble(1.25, graphite(-0.02), true);
  b.position.set(0.38, -0.42, 0.2);
  const dots = [0, 1, 2].map((i) => {
    const d = new THREE.Mesh(new THREE.SphereGeometry(0.07, 20, 16), accent());
    d.position.set((i - 1) * 0.22, 0, 0.13);
    b.add(d);
    return d;
  });
  g.add(a, b);
  g.rotation.set(0.25, -0.45, 0);
  scene.add(g);
  return {
    scene,
    tick: (t) => {
      a.position.y = 0.38 + Math.sin(t * 1.1) * 0.05;
      b.position.y = -0.42 + Math.sin(t * 1.1 + Math.PI) * 0.05;
      dots.forEach((d, i) => {
        const s = 1 + 0.35 * Math.max(0, Math.sin(t * 4 - i * 0.9));
        d.scale.setScalar(s);
      });
      g.rotation.y = -0.45 + Math.sin(t * 0.3) * 0.1;
    },
  };
}

/** 04: a ring of beads cycling round a loop, one leading in the accent. */
function improve(): Scene {
  const scene = lit(new THREE.Scene());
  const g = new THREE.Group();
  const track = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.035, 12, 96), graphite(-0.08));
  g.add(track);
  const N = 9;
  const beads = Array.from({ length: N }, (_, i) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(i === 0 ? 0.15 : 0.1, 24, 18), i === 0 ? accent() : graphite(0.03));
    g.add(m);
    return m;
  });
  g.rotation.set(1.05, 0, 0.25);
  scene.add(g);
  return {
    scene,
    tick: (t) => {
      beads.forEach((m, i) => {
        const a = -t * 0.8 + (i / N) * Math.PI * 2;
        m.position.set(Math.cos(a) * 0.95, Math.sin(a) * 0.95, 0);
        // The trail thins out behind the leader.
        if (i) m.scale.setScalar(1 - (i / N) * 0.55);
      });
      g.rotation.z = 0.25 + Math.sin(t * 0.3) * 0.08;
    },
  };
}

const smooth = (x: number) => {
  const c = Math.min(1, Math.max(0, x));
  return c * c * (3 - 2 * c);
};

const MAKERS: Record<Glyph, () => Scene> = { fix, measure, talk, improve };

export function canRun3D() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

/**
 * Draws one scene into each `[data-stage]` element inside `host`, on a single canvas
 * laid over `host`. `scroller` is the element that scrolls it (for the visibility
 * check). Returns a cleanup.
 */
export function mountSteps(host: HTMLElement, scroller: Element | null) {
  const stages = Array.from(host.querySelectorAll<HTMLElement>("[data-stage]"));
  const scenes = stages.map((s) => MAKERS[s.dataset.stage as Glyph]());
  const canvas = document.createElement("canvas");
  canvas.className = "pv-steps-canvas";
  host.appendChild(canvas);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "low-power" });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.setScissorTest(true);
  renderer.setClearColor(0x000000, 0);
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
  camera.position.set(0, 0, 6.2);

  let rects: { x: number; y: number; w: number; h: number }[] = [];
  let H = 0;
  const layout = () => {
    const box = host.getBoundingClientRect();
    renderer.setSize(box.width, box.height, false);
    canvas.style.width = `${box.width}px`;
    canvas.style.height = `${box.height}px`;
    H = box.height;
    rects = stages.map((s) => {
      const r = s.getBoundingClientRect();
      return { x: r.left - box.left, y: r.top - box.top, w: r.width, h: r.height };
    });
  };

  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const draw = (t: number) => {
    renderer.setScissor(0, 0, 9999, 9999);
    renderer.clear();
    scenes.forEach((s, i) => {
      const r = rects[i];
      if (!r) return;
      s.tick(t);
      const y = H - r.y - r.h;
      renderer.setViewport(r.x, y, r.w, r.h);
      renderer.setScissor(r.x, y, r.w, r.h);
      camera.aspect = r.w / r.h;
      camera.updateProjectionMatrix();
      renderer.render(s.scene, camera);
    });
  };

  let frame = 0;
  let visible = false;
  const t0 = performance.now();
  const loop = () => {
    draw((performance.now() - t0) / 1000);
    frame = visible && !still ? requestAnimationFrame(loop) : 0;
  };
  const io = new IntersectionObserver(
    ([e]) => {
      visible = !!e?.isIntersecting;
      if (visible && !frame) frame = requestAnimationFrame(loop);
    },
    { root: scroller, rootMargin: "100px" },
  );
  io.observe(host);
  const ro = new ResizeObserver(() => {
    layout();
    draw(still ? 1.2 : (performance.now() - t0) / 1000);
  });
  ro.observe(host);
  layout();
  draw(1.2);

  return () => {
    cancelAnimationFrame(frame);
    io.disconnect();
    ro.disconnect();
    renderer.dispose();
    canvas.remove();
  };
}
