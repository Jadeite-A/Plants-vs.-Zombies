// 缠绕水草。只能种在水里，前摇抓住靠近的一只僵尸并拖下水。
definePlant({
  "id": "tanglekelp",
  "name": "缠绕水草",
  "tip": "能够把一只僵尸拖进水里的水生植物",
  "cost": 25,
  "cd": 30,
  "reanim": "Tanglekelp",
  "aquatic": true,
  "attack": {
    "anim": "anim_grab",
    "windup": 0.4,
    "recover": 0.3,
    "body": true
  },
  update: function (plant, board, dt) {
    PlantFight.once(plant, dt, {
      windup: 0.4,
      recover: 0.3,
      anim: "anim_grab",
      body: true,
      ready: function () { return !!PlantFight.frontZombie(plant, board, 0.8); },
      strike: function () {
        var zombie = PlantFight.frontZombie(plant, board, 0.8);
        if (zombie && !zombie.massive) {
          // 拖下水时水花声。
          AudioBus.play("zombiesplash", 0.7);
          zombie.die(board);
        }
        plant.dead = true;
      },
    });
  }
});
