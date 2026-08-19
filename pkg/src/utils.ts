/**
 * Pure helpers — no React, no DOM. Exported for testing and reuse.
 */

export type SeparatorStyle = "space" | "comma" | "period" | "apostrophe";

export interface LocaleNumberInfo {
  /** The decimal separator character for the locale, e.g. "," for sv-SE. */
  decimal: string;
  /** The grouping separator character for the locale (informational). */
  group: string;
  /** The separator style the grouped font should render for this locale. */
  separatorStyle: SeparatorStyle;
  /** Value for CSS font-feature-settings that activates that style. */
  fontFeatureSettings: string;
}

// "calt" 1 is stated explicitly even though it's on by default: an explicit
// font-feature-settings survives UA feature juggling (e.g. under
// letter-spacing) where implicit defaults may not.
const STYLE_TO_FEATURE: Record<SeparatorStyle, string> = {
  space: '"calt" 1',
  comma: '"calt" 1, "ss01" 1',
  period: '"calt" 1, "ss02" 1',
  apostrophe: '"calt" 1, "ss03" 1',
};

export function featureSettingsFor(style: SeparatorStyle): string {
  return STYLE_TO_FEATURE[style];
}

/**
 * Derive decimal char and grouping style from a locale via Intl,
 * so the pair can never mismatch (a comma-grouping locale always has
 * a period decimal, and vice versa).
 */
export function getLocaleNumberInfo(locale: string): LocaleNumberInfo {
  const parts = new Intl.NumberFormat(locale).formatToParts(1234567.8);
  const group = parts.find((p) => p.type === "group")?.value ?? "\u00a0";
  const decimal = parts.find((p) => p.type === "decimal")?.value ?? ".";
  const separatorStyle: SeparatorStyle =
    group === ","
      ? "comma"
      : group === "."
        ? "period"
        : group === "\u2019" || group === "'"
          ? "apostrophe"
          : "space"; // NBSP, narrow NBSP, thin space …
  return {
    decimal,
    group,
    separatorStyle,
    fontFeatureSettings: featureSettingsFor(separatorStyle),
  };
}

/**
 * Sanitize pasted/dropped text into a plain digit string using the given
 * decimal character. Handles "1 234 567,89", "1,234,567.89", "1'234.5",
 * parenthesised negatives, unicode minus/spaces. Returns null if no
 * digits are found.
 *
 * Heuristics for a lone "." or ",":
 *  – matches the locale decimal → decimal
 *  – exactly three digits follow → thousand separator
 *  – otherwise → decimal
 * When both "." and "," occur, the last one is the decimal.
 */
export function cleanNumberString(
  text: string,
  decimal: string,
): string | null {
  if (typeof text !== "string") return null;
  let t = text.trim().replace(/[\s\u00a0\u202f\u2009'\u2019´`_]/g, "");
  if (!t) return null;
  const negative = t.includes("-") || t.includes("\u2212") || /^\(.*\)$/.test(text.trim());
  t = t.replace(/[()+\-\u2212]/g, "");

  const marks: Array<{ c: string; i: number }> = [];
  for (let i = 0; i < t.length; i++) {
    if (t[i] === "." || t[i] === "," || t[i] === "\u066b") marks.push({ c: t[i], i });
  }
  let decIndex = -1;
  const kinds = new Set(marks.map((m) => m.c));
  if (kinds.size >= 2) {
    decIndex = marks[marks.length - 1].i;
  } else if (marks.length === 1) {
    const m = marks[0];
    const digitsAfter = t.length - m.i - 1;
    if (m.c === decimal || m.c === "\u066b") decIndex = m.i;
    else if (digitsAfter === 3) decIndex = -1;
    else decIndex = m.i;
  }
  const digitsOf = (s: string) => [...s].filter((c) => /\d/.test(c)).join("");
  const intPart = digitsOf(decIndex === -1 ? t : t.slice(0, decIndex));
  const frac = decIndex === -1 ? null : digitsOf(t.slice(decIndex + 1));
  if (!intPart && !frac) return null;
  return (
    (negative ? "-" : "") + (intPart || "0") + (frac !== null ? decimal + frac : "")
  );
}

/** Parse a raw digit string (using the given decimal char) into a number. */
export function parseRaw(raw: string, decimal: string): number | null {
  if (!raw) return null;
  const n = parseFloat(raw.replace(decimal, "."));
  return Number.isFinite(n) ? n : null;
}
