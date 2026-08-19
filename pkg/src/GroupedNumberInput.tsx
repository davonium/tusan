import React, {
  forwardRef,
  type CSSProperties,
  useCallback,
  useMemo,
  type InputHTMLAttributes,
} from "react";
import { forceReshape } from "./domUtils";
import {
  cleanNumberString,
  featureSettingsFor,
  getLocaleNumberInfo,
  parseRaw,
  type SeparatorStyle,
} from "./utils";

export interface GroupedNumberInputValue {
  /** The exact input string, e.g. "1234567,89". Persist this for >15 digits. */
  raw: string;
  /** Parsed number, or null when empty/incomplete. Loses precision >2^53. */
  floatValue: number | null;
}

export interface GroupedNumberInputProps
  extends Omit<
    InputHTMLAttributes<HTMLInputElement>,
    "type" | "inputMode" | "onChange" | "value" | "defaultValue"
  > {
  /**
   * BCP 47 locale. Decides the decimal character AND the separator style
   * rendered by the font, derived from the same Intl call so the pair can
   * never mismatch. Default: the browser's locale.
   */
  locale?: string;
  /** Override the font-rendered separator style (normally derived from locale). */
  separatorStyle?: SeparatorStyle;
  defaultValue?: string | number;
  /** Called on every change with the raw string and parsed number. */
  onValueChange?: (value: GroupedNumberInputValue) => void;
  /** Maximum number of decimal digits. null/undefined = unlimited. */
  maxDecimals?: number | null;
  allowNegative?: boolean;
  /**
   * Font stack. The first entry should be a grouped-digits font (import
   * "grouped-number-input/roboto.css" for a ready-made one); later entries
   * render everything the digit-only font doesn't cover.
   */
  fontFamily?: string;
}

/** Insert text at the caret, preserving the browser's native undo stack. */
function insertText(el: HTMLInputElement, text: string) {
  el.focus();
  // execCommand is deprecated but still the only way to keep undo intact.
  if (!document.execCommand?.("insertText", false, text)) {
    const s = el.selectionStart ?? el.value.length;
    const e = el.selectionEnd ?? el.value.length;
    el.setRangeText(text, s, e, "end");
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }
}

export const GroupedNumberInput = forwardRef<
  HTMLInputElement,
  GroupedNumberInputProps
>(function GroupedNumberInput(
  {
    locale,
    separatorStyle,
    defaultValue = "",
    onValueChange,
    maxDecimals = null,
    allowNegative = true,
    fontFamily = "'Roboto Grouped', system-ui, sans-serif",
    style,
    ...rest
  },
  ref,
) {
  const info = useMemo(
    () => getLocaleNumberInfo(locale ?? (typeof navigator !== "undefined" ? navigator.language : "en-US")),
    [locale],
  );
  const decimal = info.decimal;
  const featureSettings = separatorStyle
    ? featureSettingsFor(separatorStyle)
    : info.fontFeatureSettings;

  if (typeof process !== "undefined" && process.env?.NODE_ENV !== "production") {
    const ls = (style as CSSProperties | undefined)?.letterSpacing;
    if (ls !== undefined && ls !== "normal") {
      // eslint-disable-next-line no-console
      console.warn(
        "[GroupedNumberInput] letter-spacing breaks digit grouping in some browsers — remove it from this input.",
      );
    }
  }

  const pattern = useMemo(() => {
    const d = decimal === "." ? "\\." : decimal;
    const frac =
      maxDecimals == null
        ? `(?:${d}\\d*)?`
        : maxDecimals === 0
          ? ""
          : `(?:${d}\\d{0,${maxDecimals}})?`;
    return new RegExp(`^${allowNegative ? "-?" : ""}\\d*${frac}$`);
  }, [decimal, maxDecimals, allowNegative]);

  const emit = useCallback(
    (el: HTMLInputElement) => {
      onValueChange?.({ raw: el.value, floatValue: parseRaw(el.value, decimal) });
    },
    [onValueChange, decimal],
  );

  const tryInsert = useCallback(
    (el: HTMLInputElement, text: string) => {
      const s = el.selectionStart ?? el.value.length;
      const e = el.selectionEnd ?? el.value.length;
      const cand = el.value.slice(0, s) + text + el.value.slice(e);
      if (pattern.test(cand)) insertText(el, text);
    },
    [pattern],
  );

  const handleBeforeInput = useCallback(
    (e: React.FormEvent<HTMLInputElement>) => {
      const native = e.nativeEvent as InputEvent;
      const type = native.inputType ?? "insertText";
      if (!type.startsWith("insert")) return; // deletions etc: always fine
      const el = e.currentTarget;
      let data = native.data ?? "";
      e.preventDefault();
      if (type === "insertFromPaste" || type === "insertFromDrop" || data.length > 1) {
        const cleaned = cleanNumberString(data, decimal);
        if (cleaned != null) tryInsert(el, cleaned);
        return;
      }
      if (data === "." || data === "," || data === "\u066b") data = decimal;
      if (data === "\u2212") data = "-";
      tryInsert(el, data);
    },
    [decimal, tryInsert],
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLInputElement>) => {
      e.preventDefault();
      const cleaned = cleanNumberString(
        e.clipboardData?.getData("text/plain") ?? "",
        decimal,
      );
      if (cleaned != null) tryInsert(e.currentTarget, cleaned);
    },
    [decimal, tryInsert],
  );

  // Blink kan hoppa över om-shaping när värdet går från "ingen
  // gruppering behövs" till "gruppering behövs" (t.ex. tomt -> ifyllt
  // eller 3 -> 4 siffror). Övergångarna är svåra att räkna upp
  // uttömmande, så vi nudgar på varje input: en synkron reflow per
  // tangenttryck är försumbar och kan aldrig missa ett fall.
  const handleInput = useCallback(
    (e: React.FormEvent<HTMLInputElement>) => {
      const el = e.currentTarget;
      forceReshape(el);
      emit(el);
    },
    [emit],
  );

  return (
    <input
      {...rest}
      ref={ref}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      spellCheck={false}
      defaultValue={String(defaultValue).replace(".", decimal)}
      onBeforeInput={handleBeforeInput}
      onPaste={handlePaste}
      onInput={handleInput}
      style={{
        fontFamily,
        fontFeatureSettings: featureSettings,
        fontVariantLigatures: "contextual",
        ...style,
      }}
    />
  );
});
