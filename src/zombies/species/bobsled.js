// 雪橇小队。有冰道时必须待在冰上，没有冰道的关卡里就当普通僵尸走。
defineZombie({
  "id": "bobsled",
  "name": "雪橇僵尸",
  "hp": 160,
  "speed": 22,
  "armAt": 70,
  "reanim": "Zombie_bobsled",
  "attack": {
    "anim": "anim_eat",
    "windup": 0.4,
    "recover": 0.6,
    "interval": 1,
    "damage": 70
  },
  update: function (zombie, board, dt) {
    if (board.iceAt && board.iceAt(zombie.row, zombie.x)) zombie.onIce = true;
    if (zombie.onIce && board.iceAt && !board.iceAt(zombie.row, zombie.x)) {
      zombie.die(board);
      return;
    }
    ZombieFight.march(zombie, board, dt);
  }
});
