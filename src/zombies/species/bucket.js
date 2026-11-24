// 铁桶僵尸。铁桶是金属，能被磁力菇吸走。
defineZombie({
  "id": "bucket",
  "name": "铁桶僵尸",
  "hp": 160,
  "speed": 18,
  "armAt": 70,
  "tube": true,
  "parts": {
    "show": [
      "bucket"
    ],
    "showWhenArmor": true
  },
  "armor": {
    "id": "metal",
    "hp": 650,
    "metal": true,
    "bit": "bucket"
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
