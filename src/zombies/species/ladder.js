// 梯子僵尸。啃到高血量或高坚果、南瓜时放下梯子，之后从那株植物上面走过去。
defineZombie({
  "id": "ladder",
  "name": "梯子僵尸",
  "hp": 160,
  "speed": 18,
  "armAt": 70,
  "reanim": "Zombie_ladder",
  "metalItem": "ladder",
  "sounds": {
    "spawn": "ladder_zombie"
  },
  "attack": {
    "anim": "anim_eat",
    "windup": 0.4,
    "recover": 0.6,
    "interval": 1,
    "damage": 70
  },
  update: function (zombie, board, dt) {
    if (zombie.metalItem !== "ladder") return ZombieFight.march(zombie, board, dt);
    var plant = board.plantInFront(zombie);
    var tough = plant && (plant.tall || plant.seat === "shell" || plant.maxHp >= 2000);
    if (!tough) return ZombieFight.march(zombie, board, dt);
    var hit = ZombieFight.bite(zombie, plant, board, dt);
    if (hit === "hit") {
      plant.laddered = true;
      zombie.metalItem = null;
    }
  }
});
