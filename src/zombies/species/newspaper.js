// 报纸没了以后换走路/啃食的动画段并暴怒。保龄球和普通伤害都走这里。
defineZombie({
  "id": "newspaper",
  "name": "读报僵尸",
  "hp": 160,
  "speed": 18,
  "armAt": 70,
  "reanim": "Zombie_paper",
  "anims": {
    "idle": "anim_walk",
    "walk": "anim_walk",
    "eat": "anim_eat",
    "die": "anim_death"
  },
  "armor": {
    "id": "paper",
    "hp": 150
  },
  "attack": {
    "anim": "anim_eat",
    "windup": 0.4,
    "recover": 0.6,
    "interval": 1,
    "damage": 70
  },
  onArmorBroken: function (zombie) {
    zombie.enraged = true;
    zombie.addStatus("enrage", 9999, { mul: 2 });
    zombie.animFor = { walk: "anim_walk_nopaper", eat: "anim_eat_nopaper", idle: "anim_walk_nopaper" };
    // 原版：报纸撕碎一声，僵尸暴怒吼一声。
    AudioBus.cue("newspaper_rip", 0.6);
    AudioBus.cue(["newspaper_rarrgh", "newspaper_rarrgh2"], 0.7);
  },
  update: function (zombie, board, dt) {
    ZombieFight.march(zombie, board, dt);
  }
});

Rules.add("armor", "paper", {
  absorb: function (zombie, hit) {
    return ZombieFight.soak(zombie, hit, function (owner) {
      if (owner.species.onArmorBroken) owner.species.onArmorBroken(owner);
    });
  },
});
