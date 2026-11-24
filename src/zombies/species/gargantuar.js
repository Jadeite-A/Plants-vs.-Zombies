// 巨人僵尸。不啃。面前有植物就长前摇砸扁。血量过半时扔出小鬼。
defineZombie({
  "id": "gargantuar",
  "name": "巨人僵尸",
  "hp": 1500,
  "speed": 12,
  "armAt": 0,
  "massive": true,
  "reanim": "Zombie_gargantuar",
  "dieSound": "gargantudeath",
  "anims": {
    "idle": "anim_walk",
    "walk": "anim_walk",
    "smash": "anim_smash",
    "throw": "anim_throw",
    "die": "anim_death"
  },
  "attack": {
    "anim": "anim_smash",
    "windup": 0.75,
    "recover": 0.55,
    "throwWindup": 0.7,
    "throwRecover": 0.55,
    "damage": 1800
  },
  update: function (zombie, board, dt) {
    smash(zombie, board, dt);
  }
});

function smash(zombie, board, dt) {
  if (ZombieFight.held(zombie)) return;
  var plant = board.plantInFront(zombie);
  if (plant) {
    if (!zombie.smash) {
      // 举棒前先低吼一声，砸击动画从头抬棒。
      AudioBus.play("lowgroan", 0.6);
      zombie.animTime = 0;
    }
    zombie.state = "smash";
    zombie.smash = (zombie.smash || 0) + dt;
    zombie.phase = zombie.smash < (zombie.species.attack.windup || 0.75) ? "windup" : "recover";
    zombie.phaseTime = zombie.smash;
    if (zombie.smash >= (zombie.species.attack.windup || 0.75) && !zombie.smashed) {
      zombie.smashed = true;
      AudioBus.play("gargantuar_thump", 0.8);
      plant.dead = true;
      AudioBus.cue(zombie.sounds.biteKill, 0.45);
    }
    var total = (zombie.species.attack.windup || 0.75) + (zombie.species.attack.recover || 0.55);
    if (zombie.smash >= total) {
      zombie.smash = 0;
      zombie.smashed = false;
    }
    return;
  }
  zombie.smash = 0;
  zombie.smashed = false;
  var throwWind = zombie.species.attack.throwWindup || 0.7;
  var throwRecover = zombie.species.attack.throwRecover || 0.55;
  if (zombie.throwing > 0) {
    var elapsed = throwWind + throwRecover - zombie.throwing;
    zombie.throwing -= dt;
    zombie.state = "throw";
    zombie.phase = elapsed < throwWind ? "windup" : "recover";
    zombie.phaseTime = elapsed;
    if (!zombie.impOut && elapsed >= throwWind) {
      zombie.impOut = true;
      AudioBus.cue(["imp", "imp2"], 0.7);
      board.spawnExtra("imp", zombie.row, zombie.x + 36);
    }
    return;
  }
  if (!zombie.thrown && zombie.hp <= zombie.maxHp * 0.5) {
    zombie.thrown = true;
    zombie.throwing = throwWind + throwRecover;
    zombie.animTime = 0;
    zombie.state = "throw";
    zombie.phase = "windup";
    zombie.phaseTime = 0;
    return;
  }
  zombie.state = "walk";
  zombie.x -= zombie.speed * zombie.speedMul() * dt;
  zombie.reachHouse(board);
}
