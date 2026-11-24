// 大嘴花。咬合动画播完才吞，然后咀嚼约 42 秒。
// 够得着下一格正在啃坚果的僵尸（它站在那一格的右沿）。
function chompTarget(plant, board) {
  var origin = Lawn.cellLeft(plant.col) + Lawn.COL_W / 2;
  var reach = Lawn.COL_W * 2.05;
  var best = null;
  board.zombies.forEach(function (zombie) {
    if (!zombie.alive || zombie.hypno || zombie.massive || zombie.swallowed) return;
    if (zombie.altitude > 0 || zombie.submerged) return;
    if (zombie.row !== plant.row) return;
    var dx = zombie.x - origin;
    if (dx < -24 || dx > reach) return;
    if (!best || zombie.x < best.x) best = zombie;
  });
  return best;
}

function biteSeconds() {
  var reanim = Assets.reanim("Chomper");
  var anim = reanim && reanim.anims.anim_bite;
  if (!anim) return 1.04;
  return (anim.end - anim.start + 1) / 12;
}

definePlant({
  "id": "chomper",
  "name": "大嘴花",
  "tip": "一口吞下一个僵尸，但在咀嚼僵尸的时候非常脆弱",
  "cost": 150,
  "cd": 7.5,
  "reanim": "Chomper",
  "attack": {
    "anim": "anim_bite",
    "recoverAnim": "anim_chew",
      "windup": 2.08,
    "recover": 42,
    "body": true
  },
  update: function (plant, board, dt) {
    var windup = biteSeconds();
    PlantFight.cycle(plant, dt, {
      windup: windup,
      recover: 42,
      interval: 0,
      first: 0,
      anim: "anim_bite",
      recoverAnim: "anim_chew",
      body: true,
      rate: 12,
      ready: function () { return !!chompTarget(plant, board); },
      strike: function () {
        var zombie = chompTarget(plant, board);
        if (!zombie) return "miss";
        AudioBus.play("bigchomp", 0.8);
        zombie.swallow(board);
        return "hit";
      },
    });
  }
});
