/*
 * The intro is laid out at the slider's width (globals.css, .intro), so its edges line
 * up with the slider below. This used to narrow it to its longest line of monospace
 * text; with proportional type the edges should match the slider instead, so it now
 * only clears any width a previous version set. Still called before the intro is
 * pictured for the loader, so the landing matches the page.
 */
export function fitIntro() {
  document.querySelector<HTMLElement>(".intro")?.style.removeProperty("width");
}
