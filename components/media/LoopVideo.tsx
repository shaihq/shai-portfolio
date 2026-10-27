"use client";

import { useEffect, useRef } from "react";
import { getImageProps } from "next/image";
import { VARIANTS } from "./variants";

/*
 * A silent looping video that autoplays everywhere: Chrome, Firefox, Safari on Mac,
 * and Safari and Chrome on iPhone and Android. What that takes:
 *
 *  - muted, autoplay, loop and playsinline written into the HTML itself. React does
 *    not reliably put `muted` in server-rendered markup, and iOS only autoplays a
 *    video that is muted when it is parsed, so the tag is written as raw HTML.
 *  - no controls, no picture-in-picture, no AirPlay button, and no audio track
 *    (the file itself is silent).
 *  - a poster, shown until the first frame plays (and instead of the video if the
 *    device refuses to play it, as iOS Low Power Mode does).
 *  - play() called again on mount, when it comes into view, when the tab returns and
 *    on the first touch or click anywhere, for the cases where the browser held it.
 *  - paused while off screen, to spare battery.
 *
 * And what keeps it light:
 *
 *  - nothing is downloaded until the video comes near the screen: the tag carries no
 *    source, only its poster, and the source is set as it approaches. A case study
 *    with a dozen videos loads the ones being read, not all of them at once.
 *  - a video can have smaller copies of the same picture in newer codecs: AV1
 *    (name.av1.mp4) where it can be played, else HEVC (name.hevc.mp4, Safari), else
 *    the H.264 original (name.mp4). variants.ts lists which copies exist: each was
 *    kept only if it scored VMAF 96 or more against the original and came out
 *    smaller.
 *  - the poster goes through Next's image optimizer, as AVIF or WebP.
 *
 * `startAt` begins the loop at a given second, to pick up where another copy of the
 * same video is (the project view takes over from the card this way).
 */

/** The smallest file this browser can play for a video (variants.ts lists the copies). */
function sourceFor(video: HTMLVideoElement, src: string) {
  const has = VARIANTS[src] ?? [];
  const base = src.replace(/\.mp4$/, "");
  if (has.includes("av1") && video.canPlayType('video/mp4; codecs="av01.0.08M.08"') === "probably") return `${base}.av1.mp4`;
  if (has.includes("hevc") && video.canPlayType('video/mp4; codecs="hvc1.1.6.L120.90"')) return `${base}.hevc.mp4`;
  return src;
}

const posterOf = (poster: string) => getImageProps({ src: poster, alt: "", width: 1920, height: 1200, quality: 85 }).props.src;

export default function LoopVideo({ src, poster, label, startAt, className }: { src: string; poster: string; label?: string; startAt?: number; className?: string }) {
  const host = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const video = host.current?.querySelector("video");
    if (!video) return;
    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;
    if (startAt) {
      const seek = () => {
        if (video.duration) video.currentTime = startAt % video.duration;
      };
      video.addEventListener("loadedmetadata", seek, { once: true });
    }

    let inView = false;
    const load = () => {
      if (video.getAttribute("src")) return;
      video.src = sourceFor(video, src);
      video.load();
    };
    const play = () => {
      if (!inView || document.hidden) return;
      load();
      const p = video.play();
      p?.catch(() => {});
    };
    // Fetch a little ahead of the screen, so it is playing by the time it is seen.
    const near = new IntersectionObserver(([entry]) => entry?.isIntersecting && load(), { rootMargin: "600px" });
    const io = new IntersectionObserver(
      ([entry]) => {
        inView = !!entry?.isIntersecting;
        if (inView) play();
        else video.pause();
      },
      { rootMargin: "200px" },
    );
    near.observe(video);
    io.observe(video);
    const onVisible = () => (document.hidden ? video.pause() : play());
    document.addEventListener("visibilitychange", onVisible);
    const kick = () => play();
    for (const type of ["touchstart", "pointerdown", "keydown"]) addEventListener(type, kick, { once: true, passive: true });

    return () => {
      near.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVisible);
      for (const type of ["touchstart", "pointerdown", "keydown"]) removeEventListener(type, kick);
    };
  }, [src, startAt]);

  const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  const html =
    `<video poster="${esc(posterOf(poster))}" muted autoplay loop playsinline webkit-playsinline ` +
    `preload="none" disablepictureinpicture disableremoteplayback x-webkit-airplay="deny" ` +
    `${label ? `aria-label="${esc(label)}"` : 'aria-hidden="true"'}></video>`;

  return <span ref={host} className={className ? `loop-video ${className}` : "loop-video"} dangerouslySetInnerHTML={{ __html: html }} />;
}
