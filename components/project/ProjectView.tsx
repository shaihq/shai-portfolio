"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { PROJECTS, slugOf } from "./projects";
import { StoryBlock } from "./story";
import LoopVideo from "@/components/media/LoopVideo";
import "./project.css";

/*
 * A project, opened from its card. The card's image lifts out and flies to the
 * centre into the reading column, keeping its thumbnail framing,
 * while the page behind sinks back and blurs; then the project's title, details
 * and story come in one by one out of a blur, each part as it scrolls into view.
 * Closing runs it all backwards and the image lands in its card again.
 *
 * The flight is a fixed element whose box (left, top, width, height, radius) is
 * animated from the card's image to the hero's slot.
 * Cards open it by dispatching "project:open" (components/stage/motion.ts).
 */

export interface OpenDetail {
  index: number;
  image: HTMLElement;
}

const OPEN = { duration: 1050, easing: "cubic-bezier(0.7, 0, 0.2, 1)" };
const CLOSE = { duration: 820, easing: "cubic-bezier(0.6, 0, 0.25, 1)" };
const REVEAL_AFTER = 560; // ms into the flight before the words start to arrive
const FADE_OUT = 260;
const STAGGER = 95; // ms between parts arriving together

type Phase = "opening" | "open" | "closing";

const boxOf = (el: Element) => {
  const r = el.getBoundingClientRect();
  return { left: r.left, top: r.top, width: r.width, height: r.height, radius: parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0 };
};
const frame = (b: ReturnType<typeof boxOf>): Keyframe => ({
  left: `${b.left}px`,
  top: `${b.top}px`,
  width: `${b.width}px`,
  height: `${b.height}px`,
  borderRadius: `${b.radius}px`,
});

export default function ProjectView() {
  const [open, setOpen] = useState<(OpenDetail & { phase: Phase }) | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [landed, setLanded] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const slot = useRef<HTMLDivElement>(null);
  const flyer = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const busy = useRef(false);
  // The address bar follows the open project (/projects/<slug>), so it can be shared,
  // bookmarked and closed with the browser's back button.
  const closeByKey = useRef(false);
  const pageTitle = useRef("");
  const still = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

  // A card asks to open.
  useEffect(() => {
    const onOpen = (e: Event) => {
      if (busy.current || open) return;
      const detail = (e as CustomEvent<OpenDetail>).detail;
      busy.current = true;
      setRevealed(false);
      setLanded(false);
      setOpen({ ...detail, phase: "opening" });
    };
    addEventListener("project:open", onOpen);
    return () => removeEventListener("project:open", onOpen);
  }, [open]);

  // Opening: the image flies into the hero at the top of the reading column.
  useLayoutEffect(() => {
    if (!open || open.phase !== "opening" || !slot.current || !flyer.current || !panel.current) return;
    const html = document.documentElement;
    panel.current.scrollTop = 0;
    // The page's recede transition is on only while a project opens or closes (it
    // must not run when the intro hands the page over).
    html.dataset.projectMotion = "";
    html.dataset.project = "open";
    open.image.style.visibility = "hidden";
    const opened = PROJECTS[open.index]!;
    if (history.state?.pv !== open.index) history.pushState({ pv: open.index }, "", `/projects/${slugOf(opened)}`);
    pageTitle.current = document.title;
    document.title = `${opened.title} case study | Shai Krishna`;

    const from = boxOf(open.image);
    const to = boxOf(slot.current);
    const fly = flyer.current;
    const done = () => {
      setLanded(true);
      busy.current = false;
      setOpen((o) => (o ? { ...o, phase: "open" } : o));
      closeButton.current?.focus({ preventScroll: true });
    };
    if (still()) {
      Object.assign(fly.style, frame(to));
      setRevealed(true);
      done();
      return;
    }
    Object.assign(fly.style, frame(to));
    const animation = fly.animate([frame(from), frame(to)], { ...OPEN, fill: "both" });
    const reveal = window.setTimeout(() => setRevealed(true), REVEAL_AFTER);
    animation.onfinish = done;
    return () => {
      clearTimeout(reveal);
      animation.cancel();
    };
  }, [open]);

  const closeNow = useCallback((byKey = false) => {
    if (!open || busy.current || open.phase !== "open" || !slot.current || !flyer.current) return;
    busy.current = true;
    const html = document.documentElement;
    const fly = flyer.current;
    const from = boxOf(slot.current);
    const to = boxOf(open.image);
    panel.current?.querySelectorAll(".pv-reveal[data-in]").forEach((el) => {
      (el as HTMLElement).style.setProperty("--delay", "0ms");
      el.removeAttribute("data-in");
    });
    setRevealed(false);
    setLanded(false);
    setOpen({ ...open, phase: "closing" });
    delete html.dataset.project;
    Object.assign(fly.style, frame(from));
    const finish = () => {
      open.image.style.visibility = "";
      if (pageTitle.current) document.title = pageTitle.current;
      delete html.dataset.projectMotion;
      busy.current = false;
      setOpen(null);
      // Focus goes back to the card; its ring shows only if the keyboard closed it.
      (open.image.closest("[data-card]") as HTMLElement | null)?.focus({ preventScroll: true, focusVisible: byKey } as FocusOptions);
    };
    if (still()) {
      finish();
      return;
    }
    const animation = fly.animate([frame(from), frame(to)], { ...CLOSE, delay: FADE_OUT * 0.5, fill: "both" });
    animation.onfinish = finish;
  }, [open]);

  // Closing goes back in history when opening went forward, so the back button and
  // [close] are the same thing; the history change then closes it.
  const close = useCallback(
    (byKey = false) => {
      if (history.state?.pv !== undefined) {
        closeByKey.current = byKey;
        history.back();
      } else closeNow(byKey);
    },
    [closeNow],
  );

  useEffect(() => {
    const onPop = () => {
      const pv = history.state?.pv;
      if (open && pv === undefined) closeNow(closeByKey.current);
      else if (!open && typeof pv === "number") {
        // Forward again onto a project: open it from its card.
        const image = document.querySelectorAll("[data-card]")[pv]?.querySelector<HTMLElement>(".card-media");
        if (image) dispatchEvent(new CustomEvent("project:open", { detail: { index: pv, image } }));
      }
      closeByKey.current = false;
    };
    addEventListener("popstate", onPop);
    return () => removeEventListener("popstate", onPop);
  }, [open, closeNow]);

  // Back pressed while it was still opening: close as soon as it has landed.
  useEffect(() => {
    if (open?.phase === "open" && history.state?.pv === undefined) closeNow();
  }, [open?.phase, closeNow]);

  // The words: once revealing starts, each part comes in as it enters the view;
  // parts that enter together arrive one after another.
  useEffect(() => {
    if (!open || !revealed || !panel.current) return;
    const items = Array.from(panel.current.querySelectorAll<HTMLElement>(".pv-reveal"));
    const io = new IntersectionObserver(
      (entries) => {
        let n = 0;
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const el = entry.target as HTMLElement;
          el.style.setProperty("--delay", `${n++ * STAGGER}ms`);
          el.setAttribute("data-in", "");
          io.unobserve(el);
        }
      },
      { root: panel.current, rootMargin: "0px 0px -8% 0px" },
    );
    items.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [open?.index, revealed]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close(true);
      }
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [open, close]);

  if (!open) return null;
  const project = PROJECTS[open.index]!;
  // The flight shows the picture the card already has, so it never waits on a download;
  // a card with a video hands over to the same video, at the moment it had reached.
  const picture = open.image.querySelector("img")?.currentSrc || project.image;
  const loopAt = open.image.querySelector("video")?.currentTime ?? 0;
  const media = project.video ? (
    <LoopVideo src={project.video.src} poster={project.video.poster} startAt={loopAt} />
  ) : (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={picture} alt="" />
  );
  const reveal = () => ({ className: "pv-reveal" });

  return (
    <div className="pv" data-phase={open.phase} data-revealed={revealed ? "" : undefined} role="dialog" aria-modal="true" aria-label={project.headline ?? project.title}>
      <div
        ref={panel}
        className="pv-scroll"
        onClick={(e) => {
          if (!(e.target as Element).closest(".pv-column")) close(false);
        }}
      >
        <article className="pv-column">
          <div ref={slot} className="pv-hero" data-landed={landed ? "" : undefined}>
            {media}
          </div>

          <header className="pv-head">
            <p {...reveal()}>
              <span>{String(open.index + 1).padStart(2, "0")}</span>
              <span>{project.kind.toLowerCase()}</span>
              {project.year && <span>{project.year}</span>}
            </p>
            <h2 {...reveal()}>{project.headline ?? project.title}</h2>
            <p {...reveal()} className="pv-reveal pv-summary">
              {project.summary}
            </p>
          </header>

          <dl {...reveal()} className="pv-reveal pv-details">
            {project.details.map((d) => (
              <div key={d.label}>
                <dt>{d.label}</dt>
                <dd>{d.value}</dd>
              </div>
            ))}
          </dl>

          <div className="pv-story">
            {project.story.map((block, i) => (
              <StoryBlock key={i} block={block} />
            ))}
          </div>

          <footer {...reveal()} className="pv-reveal pv-foot">
            <button type="button" onClick={(e) => close(e.detail === 0)}>
              [close]
            </button>
            <span>esc</span>
          </footer>
        </article>
      </div>

      {/* Pinned at the top while reading: the way out is always one click away. */}
      <div className="pv-topbar">
        <button ref={closeButton} type="button" onClick={(e) => close(e.detail === 0)}>
          [close]
        </button>
        <span>esc</span>
      </div>

      <div ref={flyer} className="pv-flyer" aria-hidden="true" data-landed={landed ? "" : undefined}>
        {media}
      </div>
    </div>
  );
}
