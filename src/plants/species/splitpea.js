// 双向射手。前面按豌豆射手射击，后面按双重射手的节奏向后射。
definePlant({
  "id": "splitpea",
  "name": "双向射手",
  "tip": "同时向前后发射豌豆",
  "cost": 125,
  "cd": 7.5,
  "reanim": "SplitPea",
  "sounds": {
    "shoot": ["throw", "throw2"]
  },
  "layers": [
    "anim_idle",
    "anim_head_idle",
    "anim_splitpea_idle"
  ],
  "attack": {
    "anim": "anim_shooting",
    "windup": 0.16,
    "recover": 0.26,
    "interval": 1.45,
    "damage": 20,
    "element": null
  },
  update: function (plant, board, dt) {
    PlantFight.shoot(plant, board, dt, { key: "front", dir: 1 });
    PlantFight.shoot(plant, board, dt, {
      key: "back", dir: -1, shots: 2, gap: 0.2, windup: 0.25, recover: 0.1, rate: 35, quiet: true,
    });
  }
});
