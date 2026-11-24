// 舞王僵尸。自己会啃，并且按间隔召唤伴舞。
defineZombie({
  "id": "dancer",
  "name": "舞王僵尸",
  "hp": 160,
  "speed": 18,
  "armAt": 70,
  "reanim": "Zombie_disco",
  "summon": {
    "every": 10,
    "types": [
      "backup",
      "backup"
    ],
    "rowOffsets": [
      -1,
      1
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
