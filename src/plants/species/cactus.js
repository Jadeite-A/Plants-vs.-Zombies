// 仙人掌。地面僵尸打尖刺；同线有气球时升起，改打空中。
definePlant({
  "id": "cactus",
  "name": "仙人掌",
  "tip": "发射能够刺破气球的尖刺",
  "cost": 125,
  "cd": 7.5,
  "reanim": "Cactus",
  "sounds": {
    "shoot": ["throw", "throw2"]
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
    var air = PlantFight.zombieAhead(plant, board, { air: true });
    if (air) {
      plant.pose = "anim_idlehigh";
      PlantFight.shoot(plant, board, dt, { key: "air", air: true, anim: "anim_shootinghigh" });
      return;
    }
    plant.pose = null;
    PlantFight.shoot(plant, board, dt, { key: "ground", ground: true });
  }
});
