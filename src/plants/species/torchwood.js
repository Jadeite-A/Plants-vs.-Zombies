// 火炬树桩。普通豌豆穿过后变火弹并加倍。冰豌豆只会被烤成普通豌豆。
definePlant({
  "id": "torchwood",
  "name": "火炬树桩",
  "tip": "穿过火炬树桩的豌豆会变成火弹",
  "cost": 175,
  "cd": 7.5,
  "reanim": "Torchwood",
  onProjectile: function (plant, shot) {
    if (plant.row !== shot.row) return;
    var left = Lawn.cellLeft(plant.col);
    if (shot.x < left || shot.x > left + Lawn.COL_W) return;
    shot.passed = shot.passed || {};
    if (shot.passed[plant.col]) return;
    shot.passed[plant.col] = true;
    if (shot.element === "ice") {
      shot.element = null;
      shot.chill = 0;
      return;
    }
    if (shot.element === "fire") return;
    shot.element = "fire";
    shot.damage *= 2;
    shot.splash = shot.splash || 20;
  }
});
