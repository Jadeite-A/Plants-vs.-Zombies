// 萝卜伞。挡下周围的篮球和蹦极。挡住之后有一小段后摇。
definePlant({
  "id": "umbrellaleaf",
  "name": "萝卜伞",
  "tip": "保护周围的植物，让蹦蹦僵尸和投石车僵尸无法伤害它们",
  "cost": 100,
  "cd": 7.5,
  "reanim": "Umbrellaleaf",
  "attack": {
    "anim": "anim_block",
    "windup": 0.1,
    "recover": 0.5,
    "body": true
  },
  block: function (plant, shot) {
    if (!shot.sky || plant.shoot > 0) return false;
    if (Math.abs(shot.row - plant.row) > 1) return false;
    var col = Math.floor((shot.targetX - Lawn.LAWN_X) / Lawn.COL_W);
    if (Math.abs(col - plant.col) > 1) return false;
    plant.pose = "anim_block";
    plant.shoot = 0.5;
    plant.phase = "recover";
    return true;
  },
  update: function (plant, board, dt) {
    if (plant.shoot > 0) return;
    board.zombies.forEach(function (zombie) {
      if (!zombie.alive || !zombie.bungee || zombie.leaving || !zombie.target) return;
      if (Math.abs(zombie.target.col - plant.col) > 1 || Math.abs(zombie.target.row - plant.row) > 1) return;
      zombie.leaving = true;
      plant.pose = "anim_block";
      plant.shoot = 0.5;
    });
  }
});
