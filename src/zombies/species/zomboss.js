// 僵王博士。按固定节拍跺脚、吐火球、召唤僵尸。关卡把它生成出来就会走这套。
defineZombie({
  "id": "zomboss",
  "name": "僵王博士",
  "hp": 4000,
  "speed": 0,
  "armAt": 0,
  "massive": true,
  "reanim": "Zombie_boss",
  // 僵王机甲的 reanim 坐标整体偏右下（原版摆放时也专门挪了原点），这里补偿回来。
  "drawOffset": { x: -810, y: -60 },
  "anims": {
    "idle": "anim_idle",
    "walk": "anim_idle",
    "stomp": "anim_stomp_1",
    "ball": "anim_head_attack_1",
    "die": "anim_death"
  },
  "attack": {
    "windup": 0.8,
    "recover": 1.2,
    "interval": 4,
    "damage": 1800
  },
  update: function (zombie, board, dt) {
    if (ZombieFight.held(zombie)) return;
    zombie.bossT = (zombie.bossT == null ? 2 : zombie.bossT) - dt;
    if (zombie.bossT > 0) {
      zombie.state = "idle";
      return;
    }
    zombie.bossStep = ((zombie.bossStep || 0) + 1) % 3;
    zombie.bossT = 4;
    zombie.phase = "windup";
    if (zombie.bossStep === 0) {
      zombie.state = "stomp";
      zombie.animName = "anim_stomp_" + (1 + (zombie.row % 4));
      board.plants.forEach(function (plant) {
        if (plant.row === zombie.row && plant.col >= 5) plant.dead = true;
      });
      return;
    }
    if (zombie.bossStep === 1) {
      zombie.state = "ball";
      zombie.animName = "anim_head_attack_1";
      var row = board.level.rows[Math.floor(Math.random() * board.level.rows.length)];
      board.plants.forEach(function (plant) {
        if (plant.row === row) plant.dead = true;
      });
      return;
    }
    zombie.state = "idle";
    zombie.animName = "anim_spawn_1";
    board.spawnExtra("normal", zombie.row, zombie.x - 40);
  }
});
