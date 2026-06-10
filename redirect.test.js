const test = require("node:test");
const assert = require("node:assert");
const { action } = require("./redirect.js");

const URL = "https://poll.example/abc";

test("no redirectUrl -> none", () => {
  assert.strictEqual(action({ redirectUrl: "" }, { isAdmin: false, dismissedUrl: "" }), "none");
});

test("active redirect, not admin, not dismissed -> overlay", () => {
  assert.strictEqual(action({ redirectUrl: URL }, { isAdmin: false, dismissedUrl: "" }), "overlay");
});

test("admin is exempt even with active redirect -> none", () => {
  assert.strictEqual(action({ redirectUrl: URL }, { isAdmin: true, dismissedUrl: "" }), "none");
});

test("dismissed matching url -> none", () => {
  assert.strictEqual(action({ redirectUrl: URL }, { isAdmin: false, dismissedUrl: URL }), "none");
});

test("dismissed a DIFFERENT url -> overlay (new target re-prompts)", () => {
  assert.strictEqual(action({ redirectUrl: URL }, { isAdmin: false, dismissedUrl: "https://old.example" }), "overlay");
});

test("missing opts fields default safely -> overlay when active", () => {
  assert.strictEqual(action({ redirectUrl: URL }, {}), "overlay");
});

test("missing data object -> none (no throw)", () => {
  assert.strictEqual(action(undefined, {}), "none");
});
