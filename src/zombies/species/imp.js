// 小鬼僵尸。体型小，可以被大嘴花吃掉。常由巨人扔出。
defineZombie({
  "id": "imp",
  "name": "小鬼僵尸",
  "hp": 80,
  "speed": 28,
  "armAt": 40,
  "reanim": "Zombie_imp",
  "attack": {
    "anim": "anim_eat",
    "windup": 0.25,
    "recover": 0.35,
    "interval": 0.6,
    "damage": 70
  },
  update: function (zombie, board, dt) {
    ZombieFight.march(zombie, board, dt);
  }
});
