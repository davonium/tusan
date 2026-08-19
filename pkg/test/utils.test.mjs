import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanNumberString, getLocaleNumberInfo, parseRaw } from "../dist/index.js";

test("cleanNumberString: svensk formatering", () => {
  assert.equal(cleanNumberString("1 234 567,89", ","), "1234567,89");
});
test("cleanNumberString: US-formatering till sv-decimal", () => {
  assert.equal(cleanNumberString("1,234,567.89", ","), "1234567,89");
});
test("cleanNumberString: schweizisk apostrof", () => {
  assert.equal(cleanNumberString("1'234.5", "."), "1234.5");
});
test("cleanNumberString: ensam komma + 3 siffror = tusenavgränsare (en-US)", () => {
  assert.equal(cleanNumberString("1,234", "."), "1234");
});
test("cleanNumberString: ensam komma = decimal när locale säger det (sv)", () => {
  assert.equal(cleanNumberString("1,234", ","), "1,234");
});
test("cleanNumberString: parentes-negativt och unicode-minus", () => {
  assert.equal(cleanNumberString("(1 000)", ","), "-1000");
  assert.equal(cleanNumberString("\u22125", ","), "-5");
});
test("cleanNumberString: skräp utan siffror", () => {
  assert.equal(cleanNumberString("abc", ","), null);
});
test("getLocaleNumberInfo: sv-SE = mellanrum + kommadecimal", () => {
  const i = getLocaleNumberInfo("sv-SE");
  assert.equal(i.decimal, ",");
  assert.equal(i.separatorStyle, "space");
});
test("getLocaleNumberInfo: en-US = komma-gruppering + punktdecimal", () => {
  const i = getLocaleNumberInfo("en-US");
  assert.equal(i.decimal, ".");
  assert.equal(i.separatorStyle, "comma");
  assert.equal(i.fontFeatureSettings, '"calt" 1, "ss01" 1');
});
test("getLocaleNumberInfo: de-CH = apostrof", () => {
  assert.equal(getLocaleNumberInfo("de-CH").separatorStyle, "apostrophe");
});
test("parseRaw", () => {
  assert.equal(parseRaw("1234567,89", ","), 1234567.89);
  assert.equal(parseRaw("", ","), null);
});
