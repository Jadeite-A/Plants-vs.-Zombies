// 胆小菇。远程射击；僵尸走进约 1 格时缩起来，缩着不攻击。
definePlant({
  "id": "scaredyshroom",
  "name": "胆小菇",
  "tip": "发射远程孢子，但敌人靠近时会胆小地缩进地里",
  "cost": 25,
  "cd": 7.5,
  "reanim": "ScaredyShroom",
  "sleep": "day",
  "sleepAnim": "anim_sleep",
  "sounds": {
    "shoot": "puff"
  },
  "attack": {
    "anim": "anim_shooting",
    "windup": 0.14,
    "recover": 0.22,
    "interval": 1.45,
    "damage": 20,
    "body": true
  },
  update: function (plant, board, dt) {
    if (PlantFight.zombieAhead(plant, board, { cols: 1.15 })) {
      plant.pose = "anim_scaredidle";
      plant.shoot = 0;
      return;
    }
    plant.pose = null;
    PlantFight.shoot(plant, board, dt);
  }
});
