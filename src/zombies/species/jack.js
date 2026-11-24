// 小丑僵尸。走路时引信倒数，最后 1.2 秒是爆炸前摇，炸一片。盒子能被吸走。
defineZombie({
  "id": "jack",
  "name": "小丑僵尸",
  "hp": 160,
  "speed": 18,
  "armAt": 70,
  "reanim": "Zombie_jackbox",
  "metalItem": "jack",
  "sounds": {
    "spawn": "jackinthebox"
  },
  "anims": {
    "idle": "anim_idle",
    "walk": "anim_walk",
    "eat": "anim_eat",
    "die": "anim_death",
    "pop": "anim_pop"
  },
  "attack": {
    "anim": "anim_eat",
    "windup": 0.4,
    "recover": 0.6,
    "interval": 1,
    "damage": 70,
    "fuse": 10,
    "boomWindup": 1.2
  },
  update: function (zombie, board, dt) {
    if (zombie.disarmed) return ZombieFight.march(zombie, board, dt);
    if (zombie.fuse == null) zombie.fuse = 10;
    var wasSafe = zombie.fuse >= 1.2;
    zombie.fuse -= dt;
    if (zombie.fuse < 1.2) {
      if (wasSafe) {
        // 爆炸前摇：盒盖弹开惊叫。
        AudioBus.cue(["jack_surprise", "jack_surprise2"], 0.7);
      }
      zombie.animName = "anim_pop";
      zombie.phase = "windup";
      zombie.phaseTime = 1.2 - zombie.fuse;
    }
    if (zombie.fuse > 0) return ZombieFight.march(zombie, board, dt);
    ZombieFight.blast(zombie, board, { damage: 1800, reach: 1.6, rowSpan: 1, sound: "explosion" });
    zombie.die(board);
  }
});
