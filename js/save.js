/* localStorage save / load. */
(function (root) {
  "use strict";

  function config() {
    return root.GAME_CONFIG || {};
  }

  function defaultState() {
    var cfg = config();
    var first = (root.GAME_CHARACTERS || [])[0];
    var owned = {};
    if (first) {
      owned[first.id] = {
        weight: first.baseWeight,
        fitness: 0,
        obtainedAt: Date.now()
      };
    }
    return {
      version: 1,
      coins: cfg.STARTING_COINS != null ? cfg.STARTING_COINS : 320,
      inventory: {
        "garden-salad": 1,
        "chocolate-cake": 1,
        "workout-pass": 1
      },
      owned: owned,
      stats: { pulls: 0, workClicks: 0, itemsUsed: 0 },
      flags: { seenIntro: false },
      lastSession: null,
      workUntil: 0
    };
  }

  function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function migrate(raw) {
    var base = defaultState();
    if (!raw || typeof raw !== "object") return base;
    var out = base;
    if (typeof raw.coins === "number") out.coins = raw.coins;
    if (raw.inventory && typeof raw.inventory === "object") out.inventory = raw.inventory;
    if (raw.owned && typeof raw.owned === "object") out.owned = raw.owned;
    if (raw.stats && typeof raw.stats === "object") {
      out.stats = {
        pulls: raw.stats.pulls || 0,
        workClicks: raw.stats.workClicks || 0,
        itemsUsed: raw.stats.itemsUsed || 0
      };
    }
    if (raw.flags && typeof raw.flags === "object") {
      out.flags.seenIntro = !!raw.flags.seenIntro;
    }
    out.lastSession = raw.lastSession || null;
    out.workUntil = typeof raw.workUntil === "number" ? raw.workUntil : 0;
    out.version = 1;
    return out;
  }

  var Save = {
    key: function () {
      return (config().SAVE_KEY) || "fitOrFeast.save.v1";
    },
    defaultState: defaultState,
    clone: clone,
    load: function () {
      try {
        var raw = localStorage.getItem(this.key());
        if (!raw) return defaultState();
        return migrate(JSON.parse(raw));
      } catch (err) {
        console.warn("Save load failed, starting fresh.", err);
        return defaultState();
      }
    },
    write: function (state) {
      try {
        localStorage.setItem(this.key(), JSON.stringify(state));
      } catch (err) {
        console.warn("Save write failed.", err);
      }
    },
    reset: function () {
      try {
        localStorage.removeItem(this.key());
      } catch (err) { /* ignore */ }
      return defaultState();
    }
  };

  root.Save = Save;
})(typeof window !== "undefined" ? window : this);
