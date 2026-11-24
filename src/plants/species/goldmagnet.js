// 吸金菇。种在磁力菇上，把场上的金币吸过来。不吸金属。
definePlant({
  "id": "goldmagnet",
  "name": "吸金菇",
  "tip": "收集硬币和钻石\n（需要磁力菇）",
  "cost": 50,
  "cd": 50,
  "reanim": "GoldMagnet",
  "upgrade": true,
  "requires": [
    "magnetshroom"
  ],
  "replaces": "magnetshroom",
  "attack": {
    "anim": "anim_attract",
    "windup": 0.2,
    "recover": 0.4,
    "interval": 1,
    "body": true
  },
  update: function (plant, board, dt) {
    PlantFight.cycle(plant, dt, {
      windup: 0.2,
      recover: 0.4,
      interval: 1,
      anim: "anim_attract",
      body: true,
      ready: function () {
        return board.suns.some(function (sun) { return sun.coin && !sun.collect; });
      },
      strike: function () {
        board.suns.forEach(function (sun) {
          if (sun.coin && !sun.collect) sun.collect = true;
        });
      },
    });
  }
});
