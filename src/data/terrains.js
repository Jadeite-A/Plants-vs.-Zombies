// 地形定义：五大场景（白天/黑夜/泳池/雾夜/屋顶）的种植规则、
// 冒险模式的地图。关卡号决定地形，不在每一关里再写一遍。
//   1-1 到 1-10  前院白天
//   2-1 到 2-10  前院夜晚
//   3-1 到 3-10  后院泳池
//   4-1 到 4-10  后院夜晚
//   5-1 到 5-10  屋顶
// 行号用玩家看到的第几行（从 1 开始）。草坪代码里的行是从 0 开始，这里换算。
//
// 植物职责写在植物配置的 roles 上：sun、lilypad、pot、coffee。
//   required  该图必须带。玩家已经解锁了能履行这个职责的植物、却没选，点开始要再确认。
//   dimRoles  这张图用不到。选卡列表里变灰，仍然可以选。
// 僵尸：
//   ban     种类 id 或行进方式，整张图都不出现（屋顶没有矿工）。
//   rowBan  这些种类不能出现在列出的行（巨人不到泳池第 3、4 行）。

var Terrains = (function () {
  var book = {
    "front-day": {
      id: "front-day",
      name: "前院",
      label: "前院 · 草地 · 白天",
      ground: "lawn",
      background: "background1",
      time: "day",
      waterRows: [],
      required: [
        { role: "sun", ask: "你没有带生产阳光的植物，确定开始吗？" },
      ],
      dimRoles: ["lilypad", "pot"],
      zombies: { ban: [], rowBan: [] },
    },
    "front-night": {
      id: "front-night",
      name: "前院夜晚",
      label: "前院 · 草地 · 夜晚",
      ground: "lawn",
      background: "background2",
      time: "night",
      waterRows: [],
      required: [
        { role: "sun", ask: "你没有带生产阳光的植物，确定开始吗？" },
      ],
      // 咖啡豆夜里用处不大，变灰但仍可选。荷叶、花盆在前院用不到。
      dimRoles: ["lilypad", "pot", "coffee"],
      // 原版夜晚草坪的墓碑：开局就立在右半场，最终波会钻出僵尸。
      graves: { min: 5, max: 8, cols: [4, 5, 6, 7, 8] },
      zombies: { ban: [], rowBan: [] },
    },
    "pool-day": {
      id: "pool-day",
      name: "后院泳池",
      label: "后院 · 泳池 · 白天",
      ground: "pool",
      background: "background3",
      time: "day",
      waterRows: [3, 4],
      required: [
        { role: "sun", ask: "你没有带生产阳光的植物，确定开始吗？" },
        { role: "lilypad", ask: "泳池需要荷叶才能在水面上种植，确定不带吗？" },
      ],
      // 花盆不是泳池必需的，变灰但仍可选。
      dimRoles: ["pot"],
      zombies: {
        ban: [],
        rowBan: [{ match: ["gargantuar"], rows: [3, 4] }],
      },
    },
    "pool-night": {
      id: "pool-night",
      name: "后院浓雾",
      label: "后院 · 泳池 · 浓雾",
      ground: "pool",
      background: "background4",
      time: "night",
      waterRows: [3, 4],
      required: [
        { role: "sun", ask: "你没有带生产阳光的植物，确定开始吗？" },
        { role: "lilypad", ask: "泳池需要荷叶才能在水面上种植，确定不带吗？" },
      ],
      dimRoles: ["pot", "coffee"],
      dimRoles: ["pot", "coffee"],
      // 原版浓雾关没有墓碑（最终波的"添头"从水里冒出来）。
      fog: { from: 4 },
      zombies: {
        ban: [],
        rowBan: [{ match: ["gargantuar"], rows: [3, 4] }],
      },
    },
    "boss": {
      id: "boss",
      name: "僵王机甲",
      label: "屋顶 · 黑夜",
      ground: "roof",
      background: "background6boss",
      time: "night",
      waterRows: [],
      required: [
        { role: "sun", ask: "你没有带生产阳光的植物，确定开始吗？" },
        { role: "pot", ask: "屋顶需要花盆才能种植，确定不带吗？" },
      ],
      dimRoles: ["lilypad"],
      zombies: { ban: ["miner", "digger", "burrow"], rowBan: [] },
    },
    "roof": {
      id: "roof",
      name: "屋顶",
      label: "屋顶 · 白天",
      ground: "roof",
      background: "background5",
      time: "day",
      waterRows: [],
      required: [
        { role: "sun", ask: "你没有带生产阳光的植物，确定开始吗？" },
        { role: "pot", ask: "屋顶需要花盆才能种植，确定不带吗？" },
      ],
      // 荷叶在屋顶用不到，变灰但仍可选。矿工不能挖屋顶。
      dimRoles: ["lilypad"],
      zombies: { ban: ["miner", "digger", "burrow"], rowBan: [] },
    },
  };

  var byWorld = {
    1: "front-day",
    2: "front-night",
    3: "pool-day",
    4: "pool-night",
    5: "roof",
  };

  function hasRole(id, role) {
    var plant = PlantCatalog.get(id);
    return !!(plant && plant.roles && plant.roles.indexOf(role) >= 0);
  }

  function listed(keys, config) {
    if (!keys || !config) return false;
    return keys.indexOf(config.id) >= 0 || keys.indexOf(config.locomotion) >= 0;
  }

  return {
    get: function (id) {
      return book[id] || null;
    },

    forId: function (levelId) {
      var world = parseInt(String(levelId || "").split("-")[0], 10);
      return book[byWorld[world] || "front-day"];
    },

    // 选卡池里变灰。没有特殊职责的植物（豌豆、坚果）始终是原色。
    plantDim: function (id, terrain) {
      var plant = PlantCatalog.get(id);
      if (!plant || !plant.roles || !terrain) return false;
      for (var i = 0; i < plant.roles.length; i++) {
        if (terrain.dimRoles.indexOf(plant.roles[i]) >= 0) return true;
      }
      return false;
    },

    // 只提醒玩家其实选得到、却没带的职责。1-1 还没有向日葵时不弹。
    missingRequired: function (terrain, chosen, unlocked) {
      var asks = [];
      if (!terrain) return asks;
      terrain.required.forEach(function (need) {
        var owns = (unlocked || []).some(function (id) { return hasRole(id, need.role); });
        if (!owns) return;
        var brought = (chosen || []).some(function (id) { return hasRole(id, need.role); });
        if (!brought) asks.push(need.ask);
      });
      return asks;
    },

    // 这个僵尸在本关能走的行（0 基）。整图禁掉时返回空数组。
    // 对照原版 RowCanHaveZombieType：
    //   潜水、海豚只走水路；
    //   前 5 波（mCurrentWave < 5）水面只出这两类，普通/路障/铁桶/旗手还不能带圈下水；
    //   第 6 波起，能进泳池的种类才可以出现在水面。气球也要等过了这 5 波。
    spawnRows: function (terrain, levelRows, config, waveIndex) {
      var rows = (levelRows || []).slice();
      if (!terrain || !config) return rows;
      var rules = terrain.zombies || { ban: [], rowBan: [] };
      if (listed(rules.ban, config)) return [];
      var waterRows = (terrain.waterRows || []).map(function (row1) { return row1 - 1; });
      var blocked = {};
      var waterOnly = config.water || config.poolOnly;
      var earlyPool = waveIndex != null && waveIndex < 5;
      var canPool = waterOnly || config.tube || config.altitude > 0;
      waterRows.forEach(function (row) {
        if (waterOnly) return;
        if (earlyPool || !canPool) blocked[row] = true;
      });
      if (waterOnly) {
        rows.forEach(function (row) {
          if (waterRows.indexOf(row) < 0) blocked[row] = true;
        });
      }
      (rules.rowBan || []).forEach(function (rule) {
        if (!listed(rule.match, config)) return;
        (rule.rows || []).forEach(function (row) { blocked[row - 1] = true; });
      });
      return rows.filter(function (row) { return !blocked[row]; });
    },
  };
})();
