// 迷糊菇。被啃的那一口不掉血，改为让那只僵尸调头。
definePlant({
  "id": "hypnoshroom",
  "name": "迷糊菇",
  "tip": "让一只僵尸为你作战",
  "cost": 75,
  "cd": 30,
  "reanim": "HypnoShroom",
  "sleep": "day",
  "sleepAnim": "anim_sleep",
  onBite: function (plant, zombie) {
    if (zombie.massive || zombie.vehicle) return;
    plant.dead = true;
    zombie.hypno = true;
    zombie.biteTime = null;
    // 原版：被吞时一声 floop，僵尸被控制的瞬间一声 mindcontrolled。
    AudioBus.play("floop", 0.7);
    AudioBus.play("mindcontrolled", 0.6);
    return "stop";
  }
});
