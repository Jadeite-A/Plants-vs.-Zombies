// 僵尸通用行为：行进、啃咬（前摇/后摇）、护甲浸泡、爆炸。
// 僵尸行进和啃咬的公共动作。前摇、出手、后摇写在每种僵尸自己的文件里。
var ZombieFight = {
  held: function (zombie) {
    return !!(zombie.statuses && (zombie.statuses.freeze || zombie.statuses.butter));
  },

  soak: function (zombie, hit, broken) {
    if (zombie.armor <= 0) return hit.amount;
    zombie.armor -= hit.amount;
    if (zombie.armor > 0) return 0;
    var overflow = -zombie.armor;
    zombie.armor = 0;
    zombie.armorId = "none";
    if (broken) broken(zombie, hit);
    return overflow;
  },

  // 碰上植物先停步，啃咬动画从举手那一帧播起，手送到嘴边才掉血。
  // 之后按 interval 重复。减速时举手和咬合一起变慢。
  bite: function (zombie, plant, board, dt) {
    if (this.held(zombie) || !plant || plant.dead) return null;
    var atk = zombie.species.attack || { windup: 0.4, recover: 0.6, interval: 1, damage: 70 };
    var windup = atk.windup == null ? 0.4 : atk.windup;
    var interval = atk.interval == null ? 1 : atk.interval;
    if (!zombie.eating) {
      zombie.eating = true;
      zombie.eatAge = 0;
      zombie.biteClock = 0;
      zombie.bites = 0;
    }
    var step = dt * zombie.speedMul();
    zombie.eatAge += step;
    zombie.biteClock += step;
    zombie.state = "eat";
    zombie.phase = zombie.biteClock < windup && !zombie.bites ? "windup" : "recover";
    zombie.attackAnim = atk.anim || "anim_eat";
    var due = zombie.bites ? interval : windup;
    if (zombie.biteClock < due) return null;
    zombie.biteClock = 0;
    zombie.bites += 1;
    if (plant.species.onBite) {
      var result = plant.species.onBite(plant, zombie, board);
      if (result === "stop") return "stop";
    }
    plant.hp -= atk.damage == null ? 70 : atk.damage;
    var soft = plant.id === "wallnut" || plant.id === "tallnut" || plant.id === "pumpkin";
    if (plant.id === "garlic") {
      AudioBus.cue("chomp", 0.5);
      AudioBus.cue(Math.random() < 0.5 ? "yuck" : "yuck2", 0.5);
    } else AudioBus.cue(soft ? "chompsoft" : zombie.sounds.bite, 0.5);
    if (plant.hp <= 0) AudioBus.cue(zombie.sounds.biteKill, 0.45);
    return "hit";
  },

  march: function (zombie, board, dt) {
    if (this.held(zombie)) {
      if (zombie.state !== "die") zombie.state = "idle";
      return;
    }
    if (zombie.hypno) return this.ally(zombie, board, dt);
    var plant = board.plantInFront(zombie);
    if (plant) return this.bite(zombie, plant, board, dt);
    if (zombie.eating) {
      zombie.leaveEat = 0.18;
      zombie.eatHold = zombie.eatAge || 0;
    }
    zombie.eating = false;
    zombie.eatAge = 0;
    zombie.biteClock = 0;
    zombie.bites = 0;
    zombie.state = "walk";
    zombie.phase = "idle";
    zombie.x -= zombie.speed * zombie.speedMul() * dt;
    zombie.reachHouse(board);
    return null;
  },

  ally: function (zombie, board, dt) {
    var atk = zombie.species.attack || { interval: 1, damage: 70 };
    var foe = null;
    board.zombies.forEach(function (other) {
      if (other === zombie || !other.alive || other.hypno || other.row !== zombie.row) return;
      if (other.x < zombie.x - 8 || other.x > zombie.x + 56) return;
      if (!foe || other.x < foe.x) foe = other;
    });
    if (foe) {
      zombie.state = "eat";
      zombie.allyTime = (zombie.allyTime == null ? atk.interval : zombie.allyTime) - dt;
      if (zombie.allyTime <= 0) {
        zombie.allyTime = atk.interval;
        foe.takeDamage(atk.damage == null ? 70 : atk.damage, board, { from: "front", source: "hypno" });
      }
      return;
    }
    zombie.state = "walk";
    zombie.x += zombie.speed * zombie.speedMul() * dt;
    if (zombie.x > Lawn.LAWN_X + Lawn.COLS * Lawn.COL_W + 40) zombie.die(board);
  },

  blast: function (zombie, board, opt) {
    opt = opt || {};
    PlantFight.area(board, zombie.x, zombie.row, {
      reach: opt.reach == null ? 1.6 : opt.reach,
      rowSpan: opt.rowSpan == null ? 1 : opt.rowSpan,
      damage: opt.damage || 1800,
      plants: true,
      ignore: zombie,
      sound: opt.sound,
      source: "zombie-blast",
    });
  },
};

Rules.add("armor", "metal", {
  absorb: function (zombie, hit) {
    // 铁桶、头盔被击中时一声金属响。
    if (zombie.armor > 0) AudioBus.cue(["shieldhit", "shieldhit2"], 0.35);
    return ZombieFight.soak(zombie, hit, function (owner, info) {
      owner.metal = false;
      var bit = owner.species.armor && owner.species.armor.bit;
      info.board.spawnBit(owner, bit || "bucket");
      AudioBus.cue(owner.sounds.armorBreak, 0.4);
    });
  },
});
