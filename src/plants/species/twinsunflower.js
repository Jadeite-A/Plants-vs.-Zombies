// 双胞向日葵。种在向日葵上，一次吐出两颗阳光。
definePlant({
  "id": "twinsunflower",
  "name": "双胞向日葵",
  "tip": "为你提供两倍于普通向日葵的阳光\n（需要向日葵）",
  "cost": 150,
  "cd": 50,
  "reanim": "TwinSunflower",
  "upgrade": true,
  "roles": [
    "sun"
  ],
  "requires": [
    "sunflower"
  ],
  "replaces": "sunflower",
  "attack": {
    "windup": 0.25,
    "recover": 0.35,
    "interval": 20
  },
  start: function (plant) {
    plant._firstWait = 5 + Math.random() * 4;
  },
  update: function (plant, board, dt) {
    PlantFight.produce(plant, board, dt, {
      strike: function () {
        var left = PlantFight.sun(plant, board, { value: 25, dx: 16 });
        var right = PlantFight.sun(plant, board, { value: 25, dx: 52 });
        if (left) left.x -= 10;
        if (right) right.x += 10;
      },
    });
  }
});
