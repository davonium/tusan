# Tusan!

> *Tusan!* — Swedish for "damn it!", literally an old form of "thousand".
> It's both what this library handles and what you'll say if you try to do it in JavaScript.

React number input where thousand separators are **rendered by the font,
not the string**. `input.value` is always a plain digit string — caret,
selection, copy and undo are 100% native, because there is no separator
character to fight with.

The trick: a 5 kB font patched with an OpenType `calt` rule that gives
every third digit (counted from the end of the integer part) a variant
glyph with the separator baked into its advance width.

## Install

```
npm install tusan
```

## Use

```tsx
import { GroupedNumberInput } from "tusan";
import "tusan/roboto.css"; // 'Roboto Grouped' @font-face

<GroupedNumberInput
  locale="sv-SE"          // decimal char + separator style from one Intl call
  defaultValue={1234567.89}
  maxDecimals={2}
  onValueChange={({ raw, floatValue }) => save(raw, floatValue)}
/>
```

Controlled, with the parent owning the number:

```tsx
<GroupedNumberInput
  locale="sv-SE"
  value={price}
  onValueChange={({ floatValue }) => setPrice(floatValue)}
/>
```

Renders `1 234 567,89` for sv-SE, `1,234,567.89` for en-US,
`1'234'567.89` for de-CH — while the value stays `1234567,89` /
`1234567.89`. If the font fails to load you see ungrouped digits;
never broken data.

### Bring your own font

The component is font-agnostic. Patch your brand font with the
[build script](https://github.com/davonium/tusan) and pass it in:

```tsx
<GroupedNumberInput fontFamily="'MyBrand Grouped', MyBrand, sans-serif" />
```

The patched font contains only digits and separators, so the rest of
your stack renders placeholders and any other characters seamlessly.

### Props

| Prop | Type | Default | |
|---|---|---|---|
| `locale` | `string` | browser locale | decides decimal char **and** separator style |
| `separatorStyle` | `"space" \| "comma" \| "period" \| "apostrophe"` | from locale | override the rendered style |
| `value` | `string \| number \| null` | | controlled; a number only has to match numerically, so `12,` survives a parent storing `12` |
| `defaultValue` | `string \| number` | `""` | |
| `onValueChange` | `({ raw, floatValue }) => void` | | `raw` is the exact string; persist it for >15 digits |
| `maxDecimals` | `number \| null` | `null` | |
| `allowNegative` | `boolean` | `true` | |
| `fontFamily` | `string` | `'Roboto Grouped', system-ui, sans-serif` | |

Plus all standard `<input>` props (`ref` is forwarded).

### Utilities

`cleanNumberString(text, decimal)`, `getLocaleNumberInfo(locale)`,
`featureSettingsFor(style)`, `parseRaw(raw, decimal)` are exported.

## Gotchas

- Grouping is a rendering feature and can fail silently — the value is
  always plain digits so nothing breaks, but if visible separators are a
  hard requirement, use JS formatting instead. Verified in the latest
  Chrome, Firefox and Safari.

- **Never set `letter-spacing`** on the input. It breaks the grouping
  entirely in some browsers (observed in the wild), and the behavior is
  inconsistent across engines. A dev-mode warning fires if you do.
- **Blink re-shaping bug:** in Chromium, grouping can fail to render
  when the value crosses into "grouping needed" territory — e.g. going
  from empty to filled, or from 3 to 4 digits. The exact set of
  triggering transitions is unclear, so the component runs a reshape
  nudge on every input event (toggle ligatures off → force reflow via
  `void el.offsetWidth` → toggle back on; sub-millisecond, no flicker).
  Building your own input on top of the fonts? Use the exported
  `forceReshape(el)`.
- Full grouping covers up to 24 integer digits; decimal digits are never grouped, regardless of length.
- One font file per weight; `roboto.css` ships Regular. Also available:
  `tusan/jetbrains-mono.css`.

## Credits

Font-based digit grouping for terminals was pioneered by
[Numderline](https://blog.janestreet.com/commas-in-big-numbers-everywhere/)
(2019). This package applies it to editable inputs. Demo fonts patched
from Roboto and JetBrains Mono (SIL OFL, renamed as required — see
`OFL.txt`). Code: MIT.
