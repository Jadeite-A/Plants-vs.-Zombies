// 红眼巨人。砸击和扔小鬼跟巨人一样，血量更高。
defineZombie({
  "id": "giga",
  "name": "红眼巨人僵尸",
  "hp": 3000,
  "speed": 12,
  "armAt": 0,
  "massive": true,
  "reanim": "Zombie_gargantuar",
  "anims": {
    "idle": "anim_walk",
    "walk": "anim_walk",
    "smash": "anim_smash",
    "throw": "anim_throw",
    "die": "anim_death"
  },
  "attack": {
    "anim": "anim_smash",
    "windup": 0.7,
    "recover": 0.5,
    "throwWindup": 0.6,
    "throwRecover": 0.45,
    "damage": 1800
  },
  update: function (zombie, board, dt) {
    smash(zombie, board, dt);
  }
});
