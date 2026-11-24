// 窝瓜。发现身旁一格内的僵尸就前摇起跳，落地压扁那一只。
definePlant({
  "id": "squash",
  "name": "窝瓜",
  "tip": "压扁身旁的僵尸",
  "cost": 50,
  "cd": 30,
  "reanim": "Squash",
  "attack": {
    "windup": 0.35,
    "recover": 0.15,
    "damage": 1800,
    "body": true
  },
  update: function (plant, board, dt) {
    var target = PlantFight.frontZombie(plant, board, 1.2);
    if (target && !plant.aiming) {
      plant.aiming = target;
      plant.pose = target.x < Lawn.cellLeft(plant.col) ? "anim_lookleft" : "anim_lookright";
      // 发现目标先“哼”一声再跳。
      AudioBus.cue(["squash_hmm", "squash_hmm2"], 0.6);
    }
    PlantFight.once(plant, dt, {
      windup: 0.35,
      recover: 0.15,
      anim: "anim_jumpup",
      body: true,
      ready: function () { return !!plant.aiming && plant.aiming.alive; },
      strike: function () {
        var zombie = plant.aiming && plant.aiming.alive ? plant.aiming : PlantFight.frontZombie(plant, board, 1.4);
        if (zombie) zombie.takeDamage(1800, board, { from: "around", source: "squash" });
        AudioBus.play("gargantuar_thump", 0.7);
        plant.dead = true;
      },
    });
  }
});
