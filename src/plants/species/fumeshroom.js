// 大喷菇。喷 4 格，打中这条线上的全部僵尸，正面护甲挡不住。
definePlant({
  "id": "fumeshroom",
  "name": "大喷菇",
  "tip": "喷射可以穿过铁丝网门的气泡",
  "cost": 75,
  "cd": 7.5,
  "reanim": "FumeShroom",
  "sleep": "day",
  "sleepAnim": "anim_sleep",
  "attack": {
    "anim": "anim_shooting",
    "windup": 0.16,
    "recover": 0.24,
    "interval": 1.45,
    "damage": 20,
    "cols": 4,
    "body": true
  },
  update: function (plant, board, dt) {
    PlantFight.cycle(plant, dt, {
      windup: 0.16,
      recover: 0.24,
      interval: 1.45,
      anim: "anim_shooting",
      body: true,
      keep: 1.2,
      ready: function () { return PlantFight.zombieAhead(plant, board, { cols: 4, ground: true }); },
      strike: function () {
        AudioBus.cue("fume", 0.6);
        PlantFight.fume(plant, board, { cols: 4, damage: 20 });
      },
    });
  }
});
