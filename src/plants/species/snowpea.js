// 寒冰射手。伤害和豌豆一样，命中后减速。
definePlant({
  "id": "snowpea",
  "name": "寒冰射手",
  "tip": "射出寒冰豌豆，伤害敌人的同时减慢敌人速度",
  "cost": 175,
  "cd": 7.5,
  "reanim": "SnowPea",
  "anim": "anim_full_idle",
  "sounds": {
    "shoot": ["throw", "throw2"],
    "sparkle": "snow_pea_sparkles"
  },
  "attack": {
    "anim": "anim_shooting",
    "windup": 0.16,
    "recover": 0.26,
    "interval": 1.45,
    "damage": 20,
    "element": "ice",
    "chill": 4
  },
  update: function (plant, board, dt) {
    PlantFight.shoot(plant, board, dt);
  }
});
