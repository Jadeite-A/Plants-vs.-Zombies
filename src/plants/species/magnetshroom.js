// 磁力菇。前摇后吸走范围内的金属护甲或金属道具。
definePlant({
  "id": "magnetshroom",
  "name": "磁力菇",
  "tip": "吸走铁桶、头盔或者其它金属物品",
  "cost": 100,
  "cd": 7.5,
  "reanim": "Magnetshroom",
  "sleep": "day",
  "sleepAnim": "anim_sleep",
  "attack": {
    "anim": "anim_shooting",
    "windup": 0.35,
    "recover": 0.45,
    "interval": 12,
    "body": true
  },
  update: function (plant, board, dt) {
    PlantFight.cycle(plant, dt, {
      windup: 0.35,
      recover: 0.45,
      interval: 12,
      anim: "anim_shooting",
      body: true,
      ready: function () {
        return board.zombies.some(function (zombie) { return metalNear(plant, zombie); });
      },
      strike: function () {
        var target = null;
        board.zombies.forEach(function (zombie) {
          if (!metalNear(plant, zombie)) return;
          if (!target) target = zombie;
        });
        if (target) {
          AudioBus.play("magnetshroom", 0.7);
          stealMetal(target);
        }
      },
    });
  }
});

function metalNear(plant, zombie) {
  if (!zombie.alive || zombie.hypno) return false;
  if (Math.abs(zombie.row - plant.row) > 2) return false;
  var col = Math.floor((zombie.x - Lawn.LAWN_X) / Lawn.COL_W);
  if (Math.abs(col - plant.col) > 2) return false;
  var armored = zombie.armor > 0 && zombie.species.armor && zombie.species.armor.metal;
  return armored || !!zombie.metalItem;
}

function stealMetal(zombie) {
  if (zombie.armor > 0 && zombie.species.armor && zombie.species.armor.metal) {
    zombie.armor = 0;
    zombie.armorId = "none";
  }
  if (zombie.metalItem === "pick") zombie.emerged = true;
  if (zombie.metalItem === "jack") zombie.disarmed = true;
  zombie.metalItem = null;
}
