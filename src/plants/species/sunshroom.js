// 阳光菇。先产 15 阳光，长成后产 25。白天睡觉。
definePlant({
  "id": "sunshroom",
  "name": "阳光菇",
  "tip": "开始时提供少量阳光，一段时间后产量变为和向日葵一致",
  "cost": 25,
  "cd": 7.5,
  "reanim": "SunShroom",
  "roles": [
    "sun"
  ],
  "sleep": "day",
  "sleepAnim": "anim_sleep",
  "attack": {
    "windup": 0.2,
    "recover": 0.3,
    "interval": 24
  },
  start: function (plant) {
    plant._firstWait = 5 + Math.random() * 4;
  },
  update: function (plant, board, dt) {
    plant.grown = (plant.grown || 0) + dt;
    var big = plant.grown >= 120;
    if (big) plant.pose = "anim_bigidle";
    PlantFight.produce(plant, board, dt, {
      strike: function () {
        PlantFight.sun(plant, board, { value: big ? 25 : 15, small: !big });
      },
    });
  }
});
