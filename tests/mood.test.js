const { test } = require("node:test");
const assert = require("node:assert");
const { analyzeMood } = require("../lib/mood");

test("maps basic moods to MovieLens genres", () => {
  const r = analyzeMood("I feel heartbroken tonight");
  assert.ok(r.moods.includes("heartbroken"));
  assert.ok(r.genreWeights["Romance"] > 0);
  assert.ok(r.genreWeights["Drama"] > 0);
});

test("multi-word phrases beat single tokens", () => {
  const r = analyzeMood("mind bending please");
  assert.deepEqual(r.moods, ["curious"]);
  assert.ok(r.genreWeights["Mystery"] > 0 || r.genreWeights["Sci-Fi"] > 0);
});

test("negation suppresses the next mood word", () => {
  const r = analyzeMood("something not scary");
  assert.ok(!r.moods.includes("scared"), `got ${r.moods}`);
});

test("empty input yields nothing", () => {
  const r = analyzeMood("   ");
  assert.equal(r.moods.length, 0);
  assert.deepEqual(Object.keys(r.genreWeights).length, 0);
});

test("unknown text still returns a shape (no crash)", () => {
  const r = analyzeMood("zzz qqq");
  assert.deepEqual(r.moods, []);
});
