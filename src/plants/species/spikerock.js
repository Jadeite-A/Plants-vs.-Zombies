// 钢地刺。种在地刺上。伤害更高，能扎破三辆车。
definePlant({
  "id": "spikerock",
  "name": "钢地刺",
  "tip": "能扎破多个轮胎，并刺伤踏在上面的僵尸\n（需要地刺）",
  "cost": 125,
  "cd": 50,
  "reanim": "SpikeRock",
  "upgrade": true,
  "requires": [
    "spikeweed"
  ],
  "replaces": "spikeweed",
  "passable": true,
  "noPot": true,
  "pops": 3,
  "attack": {
    "anim": "anim_attack",
    "windup": 0.08,
    "recover": 0.12,
    "interval": 0.5,
    "damage": 20,
    "body": true
  },
  update: function (plant, board, dt) {
    var strike = plant.spikeT == null || plant.spikeT <= 0;
    if (strike) plant.spikeT = 0.5;
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
      plant.shoot = 0.25;
      zombie.takeDamage(20, board, { from: "ground", source: "spike" });
    });
  }
});
