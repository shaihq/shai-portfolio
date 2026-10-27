"use client";

import { useEffect, useRef } from "react";

/*
 * The light in the room: soft warm light from the top centre and a falloff toward
 * the edges, laid over everything (the loader too, so the zoom lands seamlessly).
 *
 * Drawn per pixel into a canvas with dithering rather than as CSS gradients: across a
 * dark background a gradient has only a few shades to step through, and the browser
 * draws those steps as visible rings. Each pixel gets a random offset worth about one
 * shade of the final picture, which breaks the steps into noise too fine to see.
 * The offset is set in the alpha, scaled by how much a step of alpha changes what
 * shows: over a near-black page a dark layer needs a much larger alpha step than the
 * warm light does. Drawn once, and again when the window is resized.
 */

/**
 * Paints the light into the canvas. Self-contained (its constants live inside it) so
 * it can also run as an inline script the moment the page arrives: the light is there
 * on the first frame, not added when the app starts, which made the loader's room
 * change shade a moment after it appeared.
 */
function paint(canvas: HTMLCanvasElement | null) {
  if (!canvas) return;
  const LIGHT = { cx: 0.5, cy: 0, rx: 0.9, ry: 0.7, alpha: 0.03, color: [236, 241, 248] };
  const SHADE = { cx: 0.5, cy: 0.45, rx: 1.4, ry: 1.1, from: 0.5, alpha: 0.42 };
  // The page's brightness (0–255) the layer mostly sits on, for sizing the dither.
  const GROUND = 18;
  const smooth = (t: number) => {
    const x = Math.min(1, Math.max(0, t));
    return x * x * (3 - 2 * x);
  };
  const w = Math.max(1, Math.round(innerWidth));
  const h = Math.max(1, Math.round(innerHeight));
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const image = ctx.createImageData(w, h);
  const data = image.data;
  const [lr, lg, lb] = LIGHT.color;
  for (let y = 0; y < h; y++) {
    const ly = (y / h - LIGHT.cy) / LIGHT.ry;
    const sy = (y / h - SHADE.cy) / SHADE.ry;
    for (let x = 0; x < w; x++) {
      const lx = (x / w - LIGHT.cx) / LIGHT.rx;
      const sx = (x / w - SHADE.cx) / SHADE.rx;
      const l = LIGHT.alpha * (1 - smooth(Math.sqrt(lx * lx + ly * ly)));
      const v = SHADE.alpha * smooth((Math.sqrt(sx * sx + sy * sy) - SHADE.from) / (1 - SHADE.from));
      // The light, then the shade over it, as one layer: alpha a, colour (light only).
      const a = 1 - (1 - l) * (1 - v);
      const lit = a > 0 ? (l * (1 - v)) / a : 0;
      const i = (y * w + x) * 4;
      data[i] = lr * lit;
      data[i + 1] = lg * lit;
      data[i + 2] = lb * lit;
      // One shade of the final picture, in alpha: 255 / |layer colour - ground|.
      const step = a > 0.001 ? Math.min(24, 255 / Math.max(8, Math.abs(lg * lit - GROUND))) : 0;
      data[i + 3] = a * 255 + (Math.random() + Math.random() - 1) * step;
    }
  }
  ctx.putImageData(image, 0, 0);
}

const PAINT_NOW = `(${paint.toString()})(document.getElementById("film-light"))`;

export default function Film() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    // Painted already by the inline script; paint again only if it didn't run.
    if (!canvas.width || canvas.width === 300) paint(canvas);
    let timer = 0;
    const onResize = () => {
      clearTimeout(timer);
      timer = window.setTimeout(() => paint(canvas), 150);
    };
    addEventListener("resize", onResize);
    return () => {
      clearTimeout(timer);
      removeEventListener("resize", onResize);
    };
  }, []);

  return (
    <>
      <canvas ref={ref} id="film-light" className="film-light" aria-hidden="true" suppressHydrationWarning />
      <script dangerouslySetInnerHTML={{ __html: PAINT_NOW }} />
    </>
  );
}
