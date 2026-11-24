// 豌豆射手。同一行右侧有僵尸才射击，前摇结束才飞出豌豆。
definePlant({
  "id": "peashooter",
  "name": "豌豆射手",
  "tip": "向敌人发射豌豆",
  "cost": 100,
  "cd": 7.5,
  "hp": 300,
  "reanim": "PeaShooterSingle",
  "sounds": {
    "shoot": ["throw", "throw2"]
  },
  "anim": "anim_full_idle",
  "anchor": {
    "x": 40,
    "y": 48
  },
  "aim": {
    "x": 40,
    "y": 52
  },
  "attack": {
    "anim": "anim_shooting",
    "windup": 0.16,
    "recover": 0.26,
    "interval": 1.45,
    "damage": 20,
    "element": null
  },
  update: function (plant, board, dt) {
    PlantFight.shoot(plant, board, dt);
  }
});
