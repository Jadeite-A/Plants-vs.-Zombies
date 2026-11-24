// 咬咬碑。只能种在墓碑上，前摇咬完墓碑后消失。
definePlant({
  "id": "gravebuster",
  "name": "咬咬碑",
  "tip": "把它种植在墓碑上，它就能咬掉墓碑",
  "cost": 75,
  "cd": 7.5,
  "reanim": "Gravebuster",
  "anim": "anim_idle",
  "attack": {
    "anim": "anim_idle",
    "windup": 4,
    "recover": 0.2,
    "body": true
  },
  canPlace: function (board, col, row) {
    return (board.graves || []).some(function (grave) {
      return grave.col === col && grave.row === row && !grave.gone;
    });
  },
  update: function (plant, board, dt) {
    PlantFight.once(plant, dt, {
      windup: 4,
      recover: 0.2,
      anim: "anim_idle",
      body: true,
      die: true,
      strike: function () {
        AudioBus.play("gravebusterchomp", 0.7);
        (board.graves || []).forEach(function (grave) {
          if (grave.col === plant.col && grave.row === plant.row) grave.gone = true;
        });
      },
    });
  }
});
