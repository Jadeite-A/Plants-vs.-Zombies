// 关卡类与名册：Level 只存每关自己的数据（波数/地形/玩法），
// 关卡名册。每一关一个文件，只写这一关的波数、阳光和特殊玩法。
// 僵尸名单由 waves.js 按原版点数规则生成。植物不在这里解锁。
function defineLevel(spec) {
  Adventure.levels.push(new Level(spec));
}

class Level {
  constructor(spec) {
    this.id = spec.id;
    this.name = spec.name;
    this.mode = spec.mode || "adventure";
    // 冒险流程全局序号：1-1 是 1，2-1 是 11……出怪表的登场关都按它算。
    var parts = String(spec.id).split("-");
    var stage = parseInt(parts[0], 10) || 1;
    var sub = parseInt(parts[1], 10) || 1;
    this.number = spec.number == null ? (stage - 1) * 10 + sub : spec.number;
    this.stage = stage;
    this.sub = sub;
    this.kind = spec.kind || "defend";
    this.waveCount = spec.waveCount == null ? 10 : spec.waveCount;
    this.startSun = spec.startSun == null ? 50 : spec.startSun;
    this.sunEvery = spec.sunEvery == null ? 4.25 : spec.sunEvery;
    this.sunSpan = spec.sunSpan == null ? 2.75 : spec.sunSpan;
    this.rows = (spec.rows || [0, 1, 2, 3, 4]).slice();
    this.terrain = Terrains.get(spec.terrain) || Terrains.forId(spec.id);
    this.belt = spec.belt || null;
    // 保龄球关开场预置的植物（原版 1-5 的三株豌豆射手）。
    this.prePlants = spec.prePlants || null;
    // 浓雾从第几列开始压过来（0 基，原版每关雾墙位置不同）；4-10 是漆黑暴雨夜。
    this.fogFrom = spec.fogFrom != null ? spec.fogFrom : this.terrain && this.terrain.fog ? this.terrain.fog.from : null;
    this.dark = !!spec.dark;
    this.firstDelay = spec.firstDelay;
    this.round = spec.round == null ? 1 : spec.round;
    this.buildWaves();
    this.sounds = spec.sounds || {
      wave: "hugewave",
      siren: "siren",
      win: "winmusic",
      lose: "losemusic",
      final: "finalwave",
    };
    // 背景音乐是 mainmusic.mo3 里的曲段名，见 electron/audio.js 的 TUNES。
    // 保龄球和传送带放小游戏曲 Loonboon / 传送带曲，其余按地形选；雾夜用雾曲。
    var tuneByTerrain = { "front-day": "day", "front-night": "night", "pool-day": "pool", "pool-night": "fog", roof: "roof" };
    this.musicTune = spec.musicTune
      || (this.kind === "bowling" ? "loonboon" : this.kind === "conveyor" ? "conveyer" : tuneByTerrain[this.terrain.id] || "day");
  }

  // 通关奖励：按图鉴顺序发卡。开局已给豌豆射手（图鉴第 0 张），
  // 通第 n 关（全局序号）发图鉴第 n 张；第 50 关通关即整个冒险完成。
  get reward() {
    return (typeof Almanac !== "undefined" && Almanac.plantOrder && Almanac.plantOrder[this.number]) || null;
  }

  // 选关时确定轮次后重建出怪表：第一轮用原版波数，第二轮二十波、点数翻倍。
  buildWaves() {
    var built = Waves.build(this);
    this.waves = built.waves;
    this.flagWaves = built.flagWaves;
    this.zombies = built.zombies;
    this.waveCount = built.waveCount;
    this.firstDelay = built.firstDelay;
  }

  randomRow() {
    return this.rows[Math.floor(Math.random() * this.rows.length)];
  }

  rowFor(type, wave) {
    var known = ZombieCatalog.byId[type];
    var config = known || { id: type, locomotion: "" };
    var rows = Terrains.spawnRows(this.terrain, this.rows, config, wave);
    if (!rows.length) return null;
    return rows[Math.floor(Math.random() * rows.length)];
  }

  get spawnCount() {
    return this.zombies.length;
  }
}

var Adventure = {
  levels: [],

  byId: function (id) {
    for (var i = 0; i < this.levels.length; i++) {
      if (this.levels[i].id === id) return this.levels[i];
    }
    return null;
  },

  indexOf: function (id) {
    for (var i = 0; i < this.levels.length; i++) {
      if (this.levels[i].id === id) return i;
    }
    return -1;
  },

  // 选关界面选定轮次后调用：重建成怪表再开打。
  prepare: function (id, round) {
    var level = this.byId(id);
    if (!level) return null;
    level.round = round;
    level.buildWaves();
    return level;
  },
};
