/* Fit or Feast — UI and game loop */
(function () {
  "use strict";

  var Engine = window.GameEngine;
  var Save = window.Save;
  var CFG = window.GAME_CONFIG;
  var ITEMS = window.GAME_ITEMS;
  var CHARS = window.GAME_CHARACTERS;

  var state;
  var currentCharId = null;
  var pendingUseItemId = null;
  var workTimer = null;
  var activeScreen = "home";

  var $ = function (id) { return document.getElementById(id); };

  function itemById(id) { return Engine.findItem(ITEMS, id); }
  function charById(id) { return Engine.findCharacter(CHARS, id); }

  function qty(id) { return (state.inventory && state.inventory[id]) || 0; }

  function addItem(id, n) {
    if (!state.inventory) state.inventory = {};
    state.inventory[id] = (state.inventory[id] || 0) + n;
    if (state.inventory[id] <= 0) delete state.inventory[id];
  }

  function persist() { Save.write(state); }

  function toast(msg) {
    var host = $("toast-host");
    var el = document.createElement("div");
    el.className = "toast";
    el.textContent = msg;
    host.appendChild(el);
    setTimeout(function () {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, 2200);
  }

  function formatCoins(n) {
    return String(Math.floor(n));
  }

  function refreshHeader() {
    $("coin-count").textContent = formatCoins(state.coins);
    $("btn-pull").textContent = "Pull · " + CFG.PULL_COST;
    var tenBtn = $("btn-pull10");
    if (tenBtn) tenBtn.textContent = "10× Pull · " + CFG.PULL10_COST;
    $("work-hint").textContent = "+" + CFG.WORK_PAY + " coins";
  }

  function artClass(ch) {
    return ch && ch.artStyle === "pixel" ? " art-pixel" : "";
  }

  function showScreen(name) {
    if (name === "character" && !currentCharId) name = "collection";
    activeScreen = name;
    var screens = document.querySelectorAll(".screen");
    var i;
    for (i = 0; i < screens.length; i++) {
      screens[i].classList.toggle("active", screens[i].getAttribute("data-screen") === name);
    }
    var navs = document.querySelectorAll(".app-nav button");
    for (i = 0; i < navs.length; i++) {
      var target = navs[i].getAttribute("data-nav");
      navs[i].classList.toggle("active", target === name || (name === "character" && target === "collection"));
    }
    if (name === "home") renderHome();
    if (name === "inventory") renderInventory();
    if (name === "collection") renderCollection();
    if (name === "character") renderCharacter();
  }

  function renderHome() {
    var row = $("odds-row");
    row.innerHTML =
      '<span class="chip ssr">Character ' + Math.round(CFG.ODDS.character * 100) + '%</span>' +
      '<span class="chip food">Food ' + Math.round(CFG.ODDS.food * 100) + '%</span>' +
      '<span class="chip work">Workout pass ' + Math.round(CFG.ODDS.workout * 100) + '%</span>' +
      '<span class="chip token">Reroll ' + Math.round(CFG.ODDS.reroll * 100) + '%</span>';
    refreshHeader();
    updateWorkButton();
  }

  function renderInventory() {
    var host = $("inventory-list");
    var ids = Object.keys(state.inventory || {}).filter(function (id) {
      return qty(id) > 0 && itemById(id);
    });
    ids.sort(function (a, b) {
      var ia = itemById(a);
      var ib = itemById(b);
      var order = { food: 0, workout: 1, reroll: 2 };
      var da = (order[ia.type] != null ? order[ia.type] : 9) - (order[ib.type] != null ? order[ib.type] : 9);
      if (da !== 0) return da;
      if (ia.diet === ib.diet) return ia.name.localeCompare(ib.name);
      if (ia.diet === "healthy") return -1;
      if (ib.diet === "healthy") return 1;
      return ia.name.localeCompare(ib.name);
    });
    if (!ids.length) {
      host.innerHTML = '<p class="empty">Your bag is empty. Pull from the loot box!</p>';
      return;
    }
    host.innerHTML = ids.map(function (id) {
      var it = itemById(id);
      var tag = "";
      if (it.diet === "healthy") tag = '<span class="tag healthy">Healthy</span>';
      else if (it.diet === "junk") tag = '<span class="tag junk">Junk</span>';
      else if (it.type === "workout") tag = '<span class="tag workout">Workout</span>';
      else if (it.type === "reroll") tag = '<span class="tag reroll">Token</span>';
      var useBtn = (it.type === "food" || it.type === "workout")
        ? '<button class="btn btn-ghost" data-use="' + it.id + '" type="button">Use</button>'
        : "";
      return (
        '<article class="item-card">' +
          '<div class="emoji">' + it.emoji + '</div>' +
          '<div><h3>' + escapeHtml(it.name) + tag + '</h3><p>' + escapeHtml(it.blurb) + effectText(it) + '</p></div>' +
          '<div><div class="qty">×' + qty(id) + '</div>' + useBtn + '</div>' +
        '</article>'
      );
    }).join("");
    var buttons = host.querySelectorAll("[data-use]");
    var i;
    for (i = 0; i < buttons.length; i++) {
      buttons[i].addEventListener("click", function (ev) {
        startUseItem(ev.currentTarget.getAttribute("data-use"));
      });
    }
  }

  function effectText(it) {
    var bits = [];
    if (it.weightDelta) {
      bits.push((it.weightDelta > 0 ? "+" : "") + it.weightDelta + " kg");
    }
    if (it.fitnessDelta) {
      bits.push((it.fitnessDelta > 0 ? "+" : "") + it.fitnessDelta + " fitness");
    }
    return bits.length ? " · " + bits.join(", ") : "";
  }

  function ownedIds() {
    return Object.keys(state.owned || {}).filter(function (id) { return charById(id); });
  }

  function startUseItem(itemId) {
    var ids = ownedIds();
    if (!ids.length) {
      toast("You don't have a character to use that on yet.");
      return;
    }
    if (ids.length === 1) {
      useItemOn(itemId, ids[0]);
      return;
    }
    pendingUseItemId = itemId;
    var it = itemById(itemId);
    var html = '<h2 id="modal-title">Use ' + escapeHtml(it.name) + '</h2><p class="lede">Choose a character.</p><div class="picker-list">';
    ids.forEach(function (id) {
      var ch = charById(id);
      var st = Engine.resolveStage(state.owned[id], ch, CFG);
      html += '<button type="button" data-pick="' + id + '"><img src="' + ch.images[st.key] + '" alt="">' +
        '<span><strong>' + escapeHtml(ch.name) + '</strong><br><small>' + escapeHtml(st.label) + '</small></span></button>';
    });
    html += '</div><button class="btn btn-ghost" id="modal-close" type="button">Cancel</button>';
    openModal(html, function (root) {
      root.querySelectorAll("[data-pick]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          closeModal();
          useItemOn(itemId, btn.getAttribute("data-pick"));
        });
      });
    });
  }

  function useItemOn(itemId, charId) {
    var it = itemById(itemId);
    var ch = charById(charId);
    if (!it || !ch || qty(itemId) < 1) return;
    if (!state.owned[charId]) return;
    var before = Engine.resolveStage(state.owned[charId], ch, CFG);
    state.owned[charId] = Engine.applyItem(state.owned[charId], it, ch, CFG);
    addItem(itemId, -1);
    state.stats.itemsUsed += 1;
    persist();
    var after = Engine.resolveStage(state.owned[charId], ch, CFG);
    currentCharId = charId;
    lastSpokenKey = "";
    showScreen("character");
    speakFor(ch, after.key, true);
    if (before.key !== after.key) {
      toast(ch.shortName + " is now " + after.label + "!");
    } else {
      toast("Used " + it.name + " on " + ch.shortName + ".");
    }
  }

  function renderCollection() {
    var host = $("roster-grid");
    host.innerHTML = CHARS.map(function (ch) {
      var owned = state.owned[ch.id];
      if (!owned) {
        return (
          '<button class="char-card locked" type="button" disabled>' +
            '<img class="sil' + artClass(ch) + '" src="' + ch.images.base + '" alt="">' +
            '<span class="rarity-pill">???</span>' +
            '<span class="meta"><span class="name">???</span><span class="sub">Not yet pulled</span></span>' +
          '</button>'
        );
      }
      var st = Engine.resolveStage(owned, ch, CFG);
      return (
        '<button class="char-card" type="button" data-open="' + ch.id + '">' +
          '<img class="' + artClass(ch).trim() + '" src="' + ch.images[st.key] + '" alt="' + escapeHtml(ch.name) + '">' +
          '<span class="rarity-pill">' + escapeHtml(ch.rarity) + '</span>' +
          '<span class="meta"><span class="name">' + escapeHtml(ch.name) + '</span>' +
          '<span class="sub">' + escapeHtml(st.label) + ' · ' + owned.weight.toFixed(1) + ' kg' +
          (ch.bodyType ? ' · ' + escapeHtml(ch.bodyType) : '') + '</span></span>' +
        '</button>'
      );
    }).join("");
    host.querySelectorAll("[data-open]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        currentCharId = btn.getAttribute("data-open");
        showScreen("character");
      });
    });
  }

  var lastSpokenKey = "";

  function speakFor(ch, key, force) {
    var lines = (ch.dialogue && ch.dialogue[key]) || ch.dialogue.base || [""];
    var line;
    if (!force && lastSpokenKey === key && $("vn-line").textContent) return;
    line = lines[Math.floor(Math.random() * lines.length)];
    $("vn-line").textContent = line;
    lastSpokenKey = key;
  }

  function renderCharacter() {
    var ch = charById(currentCharId);
    if (!ch || !state.owned[currentCharId]) {
      showScreen("collection");
      return;
    }
    var owned = state.owned[currentCharId];
    var st = Engine.resolveStage(owned, ch, CFG);
    var img = $("vn-portrait");
    img.className = artClass(ch).trim();
    if (img.getAttribute("src") !== ch.images[st.key]) {
      img.style.opacity = "0.4";
      img.onload = function () { img.style.opacity = "1"; };
      img.src = ch.images[st.key];
      if (img.complete) img.style.opacity = "1";
    }
    img.alt = ch.name + " — " + st.label;
    $("vn-nameplate").textContent = ch.shortName || ch.name;
    $("vn-who").textContent = ch.name;
    speakFor(ch, st.key);
    $("char-bio").textContent = ch.bio;
    $("char-weight").textContent = owned.weight.toFixed(1) + " kg";
    var badge = $("char-stage");
    var tags = '<span class="badge ' + (st.path === "fit" ? "fit" : st.path === "fat" ? "fat" : "base") + '">' + escapeHtml(st.label) + '</span>';
    if (ch.job) tags += '<span class="badge job">' + escapeHtml(ch.job) + '</span>';
    if (ch.bodyType) tags += '<span class="badge type">' + escapeHtml(ch.bodyType) + '</span>';
    badge.className = "stat-tags";
    badge.innerHTML = tags;
    $("weight-bar").style.width = Math.round(st.weight.ratio * 100) + "%";
    $("fitness-bar").style.width = Math.round(st.fitness.ratio * 100) + "%";
    if (st.weight.next == null) {
      $("weight-label").textContent = "Max stage · " + owned.weight.toFixed(1) + " kg";
    } else {
      $("weight-label").textContent = owned.weight.toFixed(1) + " / " + st.weight.next.toFixed(1) + " kg";
    }
    if (st.fitness.next == null) {
      $("fitness-label").textContent = "Max stage · " + owned.fitness.toFixed(1);
    } else {
      $("fitness-label").textContent = owned.fitness.toFixed(1) + " / " + st.fitness.next.toFixed(1);
    }

    var usable = ITEMS.filter(function (it) {
      return (it.type === "food" || it.type === "workout") && qty(it.id) > 0;
    });
    var grid = $("use-grid");
    if (!usable.length) {
      grid.innerHTML = '<p class="empty" style="grid-column:1/-1">No food or workout passes. Pull from the loot box!</p>';
      return;
    }
    grid.innerHTML = usable.map(function (it) {
      return (
        '<button class="use-item" type="button" data-use="' + it.id + '">' +
          '<span class="emoji">' + it.emoji + '</span>' +
          '<span class="info"><strong>' + escapeHtml(it.name) + ' ×' + qty(it.id) + '</strong>' +
          '<small>' + effectText(it).replace(/^ · /, "") + '</small></span>' +
        '</button>'
      );
    }).join("");
    grid.querySelectorAll("[data-use]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        useItemOn(btn.getAttribute("data-use"), currentCharId);
      });
    });
  }

  function snapshotRelevant() {
    return {
      coins: state.coins,
      inventory: Save.clone(state.inventory || {}),
      owned: Save.clone(state.owned || {})
    };
  }

  function restoreSnapshot(snap) {
    state.coins = snap.coins;
    state.inventory = Save.clone(snap.inventory);
    state.owned = Save.clone(snap.owned);
  }

  function applyPullResult(result) {
    var info = { type: "none", itemId: result.itemId || null, characterId: result.characterId || null, payout: 0 };
    if (result.category === "character" && result.characterId) {
      if (state.owned[result.characterId]) {
        state.coins += CFG.DUPLICATE_PAYOUT;
        info.type = "duplicate";
        info.payout = CFG.DUPLICATE_PAYOUT;
      } else {
        var ch = charById(result.characterId);
        state.owned[result.characterId] = {
          weight: ch ? ch.baseWeight : 60,
          fitness: 0,
          obtainedAt: Date.now()
        };
        info.type = "newChar";
      }
    } else if (result.itemId) {
      addItem(result.itemId, 1);
      info.type = "item";
    }
    return info;
  }

  function undoGrant(grant, session) {
    if (!grant) return;
    if (grant.type === "item" && grant.itemId) addItem(grant.itemId, -1);
    if (grant.type === "duplicate") state.coins -= grant.payout || 0;
    if (grant.type === "newChar" && grant.characterId) {
      var later = null;
      var i;
      for (i = 0; i < session.slots.length; i++) {
        var g = session.slots[i].grant;
        if (g && g !== grant && g.characterId === grant.characterId && g.type === "duplicate") {
          later = g;
          break;
        }
      }
      if (later) {
        state.coins -= later.payout || 0;
        later.type = "newChar";
        later.payout = 0;
      } else {
        delete state.owned[grant.characterId];
      }
    }
  }

  function startSession(type, count, cost) {
    state.coins -= cost;
    var slots = [];
    var i;
    for (i = 0; i < count; i++) {
      var result = Engine.rollPull(Math.random, { items: ITEMS, characters: CHARS, config: CFG });
      var grant = applyPullResult(result);
      slots.push({ result: result, grant: grant });
    }
    state.lastSession = { type: type, confirmed: false, slots: slots };
    state.stats.pulls += count;
    state.lastPull = null;
    persist();
    refreshHeader();
    return state.lastSession;
  }

  function doPull() {
    if (state.coins < CFG.PULL_COST) {
      toast("Not enough coins. Go to work!");
      return;
    }
    shakeCapsule();
    startSession("single", 1, CFG.PULL_COST);
    setTimeout(function () {
      stopCapsule();
      showPullModal(state.lastSession.slots[0].result, 0);
    }, 650);
  }

  function doPull10() {
    if (state.coins < CFG.PULL10_COST) {
      toast("Need " + CFG.PULL10_COST + " coins for a 10× pull.");
      return;
    }
    shakeCapsule();
    startSession("x10", CFG.PULL10_COUNT, CFG.PULL10_COST);
    setTimeout(function () {
      stopCapsule();
      showTenModal();
    }, 650);
  }

  function shakeCapsule() {
    var cap = $("capsule");
    cap.classList.remove("shaking");
    void cap.offsetWidth;
    cap.classList.add("shaking");
  }
  function stopCapsule() {
    $("capsule").classList.remove("shaking");
  }

  function doRerollSlot(index) {
    var sess = state.lastSession;
    if (!sess || sess.confirmed) return;
    if (index < 0 || index >= sess.slots.length) return;
    if (qty("reroll-token") < 1) {
      toast("No reroll tokens.");
      return;
    }
    undoGrant(sess.slots[index].grant, sess);
    addItem("reroll-token", -1);
    var result = Engine.rollPull(Math.random, { items: ITEMS, characters: CHARS, config: CFG });
    var grant = applyPullResult(result);
    sess.slots[index] = { result: result, grant: grant };
    persist();
    refreshHeader();
    if (sess.type === "x10") showTenModal(true);
    else showPullModal(result, index);
  }

  function confirmPull() {
    if (state.lastSession) {
      state.lastSession.confirmed = true;
      persist();
    }
    closeModal();
    if (activeScreen === "inventory") renderInventory();
    if (activeScreen === "collection") renderCollection();
    if (activeScreen === "character") renderCharacter();
    refreshHeader();
  }

  function resultCardHtml(result, grant) {
    if (result.category === "character") {
      var ch = charById(result.characterId);
      var owned = state.owned[result.characterId];
      var st = owned && ch ? Engine.resolveStage(owned, ch, CFG) : { key: "base" };
      var src = ch ? (grant && grant.type === "duplicate" ? ch.images[st.key] : ch.images.base) : "";
      var sub = grant && grant.type === "duplicate"
        ? "Duplicate · +" + CFG.DUPLICATE_PAYOUT + " coins"
        : ((ch && ch.rarity) || "") + " · New";
      return { title: grant && grant.type === "duplicate" ? "Duplicate character" : "New character!",
        big: '<img class="rarity-glow' + artClass(ch) + '" src="' + src + '" alt="">',
        name: ch ? ch.name : "Unknown",
        sub: sub,
        detail: ch && grant && grant.type !== "duplicate" ? ch.bio : sub };
    }
    var it = itemById(result.itemId);
    return { title: it ? it.name : "Item",
      big: '<div class="big-emoji">' + (it ? it.emoji : "🎁") + '</div>',
      name: it ? it.name : "Unknown",
      sub: it ? (it.blurb + effectText(it)) : "",
      detail: it ? (it.blurb + effectText(it)) : "" };
  }

  function showPullModal(result, index) {
    if (index == null) index = 0;
    var sess = state.lastSession;
    var grant = sess && sess.slots[index] ? sess.slots[index].grant : null;
    var card = resultCardHtml(result, grant);
    var canReroll = qty("reroll-token") >= 1;
    var body = '<div class="result-art">' + card.big + '<h3>' + escapeHtml(card.name) + '</h3><p>' + escapeHtml(card.detail) + '</p></div>';
    var actions = '<div class="btn-row">';
    if (canReroll) {
      actions += '<button class="btn btn-rose" id="btn-reroll" type="button">Reroll · 🔮' + qty("reroll-token") + '</button>';
    }
    actions += '<button class="btn btn-gold" id="btn-keep" type="button">Keep</button></div>';
    if (result.itemId && (result.category === "food" || result.category === "workout") && ownedIds().length) {
      actions += '<button class="btn btn-ghost" id="btn-use-now" type="button" style="margin-top:8px">Keep &amp; use now</button>';
    }
    openModal('<h2 id="modal-title">' + escapeHtml(card.title) + '</h2>' + body + actions, function (root) {
      var keep = root.querySelector("#btn-keep");
      if (keep) keep.addEventListener("click", confirmPull);
      var reroll = root.querySelector("#btn-reroll");
      if (reroll) reroll.addEventListener("click", function () { doRerollSlot(index); });
      var useNow = root.querySelector("#btn-use-now");
      if (useNow) {
        useNow.addEventListener("click", function () {
          confirmPull();
          startUseItem(result.itemId);
        });
      }
    });
  }

  function showTenModal(skipAnim) {
    var sess = state.lastSession;
    if (!sess) return;
    var canReroll = qty("reroll-token") >= 1;
    var grid = '<div class="ten-grid">';
    var i;
    for (i = 0; i < sess.slots.length; i++) {
      var slot = sess.slots[i];
      var card = resultCardHtml(slot.result, slot.grant);
      var delay = skipAnim ? 0 : (0.05 + i * 0.08);
      var thumb = slot.result.category === "character" ? card.big.replace("rarity-glow", "rarity-glow").replace("class=\"result-art\"", "") : ('<div class="big">' + (itemById(slot.result.itemId) ? itemById(slot.result.itemId).emoji : "🎁") + '</div>');
      if (slot.result.category === "character") {
        var ch = charById(slot.result.characterId);
        var owned = state.owned[slot.result.characterId];
        var st = owned && ch ? Engine.resolveStage(owned, ch, CFG) : { key: "base" };
        var src = ch ? ch.images[(slot.grant && slot.grant.type === "duplicate") ? st.key : "base"] : "";
        thumb = '<img class="' + artClass(ch).trim() + '" src="' + src + '" alt="">';
      }
      grid += '<div class="ten-card" style="animation-delay:' + delay + 's' + (skipAnim ? ";animation:none;opacity:1;transform:none" : "") + '">' +
        thumb +
        '<strong>' + escapeHtml(card.name) + '</strong>' +
        '<small>' + escapeHtml(card.sub) + '</small>';
      if (canReroll) {
        grid += '<button class="btn btn-rose reroll-mini" type="button" data-reroll="' + i + '">Reroll</button>';
      }
      grid += '</div>';
    }
    grid += '</div>';
    var actions = '<button class="btn btn-gold" id="btn-keep" type="button">Keep all</button>';
    if (canReroll) {
      actions = '<p class="ten-note">🔮 ' + qty("reroll-token") + ' token' + (qty("reroll-token") === 1 ? "" : "s") + ' — reroll any one result.</p>' + actions;
    }
    openModal('<h2 id="modal-title">10× Pull</h2>' + grid + actions, function (root) {
      var keep = root.querySelector("#btn-keep");
      if (keep) keep.addEventListener("click", confirmPull);
      root.querySelectorAll("[data-reroll]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          doRerollSlot(parseInt(btn.getAttribute("data-reroll"), 10));
        });
      });
    });
  }

  function workTick() {
    var left = state.workUntil - Date.now();
    var btn = $("btn-work");
    var bar = $("work-bar");
    if (left <= 0) {
      btn.disabled = false;
      btn.textContent = "Go to Work";
      bar.style.width = "0%";
      if (workTimer) {
        clearInterval(workTimer);
        workTimer = null;
      }
      return;
    }
    btn.disabled = true;
    btn.textContent = "Working… " + (Math.ceil(left / 100) / 10).toFixed(1) + "s";
    var pct = Math.max(0, Math.min(100, 100 - (left / CFG.WORK_COOLDOWN_MS) * 100));
    bar.style.width = pct + "%";
  }

  function updateWorkButton() {
    if (Date.now() < state.workUntil) {
      if (!workTimer) workTimer = setInterval(workTick, 50);
      workTick();
    } else {
      workTick();
    }
  }

  function doWork() {
    if (Date.now() < state.workUntil) return;
    state.workUntil = Date.now() + CFG.WORK_COOLDOWN_MS;
    state.coins += CFG.WORK_PAY;
    state.stats.workClicks += 1;
    persist();
    refreshHeader();
    var wrap = document.querySelector(".work-wrap");
    var floater = document.createElement("div");
    floater.className = "float-coin";
    floater.textContent = "+" + CFG.WORK_PAY;
    wrap.appendChild(floater);
    setTimeout(function () { if (floater.parentNode) floater.parentNode.removeChild(floater); }, 900);
    updateWorkButton();
  }

  function openModal(html, bind) {
    var overlay = $("overlay");
    var modal = $("modal");
    modal.innerHTML = html;
    overlay.classList.add("open");
    var closer = modal.querySelector("#modal-close");
    if (closer) closer.addEventListener("click", closeModal);
    if (bind) bind(modal);
  }

  function closeModal() {
    $("overlay").classList.remove("open");
    $("modal").innerHTML = "";
  }

  function showHelp() {
    openModal(
      '<h2 id="modal-title">How to play</h2>' +
      '<p class="lede">A tiny visual-novel gacha about snacks, workouts, and one very persuadable gym receptionist.</p>' +
      '<ul style="padding-left:1.1rem;color:var(--muted);font-size:0.9rem;line-height:1.45">' +
      '<li><strong style="color:var(--text)">Pull</strong> costs ' + CFG.PULL_COST + ' coins. <strong style="color:var(--text)">10× Pull</strong> costs ' + CFG.PULL10_COST + ' coins (10% off). Odds: character ' + Math.round(CFG.ODDS.character*100) + '%, food ' + Math.round(CFG.ODDS.food*100) + '%, workout pass ' + Math.round(CFG.ODDS.workout*100) + '%, reroll token ' + Math.round(CFG.ODDS.reroll*100) + '%.</li>' +
      '<li><strong style="color:var(--text)">Go to Work</strong> earns ' + CFG.WORK_PAY + ' coins, with a ' + (CFG.WORK_COOLDOWN_MS/1000) + 's cooldown.</li>' +
      '<li>Feed <strong style="color:var(--text)">healthy food</strong> and use <strong style="color:var(--text)">workout passes</strong> to raise fitness (Toned, then Athletic).</li>' +
      '<li>Feed <strong style="color:var(--text)">junk food</strong> to raise weight. Each fat stage starts at about +15% over the last threshold.</li>' +
      '<li>If she is heavy enough for a fat stage, that sprite takes priority even if fitness is high. Workouts and salads can bring weight back down.</li>' +
      '<li><strong style="color:var(--text)">Reroll tokens</strong> let you reroll a pull before you keep it. Duplicates of a character you already own pay ' + CFG.DUPLICATE_PAYOUT + ' coins.</li>' +
      '</ul>' +
      '<div class="btn-row"><button class="btn btn-gold" id="modal-close" type="button">Got it</button></div>' +
      '<button class="btn btn-ghost" id="btn-reset" type="button" style="margin-top:8px">Reset save data</button>',
      function (root) {
        root.querySelector("#btn-reset").addEventListener("click", function () {
          if (confirm("Reset all progress? This cannot be undone.")) {
            state = Save.reset();
            currentCharId = null;
            persist();
            closeModal();
            showScreen("home");
            refreshHeader();
            toast("Save reset. Mira is ready to start over.");
          }
        });
      }
    );
  }

  function showIntro() {
    var first = CHARS[0];
    openModal(
      '<h2 id="modal-title">Welcome to Fit or Feast</h2>' +
      '<p class="lede">' + escapeHtml(first.name) + ' just asked you to be her routine partner. You start with her already on your roster, a few snacks, and a gym pass.</p>' +
      '<p style="color:var(--muted);font-size:0.9rem">Pull the loot box for food, workout passes, reroll tokens, and more characters. A 10× pull is cheaper per box. What you feed someone changes the path they take.</p>' +
      '<button class="btn btn-gold" id="modal-close" type="button">Let\'s go</button>',
      function () {
        state.flags.seenIntro = true;
        persist();
      }
    );
  }

  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function bind() {
    document.querySelectorAll(".app-nav button").forEach(function (btn) {
      btn.addEventListener("click", function () {
        showScreen(btn.getAttribute("data-nav"));
      });
    });
    $("btn-pull").addEventListener("click", doPull);
    $("btn-pull10").addEventListener("click", doPull10);
    $("btn-work").addEventListener("click", doWork);
    $("btn-help").addEventListener("click", showHelp);
    $("btn-back-roster").addEventListener("click", function () { showScreen("collection"); });
    $("overlay").addEventListener("click", function (ev) {
      if (ev.target.id === "overlay") {
        // Don't discard an unconfirmed pull by clicking the backdrop; require Keep.
        if (state.lastSession && !state.lastSession.confirmed && $("btn-keep")) return;
        closeModal();
      }
    });
    $("vn-dialogue").addEventListener("click", function () {
      var ch = charById(currentCharId);
      if (!ch || !state.owned[currentCharId]) return;
      var st = Engine.resolveStage(state.owned[currentCharId], ch, CFG);
      lastSpokenKey = "";
      speakFor(ch, st.key, true);
    });
  }

  function init() {
    if (!Engine || !Save || !CFG || !ITEMS || !CHARS) {
      document.body.innerHTML = "<p style='padding:2rem;font-family:sans-serif'>Failed to load game data.</p>";
      return;
    }
    state = Save.load();
    bind();
    refreshHeader();
    showScreen("home");
    if (state.lastSession && !state.lastSession.confirmed) {
      if (state.lastSession.type === "x10") showTenModal(true);
      else showPullModal(state.lastSession.slots[0].result, 0);
    } else if (!state.flags.seenIntro) {
      showIntro();
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
