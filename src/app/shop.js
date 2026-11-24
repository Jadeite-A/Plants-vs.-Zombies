/*
 * shop.js — 疯狂戴夫和戴夫的杂货店。
 *
 * 买过什么、卡槽有几格、清洁车、钉耙还剩几关、戴夫哪段话已经说过，
 * 全部写在当前 Profile 上，由 Accounts.save() 落到 account/users/<id>.json。
 * 换账户读的是另一份档案，商店不共享。
 *
 * 价格按原版年度版：
 *   第 7/8/9/10 格卡槽 750 / 5000 / 20000 / 80000
 *   机枪射手、双胞向日葵 5000；多嘴小蘑菇 7500；猫尾草、冰西瓜 10000
 *   吸金菇 3000；钢地刺 7500；玉米加农炮 20000；变身茄子 30000
 *   钉耙 200（三关）；池塘清洁车 1000；屋顶推车 3000
 * 升级植物要先有底植物。多嘴小蘑菇和猫尾草要等戴夫买走玉米卷（4-5）才上架。
 */
var Shop = (function () {
  var SLOT_COST = [750, 5000, 20000, 80000];
  var UPGRADES = {
    gatlingpea: true, twinsunflower: true, gloomshroom: true, cattail: true,
    wintermelon: true, goldmagnet: true, spikerock: true, cobcannon: true, imitater: true,
  };

  var PLANTS = [
    { id: "gatlingpea", cost: 5000, need: "repeater", blurb: "CRAZY_DAVE_2000" },
    { id: "twinsunflower", cost: 5000, need: "sunflower", blurb: "CRAZY_DAVE_2001" },
    { id: "gloomshroom", cost: 7500, need: "fumeshroom", taco: true, blurb: "CRAZY_DAVE_2002" },
    { id: "cattail", cost: 10000, need: "lilypad", taco: true, blurb: "CRAZY_DAVE_2003" },
    { id: "wintermelon", cost: 10000, need: "melonpult", blurb: "CRAZY_DAVE_2004" },
    { id: "goldmagnet", cost: 3000, need: "magnetshroom", blurb: "CRAZY_DAVE_2005" },
    { id: "spikerock", cost: 7500, need: "spikeweed", blurb: "CRAZY_DAVE_2006" },
    { id: "cobcannon", cost: 20000, need: "kernelpult", blurb: "CRAZY_DAVE_2007" },
    { id: "imitater", cost: 30000, blurb: "CRAZY_DAVE_2008" },
  ];

  function varsOf(profile) {
    return {
      name: profile && profile.name || "园丁",
      money: profile && profile.wallet ? profile.wallet.coins : 0,
      cost: slotCost(profile),
      slots: profile && profile.shop ? profile.shop.slots + 1 : 7,
    };
  }

  function fill(raw, vars) {
    vars = vars || {};
    var scream = raw.indexOf("{SCREAM") >= 0;
    var noSound = raw.indexOf("{NO_SOUND}") >= 0;
    var text = String(raw || "")
      .replace(/\{PLAYER_NAME\}/g, vars.name || "园丁")
      .replace(/\{MONEY\}/g, vars.money != null ? String(vars.money) : "")
      .replace(/\{UPGRADE_COST\}/g, vars.cost != null ? String(vars.cost) : "")
      .replace(/\{SLOTS\}/g, vars.slots != null ? String(vars.slots) : "")
      .replace(/\{[^}]+\}/g, "")
      .replace(/[ \t]+/g, " ")
      .trim();
    return { text: text, scream: scream, noSound: noSound };
  }

  function speak(key, vars) {
    var raw = (typeof Almanac !== "undefined" && Almanac.line) ? Almanac.line(key) : "";
    return fill(raw, vars);
  }

  function block(from, to, vars) {
    var lines = [];
    for (var n = from; n <= to; n++) {
      var line = speak("CRAZY_DAVE_" + n, vars);
      if (line.text) lines.push(line);
    }
    return lines;
  }

  function slotCost(profile) {
    var slots = profile && profile.shop ? profile.shop.slots : 6;
    if (slots < 6 || slots >= 10) return 0;
    return SLOT_COST[slots - 6];
  }

  function plantName(id) {
    var plant = PlantCatalog.get(id);
    return (plant && plant.name) || id;
  }

  // 当前账户看得到的货架。已买的留在架上标售罄，方便换账户时对得上。
  function stock(profile) {
    var shop = profile.shop;
    var items = [];
    if (shop.open && shop.slots < 10) {
      var next = shop.slots + 1;
      var slotKey = next === 7 ? "CRAZY_DAVE_2011" : next === 8 ? "CRAZY_DAVE_2012" : next === 9 ? "CRAZY_DAVE_2013" : "CRAZY_DAVE_2014";
      items.push({
        id: "slot",
        name: next + " 格卡槽",
        cost: SLOT_COST[shop.slots - 6],
        owned: false,
        icon: "Store_PacketUpgrade",
        key: slotKey,
        blurb: speak(slotKey, varsOf(profile)).text || ("每关可以再多带一种植物，升到 " + next + " 格。"),
      });
    }
    PLANTS.forEach(function (spec) {
      if (!shop.open) return;
      if (spec.taco && !shop.taco) return;
      if (spec.need && !profile.hasPlant(spec.need)) return;
      if (!PlantCatalog.get(spec.id)) return;
      items.push({
        id: spec.id,
        name: plantName(spec.id),
        cost: spec.cost,
        owned: profile.hasPlant(spec.id),
        plant: spec.id,
        key: spec.blurb,
        blurb: speak(spec.blurb, varsOf(profile)).text || plantName(spec.id),
      });
    });
    if (shop.open) {
      var rakeText = speak("CRAZY_DAVE_2028", varsOf(profile)).text || "干草叉能击倒最先碰到它的那只僵尸，可以用三关。";
      if (shop.rake > 0) rakeText += "（还剩 " + shop.rake + " 关）";
      items.push({
        id: "rake",
        name: "钉耙",
        cost: 200,
        owned: shop.rake > 0,
        icon: "icon_rake",
        key: "CRAZY_DAVE_2028",
        blurb: rakeText,
      });
    }
    if (profile.hasCleared("2-10")) {
      items.push({
        id: "pool",
        name: "池塘清洁车",
        cost: 1000,
        owned: shop.poolCleaner,
        icon: "icon_poolcleaner",
        key: "CRAZY_DAVE_2026",
        blurb: speak("CRAZY_DAVE_2026", varsOf(profile)).text || "泳池那两行也会有清洁车。",
      });
    }
    if (profile.hasCleared("4-10")) {
      items.push({
        id: "roof",
        name: "屋顶推车",
        cost: 3000,
        owned: shop.roofCleaner,
        icon: "icon_roofcleaner",
        key: "CRAZY_DAVE_2027",
        blurb: speak("CRAZY_DAVE_2027", varsOf(profile)).text || "屋顶上的每一行都会有一辆推车。",
      });
    }
    return items;
  }

  function find(profile, id) {
    var items = stock(profile);
    for (var i = 0; i < items.length; i++) {
      if (items[i].id === id) return items[i];
    }
    return null;
  }

  function buy(profile, id) {
    var item = find(profile, id);
    if (!item || item.owned) return false;
    if (!profile.wallet.spend(item.cost)) return false;
    if (id === "slot") profile.shop.slots = Math.min(10, profile.shop.slots + 1);
    else if (id === "rake") profile.shop.rake += 3;
    else if (id === "pool") profile.shop.poolCleaner = true;
    else if (id === "roof") profile.shop.roofCleaner = true;
    else profile.unlockPlant(id);
    return true;
  }

  function remembered(profile, list, id) {
    return profile.shop[list].indexOf(id) >= 0;
  }

  // 进关前戴夫要说的话。每段话用 id 记在档案里，说过就不再说。
  function beatsFor(profile, level) {
    var beats = [];
    var vars = varsOf(profile);
    vars.cost = slotCost(profile);
    vars.slots = profile.shop.slots + 1;
    function once(id, lines, extra) {
      if (!lines || !lines.length) return;
      if (remembered(profile, "seen", id)) return;
      beats.push(Object.assign({ id: id, lines: lines, remember: "seen" }, extra || {}));
    }
    if (level.round !== 2) {
      var id = level.id;
      if (id === "1-5") once("1-5", block(2200, 2203, vars));
      if (id === "2-1") once("2-1", block(201, 207, vars));
      if (id === "2-5") once("2-5", block(401, 406, vars));
      if (id === "3-1") once("3-1", block(501, 505, vars));
      if (id === "3-5") once("3-5", block(701, 703, vars));
      if (id === "4-1") once("4-1", block(801, 803, vars));
      if (id === "4-5") once("4-5", block(601, 606, vars), { grant: 1000, taco: true });
      if (id === "4-10") once("4-10", block(1101, 1103, vars));
      if (id === "5-1") once("5-1", block(1201, 1204, vars));
      if (id === "5-5") once("5-5", block(1304, 1311, vars));
      if (id === "5-10") once("5-10", block(2300, 2310, vars));
    }
    var direct = !!(level.belt || level.kind === "whack" || level.kind === "vase");
    if (!direct && profile.shop.open && profile.shop.slots < 10 && profile.wallet.coins >= slotCost(profile)) {
      var offerId = "slot" + (profile.shop.slots + 1);
      if (!remembered(profile, "offered", offerId)) {
        var lines = profile.shop.slots === 6 ? block(1501, 1503, vars)
          : profile.shop.slots === 7 ? block(1551, 1553, vars)
          : [fill("升级到 {SLOTS} 个卡片槽？花费 {UPGRADE_COST} 金币。", vars)];
        if (lines.length) {
          beats.push({ id: offerId, lines: lines, remember: "offered", offer: "slot" });
        }
      }
    }
    if (level.round === 2 && !direct) {
      var pickId = "picks-" + level.id;
      if (!remembered(profile, "seen", pickId)) {
        var picks = block(1601, 1603, vars);
        if (!picks.length) picks = [{ text: "这次，我想替你挑些植物！我选……这三种！", scream: false }];
        beats.push({ id: pickId, lines: picks, remember: "seen" });
      }
    }
    return beats;
  }

  function shopIntro(profile) {
    var lines = block(301, 304, varsOf(profile));
    if (!lines.length) {
      lines = [
        { text: "你找到了我的车钥匙！", scream: false },
        { text: "疯子戴夫的闪闪亮杂货店正式营业了！", scream: false },
      ];
    }
    return { id: "shop-open", lines: lines, remember: "seen" };
  }

  // 二周目戴夫按关卡序号抽 3 张。升级植物、模仿者不抽。
  // 伞叶只在有飞贼或投石车时抽，三叶草只在有气球或浓雾时抽，屋顶不抽火炬树桩。
  function pickSeeds(level, unlocked) {
    var roster = (typeof Waves !== "undefined" && Waves.roster && Waves.roster[level.id]) || [];
    var roof = !!(level.terrain && level.terrain.ground === "roof");
    var fog = !!(level.fogFrom != null || (level.terrain && level.terrain.fog));
    var bungee = level.kind === "blitz" || roster.indexOf("bungee") >= 0;
    var catapult = roster.indexOf("catapult") >= 0;
    var balloon = roster.indexOf("balloon") >= 0;
    var rand = mulberry((level.number || 1) * 997 + 13);
    var bag = [];
    (unlocked || []).forEach(function (id) {
      if (UPGRADES[id]) return;
      var plant = PlantCatalog.get(id);
      if (!plant || plant.place === "corner") return;
      if (id === "umbrellaleaf" && !bungee && !catapult) return;
      if (id === "blover" && !balloon && !fog) return;
      if (id === "torchwood" && roof) return;
      bag.push(id);
    });
    var picks = [];
    while (picks.length < 3 && bag.length) {
      var index = Math.floor(rand() * bag.length);
      picks.push(bag.splice(index, 1)[0]);
    }
    return picks;
  }

  function mulberry(seed) {
    var s = seed >>> 0;
    return function () {
      s = (Math.imul(1664525, s) + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  return {
    stock: stock,
    say: function (key, profile) { return speak(key, varsOf(profile)); },
    find: find,
    buy: buy,
    beatsFor: beatsFor,
    shopIntro: shopIntro,
    pickSeeds: pickSeeds,
    slotCost: slotCost,
  };
})();
