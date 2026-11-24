// 僵尸名册：把 species/ 收成 ZombieCatalog，并生成上场的 Zombie 实例。
// 把各种僵尸文件收成名册。上场后走该文件的 update，关卡只提供 id。
class Zombie {
  constructor(config, row, x) {
    this.config = config;
    this.species = config;
    // kindId 是出生时的种类，一直不变。type 是当前外观，护甲碎了会改成普通僵尸。
    this.kindId = config.id;
    this.type = config.id;
    this.name = config.name;
    this.reanim = config.reanim || "Zombie";
    this.row = row;
    this.x = x;
    this.hp = config.hp;
    this.maxHp = config.hp;
    this.speed = config.speed;
    this.armAt = config.armAt;
    this.armDropped = false;
    this.coneDropped = false;
    this.locomotion = config.locomotion || "walk";
    var atk = config.attack || {};
    this.attack = atk;
    this.attackDamage = atk.damage == null ? 70 : atk.damage;
    this.attackEvery = atk.interval == null ? 1 : atk.interval;
    this.biteTime = null;
    this.biteHit = false;
    this.armor = config.armor ? config.armor.hp : 0;
    this.maxArmor = this.armor;
    this.armorId = config.armor ? config.armor.id : "none";
    this.armorBreakInto = config.armor ? config.armor.breakInto : null;
    this.sounds = config.sounds;
    this.immune = config.immune ? config.immune.slice() : [];
    this.enrage = config.enrage || null;
    this.enraged = false;
    this.summon = config.summon || null;
    this.summonTimer = config.summon ? config.summon.every : 0;
    this.altitude = config.altitude || 0;
    this.massive = !!config.massive;
    this.vehicle = !!config.vehicle;
    this.metalItem = config.metalItem || null;
    this.metal = !!(config.armor && config.armor.metal) || !!config.metalItem;
    this.bungee = !!config.bungee;
    this.emerged = false;
    this.vaulted = false;
    this.statuses = {};
    this.state = "walk";
    this.animTime = Math.random() * 2;
    // 走路/待机的播放倍率。1 附近是 reanim 自己的帧率，每只略有差别，不会齐步。
    this.animRate = 0.9 + Math.random() * 0.45;
    this.groan = 2 + Math.random() * 4;
    this.preview = false;
    this.phase = "idle";
    if (config.start) config.start(this);
    // 出场音效（气球打气、小丑八音盒等）。选卡预览里的僵尸不响。
    if (config.sounds && config.sounds.spawn && !ZombieCatalog.silent) AudioBus.cue(config.sounds.spawn, 0.6);
  }

  get alive() {
    return this.state !== "die" && !this.swallowed;
  }

  speedMul() {
    var mul = 1;
    if (this.statuses.chill) mul *= this.statuses.chill.mul;
    if (this.statuses.enrage) mul *= this.statuses.enrage.mul;
    return mul;
  }

  addStatus(id, seconds, extra) {
    if (this.immune.indexOf(id) >= 0) return;
    extra = extra || {};
    this.statuses[id] = { time: seconds, mul: extra.mul == null ? 1 : extra.mul };
  }

  tickStatus(dt) {
    var names = Object.keys(this.statuses);
    for (var i = 0; i < names.length; i++) {
      var status = this.statuses[names[i]];
      status.time -= dt;
      if (status.time <= 0) delete this.statuses[names[i]];
    }
  }

  update(dt, board) {
    this.animTime += dt;
    if (this.leaveEat > 0) this.leaveEat -= dt;
    this.tickStatus(dt);
    this.groan -= dt;
    if (this.groan <= 0 && this.alive && !this.preview) {
      // 原版节奏：吼声间隔 5–15 秒随机，巨人吼低吼。
      this.groan = 5 + Math.random() * 10;
      var low = this.kindId === "gargantuar" || this.kindId === "giga";
      AudioBus.cue(low ? ["lowgroan", "lowgroan2"] : this.sounds.groan, 0.35);
    }
    if (!this.alive || this.preview) return;
    // 墓碑里钻出来、蹦极空投下来的僵尸，落地前不行动。
    if (this.carried) return;
    if (this.rise > 0) {
      this.rise -= dt;
      return;
    }
    if (this.dropIn > 0 && !this.delivery) {
      this.dropIn -= dt;
      return;
    }
    // 特殊玩法（保龄球等）可以整体接管僵尸行为。物种把专用行为登记在
    // "mode-zombie" 组里，键为 "关卡种类:僵尸id"，这里只负责分发。
    var mode = Rules.use("mode", board.level && board.level.kind);
    if (mode && mode.zombieUpdate && mode.zombieUpdate(this, board, dt)) return;
    if (this.species.update) this.species.update(this, board, dt);
    var summon = Rules.use("special", "summon");
    if (this.summon && summon) summon.update(this, board, dt);
  }

  reachHouse(board) {
    if (this.x >= Lawn.LAWN_X + 16) return;
    var mower = board.mowers[this.row];
    if (mower && mower.state === "idle") {
      mower.state = "run";
      AudioBus.play("lawnmower");
      return;
    }
    if (!mower || mower.state === "none" || mower.state === "gone" || this.x < mower.x - 16) {
      board.phase = "lost";
      AudioBus.stop();
      AudioBus.jingle(board.level.sounds.lose, 0.8);
    }
  }

  // 受伤顺序：冰冻或黄油 → 护甲吸收 → 本体扣血 → 暴怒 → 掉胳膊 → 死亡。
  takeDamage(amount, board, extra) {
    if (!this.alive) return;
    extra = extra || {};
    var hit = {
      amount: amount,
      board: board,
      from: extra.from || "front",
      element: extra.element || null,
      source: extra.source || "hit",
    };
    if (hit.element === "ice") {
      var seconds = extra.chill == null ? 4 : extra.chill;
      if (seconds > 0) this.addStatus("chill", seconds, { mul: 0.5 });
    }
    if (extra.butter) this.addStatus("butter", extra.butter, { mul: 0 });
    if (extra.freeze) this.addStatus("freeze", extra.freeze, { mul: 0 });
    var armor = Rules.use("armor", this.armorId) || Rules.use("armor", "none");
    var left = armor.absorb(this, hit);
    if (left > 0) this.hp -= left;
    if (this.enrage && !this.enraged && this.hp > 0 && this.hp <= this.enrage.below) {
      this.enraged = true;
      this.addStatus("enrage", 9999, { mul: this.enrage.mul });
    }
    if (this.hp > 0 && this.hp <= this.armAt && !this.armDropped) this.dropArm(board);
    if (this.hp <= 0) this.die(board);
  }

  dropArm(board) {
    if (this.armDropped || this.swallowed || this.vehicle) return;
    this.armDropped = true;
    board.spawnBit(this, "arm");
    AudioBus.cue(this.sounds.armDrop, 0.45);
  }

  // 被大嘴花吞掉：当场消失，不倒地、不掉胳膊、不掉东西。
  swallow(board) {
    if (this.swallowed || this.state === "die") return;
    this.swallowed = true;
    this.hp = 0;
    this.armor = 0;
    this.state = "die";
    this.animTime = 0;
  }

  // 保龄球伤害按原版比例缩放：原版球伤 900、普通僵尸血 270，本项目血量按 160/270 缩放，
  // 所以球伤取 533——路障一击连人带锥打碎，铁桶掉约 82% 护甲还能挨一下，报纸只碎报纸。
  // 护甲的具体反应交给护甲规则和种类的 onArmorBroken，这里不认识任何具体僵尸。
  bowlStrike(board) {
    if (!this.alive || this.jumping) return;
    AudioBus.play("bowlingimpact");
    var amount = 533;
    if (this.armor > 0) {
      if (this.armorId === "paper") {
        // 报纸被保龄球整个撕掉，但不伤本体。
        this.armor = 0;
        this.armorId = "none";
        if (this.species.onArmorBroken) this.species.onArmorBroken(this, board);
        return;
      }
      var armor = Rules.use("armor", this.armorId) || Rules.use("armor", "none");
      var left = armor.absorb(this, { amount: amount, board: board, from: "front", element: null, source: "bowl" });
      if (left > 0) {
        this.hp -= left;
        if (this.hp <= 0) this.die(board);
      }
      return;
    }
    this.hp = 0;
    this.die(board);
  }

  die(board) {
    if (!this.alive) return;
    if (this.armor > 0) {
      var armor = Rules.use("armor", this.armorId);
      if (armor) armor.absorb(this, { amount: this.armor, board: board, from: "around", element: null, source: "death" });
    }
    if (!this.armDropped && !this.vehicle) this.dropArm(board);
    this.hp = 0;
    this.armor = 0;
    this.state = "die";
    this.animTime = 0;
    if (this.species.dieSound && !this.preview) AudioBus.play(this.species.dieSound, 0.8);
    // 杂货店开门前后（打过 1-10）僵尸掉金币，点了进当前账户的钱包。
    if (board && board.dropCoins && board.spendsSun() && !this.preview && !this.hypno && !this.loot) {
      this.loot = true;
      var kind = this.species && this.species.id;
      var fat = kind === "bucket" || kind === "screen" || kind === "football" || kind === "gargantuar" || kind === "giga" || kind === "zomboss";
      var coin = board.spawnSun(this.x + 16, Lawn.groundY(this.row) - 80, Lawn.groundY(this.row) - 24, false, true, fat ? 50 : 10, true);
    }
  }
}

var ZombieCatalog = {
  order: ZombieSpecies,
  byId: {},
  silent: false,

  register: function (config) {
    this.byId[config.id] = config;
  },

  get: function (id) {
    return this.byId[id] || this.byId.normal;
  },

  create: function (id, row, x) {
    return new Zombie(this.get(id), row, x);
  },

  preview: function (id, row, x) {
    ZombieCatalog.silent = true;
    var zombie = this.create(id, row, x);
    ZombieCatalog.silent = false;
    zombie.state = "idle";
    zombie.preview = true;
    zombie.animTime = Math.random() * 3;
    return zombie;
  },
};

ZombieSpecies.forEach(function (config) {
  ZombieCatalog.register(config);
});
