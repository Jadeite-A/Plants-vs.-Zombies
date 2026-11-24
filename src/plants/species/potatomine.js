// 土豆地雷。前摇 15 秒出土，出土后碰到僵尸再炸。
definePlant({
  "id": "potatomine",
  "name": "土豆地雷",
  "tip": "炸飞碰到它的敌人，但安放后需要一定时间启动",
  "cost": 25,
  "cd": 30,
  "reanim": "PotatoMine",
  "anim": "anim_idle",
  "attack": {
    "windup": 15,
    "recover": 0.2,
    "damage": 1800
  },
  start: function (plant) {
    plant.arm = 0;
    plant.pose = "anim_idle";
  },
  update: function (plant, board, dt) {
    if (!plant.armed) {
      plant.arm += dt;
      plant.phase = "windup";
      plant.phaseTime = plant.arm;
      plant.pose = plant.arm > 14.2 ? "anim_rise" : "anim_idle";
      if (plant.arm >= 15) {
        plant.armed = true;
        plant.pose = "anim_armed";
        plant.phase = "idle";
      }
      return;
    }
    var origin = Lawn.cellLeft(plant.col);
    board.zombies.forEach(function (zombie) {
      if (plant.dead || !zombie.alive || zombie.hypno || zombie.row !== plant.row || zombie.altitude > 0) return;
      if (zombie.x < origin || zombie.x > origin + Lawn.COL_W) return;
      // 土豆雷炸响（SPUDOW!）。
      AudioBus.play("potato_mine", 0.8);
      board.flash = Math.max(board.flash, 0.4);
      zombie.takeDamage(1800, board, { from: "around", source: "mine" });
      plant.dead = true;
    });
  }
});
