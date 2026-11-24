// 路灯花。照亮周围 2 格，供迷雾关卡读取。
definePlant({
  "id": "plantern",
  "name": "路灯花",
  "tip": "照亮一片区域，为你驱散迷雾",
  "cost": 25,
  "cd": 30,
  "reanim": "Plantern",
  start: function (plant) {
    plant.light = 2;
    // 点亮灯笼的一声。
    AudioBus.play("plantern", 0.6);
  }
});
