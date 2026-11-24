// 鸭子救生圈僵尸。啃咬和普通僵尸一样，出现在水面上。
defineZombie({
  "id": "ducky",
  "name": "鸭子救生圈僵尸",
  "hp": 160,
  "speed": 18,
  "armAt": 70,
  "water": true,
  "parts": {
    "show": [
      "ducky",
      "whitewater"
    ]
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
