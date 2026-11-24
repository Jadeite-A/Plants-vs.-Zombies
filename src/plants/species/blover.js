// 三叶草。吹一下，吹走气球僵尸，然后消失。
definePlant({
  "id": "blover",
  "name": "三叶草",
  "tip": "吹走所有气球僵尸和迷雾",
  "cost": 100,
  "cd": 7.5,
  "reanim": "Blover",
  "attack": {
    "anim": "anim_blow",
    "windup": 0.45,
    "recover": 0.2,
    "body": true
  },
  update: function (plant, board, dt) {
    PlantFight.once(plant, dt, {
      windup: 0.45,
      recover: 0.2,
      anim: "anim_blow",
      body: true,
      die: true,
      strike: function () {
        AudioBus.play("blover", 0.7);
        board.zombies.forEach(function (zombie) {
          if (!zombie.alive) return;
          if (zombie.altitude > 0 || zombie.kindId === "balloon") zombie.die(board);
        });
        board.fog = [];
      },
    });
  }
});
