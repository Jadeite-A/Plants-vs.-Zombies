// 向日葵。前摇后吐出 25 阳光，之后按间隔重复。
definePlant({
  "id": "sunflower",
  "name": "向日葵",
  "tip": "为你提供更多阳光",
  "cost": 50,
  "cd": 7.5,
  "hp": 300,
  "reanim": "SunFlower",
  "anim": "anim_idle",
  "anchor": {
    "x": 37,
    "y": 46
  },
  "aim": {
    "x": 37,
    "y": 50
  },
  "roles": [
    "sun"
  ],
  "attack": {
    "windup": 0.2,
    "recover": 0.35,
    "interval": 20
  },
  start: function (plant) {
    plant._firstWait = 5 + Math.random() * 4;
  },
  update: function (plant, board, dt) {
    PlantFight.produce(plant, board, dt, {
      strike: function () { PlantFight.sun(plant, board, { value: 25 }); },
    });
  }
});
