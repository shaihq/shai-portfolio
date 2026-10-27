"use client";

import { useEffect, useRef } from "react";
import { mount } from "ascii.rest";
import * as piece from "./piece";

/*
 * The experience tree under the bio, played by ascii.rest's own mount (it pauses
 * offscreen and in a background tab, and holds still for reduced motion).
 *
 * It starts on its resting frame, already in the server's HTML, and only begins to
 * move once the intro has landed and the signature is written, so the picture the
 * loader takes of the page and the page it lands on are the same.
 */
export default function Experience() {
  const ref = useRef<HTMLPreElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const html = document.documentElement;
    let stop: (() => void) | undefined;
    let timer = 0;
    const start = () => {
      const after = parseFloat(getComputedStyle(html).getPropertyValue("--sig-end")) || 0;
      timer = window.setTimeout(() => (stop = mount(el, piece)), after * 1000);
    };
    let watch: MutationObserver | undefined;
    if (html.dataset.intro === "on") {
      watch = new MutationObserver(() => {
        if (html.dataset.intro !== "on") {
          watch?.disconnect();
          start();
        }
      });
      watch.observe(html, { attributes: true, attributeFilter: ["data-intro"] });
    } else {
      start();
    }
    return () => {
      watch?.disconnect();
      clearTimeout(timer);
      stop?.();
    };
  }, []);

  return (
    <pre
      ref={ref}
      className="tree"
      role="img"
      aria-label={`Experience: ${piece.ROLES.map((r) => `${r.title} at ${r.company}, ${r.from} to ${r.to}`).join("; ")}`}
      style={{ "--cols": piece.meta.cols } as React.CSSProperties}
    >
      {piece.restFrame()}
    </pre>
  );
}
