import { test, before } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

let React, act, createRoot, GroupedNumberInput;

before(async () => {
  const { window } = new JSDOM("<!doctype html><body></body>");
  globalThis.window = window;
  globalThis.document = window.document;
  globalThis.HTMLElement = window.HTMLElement;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  React = (await import("react")).default;
  ({ act } = await import("react"));
  ({ createRoot } = await import("react-dom/client"));
  ({ GroupedNumberInput } = await import("../dist/index.js"));
});

function render(props) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const rerender = (next) =>
    act(() => root.render(React.createElement(GroupedNumberInput, next)));
  rerender(props);
  return { input: container.querySelector("input"), rerender };
}

function type(input, text) {
  act(() => {
    input.setRangeText(text, input.value.length, input.value.length, "end");
    input.dispatchEvent(new window.Event("input", { bubbles: true }));
  });
}

test("controlled: shows a number with the locale's decimal char", () => {
  const { input } = render({ locale: "sv-SE", value: 1234.5 });
  assert.equal(input.value, "1234,5");
});

test("controlled: follows a new value from the parent", () => {
  const { input, rerender } = render({ locale: "sv-SE", value: 100 });
  rerender({ locale: "sv-SE", value: 2500 });
  assert.equal(input.value, "2500");
  rerender({ locale: "sv-SE", value: null });
  assert.equal(input.value, "");
});

test("controlled: keeps a trailing decimal char the parent stores as a number", () => {
  const { input, rerender } = render({ locale: "sv-SE", value: 12 });
  let latest;
  const onValueChange = (v) => (latest = v.floatValue);
  rerender({ locale: "sv-SE", value: 12, onValueChange });
  type(input, ",");
  rerender({ locale: "sv-SE", value: latest, onValueChange });
  assert.equal(input.value, "12,");
});

test("controlled: a parent that clamps to the same value rewrites the field", () => {
  const { input, rerender } = render({ locale: "sv-SE", value: 500 });
  rerender({ locale: "sv-SE", value: 500, onValueChange: () => {} });
  type(input, "0");
  rerender({ locale: "sv-SE", value: 500, onValueChange: () => {} });
  assert.equal(input.value, "500");
});

test("controlled: a locale change rewrites the decimal char", () => {
  const { input, rerender } = render({ locale: "sv-SE", value: 12.5 });
  rerender({ locale: "en-GB", value: 12.5 });
  assert.equal(input.value, "12.5");
});

test("uncontrolled: starts from defaultValue and keeps what is typed", () => {
  const { input, rerender } = render({ locale: "sv-SE", defaultValue: 1.5 });
  type(input, "5");
  rerender({ locale: "sv-SE", defaultValue: 1.5 });
  assert.equal(input.value, "1,55");
});
