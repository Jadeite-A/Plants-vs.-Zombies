// 潜水僵尸。在水里潜游时豌豆打不中，浮上水面啃植物时才能打中。
defineZombie({
  "id": "snorkel",
  "name": "潜水僵尸",
  "hp": 160,
  "speed": 18,
  "armAt": 70,
  "reanim": "Zombie_snorkle",
  "water": true,
  "anims": {
    "idle": "anim_walk",
    "walk": "anim_swim",
    "eat": "anim_eat",
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
    if (!water) {
      zombie.submerged = false;
      return ZombieFight.march(zombie, board, dt);
    }
    zombie.submerged = !board.plantInFront(zombie);
    return ZombieFight.march(zombie, board, dt);
  }
});
