// 矿工僵尸。从地下钻到房子边再钻出来往回走。稿子能被吸走，吸走后立刻钻出。
defineZombie({
  "id": "digger",
  "name": "矿工僵尸",
  "hp": 160,
  "speed": 18,
  "armAt": 70,
  "reanim": "Zombie_digger",
  "locomotion": "burrow",
  "metalItem": "pick",
  "sounds": {
    "spawn": "digger_zombie"
  },
  "anims": {
    "idle": "anim_walk",
    "walk": "anim_walk",
    "eat": "anim_eat",
    "die": "anim_death",
    "burrow": "anim_drill"
  },
  "attack": {
    "anim": "anim_eat",
    "windup": 0.4,
    "recover": 0.6,
    "interval": 1,
    "damage": 70
  },
  update: function (zombie, board, dt) {
    if (!zombie.emerged) {
      zombie.state = "burrow";
      zombie.phase = "windup";
      zombie.x -= zombie.speed * zombie.speedMul() * dt;
      if (zombie.x <= Lawn.LAWN_X + 70) {
        zombie.emerged = true;
        zombie.phase = "recover";
        zombie.x += 8;
        AudioBus.play("dirt_rise", 0.7);
      }
      return;
    }
    var plant = board.plantInFront(zombie);
    if (plant) return ZombieFight.bite(zombie, plant, board, dt);
    zombie.state = "walk";
    zombie.x += zombie.speed * zombie.speedMul() * dt;
    if (zombie.x > Lawn.LAWN_X + Lawn.COLS * Lawn.COL_W + 30) zombie.die(board);
  }
});
