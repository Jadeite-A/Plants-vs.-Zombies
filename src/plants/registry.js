// 植物名册：把 species/ 收成 PlantCatalog，并生成上场的 Plant 实例。
// 把各种植物文件收成图鉴，并生成上场的植物。攻击函数来自种类文件，这里不按名字分支。
var PLANT_SLOTS = 10;

function buildPlant(raw) {
  if (raw.hp == null) raw.hp = 300;
  raw.tip = raw.tip || "";
  raw.anim = raw.anim || "anim_idle";
  raw.anchor = raw.anchor || { x: 40, y: 48 };
  raw.aim = raw.aim || { x: 40, y: 50 };
  raw.sounds = raw.sounds || {};
  raw.sleep = raw.sleep || null;
  raw.sleepAnim = raw.sleepAnim || null;
  raw.roles = raw.roles || [];
  raw.requires = raw.requires || [];
  raw.upgrade = !!raw.upgrade;
  raw.place = raw.place || "grid";
  raw.layers = raw.layers || null;
  raw.card = raw.card || null;
  raw.seat = raw.seat || "body";
  raw.span = raw.span || 1;
  if (raw.mount === "wake") {
    raw.mount = function (under) { return !!under.asleep; };
    raw.onMount = function (under) {
      if (raw.sounds && raw.sounds.mount) AudioBus.cue(raw.sounds.mount, 0.7);
      under.wake();
    };
  }
  return raw;
}

var PLANT_CONFIG = PlantSpecies.map(buildPlant);

class Plant {
  constructor(config, col, row) {
    this.config = config;
    this.species = config;
    this.id = config.id;
    this.name = config.name;
    this.col = col;
    this.row = row;
    this.hp = config.hp;
    this.maxHp = config.hp;
    this.cost = config.cost;
    this.sounds = config.sounds || {};
    this.sleep = config.sleep;
    this.mount = config.mount;
    this.seat = config.seat || "body";
    this.span = config.span || 1;
    this.passable = !!config.passable;
    this.tall = !!config.tall;
    this.asleep = false;
    this.woken = false;
    this.time = Math.random() * 4;
    // 原版身体摇摆：豌豆家族 15–20 帧/秒，其余 10–15，每株随机一次。
    var fastSway = {
      peashooter: 1, snowpea: 1, repeater: 1, threepeater: 1, splitpea: 1, gatlingpea: 1,
    };
    this.swayRate = fastSway[config.id] ? 15 + Math.random() * 5 : 10 + Math.random() * 5;
    this.glow = 0;
    this.shoot = 0;
    this.fuse = null;
    this.dead = false;
    this.imitated = false;
    this.disguise = 0;
    this.cycles = {};
    this.phase = "idle";
    this.phaseTime = 0;
    this.pose = null;
    this.attackAnim = null;
    this.attackBody = !!(config.attack && config.attack.body);
    this.popsLeft = config.pops || 1;
    if (config.start) config.start(this);
  }

  wake() {
    this.asleep = false;
    this.woken = true;
  }

  update(board, dt) {
    this.time += dt;
    if (this.shoot > 0) this.shoot -= dt;
    // 变身茄子先保持茄子外形，这段时间不攻击、不产阳光。
    if (this.disguise > 0) {
      this.disguise -= dt;
      return;
    }
    // 白天睡觉只看当前地形，和这株植物有没有在关卡里解锁无关。
    if (this.species.sleep === "day" && !this.woken) {
      var terrain = board.level && board.level.terrain;
      this.asleep = !terrain || terrain.time !== "night";
    }
    if (this.asleep) return;
    if (this.species.update) this.species.update(this, board, dt);
  }
}

var PlantCatalog = {
  maxPick: PLANT_SLOTS,
  order: PLANT_CONFIG,
  byId: {},
  defs: {},
  anchors: {},
  aim: {},

  register: function (config) {
    config.cooldown = config.cd;
    this.byId[config.id] = config;
    this.defs[config.id] = {
      id: config.id,
      name: config.name,
      tip: config.tip,
      cost: config.cost,
      cd: config.cd,
      hp: config.hp,
      reanim: config.reanim,
      anim: config.anim,
      layers: config.layers,
      card: config.card,
      sleepAnim: config.sleepAnim || null,
      upgrade: !!config.upgrade,
      attackAnim: config.attack && config.attack.anim || null,
      attackBody: !!(config.attack && config.attack.body),
    };
    this.anchors[config.id] = config.anchor;
    this.aim[config.id] = config.aim;
  },

  get: function (id) {
    return this.byId[id] || null;
  },

  cardTone: function (id, terrain, chosen) {
    chosen = chosen || [];
    if (chosen.indexOf(id) >= 0) return "picked";
    var plant = this.get(id);
    if (!plant) return "full";
    if (plant.requires.length && !plant.requires.every(function (need) { return chosen.indexOf(need) >= 0; })) return "dim";
    if (terrain && terrain.time === "day" && plant.sleep === "day" && chosen.indexOf("coffee") < 0) return "dim";
    if (typeof Terrains !== "undefined" && Terrains.plantDim(id, terrain)) return "dim";
    return "full";
  },

  create: function (id, col, row) {
    var config = this.byId[id];
    if (!config) throw new Error("unknown plant " + id);
    return new Plant(config, col, row);
  },

  anchor: function (id) {
    return this.anchors[id] || { x: 40, y: 48 };
  },
};

PLANT_CONFIG.forEach(function (config) {
  PlantCatalog.register(config);
});
