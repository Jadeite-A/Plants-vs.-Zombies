// 路障僵尸。路障先承受伤害，碎了以后按普通僵尸啃。
defineZombie({
  "id": "cone",
  "name": "路障僵尸",
  "hp": 160,
  "speed": 18,
  "armAt": 70,
  "tube": true,
  "armor": {
    "id": "cone",
    "hp": 220,
    "breakInto": "normal"
  },
  "attack": {
    "anim": "anim_eat",
    "windup": 0.4,
    "recover": 0.6,
    "interval": 1,
    "damage": 70
  },
  update: function (zombie, board, dt) {
    ZombieFight.march(zombie, board, dt);
  }
});
