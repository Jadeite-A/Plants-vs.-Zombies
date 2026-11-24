// 末日菇。醒来后引信结束，炸开比樱桃更大的范围，并留下弹坑。
definePlant({
  "id": "doomshroom",
  "name": "末日菇",
  "tip": "造成大范围毁灭效果，但会在原地留下无法进行种植的弹坑",
  "cost": 125,
  "cd": 50,
  "reanim": "DoomShroom",
  "sleep": "day",
  "sleepAnim": "anim_sleep",
  "sounds": {
    "explode": "doomshroom"
  },
  "attack": {
    "anim": "anim_explode",
    "windup": 1.15,
    "recover": 0,
    "body": true,
    "damage": 1800
  },
  update: function (plant, board, dt) {
    PlantFight.once(plant, dt, {
      windup: 1.15,
      recover: 0,
      anim: "anim_explode",
      body: true,
      strike: function () {
        var cx = Lawn.cellLeft(plant.col) + Lawn.COL_W / 2;
        PlantFight.area(board, cx, plant.row, { reach: 3.2, rowSpan: 2, damage: 1800, sound: plant.sounds.explode });
        board.addCrater(plant.col, plant.row, 180);
        plant.dead = true;
      },
    });
    if (plant.phase === "windup") plant.fuse = Math.max(0, 1.15 - plant.phaseTime);
  }
});
