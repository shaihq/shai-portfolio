"use client";

import { useEffect, useRef, useState } from "react";
import { runIntro } from "./live";
import type { ScreenGeometry } from "./macintosh";
import "@/components/iso/iso.css";
import "./intro.css";

export default function Intro({ markup, screen }: { markup: string; screen: ScreenGeometry }) {
  const ref = useRef<HTMLDivElement>(null);
  const [done, setDone] = useState(false);

  // The real-3D intro where WebGL is there and motion is welcome; the drawn one
  // (live.ts) otherwise, and while three.js is still loading nothing has moved yet.
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    let stop: (() => void) | undefined;
    let cancelled = false;
    const finish = () => setDone(true);
    // Crawlers, link previewers and audit tools get the page at once: the same page,
    // without the show (it would otherwise sit hidden for the seconds the intro runs).
    if (/bot|crawl|spider|slurp|lighthouse|inspectiontool|bingpreview|facebookexternalhit|embedly|preview/i.test(navigator.userAgent)) {
      document.documentElement.dataset.intro = "done";
      finish();
      return;
    }
    const drawn = () => (stop = runIntro(root, screen, finish));
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) drawn();
    else
      import("./three/run")
        .then(({ canRun3D, run3D }) => {
          if (cancelled) return;
          if (!canRun3D()) return drawn();
          try {
            stop = run3D(root, finish);
          } catch {
            root.querySelector(".intro-3d")?.remove();
            delete root.dataset.mode;
            drawn();
          }
        })
        .catch(() => !cancelled && drawn());
    return () => {
      cancelled = true;
      stop?.();
    };
  }, [screen]);

  if (done) return null;

  return (
    <div
      ref={ref}
      className="iso intro-overlay"
      data-theme="dark"
      role="status"
      aria-label="Loading"
      dangerouslySetInnerHTML={{ __html: markup }}
    />
  );
}
