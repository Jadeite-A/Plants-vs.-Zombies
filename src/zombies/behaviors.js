// 僵尸公共规则：行进方式（走/飞/钻地/撑杆）、啃咬攻击、召唤、护甲规则。
// 护甲、召唤这些还被多种僵尸共用。
// 每种植物、僵尸的攻击、前摇和后摇在 src/plants/species、src/zombies/species 各自的文件里，关卡不调用这里。
//
// 受击 hit：{ amount, board, from, element, source }
//   from = "front" 正面（豌豆），"around" 爆炸或死亡时拆甲（防盗门挡不住）
//   element = "ice" 时由僵尸自己上减速，immune 里写了 "chill" 的不受影响

function speedOf(actor) {
  var mul = 1;
  if (actor.statuses && actor.statuses.chill) mul *= actor.statuses.chill.mul;
  if (actor.statuses && actor.statuses.enrage) mul *= actor.statuses.enrage.mul;
  return actor.speed * mul;
}

Rules.add("locomotion", "walk", {
  update: function (zombie, board, dt) {
    var plant = board.plantInFront(zombie);
    if (plant) {
      zombie.state = "eat";
      var bite = Rules.use("attack", zombie.attack);
      if (bite) bite.update(zombie, plant, dt);
    } else {
      if (zombie.state === "eat") zombie.animTime = 0;
      zombie.state = "walk";
      zombie.x -= speedOf(zombie) * dt;
    }
    zombie.reachHouse(board);
  },
});

// 跑步和步行同一套判定，差别只在配置里的 speed。
Rules.add("locomotion", "run", Rules.use("locomotion", "walk"));

// 滞空：不啃植物，也不触发小推车。altitude 降到 0 后改走步行。
Rules.add("locomotion", "fly", {
  update: function (zombie, board, dt) {
    if (zombie.altitude <= 0) {
      zombie.locomotion = "walk";
      return Rules.use("locomotion", "walk").update(zombie, board, dt);
    }
    zombie.state = "walk";
    zombie.x -= speedOf(zombie) * dt;
  },
});

// 挖地：钻到小推车前再钻出，之后朝右走回去。
Rules.add("locomotion", "burrow", {
  update: function (zombie, board, dt) {
    if (!zombie.emerged) {
      zombie.state = "burrow";
      zombie.x -= speedOf(zombie) * dt;
      if (zombie.x <= Lawn.LAWN_X + 70) {
        zombie.emerged = true;
        zombie.speed = Math.abs(zombie.speed);
        zombie.x += 8;
      }
      return;
    }
    var plant = board.plantInFront(zombie);
    if (plant) {
      zombie.state = "eat";
      var bite = Rules.use("attack", zombie.attack);
      if (bite) bite.update(zombie, plant, dt);
      return;
    }
    zombie.state = "walk";
    zombie.x += speedOf(zombie) * dt;
  },
});

// 撑杆：先以 1.8 倍速跑，越过面前那一格植物后改步行。
Rules.add("locomotion", "pole", {
  update: function (zombie, board, dt) {
    if (zombie.vaulted) return Rules.use("locomotion", "walk").update(zombie, board, dt);
    var plant = board.plantInFront(zombie);
    if (plant) {
      zombie.vaulted = true;
      zombie.x = Lawn.cellLeft(plant.col) - 16;
      zombie.animTime = 0;
      return;
    }
    zombie.state = "walk";
    zombie.x -= speedOf(zombie) * 1.8 * dt;
    zombie.reachHouse(board);
  },
});

Rules.add("attack", "bite", {
  update: function (zombie, plant, dt) {
    zombie.biteTimer -= dt;
    if (zombie.biteTimer > 0) return;
    zombie.biteTimer = zombie.attackEvery;
    plant.hp -= zombie.attackDamage;
    AudioBus.cue(zombie.sounds.bite, 0.5);
    if (plant.hp <= 0) AudioBus.cue(zombie.sounds.biteKill, 0.45);
  },
});

// 召唤。配置 summon: { every, types, rowOffsets }。
// 落在本关没铺草的行会被丢掉；召唤物不计入关卡进度。
Rules.add("special", "summon", {
  update: function (zombie, board, dt) {
    var spec = zombie.summon;
    if (!spec) return;
    zombie.summonTimer -= dt;
    if (zombie.summonTimer > 0) return;
    zombie.summonTimer = spec.every;
    spec.types.forEach(function (type, index) {
      var row = zombie.row + (spec.rowOffsets ? spec.rowOffsets[index] || 0 : 0);
      if (board.level.rows.indexOf(row) < 0) return;
      board.spawnExtra(type, row, zombie.x + 20);
    });
  },
});

// 护甲先扣。还没碎就吞掉全部伤害；碎了之后把溢出的伤害还给本体，并回调 broken。
function soakArmor(zombie, hit, broken) {
  if (zombie.armor <= 0) return hit.amount;
  zombie.armor -= hit.amount;
  if (zombie.armor > 0) return 0;
  var overflow = -zombie.armor;
  zombie.armor = 0;
  zombie.armorId = "none";
  if (broken) broken(zombie, hit);
  return overflow;
}

Rules.add("armor", "none", {
  absorb: function (zombie, hit) {
    return hit.amount;
  },
});

Rules.add("armor", "cone", {
  absorb: function (zombie, hit) {
    // 路障被击中时一声塑料闷响。
    if (zombie.armor > 0) AudioBus.cue(["plastichit", "plastichit2"], 0.35);
    return soakArmor(zombie, hit, function (owner, info) {
      owner.coneDropped = true;
      owner.type = owner.armorBreakInto || "normal";
      info.board.spawnBit(owner, "cone");
      AudioBus.cue(owner.sounds.armorBreak, 0.4);
    });
  },
});

// 防盗门只挡 from === "front"。爆炸、背后、上下来的伤害整段打到本体。
Rules.add("armor", "screen", {
  absorb: function (zombie, hit) {
    if (hit.from !== "front") return hit.amount;
    // 门被击中时一声金属声。
    if (zombie.armor > 0) AudioBus.cue(["shieldhit", "shieldhit2"], 0.35);
    return soakArmor(zombie, hit, function (owner, info) {
      owner.type = owner.armorBreakInto || owner.kindId;
      info.board.spawnBit(owner, (owner.species.armor && owner.species.armor.bit) || "door");
      AudioBus.cue(owner.sounds.armorBreak, 0.4);
    });
  },
});
