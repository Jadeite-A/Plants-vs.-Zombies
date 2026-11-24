// 气球僵尸。飞在空中，不啃植物，直到气球被打掉才落地走。
defineZombie({
  "id": "balloon",
  "name": "气球僵尸",
  "hp": 160,
  "speed": 16,
  "armAt": 70,
  "altitude": 1,
  "reanim": "Zombie_balloon",
  "sounds": {
    "spawn": "ballooninflate"
  },
  "anims": {
    "idle": "anim_walk",
    "walk": "anim_walk",
    "eat": "anim_eat",
    "die": "anim_death",
    "pop": "anim_pop"
  },
  "attack": {
    "anim": "anim_eat",
    "windup": 0.4,
    "recover": 0.6,
    "interval": 1,
    "damage": 70
  },
  update: function (zombie, board, dt) {
    if (zombie.altitude > 0) {
      if (ZombieFight.held(zombie)) return;
      // 飞着的时候是 anim_idle，气球和螺旋桨都在；anim_walk 会把气球藏掉。
      zombie.animName = "anim_idle";
      zombie.state = "walk";
      zombie.x -= zombie.speed * zombie.speedMul() * dt;
      zombie.reachHouse(board);
      return;
    }
    if (!zombie.popped) {
      zombie.popped = true;
      zombie.animName = "anim_pop";
      zombie.popTime = 0;
      zombie.animTime = 0;
      zombie.phase = "recover";
      AudioBus.play("balloon_pop", 0.7);
    }
    if (zombie.animName === "anim_pop") {
      zombie.popTime = (zombie.popTime || 0) + dt;
      var popReanim = Assets.reanim("Zombie_balloon");
      var popAnim = popReanim && popReanim.anims.anim_pop;
      var popLen = popAnim ? (popAnim.end - popAnim.start + 1) / popReanim.fps : 0.8;
      zombie.state = "idle";
      if (zombie.popTime < popLen) return;
      zombie.animName = "";
    }
    ZombieFight.march(zombie, board, dt);
  }
});
