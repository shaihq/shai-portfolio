"use client";

import { useEffect, useRef, useState } from "react";

/*
 * A page mascot after koboyo.com/page-mascot: a head that turns to look at the
 * cursor. The sheet (public/mascot/krish-directions.webp) is 3×3, row by row:
 * up-left, up, up-right / left, center, right / down-left, down, down-right, all
 * cut from one turnaround and aligned so the head doesn't drift between frames.
 *
 * The cursor's angle from the head picks one of eight directions, with a little
 * hysteresis at the borders so it doesn't flicker; close to the head it looks
 * straight out. A click boops it. Only on devices with a hovering pointer; touch
 * screens see it looking ahead.
 */

const SHEET = "/mascot/krish-directions.webp";
const FRAMES = ["up-left", "up", "up-right", "left", "center", "right", "down-left", "down", "down-right"] as const;
type Direction = (typeof FRAMES)[number];
const AROUND: Direction[] = ["right", "down-right", "down", "down-left", "left", "up-left", "up", "up-right"];
const SLICE = (Math.PI * 2) / AROUND.length;
const STICKY = 0.12; // radians of hysteresis at each border
const NEAR = 70; // px: inside this, look straight out
const BOOP: Keyframe[] = [
  { transform: "scale(1, 1)", easing: "ease-in" },
  { transform: "scale(1.08, 0.9)", offset: 0.18, easing: "ease-out" },
  { transform: "scale(0.96, 1.06)", offset: 0.45, easing: "ease-in-out" },
  { transform: "scale(1.02, 0.98)", offset: 0.72, easing: "ease-in-out" },
  { transform: "scale(1, 1)" },
];

const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const position = (d: Direction) => {
  const i = FRAMES.indexOf(d);
  return `${(i % 3) * 50}% ${Math.floor(i / 3) * 50}%`;
};

export default function Mascot({ size = 104, label = "Krish" }: { size?: number; label?: string }) {
  const button = useRef<HTMLButtonElement>(null);
  const body = useRef<HTMLSpanElement>(null);
  const [direction, setDirection] = useState<Direction>("center");

  useEffect(() => {
    if (!matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    let current = -1;
    let pointer: { x: number; y: number } | null = null;
    const look = () => {
      const el = button.current;
      if (!el || !pointer) return;
      const r = el.getBoundingClientRect();
      const dx = pointer.x - (r.left + r.width / 2);
      const dy = pointer.y - (r.top + r.height / 2);
      if (Math.hypot(dx, dy) < NEAR) {
        current = -1;
        setDirection("center");
        return;
      }
      const angle = Math.atan2(dy, dx);
      if (current !== -1 && Math.abs(wrap(angle - current * SLICE)) < SLICE / 2 + STICKY) return;
      current = (Math.round(angle / SLICE) + AROUND.length) % AROUND.length;
      setDirection(AROUND[current]!);
    };
    const onMove = (e: PointerEvent) => {
      pointer = { x: e.clientX, y: e.clientY };
      look();
    };
    addEventListener("pointermove", onMove, { passive: true });
    return () => removeEventListener("pointermove", onMove);
  }, []);

  const boop = () => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    body.current?.animate(BOOP, { duration: 420, easing: "linear" });
  };

  return (
    <button ref={button} type="button" className="mascot" onClick={boop} aria-label={`Boop ${label}`} style={{ width: size, height: size }}>
      <span ref={body} className="mascot-body">
        <span className="mascot-frames" style={{ backgroundImage: `url(${SHEET})`, backgroundPosition: position(direction) }} />
      </span>
    </button>
  );
}
