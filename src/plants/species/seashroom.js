// 水兵菇。水生小喷菇，射程约 3 格，白天睡觉。
definePlant({
  "id": "seashroom",
  "name": "水兵菇",
  "tip": "发射短程孢子的水生蘑菇",
  "cost": 0,
  "cd": 7.5,
  "reanim": "SeaShroom",
  "aquatic": true,
  "sleep": "day",
  "sleepAnim": "anim_sleep",
  "sounds": {
    "shoot": "puff"
  },
  "attack": {
    "anim": "anim_shooting",
    "windup": 0.12,
    "recover": 0.2,
    "interval": 1.45,
    "damage": 20,
    "cols": 3,
    "body": true
  },
  update: function (plant, board, dt) {
    PlantFight.shoot(plant, board, dt);
  }
});
