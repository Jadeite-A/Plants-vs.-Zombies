// 旗帜僵尸。啃咬和普通僵尸一样，手里拿旗。
defineZombie({
  "id": "flag",
  "name": "旗帜僵尸",
  "hp": 160,
  "speed": 18,
  "armAt": 70,
  "tube": true,
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
