// src/GroupedNumberInput.tsx
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState
} from "react";

// src/domUtils.ts
function forceReshape(el) {
  const style = el.style;
  const prev = style.fontVariantLigatures;
  style.fontVariantLigatures = "none";
  void el.offsetWidth;
  style.fontVariantLigatures = prev || "contextual";
}

// src/utils.ts
var STYLE_TO_FEATURE = {
  space: '"calt" 1',
  comma: '"calt" 1, "ss01" 1',
  period: '"calt" 1, "ss02" 1',
  apostrophe: '"calt" 1, "ss03" 1'
};
function featureSettingsFor(style) {
  return STYLE_TO_FEATURE[style];
}
function getLocaleNumberInfo(locale) {
  const parts = new Intl.NumberFormat(locale).formatToParts(12345678e-1);
  const group = parts.find((p) => p.type === "group")?.value ?? "\xA0";
  const decimal = parts.find((p) => p.type === "decimal")?.value ?? ".";
  const separatorStyle = group === "," ? "comma" : group === "." ? "period" : group === "\u2019" || group === "'" ? "apostrophe" : "space";
  return {
    decimal,
    group,
    separatorStyle,
    fontFeatureSettings: featureSettingsFor(separatorStyle)
  };
}
function cleanNumberString(text, decimal) {
  if (typeof text !== "string") return null;
  let t = text.trim().replace(/[\s\u00a0\u202f\u2009'\u2019´`_]/g, "");
  if (!t) return null;
  const negative = t.includes("-") || t.includes("\u2212") || /^\(.*\)$/.test(text.trim());
  t = t.replace(/[()+\-\u2212]/g, "");
  const marks = [];
  for (let i = 0; i < t.length; i++) {
    if (t[i] === "." || t[i] === "," || t[i] === "\u066B") marks.push({ c: t[i], i });
  }
  let decIndex = -1;
  const kinds = new Set(marks.map((m) => m.c));
  if (kinds.size >= 2) {
    decIndex = marks[marks.length - 1].i;
  } else if (marks.length === 1) {
    const m = marks[0];
    const digitsAfter = t.length - m.i - 1;
    if (m.c === decimal || m.c === "\u066B") decIndex = m.i;
    else if (digitsAfter === 3) decIndex = -1;
    else decIndex = m.i;
  }
  const digitsOf = (s) => [...s].filter((c) => /\d/.test(c)).join("");
  const intPart = digitsOf(decIndex === -1 ? t : t.slice(0, decIndex));
  const frac = decIndex === -1 ? null : digitsOf(t.slice(decIndex + 1));
  if (!intPart && !frac) return null;
  return (negative ? "-" : "") + (intPart || "0") + (frac !== null ? decimal + frac : "");
}
function parseRaw(raw, decimal) {
  if (!raw) return null;
  const n = parseFloat(raw.replace(decimal, "."));
  return Number.isFinite(n) ? n : null;
}
function numberToPlain(n) {
  if (!Number.isFinite(n)) return "";
  const s = String(n);
  return /e/i.test(s) ? n.toLocaleString("en-US", { useGrouping: false, maximumFractionDigits: 20 }) : s;
}
function toRaw(value, decimal) {
  if (value == null) return "";
  const plain = typeof value === "number" ? numberToPlain(value) : value;
  return plain.replace(".", decimal);
}
function rawShowsValue(raw, value, decimal) {
  if (typeof value === "string") return raw === toRaw(value, decimal);
  const expected = value !== null && Number.isFinite(value) ? value : null;
  return parseRaw(raw, decimal) === expected;
}

// src/GroupedNumberInput.tsx
import { jsx } from "react/jsx-runtime";
var useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;
function insertText(el, text) {
  el.focus();
  if (!document.execCommand?.("insertText", false, text)) {
    const s = el.selectionStart ?? el.value.length;
    const e = el.selectionEnd ?? el.value.length;
    el.setRangeText(text, s, e, "end");
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }
}
var GroupedNumberInput = forwardRef(function GroupedNumberInput2({
  locale,
  separatorStyle,
  value,
  defaultValue = "",
  onValueChange,
  maxDecimals = null,
  allowNegative = true,
  fontFamily = "'Roboto Grouped', system-ui, sans-serif",
  style,
  ...rest
}, ref) {
  const info = useMemo(
    () => getLocaleNumberInfo(locale ?? (typeof navigator !== "undefined" ? navigator.language : "en-US")),
    [locale]
  );
  const decimal = info.decimal;
  const featureSettings = separatorStyle ? featureSettingsFor(separatorStyle) : info.fontFeatureSettings;
  if (typeof process !== "undefined" && process.env?.NODE_ENV !== "production") {
    const ls = style?.letterSpacing;
    if (ls !== void 0 && ls !== "normal") {
      console.warn(
        "[GroupedNumberInput] letter-spacing breaks digit grouping in some browsers \u2014 remove it from this input."
      );
    }
  }
  const pattern = useMemo(() => {
    const d = decimal === "." ? "\\." : decimal;
    const frac = maxDecimals == null ? `(?:${d}\\d*)?` : maxDecimals === 0 ? "" : `(?:${d}\\d{0,${maxDecimals}})?`;
    return new RegExp(`^${allowNegative ? "-?" : ""}\\d*${frac}$`);
  }, [decimal, maxDecimals, allowNegative]);
  const isControlled = value !== void 0;
  const [raw, setRaw] = useState(() => toRaw(value, decimal));
  if (isControlled && !rawShowsValue(raw, value, decimal)) {
    setRaw(toRaw(value, decimal));
  }
  const innerRef = useRef(null);
  useImperativeHandle(ref, () => innerRef.current, []);
  useIsomorphicLayoutEffect(() => {
    if (innerRef.current) forceReshape(innerRef.current);
  });
  const emit = useCallback(
    (el) => {
      onValueChange?.({ raw: el.value, floatValue: parseRaw(el.value, decimal) });
    },
    [onValueChange, decimal]
  );
  const tryInsert = useCallback(
    (el, text) => {
      const s = el.selectionStart ?? el.value.length;
      const e = el.selectionEnd ?? el.value.length;
      const cand = el.value.slice(0, s) + text + el.value.slice(e);
      if (pattern.test(cand)) insertText(el, text);
    },
    [pattern]
  );
  const handleBeforeInput = useCallback(
    (e) => {
      const native = e.nativeEvent;
      const type = native.inputType ?? "insertText";
      if (!type.startsWith("insert")) return;
      const el = e.currentTarget;
      let data = e.data ?? native.data ?? "";
      e.preventDefault();
      if (type === "insertFromPaste" || type === "insertFromDrop" || data.length > 1) {
        const cleaned = cleanNumberString(data, decimal);
        if (cleaned != null) tryInsert(el, cleaned);
        return;
      }
      if (data === "." || data === "," || data === "\u066B") data = decimal;
      if (data === "\u2212") data = "-";
      tryInsert(el, data);
    },
    [decimal, tryInsert]
  );
  const handlePaste = useCallback(
    (e) => {
      e.preventDefault();
      const cleaned = cleanNumberString(
        e.clipboardData?.getData("text/plain") ?? "",
        decimal
      );
      if (cleaned != null) tryInsert(e.currentTarget, cleaned);
    },
    [decimal, tryInsert]
  );
  const handleChange = useCallback(
    (e) => {
      if (isControlled) setRaw(e.currentTarget.value);
      else forceReshape(e.currentTarget);
      emit(e.currentTarget);
    },
    [emit, isControlled]
  );
  return /* @__PURE__ */ jsx(
    "input",
    {
      ...rest,
      ref: innerRef,
      type: "text",
      inputMode: "decimal",
      autoComplete: "off",
      spellCheck: false,
      ...isControlled ? { value: raw } : { defaultValue: toRaw(defaultValue, decimal) },
      onBeforeInput: handleBeforeInput,
      onPaste: handlePaste,
      onChange: handleChange,
      style: {
        fontFamily,
        fontFeatureSettings: featureSettings,
        fontVariantLigatures: "contextual",
        ...style
      }
    }
  );
});
export {
  GroupedNumberInput,
  cleanNumberString,
  featureSettingsFor,
  forceReshape,
  getLocaleNumberInfo,
  parseRaw
};
//# sourceMappingURL=index.js.map