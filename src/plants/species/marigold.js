// 金盏花。按向日葵的节奏产出金币，不产阳光。
definePlant({
  "id": "marigold",
  "name": "金盏花",
  "tip": "提供金币和银币",
  "cost": 50,
  "cd": 30,
  "reanim": "Marigold",
  "attack": {
    "windup": 0.2,
    "recover": 0.3,
    "interval": 24
  },
  start: function (plant) {
    plant._firstWait = 5 + Math.random() * 4;
  },
  update: function (plant, board, dt) {
    PlantFight.produce(plant, board, dt, {
      strike: function () {
        PlantFight.sun(plant, board, { value: Math.random() < 0.25 ? 25 : 10, coin: true });
      },
    });
  }
});
