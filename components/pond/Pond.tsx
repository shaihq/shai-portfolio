"use client";

import { useEffect, useRef } from "react";
import "./pond.css";

/**
 * The pond under the page (pond3d.ts). It starts once the intro has handed over, so
 * the two never share the GPU, and loads three.js only then (already cached by the
 * intro). Without WebGL 2 the page keeps its plain background.
 */
export default function Pond() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const html = document.documentElement;
    let stop: (() => void) | undefined;
    let started = false;
    let cancelled = false;
    const start = () => {
      if (started || html.dataset.intro === "on") return;
      started = true;
      watch.disconnect();
      import("./pond3d")
        .then(({ canRunPond, mountPond }) => {
          if (cancelled || !canRunPond()) return;
          stop = mountPond(canvas);
        })
        .catch(() => {});
    };
    const watch = new MutationObserver(start);
    watch.observe(html, { attributes: true, attributeFilter: ["data-intro"] });
    start();
    return () => {
      cancelled = true;
      watch.disconnect();
      stop?.();
    };
  }, []);

  return <canvas ref={ref} className="pond" aria-hidden="true" />;
}
