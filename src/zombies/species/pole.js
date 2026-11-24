// 撑杆僵尸。助跑时更快，前摇起跳越过一株植物。高坚果跳不过。
// 保龄球玩法下的专用行为登记在 "mode-zombie" 组，由 Zombie.update 分发，
// 这里不出现任何关卡 id。
defineZombie({
  "id": "pole",
  "name": "撑杆僵尸",
  "hp": 160,
  "speed": 18,
  "armAt": 70,
  "reanim": "Zombie_polevaulter",
  "locomotion": "pole",
  "anims": {
    "idle": "anim_walk",
    "walk": "anim_walk",
    "run": "anim_run",
    "jump": "anim_jump",
    "eat": "anim_eat",
    "die": "anim_death"
  },
  "attack": {
    "anim": "anim_eat",
    "windup": 0.28,
    "recover": 0.45,
    "interval": 1,
    "damage": 70,
    "vaultWindup": 0.35
  },
  update: function (zombie, board, dt) {
    if (zombie.vaulted) return ZombieFight.march(zombie, board, dt);
    if (ZombieFight.held(zombie)) return;
    var plant = board.plantInFront(zombie);
    if (plant && plant.tall) return ZombieFight.bite(zombie, plant, board, dt);
    if (plant) {
      if (zombie.jump == null) {
        // 起跳伴撑杆的撑地声，跳跃动画从头播。
        AudioBus.play("polevault", 0.7);
        zombie.jump = 0;
        zombie.animTime = 0;
      }
      zombie.state = "jump";
      zombie.phase = "windup";
      zombie.jump += dt;
      if (zombie.jump < 0.35) return;
      zombie.vaulted = true;
      zombie.phase = "recover";
      zombie.x = Lawn.cellLeft(plant.col) - 16;
      zombie.animTime = 0;
      return;
    }
    zombie.state = "run";
    zombie.x -= zombie.speed * 1.8 * zombie.speedMul() * dt;
    zombie.reachHouse(board);
  }
});

// 保龄球里撑杆提前起跳，跳的过程停在原地，坚果从脚下滚过去。
// 只登记为保龄球玩法下的撑杆行为，不在常规行进里出现。
Rules.add("mode-zombie", "bowling:pole", function (zombie, board, dt) {
  bowlPole(zombie, board, dt);
  return true;
});

function bowlPole(zombie, board, dt) {
  if (!zombie.alive) return;
  if (zombie.vaulted) return ZombieFight.march(zombie, board, dt);
  if (zombie.jumping) {
    zombie.jump += dt;
    zombie.state = "jump";
    zombie.phase = zombie.jump < 0.35 ? "windup" : "recover";
    if (zombie.jump < 0.6) return;
    zombie.jumping = false;
    zombie.vaulted = true;
    zombie.state = "walk";
    return;
  }
  var nut = null;
  (board.nuts || []).forEach(function (item) {
    if (item.dead || !item.aligned || item.row !== zombie.row) return;
    var gap = zombie.x - item.x;
    if (gap > 36 && gap < 170) nut = item;
  });
  if (nut) {
    zombie.jumping = true;
    zombie.jump = 0;
    zombie.state = "jump";
    zombie.phase = "windup";
    return;
  }
  zombie.state = "run";
  zombie.x -= zombie.speed * 1.8 * zombie.speedMul() * dt;
  zombie.reachHouse(board);
}
