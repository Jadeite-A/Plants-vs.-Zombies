// 铁栅门僵尸。铁门只挡正面直射，爆炸和喷雾绕过去。铁门能被吸走。
defineZombie({
  "id": "screen",
  "name": "铁栅门僵尸",
  "hp": 160,
  "speed": 18,
  "armAt": 70,
  "parts": {
    "show": [
      "screendoor"
    ],
    "showWhenArmor": true
  },
  "armor": {
    "id": "screen",
    "hp": 650,
    "metal": true,
    "bit": "door"
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
