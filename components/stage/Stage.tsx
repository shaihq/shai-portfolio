"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { fitIntro } from "./fit";
import { mountStage } from "./motion";
import Pond from "@/components/pond/Pond";
import Contact from "./Contact";
import "./stage.css";

/**
 * The page's stage: the intro pinned in the centre, the project cards on a layer
 * above it, and the fader fixed at the bottom. `intro` and `cards` are built on the
 * server and passed in; motion.ts moves them.
 */
export default function Stage({ intro, cards }: { intro: ReactNode; cards: ReactNode }) {
  const root = useRef<HTMLElement>(null);
  const introLayer = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const slider = useRef<HTMLDivElement>(null);
  const rail = useRef<HTMLDivElement>(null);
  const knob = useRef<HTMLDivElement>(null);
  const stops = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fitIntro();
    document.fonts?.ready.then(fitIntro);
    addEventListener("resize", fitIntro);
    return () => removeEventListener("resize", fitIntro);
  }, []);

  useEffect(() => {
    if (!root.current || !introLayer.current || !track.current || !slider.current || !rail.current || !knob.current || !stops.current) return;
    return mountStage({
      root: root.current,
      intro: introLayer.current,
      track: track.current,
      slider: slider.current,
      rail: rail.current,
      knob: knob.current,
      stops: stops.current,
    });
  }, []);

  return (
    <main className="page" ref={root}>
      {/* The pond is the page's floor: inside it, so it recedes with the page when a
          project opens, and the cards always stay over the fish. */}
      <Pond />
      <div className="intro-layer" ref={introLayer}>
        {intro}
      </div>

      {/* A pool of light behind the centred card; the room darkens toward the sides. */}
      <div className="stage-light" aria-hidden="true" />
      <div className="projects" ref={track}>
        {cards}
      </div>

      <Contact />

      <div
        className="slider"
        ref={slider}
        role="slider"
        tabIndex={0}
        aria-label="Scroll through projects"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={0}
        aria-valuetext="Intro"
      >
        <div className="slider-well">
          <span className="slider-groove" />
          <div className="slider-rail" ref={rail}>
            <div className="slider-knob" ref={knob}>
              <span className="slider-cap" />
            </div>
          </div>
        </div>
        <div className="slider-stops" ref={stops} />
      </div>
    </main>
  );
}
