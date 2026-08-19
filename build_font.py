"""
Builds a "grouped digits" font from any TTF: thousand grouping lives in the
font (OpenType calt / ss01-ss03), never in the string. A text field using the
result keeps a plain digit value, so caret, selection, copy/paste and undo
stay native, and an unloaded font degrades to ungrouped digits.

Usage:
    python3 build_font.py <source> "<Family name>" <output prefix>

Example:
    python3 build_font.py Roboto-Regular.ttf "Roboto Grouped" RobotoGrouped-Regular

Writes <prefix>.ttf and <prefix>.woff2 to the current directory.
Requires: pip install fonttools brotli

The source needs TrueType (glyf) outlines — .ttf or .woff2. CFF-based .otf
will fail. Instantiate variable fonts first (fontTools.varLib.instancer).
OFL fonts (Roboto, JetBrains Mono, ...) must be renamed when modified;
that's the family name argument. One run produces one weight; reuse the same family name and
the faces are distinguished by the source's weight.

Grouping style: calt (default) renders a space; ss01 comma, ss02 period,
ss03 apostrophe.

Part of Tusan — https://github.com/davonium/tusan (MIT)
"""
from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.feaLib.builder import addOpenTypeFeaturesFromString
import os, sys

if len(sys.argv) != 4:
    sys.exit(__doc__)
SRC, FAMILY, OUT = sys.argv[1], sys.argv[2], sys.argv[3]

# ---------- 1. Subset down to what a digit field can display ----------
opts = subset.Options()
opts.glyph_names = True
opts.layout_features = []
opts.name_IDs = ["*"]
opts.notdef_outline = True
ss = subset.Subsetter(options=opts)
ss.populate(text="0123456789.,-\u2212' \u2019\u00a0")
font = TTFont(SRC)
ss.subset(font)

glyf, hmtx = font["glyf"], font["hmtx"]
upm = font["head"].unitsPerEm

# Resolve glyphs through cmap; glyph names can't be trusted (uniXXXX etc).
cmap = font.getBestCmap()

def gname(cps, label):
    if isinstance(cps, int):
        cps = (cps,)
    for cp in cps:
        if cp in cmap:
            return cmap[cp]
    sys.exit(f"Source has no glyph for {label} "
             f"({', '.join(f'U+{cp:04X}' for cp in cps)})")

DIGITS = [gname(ord("0") + i, f"digit {i}") for i in range(10)]
SEP = {
    "cm": gname(ord(","), "comma"),
    "pd": gname(ord("."), "period"),
    "ap": gname((0x2019, 0x27), "apostrophe"),
}

# Gap = one space, so fields match Intl-formatted text next to them.
GAP = hmtx[gname(0x20, "space")][0]
TRACK = int(round(hmtx[DIGITS[0]][0] * 0.06))

def add_variant(base, newname, sep=None):
    """Digit followed by a gap or a drawn separator, as one glyph. The
    variant's metrics are exactly those of typing the separator character:
    it advances by the separator's own advance width (a space for the gap
    variant), and a drawn separator sits at its natural position. The extra
    advance belongs to the digit, which is what makes the separator
    unselectable on its own."""
    pen = TTGlyphPen(font.getGlyphSet())
    pen.addComponent(base, (1, 0, 0, 1, 0, 0))
    if sep is None:
        extra = GAP
    else:
        pen.addComponent(sep, (1, 0, 0, 1, hmtx[base][0], 0))
        extra = hmtx[sep][0]
    order = font.getGlyphOrder()
    order.append(newname)
    font.setGlyphOrder(order)
    glyf[newname] = pen.glyph()
    hmtx[newname] = (hmtx[base][0] + extra, hmtx[base][1])

for d in DIGITS:
    add_variant(d, d + ".grp")
    for suffix, sep_glyph in SEP.items():
        add_variant(d, d + "." + suffix, sep=sep_glyph)

# Identical twins used to mark fraction digits so the ladder never touches
# them. Same outline, same metrics — invisible.
for d in DIGITS:
    pen = TTGlyphPen(font.getGlyphSet())
    pen.addComponent(d, (1, 0, 0, 1, 0, 0))
    order = font.getGlyphOrder()
    order.append(d + ".frc")
    font.setGlyphOrder(order)
    glyf[d + ".frc"] = pen.glyph()
    hmtx[d + ".frc"] = hmtx[d]

# ---------- 2. OpenType rules ----------
D  = " ".join(DIGITS)
Dg = " ".join(d + ".grp" for d in DIGITS)
Dc = " ".join(d + ".cm"  for d in DIGITS)
Dp = " ".join(d + ".pd"  for d in DIGITS)
Da = " ".join(d + ".ap"  for d in DIGITS)
Df = " ".join(d + ".frc" for d in DIGITS)

def la(n):
    return " ".join(["@D"] * n)

# A digit gets a trailing gap when a positive multiple of three digits follow
# it — thousand grouping counted from the right. OpenType can't count, so
# each multiple needs its own fixed-length rule, longest first, with ignores
# for k-1/k-2 so non-multiples don't fall through to a shorter rule.
# Integers group fully up to MAX_LA + 3 digits.
MAX_LA = 21
ladder_lines = [f"ignore sub @D' {la(MAX_LA + 1)};"]
for k in range(MAX_LA, 2, -3):
    ladder_lines.append(f"sub @D' {la(k)} by @Dg;")
    if k > 3:
        ladder_lines.append(f"ignore sub @D' {la(k - 1)};")
        ladder_lines.append(f"ignore sub @D' {la(k - 2)};")
ladder = "\n    ".join(ladder_lines)

fea = f"""
languagesystem DFLT dflt;
languagesystem latn dflt;

@D    = [{D}];
@Dg   = [{Dg}];
@Dc   = [{Dc}];
@Dp   = [{Dp}];
@Da   = [{Da}];
@Df   = [{Df}];
@DEC  = [{SEP['cm']} {SEP['pd']}];

feature calt {{
  # Mark every digit after a decimal separator, inductively left to right:
  # the first fraction digit follows @DEC, each further one follows an
  # already-marked digit. Unbounded length in two rules. The GROUP ladder
  # only matches unmarked @D, so fractions are never grouped.
  lookup FRACTION {{
    sub @DEC @D' by @Df;
    sub @Df @D' by @Df;
  }} FRACTION;
  lookup GROUP {{
    {ladder}
  }} GROUP;
}} calt;

feature ss01 {{ sub @Dg by @Dc; }} ss01;
feature ss02 {{ sub @Dg by @Dp; }} ss02;
feature ss03 {{ sub @Dg by @Da; }} ss03;
"""
addOpenTypeFeaturesFromString(font, fea)

# post 2.0 keeps glyph names, which makes HarfBuzz verification readable.
font["post"].formatType = 2.0
font["post"].extraNames = []
font["post"].mapping = {}

# ---------- 3. Rename the family (required by the OFL for modified fonts) ----------
name = font["name"]

def src_name(nid):
    rec = name.getName(nid, 3, 1, 0x409) or name.getName(nid, 1, 0, 0)
    return rec.toUnicode() if rec else None

subfamily = src_name(17) or src_name(2) or "Regular"

# Instanced variable fonts often still say "Regular" in the name table while
# OS/2.usWeightClass is correct; trust the weight class in that case.
WEIGHT_NAMES = {100: "Thin", 200: "ExtraLight", 300: "Light", 400: "Regular",
                500: "Medium", 600: "SemiBold", 700: "Bold",
                800: "ExtraBold", 900: "Black"}
if subfamily == "Regular" and "OS/2" in font:
    wc = font["OS/2"].usWeightClass
    if wc in WEIGHT_NAMES and wc != 400:
        subfamily = WEIGHT_NAMES[wc]

ps_family = "".join(FAMILY.split())
ps_sub = "".join(subfamily.split())
full_name = FAMILY if subfamily == "Regular" else f"{FAMILY} {subfamily}"

for nid, val in [(1, FAMILY),
                 (3, f"{ps_family}-{ps_sub}-1.0"),
                 (4, full_name),
                 (6, f"{ps_family}-{ps_sub}"),
                 (16, FAMILY)]:
    name.setName(val, nid, 3, 1, 0x409)

ttf_path = OUT + ".ttf"
font.flavor = None  # a .woff2 source leaves flavor set; the ttf must be plain sfnt
font.save(ttf_path)
font.flavor = "woff2"
woff2_path = OUT + ".woff2"
font.save(woff2_path)
print("OK", os.path.getsize(ttf_path), "bytes ttf,",
      os.path.getsize(woff2_path), "bytes woff2, GAP =", GAP, "UPM =", upm)
