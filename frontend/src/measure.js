/** Text measurement against the real fonts, so columns can be sized exactly. */

const canvas = document.createElement("canvas").getContext("2d");
const cache = new Map();

/**
 * Width of `text` in px. `spacing` adds the CSS letter-spacing that
 * canvas measurement ignores.
 */
export function textWidth(text, font, spacing = 0) {
  if (!text) return 0;
  const key = `${font}|${spacing}|${text}`;
  let width = cache.get(key);
  if (width === undefined) {
    canvas.font = font;
    width = canvas.measureText(text).width + spacing * text.length;
    cache.set(key, width);
  }
  return width;
}

/** Cleared when the web fonts finish loading, since metrics change then. */
export function clearMeasureCache() {
  cache.clear();
}
