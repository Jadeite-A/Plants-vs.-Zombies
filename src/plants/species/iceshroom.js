// 冰川菇。醒来后短前摇，冻住场上全部僵尸并造成少量伤害，然后消失。
definePlant({
  "id": "iceshroom",
  "name": "冰川菇",
  "tip": "暂时使画面中的全部僵尸都无法动弹",
  "cost": 75,
  "cd": 50,
  "reanim": "IceShroom",
  "sleep": "day",
  "sleepAnim": "anim_sleep",
  "attack": {
    "windup": 0.6,
    "recover": 0,
    "freeze": 4,
    "damage": 20
  },
  update: function (plant, board, dt) {
    PlantFight.once(plant, dt, {
      windup: 0.6,
      recover: 0,
      strike: function () {
        // 原版冰川菇冻场伴一声冻结。
        AudioBus.play("frozen", 0.7);
        board.zombies.forEach(function (zombie) {
          if (!zombie.alive) return;
          zombie.takeDamage(20, board, { from: "around", freeze: 4, source: "ice" });
        });
        board.flash = 0.45;
        plant.dead = true;
      },
    });
  }
});
