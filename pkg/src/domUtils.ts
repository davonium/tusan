/**
 * Workaround for a Blink (Chromium) re-shaping bug: when an input goes
 * from empty to non-empty (and sometimes after programmatic value
 * changes), Blink can skip re-running OpenType shaping, so calt-based
 * digit grouping does not render until the next style change.
 *
 * Fix: toggle ligatures off, force a synchronous reflow so the change
 * is committed, then toggle them back on.
 */
export function forceReshape(el: HTMLElement): void {
  const style = el.style;
  const prev = style.fontVariantLigatures;
  style.fontVariantLigatures = "none";
  void el.offsetWidth; // force reflow — this is what makes Blink commit
  style.fontVariantLigatures = prev || "contextual";
}

