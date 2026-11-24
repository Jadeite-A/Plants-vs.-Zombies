// 投石车。不啃植物，隔一段时间把篮球扔向最左边的植物。萝卜伞能挡住。
defineZombie({
  "id": "catapult",
  "name": "投石车僵尸",
  "hp": 450,
  "speed": 12,
  "armAt": 0,
  "vehicle": true,
  "reanim": "Zombie_catapult",
  "anims": {
    "idle": "anim_idle",
    "walk": "anim_idle",
    "eat": "anim_idle",
    "die": "anim_idle",
    "shoot": "anim_bounce"
  },
  "attack": {
    "anim": "anim_bounce",
    "windup": 0.45,
    "recover": 0.4,
    "interval": 3,
    "damage": 80
  },
  update: function (zombie, board, dt) {
    if (ZombieFight.held(zombie)) return;
    var plant = null;
    board.plants.forEach(function (item) {
      if (item.dead || item.passable || item.row !== zombie.row) return;
      var x = Lawn.cellLeft(item.col);
      if (x > zombie.x - 20) return;
      if (!plant || item.col < plant.col) plant = item;
    });
    zombie.toss = (zombie.toss == null ? 1 : zombie.toss) - dt;
    if (plant && zombie.toss <= 0.45 && zombie.toss > 0) {
      zombie.state = "shoot";
      zombie.phase = "windup";
    }
    if (plant && zombie.toss <= 0) {
      zombie.toss = 3;
      zombie.phase = "recover";
      AudioBus.play("basketball", 0.7);
      board.lobs.push(new Lob(zombie.row, zombie.x, Lawn.groundY(zombie.row) - 80, Lawn.cellLeft(plant.col) + 30, {
        damage: 80, sky: true,
      }));
    }
    if (!plant || zombie.x > Lawn.cellLeft(5)) {
      zombie.state = zombie.state === "shoot" ? "shoot" : "walk";
      zombie.x -= zombie.speed * zombie.speedMul() * dt;
    }
    zombie.reachHouse(board);
  }
});
