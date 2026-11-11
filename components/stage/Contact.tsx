"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { EMAIL, LINKEDIN, MENTORSHIP } from "@/lib/site";
import { playLatch, playSelect, playTick, unlockSound } from "./sound";
import { track } from "@/lib/track";
import Resume from "./Resume";

/*
 * Contact: one chrome key in the top-left corner. Pressed, the key grows into a panel
 * of the same band and glass: its label stays where it was, as the panel's title, and
 * the ways to reach me arrive under it one after another. Closing folds the panel back
 * into the key. (The same grammar as everywhere else on the page: the thing you touch
 * becomes the thing it opens, and goes back into it.)
 *
 * Each way has a letter that works without opening anything (L, R, C, M); the key,
 * or the row if the panel is open, goes down while the letter is held. The resume opens
 * as a window grown out of its row, or out of the key when it's pressed from the
 * keyboard (Resume.tsx).
 *
 * With a mouse, one highlight glides from row to row under the pointer (or the keyboard's
 * focus) rather than each row lighting on its own; touch screens have none.
 */

type Phase = "closed" | "opening" | "open" | "closing";
type Way = "linkedin" | "resume" | "email" | "mentorship";

const LETTER: Record<string, Way> = { l: "linkedin", r: "resume", c: "email", m: "mentorship" };
const GROW = { duration: 520, easing: "cubic-bezier(0.22, 1, 0.36, 1)" };
const FOLD = { duration: 380, easing: "cubic-bezier(0.6, 0, 0.3, 1)" };
const ROWS_IN = 110; // ms into the growing before the first row arrives
const STAGGER = 40;
const COPIED_FOR = 1800;

const icon = (paths: React.ReactNode) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {paths}
  </svg>
);
const ICONS: Record<Way | "check", React.ReactNode> = {
  linkedin: icon(
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="4" />
      <path d="M8 10.5V16M8 7.75v.01M11.5 16v-5.5M11.5 13c0-1.5 1-2.5 2.5-2.5s2.5 1 2.5 2.5v3" />
    </>,
  ),
  resume: icon(
    <>
      <path d="M14 3.5H7.5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2V8Z" />
      <path d="M14 3.5V8h4.5M9 12.5h6M9 16h4" />
    </>,
  ),
  email: icon(
    <>
      <rect x="8.5" y="8.5" width="11.5" height="11.5" rx="2.5" />
      <path d="M15.5 8.5V6.5a2.5 2.5 0 0 0-2.5-2.5H6.5A2.5 2.5 0 0 0 4 6.5V13a2.5 2.5 0 0 0 2.5 2.5h2" />
    </>,
  ),
  mentorship: icon(
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 19a5.5 5.5 0 0 1 11 0M15.5 5.5a3 3 0 0 1 0 5M17.5 14a5 5 0 0 1 3 5" />
    </>,
  ),
  check: icon(<path d="m5 12.5 4.5 4.5L19 7.5" />),
};

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Older browsers, or a page without clipboard permission.
    const field = document.createElement("textarea");
    field.value = text;
    field.setAttribute("readonly", "");
    field.style.cssText = "position:fixed;opacity:0;pointer-events:none";
    document.body.appendChild(field);
    field.select();
    const ok = document.execCommand("copy");
    field.remove();
    return ok;
  }
}

export default function Contact() {
  const [phase, setPhase] = useState<Phase>("closed");
  const [copied, setCopied] = useState<"email" | null>(null);
  const [down, setDown] = useState<Way | "key" | null>(null);
  const [resumeFrom, setResumeFrom] = useState<DOMRect | null>(null);
  const nav = useRef<HTMLElement>(null);
  const cap = useRef<HTMLDivElement>(null);
  const head = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const glide = useRef<HTMLSpanElement>(null);
  const glidingOn = useRef<HTMLElement | null>(null);
  const closedSize = useRef({ width: 0, height: 0 });
  const motion = useRef<Animation[]>([]);
  const byKey = useRef(false);
  const timer = useRef(0);
  const held = useRef<string | null>(null);
  const still = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

  const panelOpen = phase !== "closed";

  /* ------------------------------------------------------------ the panel */

  const openPanel = useCallback(
    (keyboard = false) => {
      if (phase !== "closed" || !cap.current) return;
      const r = cap.current.getBoundingClientRect();
      closedSize.current = { width: r.width, height: r.height };
      byKey.current = keyboard;
      unlockSound();
      playLatch(true);
      setPhase("opening");
    },
    [phase],
  );

  const closePanel = useCallback(
    (keyboard = false) => {
      if (phase !== "open") return;
      byKey.current = keyboard;
      playLatch(false);
      glideTo(null);
      setPhase("closing");
    },
    [phase],
  );

  // Growing: the key's box to the panel's, the rows arriving one after another.
  useLayoutEffect(() => {
    const c = cap.current;
    if (phase !== "opening" || !c) return;
    const done = () => setPhase("open");
    if (still()) return void done();
    const to = c.getBoundingClientRect();
    const from = closedSize.current;
    const grow = c.animate(
      [
        { width: `${from.width}px`, height: `${from.height}px` },
        { width: `${to.width}px`, height: `${to.height}px` },
      ],
      GROW,
    );
    const rows = Array.from(list.current?.children ?? []) as HTMLElement[];
    rows.forEach((row, i) =>
      row.animate(
        [
          { opacity: 0, transform: "translateY(-6px)", filter: "blur(4px)" },
          { opacity: 1, transform: "none", filter: "blur(0px)" },
        ],
        { duration: 380, delay: ROWS_IN + i * STAGGER, easing: GROW.easing, fill: "backwards" },
      ),
    );
    motion.current = [grow];
    grow.onfinish = done;
  }, [phase]);

  // Folding: the rows go first, quickly; the panel folds back to the key's size.
  useLayoutEffect(() => {
    const c = cap.current;
    if (phase !== "closing" || !c) return;
    const done = () => setPhase("closed");
    if (still()) return void done();
    const from = c.getBoundingClientRect();
    const to = closedSize.current;
    const rows = Array.from(list.current?.children ?? []) as HTMLElement[];
    rows.forEach((row) => row.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 120, easing: "ease-in", fill: "forwards" }));
    const fold = c.animate(
      [
        { width: `${from.width}px`, height: `${from.height}px` },
        { width: `${to.width}px`, height: `${to.height}px` },
      ],
      { ...FOLD, delay: 60, fill: "forwards" },
    );
    motion.current = [fold];
    fold.onfinish = done;
  }, [phase]);

  // Shut: let go of the folded size (the key sizes itself again), and focus goes back
  // to the key; open: to the first row, if the keyboard opened it.
  useLayoutEffect(() => {
    if (phase === "closed") {
      motion.current.forEach((a) => a.cancel());
      motion.current = [];
    }
  }, [phase]);
  useEffect(() => {
    if (phase === "open" && byKey.current) list.current?.querySelector<HTMLElement>("a, button")?.focus();
    if (phase === "closed" && byKey.current) head.current?.focus();
  }, [phase]);

  // A click anywhere else folds it.
  useEffect(() => {
    if (phase !== "open") return;
    const onDown = (e: PointerEvent) => {
      if (resumeFrom || nav.current?.contains(e.target as Node)) return;
      closePanel();
    };
    addEventListener("pointerdown", onDown);
    return () => removeEventListener("pointerdown", onDown);
  }, [phase, closePanel, resumeFrom]);

  /* ------------------------------------------------------------ the highlight */

  // One highlight for all the rows: it moves to the row under the pointer (or focus)
  // and stretches to its height; the first time it shows it appears in place, not
  // sliding in from wherever it last was. A faint tick as it reaches a new row.
  function glideTo(row: HTMLElement | null, quiet = false) {
    const g = glide.current;
    if (!g) return;
    if (!row) {
      g.removeAttribute("data-on");
      glidingOn.current = null;
      return;
    }
    // Measured from the box the highlight sits in, not from the list (which is inset in it).
    const place = () => {
      const holder = g.parentElement!;
      // Its top is the box's inside edge, below the box's top border (the divider).
      const top = holder.getBoundingClientRect().top + holder.clientTop + g.offsetTop;
      const r = row.getBoundingClientRect();
      g.style.transform = `translateY(${r.top - top}px)`;
      g.style.height = `${r.height}px`;
    };
    if (!g.hasAttribute("data-on")) {
      g.style.transition = "none";
      place();
      void g.offsetHeight;
      g.style.transition = "";
    } else {
      place();
      if (glidingOn.current !== row && !quiet) playTick();
    }
    g.setAttribute("data-on", "");
    glidingOn.current = row;
  }

  /* ------------------------------------------------------------ the ways */

  const rowOf = (way: Way) => list.current?.querySelector<HTMLElement>(`[data-way="${way}"]`) ?? null;

  const act = useCallback(
    async (way: Way) => {
      unlockSound();
      track("contact", { method: way });
      if (way === "linkedin") return void window.open(LINKEDIN, "_blank", "noopener,noreferrer");
      if (way === "mentorship") return void window.open(MENTORSHIP, "_blank", "noopener,noreferrer");
      if (way === "resume") {
        // Out of its row if the panel is open, else out of the key.
        const from = (phase === "open" && rowOf("resume")) || cap.current;
        if (from) setResumeFrom(from.getBoundingClientRect());
        return;
      }
      if (!(await copyText(EMAIL))) return void (location.href = `mailto:${EMAIL}`);
      setCopied(way);
      clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(null), COPIED_FOR);
    },
    [phase],
  );

  // The letters, anywhere on the page, without opening anything; Esc folds the panel.
  useEffect(() => {
    const html = document.documentElement;
    const usable = (e: KeyboardEvent) =>
      !e.metaKey &&
      !e.ctrlKey &&
      !e.altKey &&
      html.dataset.intro !== "on" &&
      html.dataset.project !== "open" &&
      html.dataset.resume !== "open" &&
      // Not before the key has appeared (after the signature).
      !!nav.current &&
      getComputedStyle(nav.current).visibility !== "hidden" &&
      !(e.target instanceof HTMLElement && (e.target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)));
    const onDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && phase === "open" && html.dataset.resume !== "open") {
        e.preventDefault();
        closePanel(true);
        return;
      }
      const key = e.key.toLowerCase();
      const way = LETTER[key];
      if (!way || !usable(e)) return;
      e.preventDefault();
      if (e.repeat) return;
      unlockSound();
      playSelect(true);
      held.current = key;
      setDown(phase === "open" ? way : "key");
      if (phase === "open") glideTo(rowOf(way), true);
      act(way);
    };
    const onUp = (e: KeyboardEvent) => {
      if (held.current !== e.key.toLowerCase()) return;
      held.current = null;
      setDown(null);
    };
    addEventListener("keydown", onDown);
    addEventListener("keyup", onUp);
    return () => {
      removeEventListener("keydown", onDown);
      removeEventListener("keyup", onUp);
    };
  }, [phase, act, closePanel]);

  // Up and down move between the rows while the panel is open.
  const onListKey = (e: React.KeyboardEvent) => {
    const step = { ArrowDown: 1, ArrowUp: -1 }[e.key];
    if (!step || !list.current) return;
    e.preventDefault();
    const rows = Array.from(list.current.querySelectorAll<HTMLElement>("a, button"));
    const at = rows.indexOf(document.activeElement as HTMLElement);
    rows[(at + step + rows.length) % rows.length]?.focus();
  };

  useEffect(() => () => clearTimeout(timer.current), []);

  /* ------------------------------------------------------------ drawing */

  const press = (way: Way | "key") => ({
    onPointerDown: () => {
      unlockSound();
      if (way !== "key") playSelect(true);
      setDown(way);
    },
    onPointerUp: () => setDown(null),
    onPointerLeave: () => setDown((d) => (d === way ? null : d)),
  });

  const row = (way: Way, label: string, extra: { href?: string; external?: boolean; hint?: string } = {}) => {
    const done = copied === way;
    const content = (
      <>
        <span className="contact-row-icon">{done ? ICONS.check : ICONS[way]}</span>
        <span className="contact-row-label">{done ? "copied" : label}</span>
        <kbd className="contact-kbd">{extra.hint}</kbd>
      </>
    );
    const common = {
      className: "contact-row",
      "data-way": way,
      "data-down": down === way ? "" : undefined,
      "data-done": done ? "" : undefined,
      "aria-keyshortcuts": extra.hint,
      ...press(way),
      onPointerEnter: (e: React.PointerEvent<HTMLElement>) => e.pointerType === "mouse" && glideTo(e.currentTarget),
      onFocus: (e: React.FocusEvent<HTMLElement>) => glideTo(e.currentTarget),
    };
    return (
      <li key={way}>
        {extra.href ? (
          <a {...common} href={extra.href} target={extra.external ? "_blank" : undefined} rel={extra.external ? "noopener noreferrer" : undefined} onClick={() => track("contact", { method: way })}>
            {content}
          </a>
        ) : (
          <button {...common} type="button" onClick={() => act(way)}>
            {content}
          </button>
        )}
      </li>
    );
  };

  const keyCopied = !panelOpen && copied;

  return (
    <nav ref={nav} className="contact" aria-label="Contact">
      <div ref={cap} className="contact-cap" data-open={panelOpen ? "" : undefined} data-phase={phase} data-down={down === "key" && !panelOpen ? "" : undefined}>
        <button
          ref={head}
          type="button"
          className="contact-head"
          aria-expanded={phase === "open" || phase === "opening"}
          aria-controls="contact-ways"
          onClick={(e) => (phase === "closed" ? openPanel(e.detail === 0) : closePanel(e.detail === 0))}
          {...press("key")}
        >
          {/* Its two faces share one place, so the key never resizes when it says "copied". */}
          <span className="contact-label">
            <span className="contact-face" aria-hidden={!!keyCopied}>
              contact
            </span>
            <span className="contact-face contact-face-done" aria-hidden={!keyCopied}>
              {ICONS.check}
              copied
            </span>
          </span>
          <svg className="contact-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m6 9.5 6 6 6-6" />
          </svg>
        </button>

        {panelOpen && (
          <div
            className="contact-ways"
            onPointerLeave={() => glideTo(null)}
            onBlur={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && glideTo(null)}
          >
          <span ref={glide} className="contact-glide" aria-hidden="true" />
          <ul ref={list} id="contact-ways" className="contact-list" onKeyDown={onListKey}>
            {row("linkedin", "linkedin", { href: LINKEDIN, external: true, hint: "L" })}
            {row("resume", "resume", { hint: "R" })}
            {row("email", "copy email", { hint: "C" })}
            {row("mentorship", "1:1 mentorship", { href: MENTORSHIP, external: true, hint: "M" })}
          </ul>
          </div>
        )}
      </div>

      <span className="contact-status" role="status" aria-live="polite">
        {copied === "email" ? "Email copied" : ""}
      </span>

      {resumeFrom && (
        <Resume
          from={resumeFrom}
          // Where it goes back to: its row if the panel is still open, else the key.
          home={() => (phase !== "closed" && rowOf("resume")) || cap.current}
          onClosed={() => setResumeFrom(null)}
        />
      )}
    </nav>
  );
}
