// 卷心菜投手。抛物线打最近的地面僵尸，正面护甲挡不住。
definePlant({
  "id": "cabbagepult",
  "name": "卷心菜投手",
  "tip": "向敌人投掷小卷心菜",
  "cost": 100,
  "cd": 7.5,
  "reanim": "Cabbagepult",
  "card": {
    "x": 23,
    "y": 40
  },
  "attack": {
    "anim": "anim_shooting",
    "windup": 0.3,
    "recover": 0.35,
    "interval": 2.8,
    "damage": 40,
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
      strike: function () { PlantFight.lob(plant, board, { damage: 40, launch: ["throw", "throw2"] }); },
    });
  }
});
