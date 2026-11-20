#!/usr/bin/env node
/* Simulate 10,000 pulls and verify drop categories land near 4 / 72 / 20 / 4. */
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.join(__dirname, "..");

function loadBrowserScript(rel, sandbox) {
  const code = fs.readFileSync(path.join(root, rel), "utf8");
  vm.runInNewContext(code, sandbox, { filename: rel });
}

const sandbox = { console: console };
sandbox.window = sandbox;
sandbox.global = sandbox;
loadBrowserScript("data/config.js", sandbox);
loadBrowserScript("data/items.js", sandbox);
loadBrowserScript("data/characters.js", sandbox);
loadBrowserScript("js/engine.js", sandbox);

const Engine = sandbox.GameEngine;
const CFG = sandbox.GAME_CONFIG;
const ITEMS = sandbox.GAME_ITEMS;
const CHARS = sandbox.GAME_CHARACTERS;

if (!Engine || !ITEMS || !CHARS) {
  console.error("Failed to load engine or data.");
  process.exit(1);
}

const N = 10000;
const expected = {
  character: CFG.ODDS.character,
  food: CFG.ODDS.food,
  workout: CFG.ODDS.workout,
  reroll: CFG.ODDS.reroll
};

const counts = { character: 0, food: 0, workout: 0, reroll: 0 };
const foodIds = {};
let failedPulls = 0;

for (let i = 0; i < N; i++) {
  const result = Engine.rollPull(Math.random, {
    items: ITEMS,
    characters: CHARS,
    config: CFG
  });
  if (!counts.hasOwnProperty(result.category)) {
    failedPulls++;
    continue;
  }
  counts[result.category]++;
  if (result.category === "food") {
    if (!result.itemId) failedPulls++;
    foodIds[result.itemId] = (foodIds[result.itemId] || 0) + 1;
  }
  if (result.category === "workout" && result.itemId !== "workout-pass") failedPulls++;
  if (result.category === "reroll" && result.itemId !== "reroll-token") failedPulls++;
  if (result.category === "character" && !Engine.findCharacter(CHARS, result.characterId)) failedPulls++;
}

if (CHARS.length < 5) {
  console.error("Expected at least 5 characters, got", CHARS.length);
  process.exit(1);
}
const charIds = CHARS.map(function (c) { return c.id; });
console.log("Roster:", charIds.join(", "));


console.log("Simulated", N, "pulls\n");
console.log("Category       Count   Observed    Expected    Delta");
let failed = failedPulls > 0;
const tolerance = 0.015; // 1.5 percentage points

Object.keys(expected).forEach(function (key) {
  const obs = counts[key] / N;
  const exp = expected[key];
  const delta = obs - exp;
  const ok = Math.abs(delta) <= tolerance;
  if (!ok) failed = true;
  console.log(
    (key + "            ").slice(0, 14) +
    String(counts[key]).padStart(6) + "   " +
    (obs * 100).toFixed(2).padStart(6) + "%    " +
    (exp * 100).toFixed(2).padStart(6) + "%    " +
    ((delta >= 0 ? "+" : "") + (delta * 100).toFixed(2) + "%").padStart(7) +
    (ok ? "   ok" : "   FAIL")
  );
});

console.log("\nFood sub-table (uniform among", ITEMS.filter(function (i) { return i.type === "food"; }).length, "foods):");
Object.keys(foodIds).sort().forEach(function (id) {
  console.log("  " + id + ": " + foodIds[id]);
});

// Growth sanity
const mira = CHARS[0];
const thresholds = Engine.fatThresholds(mira.baseWeight, CFG.FAT_STAGES, CFG.FAT_WEIGHT_MULT);
console.log("\nFat weight thresholds from", mira.baseWeight, "kg at ×" + CFG.FAT_WEIGHT_MULT + ":");
thresholds.forEach(function (t, i) {
  console.log("  Fat " + (i + 1) + ": " + t + " kg");
});

let owned = { weight: mira.baseWeight, fitness: 0 };
const cake = Engine.findItem(ITEMS, "chocolate-cake");
const salad = Engine.findItem(ITEMS, "garden-salad");
const pass = Engine.findItem(ITEMS, "workout-pass");

function stageOf(o) { return Engine.resolveStage(o, mira, CFG).key; }

if (stageOf(owned) !== "base") {
  console.error("Expected base stage at start");
  failed = true;
}

let tmp = { weight: mira.baseWeight, fitness: 0 };
for (let i = 0; i < 8; i++) tmp = Engine.applyItem(tmp, salad, mira, CFG);
tmp = Engine.applyItem(tmp, pass, mira, CFG);
if (stageOf(tmp) !== "fit1") {
  console.error("Expected fit1 after healthy stack, got", stageOf(tmp), tmp);
  failed = true;
} else {
  console.log("Fitness path ok: reached", stageOf(tmp), "with fitness", tmp.fitness, "weight", tmp.weight);
}

tmp = { weight: mira.baseWeight, fitness: 0 };
let n = 0;
while (stageOf(tmp) !== "fat5" && n < 80) {
  tmp = Engine.applyItem(tmp, cake, mira, CFG);
  n++;
}
if (stageOf(tmp) !== "fat5") {
  console.error("Expected fat5 after enough cake, got", stageOf(tmp), tmp);
  failed = true;
} else {
  console.log("Weight path ok: reached fat5 after", n, "cakes at", tmp.weight, "kg");
}

if (failedPulls) {
  console.error("Malformed pulls:", failedPulls);
}

// Economy
const expectedTenCost = Math.round(CFG.PULL_COST * CFG.PULL10_COUNT * 0.9);
if (CFG.PULL10_COST !== expectedTenCost) {
  console.error("10x cost should be 10% off:", CFG.PULL10_COST, "expected", expectedTenCost);
  failed = true;
} else {
  console.log("10x price ok:", CFG.PULL10_COUNT, "pulls for", CFG.PULL10_COST, "coins (single is", CFG.PULL_COST + ", work pays", CFG.WORK_PAY + ", dupe pays", CFG.DUPLICATE_PAYOUT + ")");
}

// 10x pull test: 1,000 batches = 10,000 pulls
const BATCHES = 1000;
const tenCounts = { character: 0, food: 0, workout: 0, reroll: 0 };
let tenFailed = 0;
const tenCharHits = {};
charIds.forEach(function (id) { tenCharHits[id] = 0; });
for (let b = 0; b < BATCHES; b++) {
  const batch = Engine.rollPulls(CFG.PULL10_COUNT, Math.random, {
    items: ITEMS,
    characters: CHARS,
    config: CFG
  });
  if (!batch || batch.length !== CFG.PULL10_COUNT) {
    tenFailed++;
    continue;
  }
  batch.forEach(function (result) {
    if (!tenCounts.hasOwnProperty(result.category)) tenFailed++;
    else tenCounts[result.category]++;
    if (result.category === "character") {
      if (!Engine.findCharacter(CHARS, result.characterId)) tenFailed++;
      else tenCharHits[result.characterId] = (tenCharHits[result.characterId] || 0) + 1;
    }
  });
}
const tenN = BATCHES * CFG.PULL10_COUNT;
console.log("\n10× pull test:", BATCHES, "batches (", tenN, "pulls )");
console.log("Category       Count   Observed    Expected    Delta");
Object.keys(expected).forEach(function (key) {
  const obs = tenCounts[key] / tenN;
  const exp = expected[key];
  const delta = obs - exp;
  const ok = Math.abs(delta) <= tolerance;
  if (!ok) failed = true;
  console.log(
    (key + "            ").slice(0, 14) +
    String(tenCounts[key]).padStart(6) + "   " +
    (obs * 100).toFixed(2).padStart(6) + "%    " +
    (exp * 100).toFixed(2).padStart(6) + "%    " +
    ((delta >= 0 ? "+" : "") + (delta * 100).toFixed(2) + "%").padStart(7) +
    (ok ? "   ok" : "   FAIL")
  );
});
console.log("Character hits in 10× pools:", JSON.stringify(tenCharHits));
if (tenFailed) {
  console.error("Malformed 10× batches/slots:", tenFailed);
  failed = true;
}

// Every character should have 8 image files
const fs2 = require("fs");
CHARS.forEach(function (ch) {
  ["base","fit1","fit2","fat1","fat2","fat3","fat4","fat5"].forEach(function (k) {
    const rel = ch.images[k];
    const full = path.join(root, rel);
    if (!fs2.existsSync(full)) {
      console.error("Missing image", rel);
      failed = true;
    }
  });
  if (!ch.bodyType) {
    console.error("Missing bodyType on", ch.id);
    failed = true;
  }
});

if (failed) {
  console.error("\nTEST FAILED");
  process.exit(1);
}
console.log("\nAll checks passed.");
