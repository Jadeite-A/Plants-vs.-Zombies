// 猫尾草。种在莲叶上，尖刺会追踪任意行的僵尸和气球。
definePlant({
  "id": "cattail",
  "name": "猫尾草",
  "tip": "攻击所有方向上的僵尸和气球僵尸\n（需要莲叶）",
  "cost": 225,
  "cd": 50,
  "reanim": "Cattail",
  "upgrade": true,
  "requires": [
    "lilypad"
  ],
  "replaces": "lilypad",
  "aquatic": true,
  "attack": {
    "anim": "anim_shooting",
    "windup": 0.2,
    "recover": 0.25,
    "interval": 1.45,
    "damage": 20,
    "body": true
  },
  update: function (plant, board, dt) {
    PlantFight.cycle(plant, dt, {
      windup: 0.2,
      recover: 0.25,
      interval: 1.45,
      anim: "anim_shooting",
      body: true,
      keep: 1.2,
      ready: function () { return !!PlantFight.nearest(plant, board); },
      strike: function () {
        var target = PlantFight.nearest(plant, board);
        if (!target) return;
        PlantFight.pea(plant, board, { damage: 20, homing: true, air: true, target: target, row: target.row });
      },
    });
  }
});
