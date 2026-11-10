import { buzz, playBump, playDetent, playGrab, playGrit, setSlide, unlockSound } from "./sound";

/*
 * The stage: the intro stays pinned in the centre, the project cards slide over it
 * from the right, and a fader at the bottom drives them.
 *
 *   target    where the cards are going (px of track scroll), set by input
 *   x         where they are, following target on a spring
 *   kp        where the fader cap is (px along the rail), on its own spring:
 *             stiff toward the pointer while dragging, softer toward target otherwise
 *
 * Stops ("detents") are the intro (0) and each card centred. Letting go, a wheel
 * pause or an arrow key settles on one. Everything is written straight to the DOM
 * from one rAF loop that sleeps when nothing moves.
 */

const TRACK = { k: 170, c: 26 };
const KNOB_DRAG = { k: 1400, c: 75 };
const KNOB_FOLLOW = { k: 420, c: 41 };
const INTRO_END = { scale: 0.92, blur: 8, dim: 0.5 };
const THROW = 0.12; // seconds of release velocity carried into the snap
const WHEEL_SETTLE = 180; // ms after the last wheel event
/** Notches: within `zone` px of a stop the cap is drawn into it, so a drag catches at each one. */
const NOTCH = { zone: 14, pull: 0.7 };
/** The cards' tilt: degrees per card-width from the centre, at most MAX; set back DEPTH px per card-width. */
const TILT = { per: 22, max: 34, depth: 70 };
/*
 * The cards' light: one key light up and to the left, toward the viewer. Each card is
 * lit by how it faces it (Lambert), with a soft glint that slides across as it turns,
 * a highlight on the edge toward the light, and side cards softened as if out of focus.
 */
const LIGHT = { x: -0.5, y: 0.35, z: 0.79, shade: 1.6, lift: 1.4, glintSweep: 2.4, blur: 2.4 };

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const rubber = (d: number, dim: number) => (d * dim * 0.55) / (dim + 0.55 * d);
const smooth = (t: number) => t * t * (3 - 2 * t);

export interface StageElements {
  root: HTMLElement;
  intro: HTMLElement;
  track: HTMLElement;
  slider: HTMLElement;
  rail: HTMLElement;
  knob: HTMLElement;
  /** Where the stop numbers go: under the well, spanning the knob's travel. */
  stops: HTMLElement;
}

export function mountStage(els: StageElements) {
  // The clicks: the cap passes TICKS evenly spaced (unseen) ticks; a stop gives a heavier one.
  const TICKS = 41;
  const still = matchMedia("(prefers-reduced-motion: reduce)");
  // Phones skip the focus blur: a moving blur on six images is too much for them.
  const small = matchMedia("(max-width: 640px), (pointer: coarse)");
  const stageLight = els.root.querySelector<HTMLElement>(".stage-light");

  let vw = 0;
  let max = 0;
  let railW = 0;
  let spacing = 1;
  let detents: number[] = [0];
  let majors: boolean[] = [];
  let labels: HTMLElement[] = [];
  let cardBodies: { el: HTMLElement; centre: number; set: Map<string, string> }[] = [];
  /*
   * A style written only when its value changes. A card off to the side holds its
   * full tilt, so its values stop changing: unwritten, it isn't restyled or
   * repainted while the others move.
   */
  const put = (card: { el: HTMLElement; set: Map<string, string> }, name: string, value: string) => {
    if (card.set.get(name) === value) return;
    card.set.set(name, value);
    card.el.style.setProperty(name, value);
  };
  let cardSpan = 1;
  let lit = -1;
  let index = 0;

  let x = 0;
  let v = 0;
  let target = 0;
  let kp = 0;
  let kv = 0;
  let ktarget = 0;

  let drag: { id: number; offset: number; samples: { t: number; p: number }[] } | null = null;
  let swipe: { id: number; x0: number; start: number; active: boolean; samples: { t: number; p: number }[] } | null = null;
  let wheelTimer = 0;
  let swiped = false;
  let lastTick = 0;
  let lastSound = 0;
  /** Speed the knob hit an end of the well at, this frame (0 if it didn't). */
  let impact = 0;
  let frame = 0;
  let previous = 0;

  const toRail = (px: number) => (max ? (px / max) * railW : 0);
  const fromRail = (r: number) => (railW ? (r / railW) * max : 0);
  /** The knob can't leave its well: it stops hard at both ends. */
  const inRail = (r: number) => clamp(r, 0, railW);
  const notch = (r: number) => {
    let stop = r;
    let gap = Infinity;
    for (const d of detents) {
      const at = toRail(d);
      if (Math.abs(at - r) < gap) {
        gap = Math.abs(at - r);
        stop = at;
      }
    }
    if (gap >= NOTCH.zone) return r;
    const t = 1 - gap / NOTCH.zone;
    return r + (stop - r) * NOTCH.pull * t * t;
  };
  const bandTrack = (t: number) => (t < 0 ? -rubber(-t, 160) : t > max ? max + rubber(t - max, 160) : t);
  const nearest = (px: number) => detents.reduce((best, d, i) => (Math.abs(d - px) < Math.abs(detents[best]! - px) ? i : best), 0);
  const velocity = (samples: { t: number; p: number }[]) => {
    const now = performance.now();
    const recent = samples.filter((s) => now - s.t < 100);
    if (recent.length < 2) return 0;
    const a = recent[0]!;
    const b = recent[recent.length - 1]!;
    return b.t > a.t ? ((b.p - a.p) / (b.t - a.t)) * 1000 : 0;
  };

  function layout() {
    vw = els.root.clientWidth;
    const cards = Array.from(els.track.querySelectorAll<HTMLElement>("[data-card]"));
    cardBodies = cards
      .map((c) => ({ el: c.querySelector<HTMLElement>(".card-body")!, centre: c.offsetLeft + c.offsetWidth / 2, set: new Map<string, string>() }))
      .filter((c) => c.el);
    cardSpan = cards.length > 1 ? cards[1]!.offsetLeft - cards[0]!.offsetLeft : cards[0]?.offsetWidth || 1;
    max = Math.max(0, els.track.offsetWidth - vw);
    detents = [0, ...cards.map((c) => clamp(c.offsetLeft + c.offsetWidth / 2 - vw / 2, 0, max))];
    railW = els.rail.clientWidth;
    spacing = railW / (TICKS - 1);
    const marked = new Set(detents.map((d) => Math.round(toRail(d) / spacing)));
    majors = Array.from({ length: TICKS }, (_, i) => marked.has(i));
    // A number under each stop: 00 for the intro, then one per project.
    labels.forEach((label) => label.remove());
    labels = detents.map((d, i) => {
      const label = document.createElement("span");
      label.className = "slider-stop";
      label.textContent = String(i).padStart(2, "0");
      label.style.left = `${toRail(d).toFixed(2)}px`;
      els.stops.appendChild(label);
      return label;
    });
    lit = -1;
    index = Math.min(index, detents.length - 1);
    x = target = detents[index]!;
    v = 0;
    kp = ktarget = toRail(x);
    kv = 0;
    lastTick = Math.round(kp / spacing);
    announce();
    render();
  }

  function announce() {
    els.slider.setAttribute("aria-valuenow", String(max ? Math.round((target / max) * 100) : 0));
    els.slider.setAttribute("aria-valuetext", index === 0 ? "Intro" : `Project ${index} of ${detents.length - 1}`);
  }

  function settleTo(i: number) {
    index = clamp(i, 0, detents.length - 1);
    target = detents[index]!;
    announce();
    run();
  }

  /* ------------------------------------------------------------ frame */

  function spring(pos: number, vel: number, goal: number, s: { k: number; c: number }, dt: number) {
    const a = s.k * (goal - pos) - s.c * vel;
    vel += a * dt;
    return [pos + vel * dt, vel] as const;
  }

  function step(dt: number) {
    if (!drag) ktarget = inRail(toRail(target));
    if (still.matches) {
      x = target;
      v = 0;
      if (!drag) {
        kp = ktarget;
        kv = 0;
      }
    }
    // Under a finger the cards are held, not sprung: they move with it exactly, as
    // anything dragged by hand should. (A spring here trails the finger by a beat,
    // which reads as lag.) Letting go hands its speed to the spring.
    const held = !!swipe?.active;
    if (held) x = target;
    // Small fixed substeps keep the stiff cap spring stable at any frame rate.
    for (let left = dt; left > 1e-6; left -= 1 / 240) {
      const h = Math.min(left, 1 / 240);
      if (!still.matches && !held) [x, v] = spring(x, v, target, TRACK, h);
      if (!still.matches || drag) [kp, kv] = spring(kp, kv, ktarget, drag ? KNOB_DRAG : KNOB_FOLLOW, h);
      // The ends of the well are solid: the knob stops dead against them.
      if (kp < 0 || kp > railW) {
        impact = Math.max(impact, Math.abs(kv));
        kp = clamp(kp, 0, railW);
        kv = 0;
      }
    }
  }

  /** Where the knob is, -1 (left) to 1 (right), for placing its sound in stereo. */
  const panOf = () => (railW ? clamp((kp / railW) * 2 - 1, -1, 1) : 0);

  function sounds() {
    const speed = Math.abs(kv);
    const pan = panOf();
    // The rub of the knob in its well, following its speed (quieter when it moves
    // by itself, as after a wheel or a release).
    setSlide(drag ? speed : speed * 0.6, pan);
    const tick = Math.round(kp / spacing);
    if (tick !== lastTick) {
      const now = performance.now();
      const i = clamp(tick, 0, TICKS - 1);
      if (majors[i] && tick === i) {
        playDetent(Math.min(1, speed / 900), pan);
        buzz(8);
        lastSound = now;
      } else if (now - lastSound > 18 && tick === i && speed > 40) {
        playGrit(Math.min(1, speed / 1500), pan);
        lastSound = now;
      }
      lastTick = tick;
    }
    if (impact > 80) {
      playBump(Math.min(1, impact / 900), pan);
      buzz(12);
    }
    impact = 0;
  }

  function render() {
    els.track.style.transform = `translate3d(${(-x).toFixed(2)}px,0,0)`;

    // The intro recedes as the first card travels to the centre.
    const reach = detents[1] || max || 1;
    const e = smooth(clamp(x / reach, 0, 1));
    els.intro.style.transform = `scale(${(1 - (1 - INTRO_END.scale) * e).toFixed(4)})`;
    // Phones skip the blur: refiltering the whole intro every frame is the heaviest
    // thing on the page for them. It still shrinks and dims.
    els.intro.style.filter = !small.matches && e > 0.002 ? `blur(${(INTRO_END.blur * e).toFixed(2)}px)` : "";
    els.intro.style.opacity = (1 - INTRO_END.dim * e).toFixed(3);
    els.intro.toggleAttribute("inert", e > 0.5);

    // Each card turns to face the centre by how far it is from it, and sits back a
    // little; in the centre it is square and flat. Moves with the cards, so it
    // changes as they scroll and settles exactly flat when one comes to rest there.
    for (const card of cardBodies) {
      const off = still.matches ? 0 : (card.centre - x - vw / 2) / cardSpan;
      const tilt = clamp(-off * TILT.per, -TILT.max, TILT.max);
      const depth = -Math.min(1.5, Math.abs(off)) * TILT.depth;
      // The transform itself, not variables for it: a variable is inherited, so every
      // element inside the card would be restyled, and repainted, each frame.
      put(card, "transform", `perspective(1500px) translateZ(${depth.toFixed(1)}px) rotateY(${tilt.toFixed(2)}deg)`);
      // Phones keep the turn (moved by the GPU, no repaint) but not the changing light:
      // each change repaints the card, image and all, every frame, and with a card
      // nearly the width of the screen the side cards it would light are barely in view.
      if (small.matches) continue;

      // Lambert against the key light, relative to a card facing straight out.
      const a = (tilt * Math.PI) / 180;
      const facing = Math.sin(a) * LIGHT.x + Math.cos(a) * LIGHT.z;
      const delta = facing - LIGHT.z;
      put(card, "--shade", Math.max(0, -delta * LIGHT.shade + Math.min(1, Math.abs(off)) * 0.12).toFixed(3));
      put(card, "--lift", Math.max(0, delta * LIGHT.lift).toFixed(3));
      // The glint: where the reflected light sits on the card, and how bright it is.
      put(card, "--glint-x", `${(50 - tilt * LIGHT.glintSweep).toFixed(1)}%`);
      put(card, "--glint", (0.1 + 0.16 * Math.max(0, 1 - Math.abs(tilt + 8) / 30)).toFixed(3));
      // The edge toward the light catches it when the card turns that way.
      put(card, "--rim", (0.08 + Math.max(0, -tilt / TILT.max) * 0.32).toFixed(3));
      const blur = small.matches ? 0 : Math.max(0, Math.min(1.4, Math.abs(off)) - 0.15) * LIGHT.blur;
      put(card, "filter", blur > 0.05 ? `blur(${blur.toFixed(2)}px)` : "");
    }
    // The spotlight comes up as the cards arrive.
    stageLight?.style.setProperty("opacity", e.toFixed(3));

    // The knob: a solid part on a spring, no squash. The number under the stop it is
    // nearest lights up.
    els.knob.style.transform = `translate3d(${kp.toFixed(2)}px,0,0)`;
    const near = nearest(fromRail(kp));
    if (near !== lit) {
      labels[lit]?.removeAttribute("data-on");
      labels[near]?.setAttribute("data-on", "");
      lit = near;
    }
  }

  function tick(now: number) {
    const dt = previous ? Math.min((now - previous) / 1000, 1 / 30) : 1 / 60;
    previous = now;
    step(dt);
    sounds();
    render();
    const moving = Math.abs(target - x) > 0.05 || Math.abs(v) > 0.05 || Math.abs(ktarget - kp) > 0.05 || Math.abs(kv) > 0.05;
    if (moving || drag || swipe?.active) {
      frame = requestAnimationFrame(tick);
    } else {
      x = target;
      kp = ktarget;
      v = kv = 0;
      setSlide(0);
      render();
      frame = 0;
      delete document.documentElement.dataset.sliding;
    }
  }

  function run() {
    if (frame) return;
    previous = 0;
    // Phones: the pond (components/pond) eases off to half its frame rate while the
    // cards move, leaving the GPU to them.
    if (small.matches) document.documentElement.dataset.sliding = "";
    frame = requestAnimationFrame(tick);
  }

  /* ------------------------------------------------------------ the fader */

  const railX = (e: PointerEvent) => e.clientX - els.rail.getBoundingClientRect().left;

  function onSliderDown(e: PointerEvent) {
    if (e.button !== 0) return;
    unlockSound();
    e.preventDefault();
    els.slider.setPointerCapture(e.pointerId);
    // Focus for the arrow keys, without the keyboard focus ring.
    els.slider.focus({ preventScroll: true, focusVisible: false } as FocusOptions);
    const r = railX(e);
    // Grabbing the cap keeps it under the finger; grabbing the rail pulls it there.
    const offset = Math.abs(r - kp) < els.knob.offsetWidth ? kp - r : 0;
    drag = { id: e.pointerId, offset, samples: [{ t: performance.now(), p: r + offset }] };
    els.slider.setAttribute("data-active", "");
    playGrab(true, panOf());
    ktarget = notch(inRail(r + offset));
    target = fromRail(ktarget);
    run();
  }

  function onSliderMove(e: PointerEvent) {
    if (!drag || e.pointerId !== drag.id) return;
    const raw = railX(e) + drag.offset;
    drag.samples.push({ t: performance.now(), p: raw });
    if (drag.samples.length > 12) drag.samples.shift();
    ktarget = notch(inRail(raw));
    target = fromRail(ktarget);
    run();
  }

  function onSliderUp(e: PointerEvent) {
    if (!drag || e.pointerId !== drag.id) return;
    const raw = railX(e) + drag.offset;
    const projected = clamp(raw + velocity(drag.samples) * THROW, 0, railW);
    drag = null;
    els.slider.removeAttribute("data-active");
    playGrab(false, panOf());
    settleTo(nearest(fromRail(projected)));
  }

  function onSliderKey(e: KeyboardEvent) {
    const last = detents.length - 1;
    const next = { ArrowRight: index + 1, ArrowUp: index + 1, ArrowLeft: index - 1, ArrowDown: index - 1, Home: 0, End: last, PageUp: index + 1, PageDown: index - 1 }[e.key];
    if (next === undefined) return;
    e.preventDefault();
    unlockSound();
    settleTo(next);
  }

  /* ------------------------------------------------------------ wheel, keys, swipe */

  function onWheel(e: WheelEvent) {
    if (document.documentElement.dataset.intro === "on") return;
    // On the intro, a vertical wheel scrolls it when it is taller than the window.
    const intro = els.intro;
    if (index === 0 && x < 1 && Math.abs(e.deltaY) > Math.abs(e.deltaX) && intro.scrollHeight > intro.clientHeight + 1) {
      const atEdge = e.deltaY > 0 ? intro.scrollTop + intro.clientHeight >= intro.scrollHeight - 1 : intro.scrollTop <= 0;
      if (!atEdge) return;
    }
    e.preventDefault();
    const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? vw : 1;
    const d = (Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY) * unit;
    target = clamp(target + d, 0, max);
    clearTimeout(wheelTimer);
    wheelTimer = window.setTimeout(() => settleTo(nearest(target)), WHEEL_SETTLE);
    run();
  }

  function onKey(e: KeyboardEvent) {
    const html = document.documentElement;
    if (html.dataset.intro === "on" || html.dataset.project === "open" || html.dataset.resume === "open" || e.defaultPrevented) return;
    if (e.target instanceof HTMLElement && (e.target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName))) return;
    if (e.target === els.slider) return;
    onSliderKey(e);
  }

  function onRootDown(e: PointerEvent) {
    if (e.pointerType !== "touch" || drag || els.slider.contains(e.target as Node)) return;
    unlockSound();
    // From where the cards are, not where they were going: a finger that lands on them
    // while they settle catches them there.
    swipe = { id: e.pointerId, x0: e.clientX, start: x, active: false, samples: [] };
  }

  function onRootMove(e: PointerEvent) {
    if (!swipe || e.pointerId !== swipe.id) return;
    const dx = e.clientX - swipe.x0;
    if (!swipe.active && Math.abs(dx) > 8) {
      swipe.active = true;
      v = 0;
      els.root.setPointerCapture(e.pointerId);
    }
    if (!swipe.active) return;
    target = bandTrack(swipe.start - dx);
    swipe.samples.push({ t: performance.now(), p: target });
    if (swipe.samples.length > 12) swipe.samples.shift();
    run();
  }

  function onRootUp(e: PointerEvent) {
    if (!swipe || e.pointerId !== swipe.id) return;
    const active = swipe.active;
    const speed = velocity(swipe.samples);
    const projected = clamp(target + speed * THROW * 1.5, 0, max);
    swipe = null;
    if (active) {
      // The cards leave the finger at its speed, and the spring takes it from there.
      v = speed;
      // The click that follows a swipe is not a tap on a card.
      swiped = true;
      setTimeout(() => (swiped = false), 0);
      settleTo(nearest(projected));
    }
  }

  // A tap on a card opens it (components/project/ProjectView.tsx).
  function onTrackClick(e: MouseEvent) {
    const card = (e.target as Element).closest<HTMLElement>("[data-card]");
    if (!card) return;
    // A live product's card is a plain link to it (a new tab), unless the tap was a swipe.
    if (card.hasAttribute("data-external")) {
      if (swiped) e.preventDefault();
      return;
    }
    // ⌘/Ctrl/Shift-click or a middle click: the card is a real link, let it be one.
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    if (swiped) return;
    const image = card.querySelector<HTMLElement>(".card-media");
    if (!image) return;
    const i = Array.from(els.track.querySelectorAll("[data-card]")).indexOf(card);
    unlockSound();
    dispatchEvent(new CustomEvent("project:open", { detail: { index: i, image } }));
  }

  els.slider.addEventListener("pointerdown", onSliderDown);
  els.slider.addEventListener("pointermove", onSliderMove);
  els.slider.addEventListener("pointerup", onSliderUp);
  els.slider.addEventListener("pointercancel", onSliderUp);
  els.slider.addEventListener("keydown", onSliderKey);
  els.root.addEventListener("wheel", onWheel, { passive: false });
  els.root.addEventListener("pointerdown", onRootDown);
  els.root.addEventListener("pointermove", onRootMove);
  els.root.addEventListener("pointerup", onRootUp);
  els.root.addEventListener("pointercancel", onRootUp);
  els.track.addEventListener("click", onTrackClick);
  window.addEventListener("keydown", onKey);
  window.addEventListener("resize", layout);
  // Browsers only allow audio after a gesture: the first one anywhere unlocks it, so
  // the slider's first sound isn't lost to the context starting up.
  const unlock = () => unlockSound();
  for (const type of ["pointerdown", "keydown", "touchstart"]) window.addEventListener(type, unlock, { once: true, passive: true });
  layout();

  return () => {
    cancelAnimationFrame(frame);
    delete document.documentElement.dataset.sliding;
    clearTimeout(wheelTimer);
    els.slider.removeEventListener("pointerdown", onSliderDown);
    els.slider.removeEventListener("pointermove", onSliderMove);
    els.slider.removeEventListener("pointerup", onSliderUp);
    els.slider.removeEventListener("pointercancel", onSliderUp);
    els.slider.removeEventListener("keydown", onSliderKey);
    els.root.removeEventListener("wheel", onWheel);
    els.root.removeEventListener("pointerdown", onRootDown);
    els.root.removeEventListener("pointermove", onRootMove);
    els.root.removeEventListener("pointerup", onRootUp);
    els.root.removeEventListener("pointercancel", onRootUp);
    els.track.removeEventListener("click", onTrackClick);
    window.removeEventListener("keydown", onKey);
    window.removeEventListener("resize", layout);
    for (const type of ["pointerdown", "keydown", "touchstart"]) window.removeEventListener(type, unlock);
  };
}
