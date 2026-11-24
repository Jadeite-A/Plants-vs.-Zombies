// 机枪射手。种在双重射手上。前摇后连射四颗。
definePlant({
  "id": "gatlingpea",
  "name": "机枪射手",
  "tip": "一次射出四颗豌豆\n（需要双重射手）",
  "cost": 250,
  "cd": 50,
  "reanim": "GatlingPea",
  "upgrade": true,
  "sounds": {
    "shoot": ["throw", "throw2"]
  },
  "layers": [
    "anim_idle",
    "anim_head_idle"
  ],
  "requires": [
    "repeater"
  ],
  "replaces": "repeater",
  "attack": {
    "anim": "anim_shooting",
    "windup": 0.12,
    "recover": 0.18,
    "interval": 1.5,
    "shots": 4,
    "gap": 0.08,
    "damage": 20,
    "element": null
  },
  update: function (plant, board, dt) {
    PlantFight.shoot(plant, board, dt);
  }
});
