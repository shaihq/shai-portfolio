/*
 * The slider's sound, synthesised with Web Audio (no files). A real fader is heard
 * as several things at once, and each is modelled on its own:
 *
 *   friction  a continuous rub while the knob slides: pink noise through a band that
 *             opens with speed, its level following speed, roughened by a slow random
 *             wobble so it sounds like a surface rather than a hiss
 *   grit      faint high specks from the surface texture as the knob travels
 *   detent    a notch catching: a dry, unpitched snap (a few milliseconds of filtered
 *             noise, no ringing), a short muffled knock from the part behind it, a
 *             fainter second snap as it settles, and a touch of mass. Each one varies
 *             a little, and arriving faster makes it firmer and brighter.
 *   bump      the knob meeting the end of the well: a dull, heavy knock
 *   grab      a soft tock when the knob is taken, a lighter one when it is let go
 *
 * Everything is placed in stereo where the knob is, and passes through a short body
 * resonance (a tiny synthetic impulse response) so it sounds like it comes from an
 * object. Browsers only allow audio after a click, tap or key, so unlockSound() is
 * called from those; until then every sound is skipped.
 */

let ctx: AudioContext | null = null;
/** Set once a gesture has asked the context to start; sounds scheduled before it is
 *  running are queued by the context and play the moment it starts. */
let unlocked = false;
let master: GainNode | null = null;
let body: ConvolverNode | null = null;
let white: AudioBuffer | null = null;
let friction: { level: GainNode; band: BiquadFilterNode; pan: StereoPannerNode } | null = null;

const rand = (spread: number) => 1 + (Math.random() * 2 - 1) * spread;

function pinkNoise(c: AudioContext, seconds: number) {
  const buffer = c.createBuffer(1, Math.floor(c.sampleRate * seconds), c.sampleRate);
  const data = buffer.getChannelData(0);
  // Paul Kellet's pink filter: noise with less fizz, like a real surface.
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < data.length; i++) {
    const w = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + w * 0.0555179;
    b1 = 0.99332 * b1 + w * 0.0750759;
    b2 = 0.969 * b2 + w * 0.153852;
    b3 = 0.8665 * b3 + w * 0.3104856;
    b4 = 0.55 * b4 + w * 0.5329522;
    b5 = -0.7616 * b5 - w * 0.016898;
    data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
    b6 = w * 0.115926;
  }
  return buffer;
}

/** A short decaying "body": what makes a click sound like it came from an object. */
function bodyResponse(c: AudioContext) {
  const length = Math.floor(c.sampleRate * 0.09);
  const buffer = c.createBuffer(2, length, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buffer.getChannelData(ch);
    let low = 0;
    for (let i = 0; i < length; i++) {
      low += 0.35 * (Math.random() * 2 - 1 - low);
      data[i] = low * Math.pow(1 - i / length, 4);
    }
  }
  return buffer;
}

export function unlockSound() {
  if (typeof window === "undefined") return;
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const c = new AC();
    ctx = c;

    master = c.createGain();
    master.gain.value = 1.3;
    const limiter = c.createDynamicsCompressor();
    limiter.threshold.value = -10;
    master.connect(limiter).connect(c.destination);

    body = c.createConvolver();
    body.buffer = bodyResponse(c);
    const wet = c.createGain();
    wet.gain.value = 0.16;
    body.connect(wet).connect(master);

    white = c.createBuffer(1, Math.floor(c.sampleRate * 0.05), c.sampleRate);
    const w = white.getChannelData(0);
    for (let i = 0; i < w.length; i++) w[i] = Math.random() * 2 - 1;

    // Friction runs all the time at zero level; speed opens it.
    const source = c.createBufferSource();
    source.buffer = pinkNoise(c, 2.5);
    source.loop = true;
    const band = c.createBiquadFilter();
    band.type = "bandpass";
    band.frequency.value = 900;
    band.Q.value = 0.8;
    const level = c.createGain();
    level.gain.value = 0;
    const rough = c.createGain();
    rough.gain.value = 1;
    const wobble = c.createBufferSource();
    wobble.buffer = pinkNoise(c, 1.7);
    wobble.loop = true;
    wobble.playbackRate.value = 0.03;
    const wobbleDepth = c.createGain();
    wobbleDepth.gain.value = 2.2;
    wobble.connect(wobbleDepth).connect(rough.gain);
    const pan = c.createStereoPanner();
    source.connect(band).connect(level).connect(rough).connect(pan).connect(master);
    source.start();
    wobble.start();
    friction = { level, band, pan };
  }
  unlocked = true;
  if (ctx.state === "suspended") void ctx.resume();
}

const ready = () => (ctx && unlocked && master && body && white && ctx.state !== "closed" ? ctx : null);

/** An output for one sound: placed at `pan`, dry and into the body resonance. */
function voice(c: AudioContext, pan: number) {
  const out = c.createStereoPanner();
  out.pan.value = Math.max(-1, Math.min(1, pan));
  out.connect(master!);
  out.connect(body!);
  return out;
}

/**
 * A noise hit: a burst that is already dying as it starts. Shaped by a high-pass and
 * low-pass (a dry snap) or one wide band (a muffled knock); never a narrow resonance,
 * which is what makes synthetic clicks sound like pings.
 */
function hit(
  c: AudioContext,
  at: number,
  output: AudioNode,
  { gain, decay, hp, lp, band, q = 1.5 }: { gain: number; decay: number; hp?: number; lp?: number; band?: number; q?: number },
) {
  const src = c.createBufferSource();
  src.buffer = white;
  src.playbackRate.value = rand(0.1);
  let node: AudioNode = src;
  const filter = (type: BiquadFilterType, freq: number, Q: number) => {
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = Q;
    node.connect(f);
    node = f;
  };
  if (band) filter("bandpass", band, q);
  if (hp) filter("highpass", hp, 0.7);
  if (lp) filter("lowpass", lp, 0.7);
  const env = c.createGain();
  env.gain.setValueAtTime(0.0001, at);
  env.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), at + 0.0003);
  env.gain.exponentialRampToValueAtTime(0.0001, at + decay);
  node.connect(env).connect(output);
  src.start(at);
  src.stop(at + decay + 0.02);
}

/** A falling sine: mass landing, felt more than heard. */
function thud(c: AudioContext, at: number, output: AudioNode, from: number, to: number, gain: number, decay: number) {
  const osc = c.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(from, at);
  osc.frequency.exponentialRampToValueAtTime(to, at + decay);
  const env = c.createGain();
  env.gain.setValueAtTime(0.0001, at);
  env.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), at + 0.003);
  env.gain.exponentialRampToValueAtTime(0.0001, at + decay);
  osc.connect(env).connect(output);
  osc.start(at);
  osc.stop(at + decay + 0.02);
}

/**
 * The rub of the knob in its well. speed in px/s along the rail; call every frame
 * the knob moves and with 0 when it stops.
 */
export function setSlide(speed: number, pan = 0) {
  const c = ready();
  if (!c || !friction) return;
  const s = Math.min(1, speed / 1400);
  const t = c.currentTime;
  friction.level.gain.setTargetAtTime(s > 0.01 ? 0.26 * Math.pow(s, 0.55) : 0, t, s > 0.01 ? 0.025 : 0.05);
  friction.band.frequency.setTargetAtTime(500 + 2100 * s, t, 0.04);
  friction.pan.pan.setTargetAtTime(Math.max(-1, Math.min(1, pan)) * 0.6, t, 0.05);
}

/** Faint specks from the surface as the knob travels. strength 0–1 from speed. */
export function playGrit(strength: number, pan = 0) {
  const c = ready();
  if (!c) return;
  const t = c.currentTime;
  const out = voice(c, pan * 0.6);
  hit(c, t, out, { gain: 0.04 + 0.08 * strength, decay: 0.003, band: 4200 * rand(0.15), q: 1.8 });
}

/** A notch catching. strength 0–1 from how fast the knob arrived. */
export function playDetent(strength = 0.5, pan = 0) {
  const c = ready();
  if (!c) return;
  const t = c.currentTime;
  const out = voice(c, pan * 0.6);
  const s = 0.5 + 0.5 * Math.min(1, strength);
  const bright = (3400 + 2400 * s) * rand(0.06);
  // The snap: dry and broadband, gone in under 10 ms.
  hit(c, t, out, { gain: 0.6 * s, decay: 0.008, hp: 1100 * rand(0.08), lp: bright });
  // The part behind it: a short, muffled knock.
  hit(c, t, out, { gain: 0.32 * s, decay: 0.02, band: 640 * rand(0.08), q: 2 });
  // Settling into the notch a few milliseconds later, fainter.
  hit(c, t + 0.006 + Math.random() * 0.004, out, { gain: 0.16 * s, decay: 0.005, hp: 1700, lp: bright });
  // A touch of the knob's mass.
  thud(c, t, out, 120 * rand(0.06), 62, 0.09 * s, 0.035);
}

/** The knob meeting the end of the well: dull and heavy. */
export function playBump(strength = 0.6, pan = 0) {
  const c = ready();
  if (!c) return;
  const t = c.currentTime;
  const out = voice(c, pan * 0.6);
  const s = 0.5 + 0.5 * Math.min(1, strength);
  hit(c, t, out, { gain: 0.5 * s, decay: 0.045, band: 360 * rand(0.06), q: 1.3 });
  hit(c, t, out, { gain: 0.22 * s, decay: 0.012, hp: 600, lp: 2400 });
  thud(c, t, out, 95, 40, 0.26 * s, 0.1);
}

/** A soft tock as the knob is taken (down) or let go (up). */
export function playGrab(down: boolean, pan = 0) {
  const c = ready();
  if (!c) return;
  const t = c.currentTime;
  const out = voice(c, pan * 0.6);
  const g = down ? 1 : 0.65;
  hit(c, t, out, { gain: 0.32 * g, decay: 0.012, band: 1500 * rand(0.06), q: 1.6 });
  thud(c, t, out, down ? 210 : 250, 120, 0.15 * g, 0.035);
}

/*
 * The contact key and its panel (Contact.tsx), from the same parts.
 *
 *   latch   the key opening: a lever snapping free, a small spring tick, then the
 *           body landing (a muffled knock with a little mass): "ka-chunk". Shutting
 *           runs the other way: pressed down first, then the catch clicking home.
 *   select  a row pressed: a crisp key click and its knock; a lighter one let go.
 *   tick    the highlight arriving on a row: barely there, and never faster than a
 *           tick every 45 ms, so a quick sweep across the rows doesn't rattle.
 */
export function playLatch(open: boolean) {
  const c = ready();
  if (!c) return;
  const t = c.currentTime;
  const out = voice(c, -0.35);
  if (open) {
    hit(c, t, out, { gain: 0.5, decay: 0.006, hp: 2000 * rand(0.06), lp: 7200 });
    hit(c, t + 0.011, out, { gain: 0.14, decay: 0.008, band: 3300 * rand(0.06), q: 2.4 });
    hit(c, t + 0.046, out, { gain: 0.42, decay: 0.03, band: 520 * rand(0.06), q: 1.4 });
    hit(c, t + 0.048, out, { gain: 0.12, decay: 0.004, hp: 1500, lp: 5200 });
    thud(c, t + 0.046, out, 140 * rand(0.05), 68, 0.16, 0.05);
  } else {
    hit(c, t, out, { gain: 0.32, decay: 0.022, band: 600 * rand(0.06), q: 1.5 });
    thud(c, t, out, 165 * rand(0.05), 92, 0.12, 0.035);
    hit(c, t + 0.034, out, { gain: 0.42, decay: 0.005, hp: 2200 * rand(0.06), lp: 7600 });
    hit(c, t + 0.041, out, { gain: 0.1, decay: 0.004, hp: 2600, lp: 7000 });
  }
}

export function playSelect(down: boolean) {
  const c = ready();
  if (!c) return;
  const t = c.currentTime;
  const out = voice(c, -0.3);
  const g = down ? 1 : 0.55;
  hit(c, t, out, { gain: 0.42 * g, decay: 0.005, hp: 1800 * rand(0.06), lp: 6800 });
  hit(c, t, out, { gain: 0.2 * g, decay: 0.014, band: 900 * rand(0.06), q: 1.8 });
  thud(c, t, out, down ? 185 : 215, 115, 0.08 * g, 0.03);
}

let lastTick = 0;
export function playTick() {
  const c = ready();
  if (!c) return;
  const now = performance.now();
  if (now - lastTick < 45) return;
  lastTick = now;
  const out = voice(c, -0.3);
  hit(c, c.currentTime, out, { gain: 0.06, decay: 0.003, band: 5200 * rand(0.08), q: 2 });
}

export function buzz(ms: number) {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(ms);
}
