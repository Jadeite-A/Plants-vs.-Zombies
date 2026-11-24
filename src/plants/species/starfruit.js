// 星星果。向五个方向射星星，不射正后方。
definePlant({
  "id": "starfruit",
  "name": "星星果",
  "tip": "向五个方向发射小星星",
  "cost": 125,
  "cd": 7.5,
  "reanim": "Starfruit",
  "sounds": {
    "shoot": "shoop"
  },
  "attack": {
    "anim": "anim_shoot",
    "windup": 0.18,
    "recover": 0.28,
    "interval": 1.45,
    "damage": 20,
    "body": true
  },
  update: function (plant, board, dt) {
    PlantFight.cycle(plant, dt, {
      windup: 0.18,
      recover: 0.28,
      interval: 1.45,
      anim: "anim_shoot",
      body: true,
      keep: 1.2,
      ready: function () { return board.zombies.some(function (zombie) { return zombie.alive && !zombie.hypno; }); },
      strike: function () {
        var dirs = [
          { vx: 280, vy: 0 },
          { vx: 200, vy: -150 },
          { vx: 200, vy: 150 },
          { vx: -200, vy: -150 },
          { vx: -200, vy: 150 },
        ];
        dirs.forEach(function (dir) {
          PlantFight.pea(plant, board, { damage: 20, vx: dir.vx, vy: dir.vy, dir: dir.vx > 0 ? 1 : -1 });
        });
      },
    });
  }
});
