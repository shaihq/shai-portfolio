"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { EMAIL, LINKEDIN } from "@/lib/site";
import { playDetent, playGrab, unlockSound } from "./sound";

/*
 * The two keys at the top of the page: copy the email (C) and LinkedIn (L). Set in a
 * shallow well like the slider's at the bottom, so the page is held between them.
 * Each key goes down under the pointer or its letter on the keyboard, with the
 * slider's tock, and acts as it goes down.
 */
export default function Contact() {
  const [copied, setCopied] = useState(false);
  const [down, setDown] = useState<"c" | "l" | null>(null);
  const timer = useRef(0);
  const held = useRef<"c" | "l" | null>(null);
  const nav = useRef<HTMLElement>(null);

  const copy = useCallback(async () => {
    let ok = false;
    try {
      await navigator.clipboard.writeText(EMAIL);
      ok = true;
    } catch {
      // Older browsers, or a page without clipboard permission.
      const field = document.createElement("textarea");
      field.value = EMAIL;
      field.setAttribute("readonly", "");
      field.style.cssText = "position:fixed;opacity:0;pointer-events:none";
      document.body.appendChild(field);
      field.select();
      ok = document.execCommand("copy");
      field.remove();
    }
    if (!ok) return void (location.href = `mailto:${EMAIL}`);
    playDetent(0.7);
    setCopied(true);
    clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(false), 1800);
  }, []);

  const open = useCallback(() => {
    window.open(LINKEDIN, "_blank", "noopener,noreferrer");
  }, []);

  useEffect(() => {
    const html = document.documentElement;
    const usable = (e: KeyboardEvent) =>
      !e.metaKey &&
      !e.ctrlKey &&
      !e.altKey &&
      html.dataset.intro !== "on" &&
      html.dataset.project !== "open" &&
      // Not before the keys have appeared (after the signature).
      !!nav.current &&
      getComputedStyle(nav.current).visibility !== "hidden" &&
      !(e.target instanceof HTMLElement && (e.target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)));
    const onDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if ((key !== "c" && key !== "l") || !usable(e)) return;
      e.preventDefault();
      if (e.repeat) return;
      unlockSound();
      playGrab(true);
      held.current = key;
      setDown(key);
      if (key === "c") copy();
      else open();
    };
    const onUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (key !== "c" && key !== "l") return;
      if (held.current !== key) return;
      held.current = null;
      playGrab(false);
      setDown(null);
    };
    addEventListener("keydown", onDown);
    addEventListener("keyup", onUp);
    return () => {
      removeEventListener("keydown", onDown);
      removeEventListener("keyup", onUp);
      clearTimeout(timer.current);
    };
  }, [copy, open]);

  const press = (key: "c" | "l") => ({
    onPointerDown: () => {
      unlockSound();
      playGrab(true);
      setDown(key);
    },
    onPointerUp: () => {
      playGrab(false);
      setDown(null);
    },
    onPointerLeave: () => setDown((d) => (d === key ? null : d)),
  });

  return (
    <nav ref={nav} className="contact" aria-label="Contact">
      <div className="contact-well">
        <button type="button" className="contact-key" data-down={down === "c" ? "" : undefined} data-done={copied ? "" : undefined} aria-keyshortcuts="C" title={EMAIL} onClick={copy} {...press("c")}>
          <span className="contact-cap">
            <span className="contact-label">
              <span className="contact-face" aria-hidden={copied}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="8.5" y="8.5" width="11.5" height="11.5" rx="2.5" />
                  <path d="M15.5 8.5V6.5a2.5 2.5 0 0 0-2.5-2.5H6.5A2.5 2.5 0 0 0 4 6.5V13a2.5 2.5 0 0 0 2.5 2.5h2" />
                </svg>
                copy email
              </span>
              <span className="contact-face contact-face-done" aria-hidden={!copied}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="m5 12.5 4.5 4.5L19 7.5" />
                </svg>
                copied
              </span>
            </span>
            <kbd className="contact-kbd">C</kbd>
          </span>
        </button>
        <a className="contact-key" href={LINKEDIN} target="_blank" rel="noopener noreferrer" data-down={down === "l" ? "" : undefined} aria-keyshortcuts="L" {...press("l")}>
          <span className="contact-cap">
            <span className="contact-label">
              <span className="contact-face">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M7 17 17 7" />
                  <path d="M8.5 7H17v8.5" />
                </svg>
                linkedin
              </span>
            </span>
            <kbd className="contact-kbd">L</kbd>
          </span>
        </a>
      </div>
      <span className="contact-status" role="status" aria-live="polite">
        {copied ? "Email copied" : ""}
      </span>
    </nav>
  );
}
