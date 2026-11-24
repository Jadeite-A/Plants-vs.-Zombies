// 蹦极僵尸。从空中落下，前摇抓住一株植物后拖走。萝卜伞能把它挡开。
defineZombie({
  "id": "bungee",
  "name": "蹦极僵尸",
  "hp": 160,
  "speed": 0,
  "armAt": 0,
  "bungee": true,
  "reanim": "Zombie_bungi",
  "sounds": {
    "spawn": ["bungee_scream", "bungee_scream2", "bungee_scream3"]
  },
  "anims": {
    "idle": "anim_hold",
    "drop": "anim_drop",
    "grab": "anim_grab",
    "raise": "anim_raise",
    "walk": "anim_drop",
    "eat": "anim_grab",
    "die": "anim_raise"
  },
  "attack": {
    "windup": 1.2,
    "recover": 0.6,
    "damage": 0
  },
  update: function (zombie, board, dt) {
    // 屋顶最后一波：飞贼吊着一只僵尸落到格子上，放下后自己升回去。
    if (zombie.delivery) {
      zombie.drop = (zombie.drop || 0) + dt;
      var fall = 1.3;
      zombie.dropIn = Math.max(0, 1 - zombie.drop / fall);
      zombie.state = zombie.drop < fall ? "drop" : "raise";
      if (zombie.cargo) {
        zombie.cargo.x = zombie.x - 10;
        zombie.cargo.row = zombie.row;
      }
      if (zombie.drop >= fall && !zombie.released) {
        zombie.released = true;
        var shade = board.plants.some(function (plant) {
          return !plant.dead && plant.id === "umbrellaleaf" && plant.col === zombie.col && plant.row === zombie.row;
        });
        if (zombie.cargo) {
          if (shade) zombie.cargo.swallowed = true;
          else zombie.cargo.carried = false;
          zombie.cargo = null;
        }
        if (shade) AudioBus.play("boing", 0.6);
      }
      if (zombie.drop > fall + 1.1) {
        zombie.loot = true;
        zombie.die(board);
      }
      return;
    }
    // 蹦极闪电战里蹦极僵尸只负责空投，抓完就撤。
    if (zombie.blitz) {
      zombie.drop = (zombie.drop || 0) + dt;
      zombie.state = zombie.drop < 1.1 ? "drop" : "raise";
      zombie.phase = zombie.drop < 1.1 ? "windup" : "recover";
      if (zombie.drop > 1.6) zombie.die(board);
      return;
    }
    if (zombie.leaving) {
      zombie.state = "raise";
      zombie.phase = "recover";
      zombie.lift = (zombie.lift || 0) + dt;
      if (zombie.lift > 0.8) zombie.die(board);
      return;
    }
    if (!zombie.target) {
      var plants = board.plants.filter(function (plant) {
        return !plant.dead && !plant.passable && plant.seat !== "platform";
      });
      if (!plants.length) { zombie.die(board); return; }
      zombie.target = plants[Math.floor(Math.random() * plants.length)];
      zombie.row = zombie.target.row;
      zombie.x = Lawn.cellLeft(zombie.target.col) + 24;
      zombie.drop = 0;
      return;
    }
    if (zombie.target.dead) { zombie.leaving = true; return; }
    zombie.drop = (zombie.drop || 0) + dt;
    zombie.state = zombie.drop < 1.2 ? "drop" : "grab";
    zombie.phase = zombie.drop < 1.2 ? "windup" : "recover";
    zombie.phaseTime = zombie.drop;
    if (zombie.drop < 2) return;
    zombie.target.dead = true;
    zombie.leaving = true;
  }
});
