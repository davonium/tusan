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

function press(input, ch) {
  act(() => {
    input.focus();
    // jsdom has no TextEvent, so React builds onBeforeInput from keypress,
    // which reads the legacy `which` that jsdom does not initialise.
    const event = new window.KeyboardEvent("keypress", {
      key: ch,
      bubbles: true,
      cancelable: true,
    });
    Object.defineProperty(event, "which", { value: ch.charCodeAt(0) });
    Object.defineProperty(event, "charCode", { value: ch.charCodeAt(0) });
    input.dispatchEvent(event);
  });
}

test("controlled: NaN and Infinity show an empty field instead of looping", () => {
  const { input, rerender } = render({ locale: "sv-SE", value: NaN });
  assert.equal(input.value, "");
  rerender({ locale: "sv-SE", value: Infinity });
  assert.equal(input.value, "");
});

test("controlled: a number never shows in exponent notation", () => {
  const { input, rerender } = render({ locale: "sv-SE", value: 1e21 });
  assert.equal(input.value, "1000000000000000000000");
  rerender({ locale: "sv-SE", value: 1e-7 });
  assert.equal(input.value, "0,0000001");
});

test("a string value or defaultValue gets the locale's decimal char", () => {
  assert.equal(render({ locale: "sv-SE", value: "1234.56" }).input.value, "1234,56");
  assert.equal(
    render({ locale: "sv-SE", defaultValue: "1234.56" }).input.value,
    "1234,56",
  );
});

test("controlled: the raw string from onValueChange round-trips", () => {
  const { input, rerender } = render({ locale: "sv-SE", value: "12" });
  let latest;
  rerender({ locale: "sv-SE", value: "12", onValueChange: (v) => (latest = v.raw) });
  type(input, ",50");
  rerender({ locale: "sv-SE", value: latest });
  assert.equal(input.value, "12,50");
});

test("uncontrolled: form.reset() restores defaultValue", () => {
  const form = document.createElement("form");
  document.body.append(form);
  const root = createRoot(form);
  act(() =>
    root.render(
      React.createElement(GroupedNumberInput, { locale: "sv-SE", defaultValue: 100 }),
    ),
  );
  const input = form.querySelector("input");
  type(input, "5");
  assert.equal(input.value, "1005");
  act(() => form.reset());
  assert.equal(input.value, "100");
});

function renderWithState(initial) {
  const container = document.createElement("div");
  document.body.append(container);
  function Parent() {
    const [value, setValue] = React.useState(initial);
    return React.createElement(GroupedNumberInput, {
      locale: "sv-SE",
      value,
      onValueChange: (v) => setValue(v.floatValue),
    });
  }
  act(() => createRoot(container).render(React.createElement(Parent)));
  return container.querySelector("input");
}

test("typing into a parent that stores a number: a typed '.' becomes the decimal char", () => {
  const input = renderWithState(12);
  press(input, ".");
  press(input, "5");
  assert.equal(input.value, "12,5");
});

test("typing goes through the filter: digits pass, letters are rejected", () => {
  const { input } = render({ locale: "sv-SE", defaultValue: 12 });
  press(input, "3");
  assert.equal(input.value, "123");
  press(input, "a");
  assert.equal(input.value, "123");
});
