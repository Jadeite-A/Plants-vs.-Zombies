// 雪人僵尸。先往前走一会儿，然后转身跑出屏幕。
defineZombie({
  "id": "yeti",
  "name": "雪人僵尸",
  "hp": 200,
  "speed": 16,
  "armAt": 80,
  "reanim": "Zombie_yeti",
  "attack": {
    "anim": "anim_eat",
    "windup": 0.4,
    "recover": 0.6,
    "interval": 1,
    "damage": 70
  },
  update: function (zombie, board, dt) {
    zombie.seen = (zombie.seen || 0) + dt;
    if (zombie.seen < 8) return ZombieFight.march(zombie, board, dt);
    zombie.state = "walk";
    zombie.phase = "recover";
    zombie.x += zombie.speed * 1.7 * dt;
    if (zombie.x > Lawn.W + 20) zombie.die(board);
  }
});
