// 地刺。不挡路。扎踩在上面的僵尸，车辆轧上来会被扎破并同归于尽。
definePlant({
  "id": "spikeweed",
  "name": "地刺",
  "tip": "能扎破轮胎，也能刺伤踏在上面的僵尸",
  "cost": 100,
  "cd": 7.5,
  "reanim": "Caltrop",
  "passable": true,
  "noPot": true,
  "pops": 1,
  "attack": {
    "anim": "anim_attack",
    "windup": 0.1,
    "recover": 0.2,
    "interval": 1,
    "damage": 20,
    "body": true
  },
  update: function (plant, board, dt) {
    var strike = plant.spikeT == null || plant.spikeT <= 0;
    if (strike) plant.spikeT = plant.species.attack.interval;
    else plant.spikeT -= dt;
    var left = Lawn.cellLeft(plant.col);
    board.zombies.forEach(function (zombie) {
      if (!zombie.alive || zombie.row !== plant.row || zombie.altitude > 0) return;
      if (zombie.x < left || zombie.x > left + Lawn.COL_W) return;
      if (zombie.vehicle) {
        zombie.die(board);
        plant.popsLeft -= 1;
        if (plant.popsLeft <= 0) plant.dead = true;
        return;
      }
      if (!strike || zombie.hypno) return;
      plant.attackAnim = "anim_attack";
      plant.attackBody = true;
      plant.shoot = 0.3;
      zombie.takeDamage(plant.species.attack.damage, board, { from: "ground", source: "spike" });
    });
  }
});
