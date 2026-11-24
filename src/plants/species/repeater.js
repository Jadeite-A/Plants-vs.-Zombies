// 双重射手。前摇之后连射两颗，中间有短间隔，然后后摇。
definePlant({
  "id": "repeater",
  "name": "双重射手",
  "tip": "一次发射两颗豌豆",
  "cost": 200,
  "cd": 7.5,
  "reanim": "PeaShooter",
  "anim": "anim_full_idle",
  "attack": {
    "anim": "anim_shooting",
    "windup": 0.14,
    "recover": 0.2,
    "interval": 1.45,
    "shots": 2,
    "gap": 0.14,
    "damage": 20,
    "element": null
  },
  update: function (plant, board, dt) {
    PlantFight.shoot(plant, board, dt);
  }
});
