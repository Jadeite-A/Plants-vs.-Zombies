// 雪橇车。碾过植物，身后留下冰。地刺会扎破它。
defineZombie({
  "id": "zomboni",
  "name": "雪橇车僵尸",
  "hp": 450,
  "speed": 14,
  "armAt": 0,
  "vehicle": true,
  "reanim": "Zombie_zamboni",
  "sounds": {
    "spawn": "zamboni"
  },
  "anims": {
    "idle": "anim_drive",
    "walk": "anim_drive",
    "eat": "anim_drive",
    "die": "anim_wheelie2"
  },
  "attack": {
    "windup": 0,
    "recover": 0,
    "interval": 1,
    "damage": 1800
  },
  update: function (zombie, board, dt) {
    if (ZombieFight.held(zombie)) return;
    zombie.state = "walk";
    zombie.x -= zombie.speed * zombie.speedMul() * dt;
    if (board.addIce) board.addIce(zombie.row, zombie.x);
    board.plants.forEach(function (plant) {
      if (plant.dead || plant.passable || plant.row !== zombie.row) return;
      var left = Lawn.cellLeft(plant.col);
      if (zombie.x < left + Lawn.COL_W && zombie.x > left) plant.dead = true;
    });
    zombie.reachHouse(board);
  }
});
