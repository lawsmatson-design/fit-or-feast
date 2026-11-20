/* Drop tables, growth math, and stage resolution.
   Works in the browser (window.GameEngine) and in Node (module.exports). */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.GameEngine = api;
  }
})(typeof window !== "undefined" ? window : typeof global !== "undefined" ? global : this, function () {
  "use strict";

  var DEFAULT_ODDS = [
    { id: "character", p: 0.04 },
    { id: "food", p: 0.72 },
    { id: "workout", p: 0.20 },
    { id: "reroll", p: 0.04 }
  ];

  var DEFAULTS = {
    FAT_WEIGHT_MULT: 1.15,
    FAT_STAGES: 5,
    FIT1_FITNESS: 10,
    FIT2_FITNESS: 24,
    MIN_WEIGHT_RATIO: 0.85,
    STAGE_LABELS: {
      base: "Base",
      fit1: "Toned",
      fit2: "Athletic",
      fat1: "Soft",
      fat2: "Chubby",
      fat3: "Plump",
      fat4: "Heavy",
      fat5: "Very Heavy"
    }
  };

  function oddsList(config) {
    if (config && config.ODDS) {
      var o = config.ODDS;
      return [
        { id: "character", p: o.character },
        { id: "food", p: o.food },
        { id: "workout", p: o.workout },
        { id: "reroll", p: o.reroll }
      ];
    }
    return DEFAULT_ODDS.slice();
  }

  function cfg(config) {
    var c = config || {};
    var out = {};
    var k;
    for (k in DEFAULTS) {
      if (Object.prototype.hasOwnProperty.call(DEFAULTS, k)) {
        out[k] = c[k] != null ? c[k] : DEFAULTS[k];
      }
    }
    if (c.STAGE_LABELS) out.STAGE_LABELS = c.STAGE_LABELS;
    return out;
  }

  function rollCategory(rng, config) {
    var r = typeof rng === "function" ? rng() : Math.random();
    var list = oddsList(config);
    var acc = 0;
    var i;
    for (i = 0; i < list.length; i++) {
      acc += list[i].p;
      if (r < acc) return list[i].id;
    }
    return list[list.length - 1].id;
  }

  function pick(arr, rng) {
    if (!arr || !arr.length) return null;
    var r = typeof rng === "function" ? rng() : Math.random();
    var i = Math.floor(r * arr.length);
    if (i >= arr.length) i = arr.length - 1;
    return arr[i];
  }

  function rollPull(rng, options) {
    options = options || {};
    var items = options.items || [];
    var characters = options.characters || [];
    var config = options.config;
    var rand = typeof rng === "function" ? rng : Math.random;
    var category = rollCategory(rand, config);

    if (category === "character") {
      var ch = pick(characters, rand);
      return { category: "character", characterId: ch ? ch.id : null, itemId: null };
    }
    if (category === "food") {
      var foods = items.filter(function (it) { return it.type === "food"; });
      var food = pick(foods, rand);
      return { category: "food", itemId: food ? food.id : null, characterId: null };
    }
    if (category === "workout") {
      var pass = items.filter(function (it) { return it.type === "workout"; })[0];
      return { category: "workout", itemId: pass ? pass.id : "workout-pass", characterId: null };
    }
    var token = items.filter(function (it) { return it.type === "reroll"; })[0];
    return { category: "reroll", itemId: token ? token.id : "reroll-token", characterId: null };
  }

  function rollPulls(n, rng, options) {
    var out = [];
    var i;
    var count = n == null ? 10 : n;
    for (i = 0; i < count; i++) {
      out.push(rollPull(rng, options));
    }
    return out;
  }

  function fatThresholds(baseWeight, stages, mult) {
    var n = stages == null ? DEFAULTS.FAT_STAGES : stages;
    var m = mult == null ? DEFAULTS.FAT_WEIGHT_MULT : mult;
    var t = [];
    var w = baseWeight;
    var i;
    for (i = 0; i < n; i++) {
      w = Math.round(w * m * 10000) / 10000;
      t.push(w);
    }
    return t;
  }

  function resolveStage(owned, charDef, config) {
    var c = cfg(config);
    var base = charDef && charDef.baseWeight != null ? charDef.baseWeight : 60;
    var thresholds = fatThresholds(base, c.FAT_STAGES, c.FAT_WEIGHT_MULT);
    var weight = owned && owned.weight != null ? owned.weight : base;
    var fitness = owned && owned.fitness != null ? owned.fitness : 0;
    var fatStage = 0;
    var i;
    for (i = 0; i < thresholds.length; i++) {
      if (weight + 1e-9 >= thresholds[i]) fatStage = i + 1;
    }

    var key, path, stage;
    if (fatStage >= 1) {
      path = "fat";
      stage = fatStage;
      key = "fat" + fatStage;
    } else if (fitness >= c.FIT2_FITNESS) {
      path = "fit";
      stage = 2;
      key = "fit2";
    } else if (fitness >= c.FIT1_FITNESS) {
      path = "fit";
      stage = 1;
      key = "fit1";
    } else {
      path = "base";
      stage = 0;
      key = "base";
    }

    var prevW;
    var nextW;
    if (path === "fat") {
      prevW = fatStage === 1 ? base : thresholds[fatStage - 2];
      nextW = fatStage < thresholds.length ? thresholds[fatStage] : null;
    } else {
      prevW = base;
      nextW = thresholds[0];
    }

    var fitPrev = 0;
    var fitNext = c.FIT1_FITNESS;
    if (fitness >= c.FIT2_FITNESS) {
      fitPrev = c.FIT2_FITNESS;
      fitNext = null;
    } else if (fitness >= c.FIT1_FITNESS) {
      fitPrev = c.FIT1_FITNESS;
      fitNext = c.FIT2_FITNESS;
    }

    function ratio(cur, prev, next) {
      if (next == null) return 1;
      var span = next - prev;
      if (span <= 0) return 1;
      var r = (cur - prev) / span;
      if (r < 0) return 0;
      if (r > 1) return 1;
      return r;
    }

    return {
      path: path,
      stage: stage,
      key: key,
      label: (c.STAGE_LABELS && c.STAGE_LABELS[key]) || key,
      thresholds: thresholds,
      weight: {
        current: weight,
        prev: prevW,
        next: nextW,
        ratio: ratio(weight, prevW, nextW)
      },
      fitness: {
        current: fitness,
        prev: fitPrev,
        next: fitNext,
        ratio: ratio(fitness, fitPrev, fitNext)
      }
    };
  }

  function applyItem(owned, item, charDef, config) {
    var c = cfg(config);
    var base = charDef && charDef.baseWeight != null ? charDef.baseWeight : 60;
    var minW = base * (c.MIN_WEIGHT_RATIO != null ? c.MIN_WEIGHT_RATIO : 0.85);
    var next = {};
    var k;
    for (k in owned) {
      if (Object.prototype.hasOwnProperty.call(owned, k)) next[k] = owned[k];
    }
    var w = (owned.weight != null ? owned.weight : base) + (item && item.weightDelta ? item.weightDelta : 0);
    var f = (owned.fitness != null ? owned.fitness : 0) + (item && item.fitnessDelta ? item.fitnessDelta : 0);
    next.weight = Math.max(minW, Math.round(w * 100) / 100);
    next.fitness = Math.max(0, Math.round(f * 100) / 100);
    return next;
  }

  function findItem(items, id) {
    var i;
    for (i = 0; i < items.length; i++) {
      if (items[i].id === id) return items[i];
    }
    return null;
  }

  function findCharacter(characters, id) {
    var i;
    for (i = 0; i < characters.length; i++) {
      if (characters[i].id === id) return characters[i];
    }
    return null;
  }

  return {
    DEFAULT_ODDS: DEFAULT_ODDS,
    DEFAULTS: DEFAULTS,
    rollCategory: rollCategory,
    rollPull: rollPull,
    rollPulls: rollPulls,
    fatThresholds: fatThresholds,
    resolveStage: resolveStage,
    applyItem: applyItem,
    findItem: findItem,
    findCharacter: findCharacter
  };
});
