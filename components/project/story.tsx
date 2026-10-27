"use client";

import { useEffect, useRef } from "react";
import type { Block } from "./projects";
import { getImageProps } from "next/image";
import LoopVideo from "@/components/media/LoopVideo";

/*
 * A project's story, block by block: shared by the open view over the home page
 * (ProjectView.tsx) and the project's own page (app/projects/[slug]), so both show
 * the same thing, and the page carries it all in its server-rendered HTML.
 */

/** A line of story text: **bold** runs become <strong>, ~~word~~ the alert colour. */
/*
 * A picture through Next's image optimizer: AVIF or WebP, at the width its place on
 * the page needs on this screen (`sizes`), lazily. Quality 85 keeps the text in the
 * product screenshots crisp. The stated size only picks the candidate widths; the
 * picture keeps its own proportions (the layout sets them).
 */
const WIDE = "(max-width: 1048px) calc(100vw - 48px), 1000px";
const TEXT = "(max-width: 728px) calc(100vw - 48px), 680px";
const THIRD = "(max-width: 899px) calc(100vw - 48px), 500px";
function picture(src: string, alt: string, sizes: string) {
  const { props } = getImageProps({ src, alt, width: 2000, height: 1500, sizes, quality: 85 });
  const { width: _w, height: _h, ...rest } = props;
  void _w;
  void _h;
  return rest;
}

export function Rich({ text }: { text: string }) {
  const alert = (t: string, key: string) =>
    t.split(/(~~[^~]+~~)/).map((p, j) =>
      p.startsWith("~~") && p.endsWith("~~") ? (
        <em key={`${key}-${j}`} className="pv-alert">
          {p.slice(2, -2)}
        </em>
      ) : (
        p
      ),
    );
  return (
    <>
      {text.split(/(\*\*[^*]+\*\*)/).map((part, i) =>
        part.startsWith("**") && part.endsWith("**") ? <strong key={i}>{alert(part.slice(2, -2), `b${i}`)}</strong> : alert(part, `t${i}`),
      )}
    </>
  );
}

/** The steps grid: cards with one shared 3D canvas laid over them (steps3d.ts). */
function Steps({ items }: { items: Extract<Block, { type: "steps" }>["items"] }) {
  const ref = useRef<HTMLOListElement>(null);
  useEffect(() => {
    const host = ref.current;
    if (!host) return;
    let stop: (() => void) | undefined;
    let cancelled = false;
    import("./steps3d").then(({ canRun3D, mountSteps }) => {
      if (cancelled) return;
      if (!canRun3D()) return host.setAttribute("data-flat", "");
      stop = mountSteps(host, host.closest(".pv-scroll"));
    });
    return () => {
      cancelled = true;
      stop?.();
    };
  }, []);
  return (
    <ol ref={ref} className="pv-reveal pv-steps">
      {items.map((item, i) => (
        <li key={item.title} className="pv-step">
          <div className="pv-step-stage" data-stage={item.glyph} aria-hidden="true">
            <span className="pv-step-fallback">{String(i + 1).padStart(2, "0")}</span>
          </div>
          <div className="pv-step-body">
            <span className="pv-step-num">{String(i + 1).padStart(2, "0")}</span>
            <h4>{item.title}</h4>
            <p>{item.text}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

export function StoryBlock({ block }: { block: Block }) {
  switch (block.type) {
    case "heading":
      return <h3 className="pv-reveal pv-h">{block.text}</h3>;
    case "subheading":
      return <h4 className="pv-reveal pv-sub">{block.text}</h4>;
    case "label":
      return <p className="pv-reveal pv-label">{block.text}</p>;
    case "p":
      return (
        <p className="pv-reveal pv-p">
          <Rich text={block.text} />
        </p>
      );
    case "list":
      return (
        <ul className="pv-reveal pv-list">
          {block.items.map((item) => (
            <li key={item}>
              <Rich text={item} />
            </li>
          ))}
        </ul>
      );
    case "image":
      return (
        <figure className="pv-reveal pv-figure" style={{ aspectRatio: block.ratio }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img {...picture(block.src, block.alt, WIDE)} decoding="async" />
        </figure>
      );
    case "video":
      if (block.version)
        return (
          <figure className="pv-reveal pv-legacy pv-versioned">
            <div className="pv-figure" style={{ aspectRatio: block.ratio }}>
              <LoopVideo src={block.src} poster={block.poster} label={block.alt} />
              <span className="pv-version-badge">
                <span className="pv-version-mark" aria-hidden="true">
                  <svg viewBox="0 0 16 16" width="11" height="11">
                    <path d="M8 2 14 5.2 8 8.4 2 5.2Z" fill="currentColor" />
                    <path d="M2.6 8.2 8 11.1l5.4-2.9" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" opacity=".7" />
                    <path d="M2.6 10.9 8 13.8l5.4-2.9" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" opacity=".4" />
                  </svg>
                </span>
                {block.version.label}
                <span className="pv-version-sheen" aria-hidden="true" />
              </span>
            </div>
            {block.version.caption && <figcaption className="pv-legacy-caption">{block.version.caption}</figcaption>}
          </figure>
        );
      if (block.legacy)
        return (
          <figure className="pv-reveal pv-legacy">
            <div className="pv-figure" style={{ aspectRatio: block.ratio }}>
              <LoopVideo src={block.src} poster={block.poster} label={block.alt} />
              <span className="pv-legacy-badge">
                <span className="pv-legacy-dot" aria-hidden="true" />
                {block.legacy.badge}
              </span>
            </div>
            {block.legacy.caption && <figcaption className="pv-legacy-caption">{block.legacy.caption}</figcaption>}
          </figure>
        );
      return (
        <figure className="pv-reveal pv-figure" style={{ aspectRatio: block.ratio }}>
          <LoopVideo src={block.src} poster={block.poster} label={block.alt} />
        </figure>
      );
    case "glass":
      return (
        <figure className="pv-reveal pv-glass">
          <blockquote className="pv-glass-card">
            <span className="pv-glass-mark" aria-hidden="true">
              “
            </span>
            <p>
              <Rich text={block.text} />
            </p>
            <span className="pv-glass-sheen" aria-hidden="true" />
          </blockquote>
        </figure>
      );
    case "placeholder":
      return (
        <figure className="pv-reveal pv-figure pv-placeholder" style={{ aspectRatio: block.ratio }} aria-label={`Image coming soon: ${block.label}`}>
          <span className="pv-placeholder-label">{block.label}</span>
          <span className="pv-placeholder-note">image coming soon</span>
        </figure>
      );
    case "slack":
      return (
        <figure className="pv-reveal pv-slack">
          <div className="pv-slack-card">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img {...picture(block.image, block.alt, TEXT)} decoding="async" style={{ aspectRatio: block.ratio }} />
          </div>
          <figcaption className="pv-slack-callout">
            <svg className="pv-slack-arrow" viewBox="0 0 120 70" aria-hidden="true">
              <path d="M112 62 C 84 60, 46 48, 18 14" />
              <path d="M10 26 L 17 12 L 32 16" />
            </svg>
            <span>
              <strong>{block.callout.title}</strong>
              {block.callout.text}
            </span>
          </figcaption>
        </figure>
      );
    case "snapshots":
      return (
        <figure className="pv-reveal pv-snaps">
          <figcaption className="pv-snaps-source">{block.source}</figcaption>
          <div className="pv-snaps-grid">
            {block.cards.map((card) => (
              <section key={card.title} className="pv-snap">
                <span className="pv-snap-label">{card.label}</span>
                <h4>{card.title}</h4>
                {card.text && <p className="pv-snap-text">{card.text}</p>}
                {card.groups && (
                  <dl className="pv-snap-groups">
                    {card.groups.map((g) => (
                      <div key={g.title}>
                        <dt>{g.title}</dt>
                        {g.items.map((item) => (
                          <dd key={item}>{item}</dd>
                        ))}
                      </div>
                    ))}
                  </dl>
                )}
                {card.notes && (
                  <ul className="pv-snap-notes">
                    {card.notes.map((n) => (
                      <li key={n}>
                        <Rich text={n} />
                      </li>
                    ))}
                  </ul>
                )}
                {card.tags && (
                  <ul className="pv-snap-tags">
                    {card.tags.map((t) => (
                      <li key={t}>{t}</li>
                    ))}
                  </ul>
                )}
                {card.quote && (
                  <blockquote className="pv-snap-quote">
                    <span>Value proposition</span>
                    {card.quote}
                  </blockquote>
                )}
              </section>
            ))}
          </div>
        </figure>
      );
    case "results":
      return (
        <figure className="pv-reveal pv-results">
          <figcaption className="pv-results-label">{block.label}</figcaption>
          <ul className="pv-results-stats">
            {block.stats.map((stat) => (
              <li key={stat.caption}>
                <span className="pv-results-value">{stat.value}</span>
                <span className="pv-results-caption">{stat.caption}</span>
              </li>
            ))}
          </ul>
          {block.note && <p className="pv-results-note">{block.note}</p>}
        </figure>
      );
    case "decline": {
      const R = 46;
      const C = 2 * Math.PI * R;
      return (
        <figure className="pv-reveal pv-decline">
          <span className="pv-decline-eyebrow">{block.eyebrow}</span>
          <p className="pv-decline-text">
            <Rich text={block.text} />
          </p>
          <ul className="pv-decline-meters">
            {block.meters.map((m, i) => (
              <li key={m.caption} style={{ "--i": i, "--off": (C * (1 - m.value / 100)).toFixed(2), "--c": C.toFixed(2) } as React.CSSProperties}>
                <span className="pv-meter">
                  <svg viewBox="0 0 108 108" aria-hidden="true">
                    <circle className="pv-meter-track" cx="54" cy="54" r={R} />
                    <circle className="pv-meter-arc" cx="54" cy="54" r={R} />
                  </svg>
                  <span className="pv-meter-value">
                    {m.value}
                    <span>%</span>
                  </span>
                </span>
                <span className="pv-meter-caption">{m.caption}</span>
              </li>
            ))}
          </ul>
        </figure>
      );
    }
    case "steps":
      return <Steps items={block.items} />;
    case "journey":
      return (
        <ol
          className="pv-reveal pv-journey"
          data-count={block.steps.length}
          style={{ "--journey-ratio": block.ratio ?? 4 / 3 } as React.CSSProperties}
        >
          {block.steps.map((step, i) => (
            <li key={step.image} className="pv-journey-card">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img {...picture(step.image, "", THIRD)} decoding="async" />
              <div className="pv-journey-text">
                <span className="pv-journey-num">{String(i + (block.start ?? 1)).padStart(2, "0")}</span>
                <p>{step.text}</p>
              </div>
            </li>
          ))}
        </ol>
      );
    case "youtube":
      return (
        <figure className="pv-reveal pv-figure" style={{ aspectRatio: 16 / 9 }}>
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${block.id}?rel=0`}
            title={block.title}
            loading="lazy"
            allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </figure>
      );
    case "link":
      return (
        <p className="pv-reveal pv-p">
          <a className="pv-link" href={block.href} target="_blank" rel="noopener noreferrer">
            {block.text} ↗
          </a>
        </p>
      );
  }
}

