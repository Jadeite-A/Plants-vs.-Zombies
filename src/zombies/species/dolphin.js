// 海豚骑士。在水里先跳过一株植物，高坚果跳不过。上岸后普通走。
defineZombie({
  "id": "dolphin",
  "name": "海豚骑士僵尸",
  "hp": 160,
  "speed": 18,
  "armAt": 70,
  "reanim": "Zombie_dolphinrider",
  "water": true,
  "sounds": {
    "spawn": "dolphin_appears"
  },
  "anims": {
    "idle": "anim_walkdolphin",
    "walk": "anim_walkdolphin",
    "eat": "anim_eat",
    "jump": "anim_jumpinpool",
    "die": "anim_death"
  },
  "attack": {
    "anim": "anim_eat",
    "windup": 0.4,
    "recover": 0.6,
    "interval": 1,
    "damage": 70
  },
  update: function (zombie, board, dt) {
    var water = board.isWater && board.isWater(zombie.row);
    if (!water || zombie.vaulted) {
      if (zombie.vaulted) zombie.anims = zombie.species.anims;
      return ZombieFight.march(zombie, board, dt);
    }
    if (ZombieFight.held(zombie)) return;
    var plant = board.plantInFront(zombie);
    if (plant && plant.tall) return ZombieFight.bite(zombie, plant, board, dt);
    if (plant) {
      if (zombie.jump == null) {
        AudioBus.play("dolphin_before_jumping", 0.7);
        zombie.jump = 0;
      }
      zombie.state = "jump";
      zombie.phase = "windup";
      zombie.jump += dt;
      if (zombie.jump < 0.4) return;
      zombie.vaulted = true;
      zombie.phase = "recover";
      zombie.x = Lawn.cellLeft(plant.col) - 16;
      return;
    }
    zombie.state = "walk";
    zombie.x -= zombie.speed * zombie.speedMul() * dt;
    zombie.reachHouse(board);
  }
});
