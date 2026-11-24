// 小喷菇。射程约 3 格。白天睡觉，叫醒后才射击。
definePlant({
  "id": "puffshroom",
  "name": "小喷菇",
  "tip": "在短距离内向敌人发射孢子",
  "cost": 0,
  "cd": 7.5,
  "reanim": "PuffShroom",
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
