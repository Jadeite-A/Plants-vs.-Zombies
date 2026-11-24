// 多嘴小蘑菇。种在大喷菇上，向周围一圈持续喷雾。白天睡觉。
definePlant({
  "id": "gloomshroom",
  "name": "多嘴小蘑菇",
  "tip": "向周围喷射大量浓烟\n（需要大喷菇）",
  "cost": 150,
  "cd": 50,
  "reanim": "GloomShroom",
  "upgrade": true,
  "sleep": "day",
  "sleepAnim": "anim_sleep",
  "requires": [
    "fumeshroom"
  ],
  "replaces": "fumeshroom",
  "attack": {
    "anim": "anim_shooting",
    "windup": 0.1,
    "recover": 0.12,
    "interval": 0.35,
    "damage": 20,
    "body": true
  },
  update: function (plant, board, dt) {
    PlantFight.cycle(plant, dt, {
      windup: 0.1,
      recover: 0.12,
      interval: 0.35,
      anim: "anim_shooting",
      body: true,
      ready: function () {
        return board.zombies.some(function (zombie) {
          if (!zombie.alive || zombie.hypno || zombie.altitude > 0) return false;
          if (Math.abs(zombie.row - plant.row) > 1) return false;
          var col = Math.floor((zombie.x - Lawn.LAWN_X) / Lawn.COL_W);
          return Math.abs(col - plant.col) <= 1;
        });
      },
      strike: function () {
        var cx = Lawn.cellLeft(plant.col) + Lawn.COL_W / 2;
        board.zombies.forEach(function (zombie) {
          if (!zombie.alive || zombie.hypno || zombie.altitude > 0) return;
          if (Math.abs(zombie.row - plant.row) > 1) return;
          if (Math.abs(zombie.x - cx) > Lawn.COL_W * 1.35) return;
          zombie.takeDamage(20, board, { from: "around", source: "gloom" });
        });
      },
    });
  }
});
