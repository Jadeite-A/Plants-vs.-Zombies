// 弹跳僵尸。连续跳过植物，遇到高坚果就停下来啃。
defineZombie({
  "id": "pogo",
  "name": "弹跳僵尸",
  "hp": 160,
  "speed": 20,
  "armAt": 70,
  "reanim": "Zombie_pogo",
  "anims": {
    "idle": "anim_pogo",
    "walk": "anim_pogo",
    "eat": "anim_eat",
    "die": "anim_death",
    "jump": "anim_pogo"
  },
  "attack": {
    "anim": "anim_eat",
    "windup": 0.25,
    "recover": 0.35,
    "interval": 1,
    "damage": 70
  },
  update: function (zombie, board, dt) {
    if (ZombieFight.held(zombie)) return;
    // 连续弹跳伴弹簧声。
    zombie.hopT = (zombie.hopT == null ? 0.4 : zombie.hopT) - dt;
    if (zombie.hopT <= 0) {
      zombie.hopT = 0.85;
      AudioBus.play("pogo_zombie", 0.55);
    }
    var plant = board.plantInFront(zombie);
    if (plant && plant.tall) return ZombieFight.bite(zombie, plant, board, dt);
    if (plant) {
      zombie.state = "jump";
      zombie.phase = "windup";
      zombie.jump = (zombie.jump || 0) + dt;
      if (zombie.jump < 0.28) return;
      zombie.phase = "recover";
      zombie.jump = 0;
      zombie.x = Lawn.cellLeft(plant.col) - 20;
      return;
    }
    zombie.state = "walk";
    zombie.x -= zombie.speed * zombie.speedMul() * dt;
    zombie.reachHouse(board);
  }
});
