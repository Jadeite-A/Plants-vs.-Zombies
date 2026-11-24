// 樱桃炸弹。前摇是引信，结束时炸 3×3，然后消失。
definePlant({
  "id": "cherry",
  "name": "樱桃炸弹",
  "tip": "炸光一定区域内的全部僵尸",
  "cost": 150,
  "cd": 50,
  "hp": 300,
  "reanim": "CherryBomb",
  "anim": "anim_idle",
  "anchor": {
    "x": 42,
    "y": 36
  },
  "aim": {
    "x": 42,
    "y": 44
  },
  "sounds": {
    "explode": "cherrybomb"
  },
  "attack": {
    "anim": "anim_explode",
    "windup": 1.15,
    "recover": 0,
    "body": true
  },
  update: function (plant, board, dt) {
    PlantFight.once(plant, dt, {
      windup: 1.15,
      recover: 0,
      anim: "anim_explode",
      body: true,
      strike: function () {
        var cx = Lawn.cellLeft(plant.col) + Lawn.COL_W / 2;
        PlantFight.area(board, cx, plant.row, { reach: 1.6, rowSpan: 1, damage: 1800, sound: plant.sounds.explode });
        plant.dead = true;
      },
    });
    if (plant.phase === "windup") plant.fuse = Math.max(0, 1.15 - plant.phaseTime);
  }
});
