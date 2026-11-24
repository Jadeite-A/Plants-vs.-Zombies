// 植物通用战斗机制：攻击循环（等待→前摇→出手→后摇）、
// 植物战斗的公共动作。前摇、出手、后摇由每种植物自己的文件决定。
// 关卡只按 id 生成植物，不写攻击。
// 原版 mShootingCounter / mAnimRate（100 刻 = 1 秒）。出手点在前摇结束，
// 后摇把嘟嘴或投掷动作收回去。只覆盖会射击的植物，大嘴花、地刺仍用各自的时长。
var SHOT_TIMING = {
  peashooter: { windup: 0.34, recover: 0.14, rate: 35 },
  snowpea: { windup: 0.34, recover: 0.14, rate: 35 },
  repeater: { windup: 0.27, gap: 0.25, recover: 0.16, rate: 45, restart: true },
  threepeater: { windup: 0.34, recover: 0.14, rate: 35 },
  splitpea: { windup: 0.26, recover: 0.12, rate: 45 },
  gatlingpea: { windup: 0.32, gap: 0.17, shots: 4, recover: 0.18, rate: 38 },
  puffshroom: { windup: 0.28, recover: 0.08, rate: 35 },
  seashroom: { windup: 0.28, recover: 0.08, rate: 35 },
  scaredyshroom: { windup: 0.24, recover: 0.08, rate: 35 },
  fumeshroom: { windup: 0.35, recover: 0.15, rate: 35 },
  cactus: { windup: 0.34, recover: 0.1, rate: 35 },
  cabbagepult: { windup: 0.31, recover: 0.1, rate: 35 },
  melonpult: { windup: 0.35, recover: 0.1, rate: 35 },
  wintermelon: { windup: 0.35, recover: 0.1, rate: 35 },
  kernelpult: { windup: 0.29, recover: 0.1, rate: 35 },
  starfruit: { windup: 0.38, recover: 0.12, rate: 28 },
  cattail: { windup: 0.31, recover: 0.19, rate: 30 },
};

var PROJECTILE_KIND = {
  peashooter: "pea", snowpea: "snow", repeater: "pea", threepeater: "pea",
  splitpea: "pea", gatlingpea: "pea",
  puffshroom: "puff", seashroom: "puff", scaredyshroom: "puff",
  starfruit: "star", cactus: "spike", cattail: "spike",
  cabbagepult: "cabbage", melonpult: "melon", wintermelon: "winter",
  kernelpult: "kernel", cobcannon: "cob",
};

function tuneShot(plant, spec) {
  var row = SHOT_TIMING[plant.id];
  if (!row) return spec;
  if (spec.key === "back") return spec;
  if (row.windup != null) spec.windup = row.windup;
  if (row.recover != null) spec.recover = row.recover;
  if (row.rate != null) spec.rate = row.rate;
  if (row.gap != null) spec.gap = row.gap;
  if (row.shots != null) spec.shots = row.shots;
  if (row.restart) spec.restart = true;
  return spec;
}

var PlantFight = {
  // 等待 → 前摇 → 出手（可连发）→ 后摇 → 再等待。
  // ready() 为假时不计时。keep 是目标离开后保留的蓄力，单位秒。
  cycle: function (plant, dt, spec) {
    spec = tuneShot(plant, spec);
    var key = spec.key || "main";
    if (!plant.cycles) plant.cycles = {};
    var slot = plant.cycles[key];
    if (!slot) {
      slot = plant.cycles[key] = {
        phase: "wait",
        time: 0,
        wait: spec.first != null ? spec.first : (spec.interval || 0),
        shotsFired: 0,
      };
    }
    if (slot.phase === "done" || plant.dead) return;

    if (spec.glow) {
      var left = slot.phase === "wait" ? slot.wait - slot.time : (slot.phase === "windup" ? 0 : 99);
      plant.glow = left <= 1 ? 1 - Math.max(0, left) : 0;
    }
    if (slot.phase === "wait") {
      slot.animTime = 0;
      if (spec.ready && !spec.ready()) {
        if (spec.keep != null) slot.time = Math.min(slot.time, spec.keep);
        return;
      }
      slot.time += dt;
      if (slot.time < slot.wait) return;
      slot.phase = "windup";
      slot.time = 0;
      slot.animTime = 0;
      slot.rate = spec.rate || (spec.body ? 24 : 35);
      slot.shotsFired = 0;
      if (!spec.quiet) {
        plant.phase = "windup";
        plant.phaseTime = 0;
        plant.attackAnim = spec.anim || (plant.species.attack && plant.species.attack.anim) || null;
        plant.attackBody = !!(spec.body || (plant.species.attack && plant.species.attack.body));
        var gaps = Math.max(0, (spec.shots || 1) - 1) * (spec.gap || 0);
        plant.shoot = (spec.windup || 0) + gaps + (spec.recover || 0);
      }
      return;
    }

    slot.time += dt;
    slot.animTime = (slot.animTime || 0) + dt;
    if (!spec.quiet) plant.phaseTime = slot.time;

    if (slot.phase === "windup") {
      if (!spec.quiet) plant.phase = "windup";
      if (slot.time < (spec.windup || 0)) return;
      slot.phase = "strike";
      slot.time = 0;
    }

    if (slot.phase === "strike") {
      var result = spec.strike ? spec.strike() : null;
      if (result === "miss") {
        this.finishCycle(plant, slot, spec);
        slot.wait = 0.25;
        return;
      }
      slot.shotsFired += 1;
      if (plant.dead) {
        slot.phase = "done";
        return;
      }
      if (slot.shotsFired < (spec.shots || 1)) {
        slot.phase = "gap";
        slot.time = 0;
        return;
      }
      slot.phase = "recover";
      slot.time = 0;
      if (!spec.quiet) {
        plant.phase = "recover";
        if (spec.recoverAnim) plant.attackAnim = spec.recoverAnim;
      }
      if ((spec.recover || 0) <= 0) this.finishCycle(plant, slot, spec);
      return;
    }

    if (slot.phase === "gap") {
      if (slot.time < (spec.gap || 0)) return;
      slot.phase = "strike";
      slot.time = 0;
      if (spec.restart) slot.animTime = 0;
      return;
    }

    if (slot.phase === "recover") {
      if (!spec.quiet) plant.phase = "recover";
      if (slot.time < (spec.recover || 0)) return;
      this.finishCycle(plant, slot, spec);
    }
  },

  finishCycle: function (plant, slot, spec) {
    if (!spec.quiet) {
      plant.phase = "idle";
      plant.shoot = 0;
      plant.glow = 0;
    }
    slot.animTime = 0;
    if (spec.once) {
      slot.phase = "done";
      if (spec.die) plant.dead = true;
      return;
    }
    slot.phase = "wait";
    slot.time = 0;
    slot.wait = spec.interval == null ? 0 : spec.interval;
  },

  once: function (plant, dt, spec) {
    spec.once = true;
    if (spec.first == null) spec.first = 0;
    if (!spec.ready) spec.ready = function () { return true; };
    this.cycle(plant, dt, spec);
  },

  zombieAhead: function (plant, board, opt) {
    opt = opt || {};
    var dir = opt.dir || 1;
    var cols = opt.cols == null ? 99 : opt.cols;
    var row = opt.row == null ? plant.row : opt.row;
    var origin = Lawn.cellLeft(plant.col) + 40;
    var reach = cols * Lawn.COL_W;
    return board.zombies.some(function (zombie) {
      if (!zombie.alive || zombie.hypno) return false;
      if (zombie.row !== row) return false;
      if (opt.air && zombie.altitude <= 0) return false;
      if (opt.ground && zombie.altitude > 0) return false;
      var dx = zombie.x - origin;
      if (dir > 0) return dx > 16 && dx < reach;
      return dx < -8 && -dx < reach;
    });
  },

  nearest: function (plant, board) {
    var best = null;
    var bestD = 1e12;
    var origin = Lawn.cellLeft(plant.col);
    board.zombies.forEach(function (zombie) {
      if (!zombie.alive || zombie.hypno) return;
      var dx = zombie.x - origin;
      var dy = (zombie.row - plant.row) * Lawn.ROW_H;
      var dist = dx * dx + dy * dy;
      if (dist < bestD) {
        bestD = dist;
        best = zombie;
      }
    });
    return best;
  },

  frontZombie: function (plant, board, cols) {
    var best = null;
    var origin = Lawn.cellLeft(plant.col) + Lawn.COL_W / 2;
    var reach = (cols == null ? 1.2 : cols) * Lawn.COL_W;
    board.zombies.forEach(function (zombie) {
      if (!zombie.alive || zombie.hypno || zombie.massive) return;
      if (zombie.row !== plant.row) return;
      var dx = zombie.x - origin;
      if (dx < -Lawn.COL_W || dx > reach) return;
      if (!best || zombie.x < best.x) best = zombie;
    });
    return best;
  },

  shoot: function (plant, board, dt, extra) {
    extra = extra || {};
    var atk = plant.species.attack || {};
    var self = this;
    this.cycle(plant, dt, {
      key: extra.key || "main",
      windup: extra.windup != null ? extra.windup : atk.windup,
      recover: extra.recover != null ? extra.recover : atk.recover,
      interval: extra.interval != null ? extra.interval : atk.interval,
      shots: extra.shots || atk.shots || 1,
      gap: extra.gap != null ? extra.gap : (atk.gap == null ? 0.12 : atk.gap),
      anim: extra.anim || atk.anim,
      body: extra.body,
      rate: extra.rate,
      quiet: extra.quiet,
      keep: extra.keep == null ? 1.2 : extra.keep,
      ready: function () {
        var rows = extra.rows || atk.rows || [0];
        var dir = extra.dir || 1;
        var cols = extra.cols != null ? extra.cols : atk.cols;
        if (extra.skipRow) {
          return rows.some(function (offset) {
            var row = plant.row + offset;
            return row >= 0 && row < Lawn.ROWS && self.zombieAhead(plant, board, {
              dir: dir, cols: cols, row: row, air: extra.air, ground: extra.ground,
            });
          });
        }
        return self.zombieAhead(plant, board, {
          dir: dir,
          cols: cols,
          row: extra.row != null ? extra.row : plant.row,
          air: extra.air,
          ground: extra.ground,
        });
      },
      strike: function () {
        var rows = extra.rows || atk.rows || [0];
        rows.forEach(function (offset) {
          var row = plant.row + offset;
          if (row < 0 || row >= Lawn.ROWS) return;
          if (extra.skipRow && !self.zombieAhead(plant, board, { dir: extra.dir || 1, cols: extra.cols != null ? extra.cols : atk.cols, row: row })) return;
          self.pea(plant, board, {
            row: row,
            dir: extra.dir || 1,
            damage: extra.damage || atk.damage,
            element: extra.element != null ? extra.element : atk.element,
            chill: extra.chill != null ? extra.chill : atk.chill,
            air: extra.air,
          });
        });
      },
    });
  },

  pea: function (plant, board, opt) {
    opt = opt || {};
    var muzzle = Lawn.plantAt(plant.col, plant.row, plant.id);
    var dir = opt.dir || 1;
    var row = opt.row == null ? plant.row : opt.row;
    var pea = new Pea(row, muzzle.x + (dir > 0 ? 58 : 8), muzzle.y + 26, opt.damage || 20);
    pea.element = opt.element || null;
    pea.chill = opt.chill || 0;
    pea.vx = opt.vx != null ? opt.vx : dir * 300;
    pea.vy = opt.vy || 0;
    pea.air = !!opt.air;
    pea.kind = opt.kind || PROJECTILE_KIND[plant.id] || "pea";
    if (pea.element === "ice") pea.kind = "snow";
    if (pea.element === "fire") pea.kind = "fire";
    pea.homing = !!opt.homing;
    pea.splash = opt.splash || 0;
    if (opt.target) pea.target = opt.target;
    board.peas.push(pea);
    // 原版每次出手都伴一声投掷（throw/throw2 随机），寒冰射手再加冰晶声。
    if (plant.sounds && plant.sounds.shoot) AudioBus.cue(plant.sounds.shoot, 0.55);
    if (plant.sounds && plant.sounds.sparkle) AudioBus.cue(plant.sounds.sparkle, 0.5);
    return pea;
  },

  sun: function (plant, board, opt) {
    opt = opt || {};
    if (!opt.coin && board.spendsSun && !board.spendsSun()) return null;
    var spot = Lawn.plantAt(plant.col, plant.row, plant.id);
    var drop = board.spawnSun(spot.x + (opt.dx || 34), spot.y + 8, spot.y + 46, false, !!opt.small, opt.value || 25, !!opt.coin);
    if (!drop) return null;
    // 原版产阳光伴一声轻响（floop）。
    AudioBus.cue((plant.sounds && plant.sounds.sun) || opt.sound || "floop", 0.5);
    return drop;
  },

  produce: function (plant, board, dt, spec) {
    var atk = plant.species.attack || {};
    this.cycle(plant, dt, {
      key: spec.key || "sun",
      first: spec.first != null ? spec.first : plant._firstWait,
      interval: spec.interval != null ? spec.interval : atk.interval,
      windup: spec.windup != null ? spec.windup : (atk.windup || 0.2),
      recover: spec.recover != null ? spec.recover : (atk.recover || 0.3),
      anim: spec.anim || atk.anim,
      body: spec.body,
      glow: spec.glow !== false,
      ready: function () { return !board.phase || board.phase !== "won"; },
      strike: spec.strike,
    });
  },

  area: function (board, cx, row, opt) {
    opt = opt || {};
    var reach = (opt.reach == null ? 1.6 : opt.reach) * Lawn.COL_W;
    var span = opt.rowSpan == null ? 1 : opt.rowSpan;
    board.zombies.forEach(function (zombie) {
      if (!zombie.alive || zombie === opt.ignore) return;
      if (Math.abs(zombie.row - row) > span) return;
      if (Math.abs(zombie.x - cx) >= reach) return;
      zombie.takeDamage(opt.damage || 1800, board, {
        from: "around",
        element: opt.element || null,
        chill: opt.chill,
        freeze: opt.freeze,
        source: opt.source || "blast",
      });
    });
    if (opt.plants) {
      board.plants.forEach(function (plant) {
        if (plant.dead) return;
        if (Math.abs(plant.row - row) > span) return;
        var px = Lawn.cellLeft(plant.col) + Lawn.COL_W / 2;
        if (Math.abs(px - cx) >= reach) return;
        plant.dead = true;
      });
    }
    board.flash = opt.flash == null ? 0.55 : opt.flash;
    if (opt.sound) AudioBus.cue(opt.sound, 0.8);
  },

  fume: function (plant, board, opt) {
    var origin = Lawn.cellLeft(plant.col) + 30;
    var reach = (opt.cols || 4) * Lawn.COL_W;
    board.zombies.forEach(function (zombie) {
      if (!zombie.alive || zombie.hypno || zombie.row !== plant.row) return;
      if (zombie.altitude > 0) return;
      var dx = zombie.x - origin;
      if (dx < 0 || dx > reach) return;
      zombie.takeDamage(opt.damage || 20, board, { from: "around", source: "fume" });
    });
  },

  lob: function (plant, board, opt) {
    var target = null;
    board.zombies.forEach(function (zombie) {
      if (!zombie.alive || zombie.hypno || zombie.row !== plant.row) return;
      if (zombie.altitude > 0) return;
      if (zombie.x < Lawn.cellLeft(plant.col) + 20) return;
      if (!target || zombie.x < target.x) target = zombie;
    });
    if (!target && !opt.forceX) return null;
    var muzzle = Lawn.plantAt(plant.col, plant.row, plant.id);
    var lob = new Lob(plant.row, muzzle.x + 36, muzzle.y + 10, target ? target.x : opt.forceX, opt);
    lob.kind = opt.butter ? "butter" : (opt.kind || PROJECTILE_KIND[plant.id] || "cabbage");
    board.lobs.push(lob);
    // 投手出手伴投掷声；玉米投手另有玉米粒声。
    AudioBus.cue(opt.launch || (plant.sounds && plant.sounds.shoot) || ["throw", "throw2"], 0.55);
    if (plant.sounds && plant.sounds.launchExtra) AudioBus.cue(plant.sounds.launchExtra, 0.5);
    return lob;
  },

  touch: function (shot, board) {
    board.plants.forEach(function (plant) {
      if (!plant.species.onProjectile || plant.asleep) return;
      plant.species.onProjectile(plant, shot, board);
    });
  },

  blocked: function (shot, board) {
    var stop = false;
    board.plants.forEach(function (plant) {
      if (stop || plant.asleep || !plant.species.block) return;
      if (plant.species.block(plant, shot, board)) stop = true;
    });
    return stop;
  },
};
