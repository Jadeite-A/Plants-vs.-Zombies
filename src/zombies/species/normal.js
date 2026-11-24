// 普通僵尸。走到植物前，前摇后啃一口，后摇结束再啃。
defineZombie({
  "id": "normal",
  "name": "普通僵尸",
  "hp": 160,
  "speed": 18,
  "armAt": 70,
  // 原版普通/路障/铁桶/旗手都能套上鸭子救生圈走水路。
  "tube": true,
  "attack": {
    "anim": "anim_eat",
    "windup": 0.4,
    "recover": 0.6,
    "interval": 1,
    "damage": 70
  },
  update: function (zombie, board, dt) {
    ZombieFight.march(zombie, board, dt);
  }
});
