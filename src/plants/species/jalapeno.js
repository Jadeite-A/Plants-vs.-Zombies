// 火爆辣椒。短前摇后烧掉整行。
definePlant({
  "id": "jalapeno",
  "name": "火爆辣椒",
  "tip": "烧光一整行的僵尸",
  "cost": 125,
  "cd": 50,
  "reanim": "Jalapeno",
  "attack": {
    "anim": "anim_explode",
    "windup": 0.8,
    "recover": 0,
    "body": true,
    "damage": 1800
  },
  update: function (plant, board, dt) {
    PlantFight.once(plant, dt, {
      windup: 0.8,
      recover: 0,
      anim: "anim_explode",
      body: true,
      strike: function () {
        var cx = Lawn.cellLeft(plant.col) + Lawn.COL_W / 2;
        // 原版：辣椒点燃一声 ignite，火焰扫过再补一声 juicy。
        AudioBus.cue(["ignite", "ignite2"], 0.8);
        AudioBus.cue("juicy", 0.55);
        PlantFight.area(board, cx, plant.row, { reach: 12, rowSpan: 0, damage: 1800 });
        plant.dead = true;
      },
    });
  }
});
