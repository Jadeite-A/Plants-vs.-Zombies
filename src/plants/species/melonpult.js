// 西瓜投手。直击 80，周围溅射。
definePlant({
  "id": "melonpult",
  "name": "西瓜投手",
  "tip": "投出西瓜，重重打击成群的僵尸",
  "cost": 300,
  "cd": 7.5,
  "reanim": "Melonpult",
  "card": {
    "x": 24,
    "y": 36,
    "scale": 0.82
  },
  "attack": {
    "anim": "anim_shooting",
    "windup": 0.35,
    "recover": 0.4,
    "interval": 2.8,
    "damage": 80,
    "body": true
  },
  update: function (plant, board, dt) {
    PlantFight.cycle(plant, dt, {
      windup: 0.35,
      recover: 0.4,
      interval: 2.8,
      anim: "anim_shooting",
      body: true,
      keep: 1.2,
      ready: function () { return PlantFight.zombieAhead(plant, board, { ground: true }); },
      strike: function () { PlantFight.lob(plant, board, { damage: 80, splash: 26, splashR: 70, launch: ["throw", "throw2"], impact: ["melonimpact", "melonimpact2"] }); },
    });
  }
});
