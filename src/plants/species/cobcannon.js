// 玉米加农炮。占两格，种在同一行相邻的两株玉米投手上。点它，再点落点。
definePlant({
  "id": "cobcannon",
  "name": "玉米加农炮",
  "tip": "点击发射火力强大的玉米导弹，需要点击确定导弹落点\n（需要2个处于同一行并且相邻的玉米投手）",
  "cost": 500,
  "cd": 50,
  "reanim": "CobCannon",
  "upgrade": true,
  "requires": [
    "kernelpult"
  ],
  "replaces": "kernelpult",
  "span": 2,
  "card": {
    "x": 78,
    "y": 42,
    "scale": 0.5
  },
  "attack": {
    "anim": "anim_shooting",
    "windup": 0.5,
    "recover": 36,
    "damage": 1800
  },
  start: function (plant) {
    plant.reload = 0;
    plant.aiming = false;
  },
  update: function (plant, board, dt) {
    if (plant.reload > 0) {
      plant.reload -= dt;
      plant.pose = "anim_charge";
      plant.phase = "recover";
      plant.phaseTime = 36 - plant.reload;
      return;
    }
    plant.pose = plant.aiming ? "anim_shooting" : null;
    plant.phase = plant.aiming ? "windup" : "idle";
  },
  arm: function (plant) {
    if (plant.reload > 0) return false;
    plant.aiming = !plant.aiming;
    return true;
  },
  fireAt: function (plant, board, col, row) {
    if (plant.reload > 0 || !plant.aiming) return false;
    plant.aiming = false;
    plant.reload = 36;
    AudioBus.play("coblaunch", 0.8);
    var cx = Lawn.cellLeft(col) + Lawn.COL_W / 2;
    PlantFight.area(board, cx, row, { reach: 1.6, rowSpan: 1, damage: 1800, sound: "explosion" });
    return true;
  }
});
