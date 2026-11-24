// 玉米投手。大多丢玉米粒，每四发有一发黄油，黄油把僵尸定住。
definePlant({
  "id": "kernelpult",
  "name": "玉米投手",
  "tip": "向僵尸投掷玉米粒和黄油块",
  "cost": 100,
  "cd": 7.5,
  "reanim": "Cornpult",
  "card": {
    "x": 32,
    "y": 36,
    "scale": 0.86
  },
  "attack": {
    "anim": "anim_shooting",
    "windup": 0.3,
    "recover": 0.35,
    "interval": 2.8,
    "damage": 20,
    "body": true
  },
  update: function (plant, board, dt) {
    PlantFight.cycle(plant, dt, {
      windup: 0.3,
      recover: 0.35,
      interval: 2.8,
      anim: "anim_shooting",
      body: true,
      keep: 1.2,
      ready: function () { return PlantFight.zombieAhead(plant, board, { ground: true }); },
      strike: function () {
        plant.kernels = (plant.kernels || 0) + 1;
        var butter = plant.kernels % 4 === 0;
        PlantFight.lob(plant, board, {
          damage: butter ? 40 : 20,
          butter: butter ? 4 : 0,
          launch: ["kernelpult", "kernelpult2"],
          impact: butter ? "butter" : null,
        });
      },
    });
  }
});
