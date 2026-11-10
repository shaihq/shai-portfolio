"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { getImageProps } from "next/image";
import { RESUME } from "@/lib/site";
import { playGrab, unlockSound } from "./sound";
import "./resume.css";

/*
 * The resume, as a window. On a wide screen it zooms out of the thing that opened it
 * (the resume row, or the contact key) into the middle of the screen, while the page
 * behind recedes as it does for a project; close, Esc or a click outside sends it back
 * into the same place. On a phone it's a sheet that rises to 90% of the screen and is
 * pulled down (or tapped outside) to close.
 *
 * It zooms, 100% to 300%: the − / % / + in its bar, a trackpad pinch or Ctrl/⌘ with the
 * wheel or + − 0 on a desktop, two fingers or a double tap on a phone. The point under
 * the pointer (or between the fingers) stays where it is as the page grows round it.
 *
 * The page is shown as a picture of the PDF (browsers show a PDF in a page each their
 * own way, iOS only its first page), with its one link kept live over it; the PDF
 * itself is a click away (download, or open).
 */

type Phase = "opening" | "open" | "closing";
type Box = { left: number; top: number; width: number; height: number };

const ZOOM_IN = { duration: 460, easing: "cubic-bezier(0.2, 0.9, 0.25, 1)" };
const ZOOM_OUT = { duration: 340, easing: "cubic-bezier(0.5, 0, 0.75, 0)" };
const RISE = { duration: 520, easing: "cubic-bezier(0.22, 1, 0.36, 1)" };
const SINK = { duration: 320, easing: "cubic-bezier(0.4, 0, 1, 1)" };
const DISMISS = 110; // px a sheet must be pulled down to close
const ZOOM = { min: 1, max: 3, step: 0.25 };
const FIT = 760; // the page's widest at 100%

/**
 * Where something on the page will be once the page is back at full size: it is
 * receded (scaled about its transform-origin, resume.css) while the window is open.
 */
function unreceded(r: DOMRect): Box {
  const page = document.querySelector<HTMLElement>(".page");
  const style = page ? getComputedStyle(page) : null;
  const m = style && style.transform !== "none" ? new DOMMatrix(style.transform) : null;
  const s = m?.a || 1;
  const [ox, oy] = (style?.transformOrigin ?? "0 0").split(" ").map(parseFloat);
  return {
    left: ox! + (r.left - ox! - (m?.e ?? 0)) / s,
    top: oy! + (r.top - oy! - (m?.f ?? 0)) / s,
    width: r.width / s,
    height: r.height / s,
  };
}

/** The window squeezed into a box, as a transform from its own corner. */
const into = (b: Box, w: Box) => `translate(${b.left - w.left}px, ${b.top - w.top}px) scale(${b.width / w.width}, ${b.height / w.height})`;

export default function Resume({ from, home, onClosed }: { from: DOMRect; home: () => Element | null; onClosed: () => void }) {
  const [phase, setPhase] = useState<Phase>("opening");
  const [sheet] = useState(() => matchMedia("(max-width: 640px)").matches);
  const [place, setPlace] = useState<Box | null>(null);
  const win = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const returnTo = useRef<Element | null>(typeof document !== "undefined" ? document.activeElement : null);
  const drag = useRef<{ id: number; x: number; y: number; left: number; top: number; t: number; dy: number } | null>(null);
  const still = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  const body = useRef<HTMLDivElement>(null);
  const page = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const zoomNow = useRef(1);
  const [fit, setFit] = useState(0);
  /** The point to keep still while zooming: where it is on the page (fractions), and on screen. */
  const anchor = useRef<{ fx: number; fy: number; x: number; y: number } | null>(null);

  // The window's place: centred, as big as the screen comfortably allows.
  useLayoutEffect(() => {
    if (sheet) return;
    const width = Math.min(820, innerWidth - 64);
    const height = Math.min(innerHeight - 64, 1060);
    setPlace({ left: Math.round((innerWidth - width) / 2), top: Math.round((innerHeight - height) / 2), width, height });
  }, [sheet]);

  /* ------------------------------------------------------------ opening */

  useLayoutEffect(() => {
    const w = win.current;
    if (phase !== "opening" || !w || (!sheet && !place)) return;
    const html = document.documentElement;
    html.dataset.resumeMotion = "";
    html.dataset.resume = "open";
    unlockSound();
    playGrab(true);
    const done = () => {
      delete html.dataset.resumeMotion;
      setPhase("open");
      closeButton.current?.focus({ preventScroll: true });
    };
    if (still()) return void done();
    const a = sheet
      ? w.animate([{ transform: "translateY(100%)" }, { transform: "translateY(0)" }], RISE)
      : w.animate(
          // Solid almost at once: a window you can see through mid-flight looks like a ghost.
          [{ transform: into(from, boxOf(w)), opacity: 0 }, { opacity: 1, offset: 0.25 }, { transform: "none", opacity: 1 }],
          ZOOM_IN,
        );
    a.onfinish = done;
    return () => a.cancel();
    // `from` is where it opened from; fixed for the window's life.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, place, sheet]);

  /* ------------------------------------------------------------ closing */

  const close = useCallback(() => {
    if (phase !== "open") return;
    setPhase("closing");
  }, [phase]);

  useLayoutEffect(() => {
    const w = win.current;
    if (phase !== "closing" || !w) return;
    const html = document.documentElement;
    const target = home();
    // Aim for the row (or key) at the page's full size, before the page starts back.
    const to = target ? unreceded(target.getBoundingClientRect()) : null;
    html.dataset.resumeMotion = "";
    delete html.dataset.resume;
    playGrab(false);
    const done = () => {
      delete html.dataset.resumeMotion;
      onClosed();
      (target instanceof HTMLElement ? target : (returnTo.current as HTMLElement | null))?.focus?.({ preventScroll: true });
    };
    if (still()) return void done();
    const now = getComputedStyle(w).transform;
    const a = sheet
      ? w.animate([{ transform: now === "none" ? "translateY(0)" : now }, { transform: "translateY(100%)" }], { ...SINK, fill: "forwards" })
      : to
        ? w.animate(
            // Solid until it's nearly home, then gone into the row.
            [{ transform: "none", opacity: 1 }, { opacity: 1, offset: 0.7 }, { transform: into(to, boxOf(w)), opacity: 0 }],
            { ...ZOOM_OUT, fill: "forwards" },
          )
        : w.animate([{ opacity: 1 }, { opacity: 0, transform: "scale(0.96)" }], { ...ZOOM_OUT, fill: "forwards" });
    a.onfinish = done;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);


  useEffect(
    () => () => {
      delete document.documentElement.dataset.resume;
      delete document.documentElement.dataset.resumeMotion;
    },
    [],
  );

  /* ------------------------------------------------------------ zoom */

  // The page's width at 100%: the body's width inside its padding, at most FIT.
  useLayoutEffect(() => {
    const b = body.current;
    if (!b) return;
    const measure = () => {
      const cs = getComputedStyle(b);
      setFit(Math.min(FIT, b.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(b);
    return () => ro.disconnect();
  }, [place]);

  /** Where a screen point is on the page, as fractions of it. */
  const onPage = (x: number, y: number) => {
    const pr = page.current!.getBoundingClientRect();
    return { fx: (x - pr.left) / pr.width, fy: (y - pr.top) / pr.height };
  };

  // `hold`: a page point to bring under `at` (a pinch keeps the one it started on, so
  // it finds its place again once the page is big enough to scroll there).
  const zoomTo = useCallback((next: number, at?: { x: number; y: number }, hold?: { fx: number; fy: number }) => {
    const b = body.current;
    const pg = page.current;
    if (!b || !pg) return;
    const z = Math.round(Math.min(ZOOM.max, Math.max(ZOOM.min, next)) * 100) / 100;
    const box = b.getBoundingClientRect();
    const x = at?.x ?? box.left + b.clientWidth / 2;
    const y = at?.y ?? box.top + b.clientHeight / 2;
    const pr = pg.getBoundingClientRect();
    anchor.current = { ...(hold ?? { fx: (x - pr.left) / pr.width, fy: (y - pr.top) / pr.height }), x, y };
    if (z === zoomNow.current) {
      // Same size (a pinch at its limit, or panning with two fingers): just steer.
      const a = anchor.current;
      anchor.current = null;
      b.scrollLeft += pr.left + a.fx * pr.width - a.x;
      b.scrollTop += pr.top + a.fy * pr.height - a.y;
      return;
    }
    zoomNow.current = z;
    setZoom(z);
  }, []);

  // After the page has grown or shrunk: scroll so the anchored point is back under the pointer.
  useLayoutEffect(() => {
    const a = anchor.current;
    const b = body.current;
    const pg = page.current;
    if (!a || !b || !pg) return;
    anchor.current = null;
    const pr = pg.getBoundingClientRect();
    b.scrollLeft += pr.left + a.fx * pr.width - a.x;
    b.scrollTop += pr.top + a.fy * pr.height - a.y;
  }, [zoom]);

  // A trackpad pinch (the browser sends it as a wheel with Ctrl) or Ctrl/⌘ with the wheel;
  // two fingers, or a double tap, on a touch screen. Not the page's own zoom while open.
  useEffect(() => {
    const b = body.current;
    if (!b) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      zoomTo(zoomNow.current * Math.exp(-e.deltaY * 0.01), { x: e.clientX, y: e.clientY });
    };
    let pinch: { d: number; z: number; hold: { fx: number; fy: number } } | null = null;
    let tap = { t: 0, x: 0, y: 0 };
    let moved = false;
    const spread = (t: TouchList) => Math.hypot(t[0]!.clientX - t[1]!.clientX, t[0]!.clientY - t[1]!.clientY);
    const middle = (t: TouchList) => ({ x: (t[0]!.clientX + t[1]!.clientX) / 2, y: (t[0]!.clientY + t[1]!.clientY) / 2 });
    const onStart = (e: TouchEvent) => {
      moved = false;
      if (e.touches.length === 2) {
        e.preventDefault();
        const m = middle(e.touches);
        pinch = { d: spread(e.touches), z: zoomNow.current, hold: onPage(m.x, m.y) };
      }
    };
    const onMove = (e: TouchEvent) => {
      moved = true;
      if (!pinch || e.touches.length !== 2) return;
      e.preventDefault();
      zoomTo(pinch.z * (spread(e.touches) / pinch.d), middle(e.touches), pinch.hold);
    };
    const onEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) pinch = null;
      // A double tap: in to 200% there, or back to the whole page.
      if (e.touches.length || e.changedTouches.length !== 1 || moved) return;
      const t = e.changedTouches[0]!;
      const now = performance.now();
      if (now - tap.t < 300 && Math.hypot(t.clientX - tap.x, t.clientY - tap.y) < 30) {
        e.preventDefault();
        zoomTo(zoomNow.current > 1.05 ? 1 : 2, { x: t.clientX, y: t.clientY });
        tap = { t: 0, x: 0, y: 0 };
      } else tap = { t: now, x: t.clientX, y: t.clientY };
    };
    const noGesture = (e: Event) => e.preventDefault(); // Safari's own pinch
    b.addEventListener("wheel", onWheel, { passive: false });
    b.addEventListener("touchstart", onStart, { passive: false });
    b.addEventListener("touchmove", onMove, { passive: false });
    b.addEventListener("touchend", onEnd, { passive: false });
    b.addEventListener("gesturestart", noGesture);
    return () => {
      b.removeEventListener("wheel", onWheel);
      b.removeEventListener("touchstart", onStart);
      b.removeEventListener("touchmove", onMove);
      b.removeEventListener("touchend", onEnd);
      b.removeEventListener("gesturestart", noGesture);
    };
  }, [zoomTo]);

  // Esc closes it; while it's open, focus stays in it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopImmediatePropagation();
        close();
      } else if ((e.ctrlKey || e.metaKey) && ["=", "+", "-", "0"].includes(e.key)) {
        e.preventDefault();
        zoomTo(e.key === "0" ? 1 : zoomNow.current + (e.key === "-" ? -ZOOM.step : ZOOM.step));
      } else if (e.key === "Tab" && win.current) {
        const stops = Array.from(win.current.querySelectorAll<HTMLElement>("a[href], button"));
        const i = stops.indexOf(document.activeElement as HTMLElement);
        e.preventDefault();
        stops[e.shiftKey ? (i <= 0 ? stops.length - 1 : i - 1) : (i + 1) % stops.length]?.focus();
      }
    };
    addEventListener("keydown", onKey, true);
    return () => removeEventListener("keydown", onKey, true);
  }, [close, zoomTo]);

  /* ------------------------------------------------------------ dragging */

  // The sheet, pulled down by its top, to close.
  const onGrab = (e: React.PointerEvent) => {
    if (!sheet || phase !== "open" || e.button !== 0 || (e.target as Element).closest("a, button")) return;
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      // Not a live pointer (some synthetic events): the drag still works within the bar.
    }
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, left: place?.left ?? 0, top: place?.top ?? 0, t: performance.now(), dy: 0 };
  };
  const onDrag = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId || !win.current) return;
    d.dy = Math.max(0, e.clientY - d.y);
    // Pulled down, it follows the finger; pushed up, it doesn't move.
    win.current.style.transform = `translateY(${d.dy}px)`;
  };
  const onLetGo = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    if (!sheet || !win.current) return;
    const speed = d.dy / Math.max(1, performance.now() - d.t);
    if (d.dy > DISMISS || speed > 0.8) return close();
    const w = win.current;
    w.animate([{ transform: w.style.transform }, { transform: "translateY(0)" }], RISE);
    w.style.transform = "";
  };

  /* ------------------------------------------------------------ drawing */

  const img = getImageProps({
    src: RESUME.image,
    alt: "Shai Krishna's resume",
    width: RESUME.width,
    height: RESUME.height,
    sizes: `${Math.round((fit || FIT) * Math.ceil(zoom * 2) / 2)}px`,
    quality: 85,
  }).props;
  const { link } = RESUME;
  const title = "shai-resume.pdf";

  const zoomBar = (
    <span className="rs-zoom">
      <button type="button" className="rs-zoom-step" onClick={() => zoomTo(zoom - ZOOM.step)} disabled={zoom <= ZOOM.min} aria-label="Zoom out">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
          <path d="M6 12h12" />
        </svg>
      </button>
      <button type="button" className="rs-zoom-level" onClick={() => zoomTo(1)} aria-label={`Zoom ${Math.round(zoom * 100)}%, reset`}>
        {Math.round(zoom * 100)}%
      </button>
      <button type="button" className="rs-zoom-step" onClick={() => zoomTo(zoom + ZOOM.step)} disabled={zoom >= ZOOM.max} aria-label="Zoom in">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
          <path d="M6 12h12M12 6v12" />
        </svg>
      </button>
    </span>
  );

  const actions = (
    <span className="rs-actions">
      {zoomBar}
      <a className="rs-action" href={RESUME.pdf} download="Shai-Krishna-Resume.pdf" aria-label="Download PDF">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19.5h14" />
        </svg>
        <span className="rs-action-label">download</span>
      </a>
      <a className="rs-action" href={RESUME.pdf} target="_blank" rel="noopener noreferrer" aria-label="Open PDF">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M7 17 17 7" />
          <path d="M8.5 7H17v8.5" />
        </svg>
        <span className="rs-action-label">open pdf</span>
      </a>
    </span>
  );

  return createPortal(
    <div className="rs" data-mode={sheet ? "sheet" : "window"} data-phase={phase}>
      <div className="rs-backdrop" onClick={close} />
      <div
        ref={win}
        className="rs-window"
        role="dialog"
        aria-modal="true"
        aria-label="Resume"
        style={!sheet && place ? { left: place.left, top: place.top, width: place.width, height: place.height } : undefined}
      >
        {sheet ? (
          <header className="rs-sheet-head" onPointerDown={onGrab} onPointerMove={onDrag} onPointerUp={onLetGo} onPointerCancel={onLetGo}>
            <span className="rs-grab" aria-hidden="true" />
            <span className="rs-sheet-row">
              <span className="rs-title">{title}</span>
              {actions}
              <button ref={closeButton} type="button" className="rs-sheet-close" onClick={close} aria-label="Close resume">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <path d="M7 7l10 10M17 7 7 17" />
                </svg>
              </button>
            </span>
          </header>
        ) : (
          <header className="rs-bar">
            <button ref={closeButton} type="button" className="rs-action rs-close" onClick={close} aria-label="Close resume">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M7 7l10 10M17 7 7 17" />
              </svg>
              close
              <span className="rs-esc" aria-hidden="true">
                esc
              </span>
            </button>
            <span className="rs-title">{title}</span>
            {actions}
          </header>
        )}

        <div ref={body} className="rs-body" data-zoomed={zoom > 1 ? "" : undefined}>
          <div ref={page} className="rs-page" style={fit ? { width: Math.round(fit * zoom), maxWidth: "none" } : undefined}>
            {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
            <img {...img} draggable={false} />
            <a
              className="rs-page-link"
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="View my portfolio"
              style={{ left: `${link.left * 100}%`, top: `${link.top * 100}%`, width: `${link.width * 100}%`, height: `${link.height * 100}%` }}
            />
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function boxOf(el: Element): Box {
  const r = el.getBoundingClientRect();
  return { left: r.left, top: r.top, width: r.width, height: r.height };
}
