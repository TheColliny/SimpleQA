const test = require("node:test");
const assert = require("node:assert");
const { balancedScore, sortQuestions, freshness } = require("./ranking.js");

const HL = 60;
const NOW = 0;
const minsAgo = (m) => -m * 60000; // timestamp so (NOW - timestamp)/60000 === m
const votes = (n) => Array.from({ length: n }); // n upvotes

test("balancedScore: 10 votes, 60 min old, HL=60 ~= 1.7047481", () => {
  const q = { timestamp: minsAgo(60), upvotes: votes(10) };
  assert.ok(Math.abs(balancedScore(q, NOW, HL) - 1.7047481) < 1e-6);
});

test("balancedScore: fresh 0-vote question scores 0", () => {
  const q = { timestamp: minsAgo(0), upvotes: [] };
  assert.ok(Math.abs(balancedScore(q, NOW, HL)) < 1e-9);
});

test("balancedScore: missing upvotes array treated as 0 votes", () => {
  const q = { timestamp: minsAgo(0) };
  assert.strictEqual(balancedScore(q, NOW, HL), 0);
});

test("balancedScore: invalid halfLifeMin falls back to votes-only (no NaN/decay)", () => {
  const q = { timestamp: minsAgo(120), upvotes: votes(4) };
  assert.strictEqual(balancedScore(q, NOW, 0), Math.log(5));
  assert.strictEqual(balancedScore(q, NOW, undefined), Math.log(5));
});

test("sortQuestions balanced: spec example orders B,C,D,A at HL=60", () => {
  const A = { id: "A", timestamp: minsAgo(0),   upvotes: [] };
  const B = { id: "B", timestamp: minsAgo(60),  upvotes: votes(10) };
  const C = { id: "C", timestamp: minsAgo(180), upvotes: votes(30) };
  const D = { id: "D", timestamp: minsAgo(10),  upvotes: votes(2) };
  const out = sortQuestions([A, B, C, D], "balanced", { now: NOW, halfLifeMin: HL });
  assert.deepStrictEqual(out.map((q) => q.id), ["B", "C", "D", "A"]);
});

test("sortQuestions votes: upvotes desc, newest breaks ties", () => {
  const a = { id: "a", timestamp: minsAgo(5),  upvotes: votes(3) };
  const b = { id: "b", timestamp: minsAgo(50), upvotes: votes(9) };
  const c = { id: "c", timestamp: minsAgo(1),  upvotes: votes(3) };
  const out = sortQuestions([a, b, c], "votes", { now: NOW, halfLifeMin: HL });
  assert.deepStrictEqual(out.map((q) => q.id), ["b", "c", "a"]);
});

test("sortQuestions newest: timestamp desc", () => {
  const a = { id: "a", timestamp: minsAgo(30), upvotes: votes(99) };
  const b = { id: "b", timestamp: minsAgo(1),  upvotes: [] };
  const out = sortQuestions([a, b], "newest", { now: NOW, halfLifeMin: HL });
  assert.deepStrictEqual(out.map((q) => q.id), ["b", "a"]);
});

test("sortQuestions: answered questions sink below unanswered in every mode", () => {
  const ans  = { id: "ans",  timestamp: minsAgo(0),   upvotes: votes(99), answered: true };
  const live = { id: "live", timestamp: minsAgo(120), upvotes: [] };
  for (const mode of ["balanced", "votes", "newest"]) {
    const out = sortQuestions([ans, live], mode, { now: NOW, halfLifeMin: HL });
    assert.deepStrictEqual(out.map((q) => q.id), ["live", "ans"], "mode " + mode);
  }
});

test("sortQuestions: does not mutate the input array", () => {
  const A = { id: "A", timestamp: minsAgo(0),  upvotes: [] };
  const B = { id: "B", timestamp: minsAgo(60), upvotes: votes(10) };
  const input = [A, B];
  sortQuestions(input, "balanced", { now: NOW, halfLifeMin: HL });
  assert.deepStrictEqual(input.map((q) => q.id), ["A", "B"]);
});

test("freshness: 1.0 at post, 0.5 at half window, 0 at/after window, clamps future to 1", () => {
  const win = 10;
  assert.strictEqual(freshness({ timestamp: minsAgo(0) }, NOW, win), 1);
  assert.ok(Math.abs(freshness({ timestamp: minsAgo(5) }, NOW, win) - 0.5) < 1e-9);
  assert.strictEqual(freshness({ timestamp: minsAgo(10) }, NOW, win), 0);
  assert.strictEqual(freshness({ timestamp: minsAgo(20) }, NOW, win), 0);
  assert.strictEqual(freshness({ timestamp: minsAgo(-5) }, NOW, win), 1);
});

test("freshness: invalid window returns 0", () => {
  assert.strictEqual(freshness({ timestamp: minsAgo(1) }, NOW, 0), 0);
});

test("balanced default behavior: at HL=60 a 1h/10v leads a 3h/30v; at HL=90 it flips", () => {
  const B = { id: "B", timestamp: minsAgo(60),  upvotes: votes(10) };
  const C = { id: "C", timestamp: minsAgo(180), upvotes: votes(30) };
  const at60 = sortQuestions([C, B], "balanced", { now: NOW, halfLifeMin: 60 }).map((q) => q.id);
  const at90 = sortQuestions([C, B], "balanced", { now: NOW, halfLifeMin: 90 }).map((q) => q.id);
  assert.deepStrictEqual(at60, ["B", "C"]); // recency-leaning default: fresher-but-fewer-votes wins
  assert.deepStrictEqual(at90, ["C", "B"]); // popularity-leaning: more votes wins
});
