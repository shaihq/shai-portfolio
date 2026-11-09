/*
 * The loaders picture the page (modern-screenshot) to put it on the computer's screen
 * and zoom into it. That picture is the page drawn again through an SVG
 * foreignObject, and Safari (every iOS browser) draws an outer box-shadow there wrong
 * on anything rounded: as a square block, offset by the shadow (the slider's knob
 * got a dark slab beside it, the well's lit edge square corners). Inner shadows draw
 * correctly.
 *
 * So, in Safari only, the picture's copy of the page keeps each element's inner
 * shadows and drops its outer ones. The page itself is untouched: once the loader
 * fades, the real page, outer shadows and all, is what remains.
 */

const SAFARI = typeof navigator !== "undefined" && /AppleWebKit/.test(navigator.userAgent) && !/(Chrome|Chromium|Edg)\//.test(navigator.userAgent);

/** A computed box-shadow list split into its shadows (commas inside rgba() don't count). */
function shadows(list: string) {
  const out: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < list.length; i++) {
    if (list[i] === "(") depth++;
    else if (list[i] === ")") depth--;
    else if (list[i] === "," && depth === 0) {
      out.push(list.slice(start, i).trim());
      start = i + 1;
    }
  }
  out.push(list.slice(start).trim());
  return out;
}

/** For modern-screenshot's `onCloneNode`: in Safari, the copy's outer shadows go. */
export function onSnapshotClone(clone: Node) {
  if (!SAFARI || !(clone instanceof Element)) return;
  const seen = new Map<string, string | null>();
  for (const el of [clone, ...Array.from(clone.querySelectorAll("*"))]) {
    if (!(el instanceof HTMLElement)) continue;
    // The copy keeps the page's classes (plus its own for pseudo-elements, which start
    // with underscores): read the shadow off the page's own element.
    const classes = Array.from(el.classList).filter((c) => !c.startsWith("__"));
    if (!classes.length) continue;
    const key = classes.map((c) => `.${CSS.escape(c)}`).join("");
    if (!seen.has(key)) {
      const live = document.querySelector(key);
      const list = live ? getComputedStyle(live).boxShadow : "none";
      const kept = list === "none" ? [] : shadows(list);
      const inner = kept.filter((s) => /\binset\b/.test(s));
      seen.set(key, kept.length && inner.length !== kept.length ? inner.join(", ") || "none" : null);
    }
    const value = seen.get(key);
    if (value) el.style.setProperty("box-shadow", value, "important");
  }
}
