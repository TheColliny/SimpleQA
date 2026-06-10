const test = require("node:test");
const assert = require("node:assert");
const { setupState } = require("./auth.js");

test("setupState: needsSetup true -> setup", () => {
  assert.strictEqual(setupState({ needsSetup: true }), "setup");
});

test("setupState: needsSetup false -> login", () => {
  assert.strictEqual(setupState({ needsSetup: false }), "login");
});

test("setupState: missing needsSetup -> login", () => {
  assert.strictEqual(setupState({}), "login");
});

test("setupState: missing payload -> login", () => {
  assert.strictEqual(setupState(), "login");
});
