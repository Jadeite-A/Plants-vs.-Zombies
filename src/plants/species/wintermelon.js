// 冰西瓜。种在西瓜投手上，直击加溅射，并让被打中的僵尸减速。
definePlant({
  "id": "wintermelon",
  "name": "冰西瓜",
  "tip": "重重打击成群的僵尸，并减慢它们的速度\n（需要西瓜）",
  "cost": 200,
  "cd": 50,
  "reanim": "WinterMelon",
  "upgrade": true,
  "requires": [
    "melonpult"
  ],
  "replaces": "melonpult",
  "card": {
    "x": 28,
    "y": 32,
    "scale": 0.78
  },
  "attack": {
    "anim": "anim_shooting",
    "windup": 0.35,
    "recover": 0.4,
    "interval": 2.8,
    "damage": 80,
    "element": "ice",
    "chill": 4,
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
      strike: function () {
        PlantFight.lob(plant, board, {
          damage: 80, splash: 26, splashR: 70, element: "ice", chill: 4,
          launch: ["throw", "throw2"], impact: ["melonimpact", "melonimpact2"],
        });
      },
    });
  }
});
