// 三重射手。本行和上下两行同时各打一颗。
definePlant({
  "id": "threepeater",
  "name": "三重射手",
  "tip": "一次射出三行豌豆",
  "cost": 325,
  "cd": 7.5,
  "reanim": "ThreePeater",
  "sounds": {
    "shoot": ["throw", "throw2"]
  },
  "layers": [
    "anim_idle",
    "anim_head_idle1",
    "anim_head_idle3",
    "anim_head_idle2"
  ],
  "attack": {
    "anim": "anim_shooting1",
    "windup": 0.16,
    "recover": 0.26,
    "interval": 1.45,
    "damage": 20,
    "rows": [
      -1,
      0,
      1
    ]
  },
  update: function (plant, board, dt) {
    PlantFight.shoot(plant, board, dt, { skipRow: true });
  }
});
