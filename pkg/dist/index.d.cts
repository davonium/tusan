import React, { InputHTMLAttributes } from 'react';

/**
 * Pure helpers — no React, no DOM. Exported for testing and reuse.
 */
type SeparatorStyle = "space" | "comma" | "period" | "apostrophe";
interface LocaleNumberInfo {
    /** The decimal separator character for the locale, e.g. "," for sv-SE. */
    decimal: string;
    /** The grouping separator character for the locale (informational). */
    group: string;
    /** The separator style the grouped font should render for this locale. */
    separatorStyle: SeparatorStyle;
    /** Value for CSS font-feature-settings that activates that style. */
    fontFeatureSettings: string;
}
declare function featureSettingsFor(style: SeparatorStyle): string;
/**
 * Derive decimal char and grouping style from a locale via Intl,
 * so the pair can never mismatch (a comma-grouping locale always has
 * a period decimal, and vice versa).
 */
declare function getLocaleNumberInfo(locale: string): LocaleNumberInfo;
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
declare function cleanNumberString(text: string, decimal: string): string | null;
/** Parse a raw digit string (using the given decimal char) into a number. */
declare function parseRaw(raw: string, decimal: string): number | null;

interface GroupedNumberInputValue {
    /** The exact input string, e.g. "1234567,89". Persist this for >15 digits. */
    raw: string;
    /** Parsed number, or null when empty/incomplete. Loses precision >2^53. */
    floatValue: number | null;
}
interface GroupedNumberInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "inputMode" | "onChange" | "value" | "defaultValue"> {
    /**
     * BCP 47 locale. Decides the decimal character AND the separator style
     * rendered by the font, derived from the same Intl call so the pair can
     * never mismatch. Default: the browser's locale.
     */
    locale?: string;
    /** Override the font-rendered separator style (normally derived from locale). */
    separatorStyle?: SeparatorStyle;
    /**
     * Makes the field controlled. "." in a number or string is shown as the
     * locale's decimal char. A number only has to match what is typed
     * numerically, so "12," survives a parent that stores 12; a string has to
     * match exactly. `null` clears the field. Leave undefined for an
     * uncontrolled field. The parent has to update in `onValueChange` itself:
     * a value applied later snaps the field back in between.
     */
    value?: string | number | null;
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
declare const GroupedNumberInput: React.ForwardRefExoticComponent<GroupedNumberInputProps & React.RefAttributes<HTMLInputElement>>;

/**
 * Workaround for a Blink (Chromium) re-shaping bug: when an input goes
 * from empty to non-empty (and sometimes after programmatic value
 * changes), Blink can skip re-running OpenType shaping, so calt-based
 * digit grouping does not render until the next style change.
 *
 * Fix: toggle ligatures off, force a synchronous reflow so the change
 * is committed, then toggle them back on.
 */
declare function forceReshape(el: HTMLElement): void;

export { GroupedNumberInput, type GroupedNumberInputProps, type GroupedNumberInputValue, type LocaleNumberInfo, type SeparatorStyle, cleanNumberString, featureSettingsFor, forceReshape, getLocaleNumberInfo, parseRaw };
