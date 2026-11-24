// 战场实体：豌豆、抛物线投掷物、阳光、小推车、掉落零件、保龄球坚果。
// 豌豆。出手时 element 为空，穿过带 projectile 的植物后才会变成火或冰。
// 击中音用僵尸自己的 hurt，这样以后换种类可以换音效。
class Pea {
  constructor(row, x, y, damage) {
    this.row = row;
    this.x = x;
    this.y = y;
    this.damage = damage;
    this.speed = 300;
    this.vx = null;
    this.vy = 0;
    this.hit = false;
    this.element = null;
    this.chill = 0;
    this.air = false;
    this.homing = false;
    this.splash = 0;
    this.target = null;
  }

  update(dt, board) {
    if (this.hit) return;
    if (this.homing) this.steer(board);
    var vx = this.vx == null ? this.speed : this.vx;
    this.x += vx * dt;
    this.y += (this.vy || 0) * dt;
    if (this.vy) {
      var row = Math.round((this.y - Lawn.LAWN_Y) / Lawn.ROW_H);
      if (row >= 0 && row < Lawn.ROWS) this.row = row;
    }
    PlantFight.touch(this, board);
    for (var i = 0; i < board.zombies.length; i++) {
      var zombie = board.zombies[i];
      if (!zombie.alive || zombie.hypno) continue;
      if (zombie.submerged && !this.air && this.from !== "above") continue;
      if (zombie.altitude > 0 && !this.air) continue;
      var close = this.homing && this.target
        ? Math.abs(this.x - zombie.x) < 28 && Math.abs(this.y - (Lawn.groundY(zombie.row) - 70)) < 36 && zombie === this.target
        : zombie.row === this.row && this.x > zombie.x - 8 && this.x < zombie.x + 46;
      if (!close) continue;
      this.hit = true;
      if (this.air && zombie.altitude > 0) zombie.altitude = 0;
      zombie.takeDamage(this.damage, board, {
        from: "front",
        element: this.element,
        chill: this.chill,
        source: "pea",
      });
      if (this.splash) {
        var splash = this.splash;
        var at = zombie;
        board.zombies.forEach(function (other) {
          if (!other.alive || other === at || other.row !== at.row) return;
          if (Math.abs(other.x - at.x) > 54) return;
          other.takeDamage(splash, board, { from: "around", source: "splash" });
        });
      }
      // 火豌豆命中是单独的火声，其余走僵尸的受击组（splat 系）。
      AudioBus.cue(this.element === "fire" ? "firepea" : zombie.sounds.hurt, 0.45);
      board.spawnSplat(this.x, this.y, this.kind || (this.element === "fire" ? "fire" : this.element === "ice" ? "snow" : "pea"));
      return;
    }
  }

  steer(board) {
    var target = this.target && this.target.alive ? this.target : null;
    if (!target) {
      var best = null;
      var bestD = 1e12;
      var self = this;
      board.zombies.forEach(function (zombie) {
        if (!zombie.alive || zombie.hypno) return;
        var dx = zombie.x - self.x;
        var dy = (zombie.row - self.row) * Lawn.ROW_H;
        var dist = dx * dx + dy * dy;
        if (dist < bestD) {
          bestD = dist;
          best = zombie;
        }
      });
      target = best;
    }
    if (!target) return;
    this.target = target;
    var ty = Lawn.groundY(target.row) - 70;
    var ang = Math.atan2(ty - this.y, target.x - this.x);
    this.vx = Math.cos(ang) * 280;
    this.vy = Math.sin(ang) * 280;
    this.row = target.row;
  }
}

class Lob {
  constructor(row, x, y, targetX, opt) {
    opt = opt || {};
    this.row = row;
    this.x = x;
    this.y = y;
    this.startX = x;
    this.startY = y;
    this.targetX = targetX;
    this.t = 0;
    this.dur = opt.flight || 0.85;
    this.damage = opt.damage || 20;
    this.splash = opt.splash || 0;
    this.splashR = opt.splashR || 50;
    this.element = opt.element || null;
    this.chill = opt.chill || 0;
    this.butter = opt.butter || 0;
    this.sky = !!opt.sky;
    this.impact = opt.impact || null;
    this.hit = false;
  }

  update(dt, board) {
    if (this.hit) return;
    if (PlantFight.blocked(this, board)) {
      this.hit = true;
      return;
    }
    this.t += dt;
    var u = Math.min(1, this.t / this.dur);
    this.x = this.startX + (this.targetX - this.startX) * u;
    this.y = this.startY - Math.sin(u * Math.PI) * 90;
    if (u < 1) return;
    this.hit = true;
    this.y = this.startY;
    if (this.impact) AudioBus.cue(this.impact, 0.6);
    board.spawnSplat(this.x, this.y - 16, this.kind || "cabbage");
    var primary = null;
    board.zombies.forEach(function (zombie) {
      if (!zombie.alive || zombie.hypno || zombie.row !== this.row) return;
      if (Math.abs(zombie.x - this.targetX) > 36) return;
      if (!primary || zombie.x < primary.x) primary = zombie;
    }, this);
    if (primary) {
      primary.takeDamage(this.damage, board, {
        from: "above",
        element: this.element,
        chill: this.chill,
        butter: this.butter,
        source: "lob",
      });
    }
    if (!this.splash) return;
    var splash = this.splash;
    var radius = this.splashR;
    var row = this.row;
    var targetX = this.targetX;
    board.zombies.forEach(function (zombie) {
      if (!zombie.alive || zombie === primary) return;
      var dx = zombie.x - targetX;
      var dy = (zombie.row - row) * Lawn.ROW_H;
      if (dx * dx + dy * dy > radius * radius) return;
      zombie.takeDamage(splash, board, {
        from: "around",
        element: this.element,
        chill: this.chill,
        source: "splash",
      });
    }, this);
  }
}

// 阳光。falling 为真是天上掉下来的；为假是向日葵弹出、先往上再落下。
// small 留给以后的小阳光菇，现在的阳光都是大的。
class SunDrop {
  constructor(x, y, ground, falling, small, value) {
    this.x = x;
    this.y = y;
    this.vy = falling ? 48 : -60;
    this.ground = ground;
    this.falling = !!falling;
    this.time = Math.random() * 2;
    this.fade = 1;
    this.life = 11;
    this.value = value == null ? 25 : value;
    this.small = !!small;
    this.hit = small ? 28 : 64;
    this.collect = false;
    this.done = false;
  }

  update(dt, board) {
    this.time += dt;
    if (this.collect) {
      this.x += (48 - this.x) * Math.min(1, dt * 6);
      this.y += (30 - this.y) * Math.min(1, dt * 6);
      if (Math.abs(this.x - 48) < 8 && Math.abs(this.y - 30) < 8) {
        if (this.coin) board.coins = (board.coins || 0) + this.value;
        else board.sun += this.value;
        this.done = true;
        AudioBus.play(this.coin ? "coin" : "points", 0.45);
      }
      return;
    }
    if (this.y < this.ground || this.vy < 0) {
      this.vy += (this.falling ? 36 : 240) * dt;
      this.y += this.vy * dt;
      if (this.y >= this.ground && this.vy >= 0) {
        this.y = this.ground;
        this.vy = 0;
      }
    } else {
      this.life -= dt;
    }
    if (this.life < 2.2) this.fade = Math.max(0, this.life / 2.2);
    if (this.life <= 0) this.done = true;
  }
}

// 没铺草的行 state 是 "none"，僵尸走到房子边时救不了。
class LawnMower {
  constructor(row, active) {
    this.row = row;
    this.x = Lawn.LAWN_X - 64;
    this.state = active ? "idle" : "none";
    this.speed = 300;
  }

  update(dt, board) {
    if (this.state !== "run") return;
    this.x += this.speed * dt;
    board.zombies.forEach(function (zombie) {
      if (zombie.row !== this.row || !zombie.alive) return;
      if (zombie.x < this.x + 78 && zombie.x > this.x - 24) zombie.die(board);
    }, this);
    if (this.x > Lawn.W + 40) this.state = "gone";
  }
}

// 掉下来的路障或胳膊。弹一下再淡出，和本体的死亡动画分开播。
class BodyBit {
  constructor(zombie, kind) {
    var y = Lawn.groundY(zombie.row) - 100;
    this.kind = kind;
    this.x = zombie.x + (kind === "arm" ? 34 : kind === "cone" ? 8 : 22);
    this.y = kind === "arm" ? Lawn.groundY(zombie.row) - 118 : y + (kind === "cone" ? -6 : 8);
    this.vx = (kind === "arm" ? 55 : 36) + Math.random() * 28;
    this.vy = kind === "arm" ? -150 : kind === "cone" ? -110 : -70;
    this.spin = (Math.random() < 0.5 ? -1 : 1) * (kind === "arm" ? 2.2 : 3.5 + Math.random() * 2);
    this.angle = kind === "arm" ? -0.4 : 0;
    this.life = kind === "arm" ? 2.3 : 1.25;
    this.fade = 1;
    this.bounces = 0;
    this.ground = Lawn.groundY(zombie.row) - (kind === "arm" ? 8 : 4);
  }

  update(dt) {
    this.life -= dt;
    this.vy += 520 * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.angle += this.spin * dt;
    if (this.y > this.ground) {
      this.y = this.ground;
      this.bounces += 1;
      if (this.kind === "arm" && this.bounces >= 1) {
        this.vy = 0;
        this.vx *= 0.2;
        this.spin *= 0.12;
      } else {
        this.vy *= -0.28;
        this.vx *= 0.55;
        this.spin *= 0.45;
      }
    }
    var tail = this.kind === "arm" ? 0.7 : 0.4;
    this.fade = this.life < tail ? Math.max(0, this.life / tail) : 1;
  }
}

// 弹道打在僵尸身上的溅射。豌豆/冰豌豆/星星各用自己的序列帧，再带几粒碎屑。
var SPLAT_ART = {
  pea: { sheet: "peasplats", frames: 4, bits: "peaparticles" },
  fire: { sheet: "peasplats", frames: 4, bits: "peaparticles" },
  snow: { sheet: "snowpeasplats", frames: 4, bits: "snowpeaparticles" },
  star: { sheet: "starsplats", frames: 4, bits: "starparticles" },
  kernel: { sheet: "starsplats", frames: 4, bits: "starparticles" },
  cabbage: { sheet: "peasplats", frames: 4 },
  melon: { sheet: "peasplats", frames: 4 },
  winter: { sheet: "snowpeasplats", frames: 4 },
  butter: { sheet: "starsplats", frames: 4 },
  puff: { sheet: "puff_1", frames: 1 },
  spike: { sheet: "peasplats", frames: 4 },
};

class HitSplat {
  constructor(x, y, kind) {
    var spec = SPLAT_ART[kind] || SPLAT_ART.pea;
    this.x = x;
    this.y = y;
    this.sheet = spec.sheet;
    this.frames = spec.frames;
    this.bitsSheet = spec.bits || "";
    this.frame = Math.floor(Math.random() * spec.frames);
    this.age = 0;
    this.life = 0.24;
    this.spin = (Math.random() - 0.5) * 0.5;
    this.scale = 0.85 + Math.random() * 0.35;
    this.bits = [];
    if (!spec.bits) return;
    for (var i = 0; i < 6; i++) {
      var ang = Math.random() * Math.PI * 2;
      var spd = 50 + Math.random() * 80;
      this.bits.push({
        x: 0,
        y: 0,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd - 30,
        frame: Math.floor(Math.random() * 3),
        life: 0.16 + Math.random() * 0.12,
      });
    }
  }

  update(dt) {
    this.age += dt;
    this.life -= dt;
    this.bits.forEach(function (bit) {
      bit.life -= dt;
      bit.vy += 220 * dt;
      bit.x += bit.vx * dt;
      bit.y += bit.vy * dt;
    });
  }
}

// 保龄球坚果。先沿所在行直线滚，撞上以后才斜着换行，而且要滚到那一行的中线才再次判定碰撞。
// 爆炸坚果碰到就在半径 90 里清掉上下一行的僵尸。撑杆跳在空中时碰不到。
class BowlNut {
  constructor(row, x, explode) {
    this.row = row;
    this.x = x;
    this.y = BowlNut.rowY(row);
    this.explode = !!explode;
    this.speed = 220 + Math.random() * 120;
    this.spin = 0;
    this.state = "straight";
    this.shift = 0;
    this.aligned = true;
    this.dead = false;
  }

  static rowY(row) {
    return Lawn.groundY(row) - 36;
  }

  update(dt, board) {
    if (this.dead) return;
    this.x += this.speed * dt;
    this.spin += dt * 9;
    if (this.x > Lawn.W + 40) {
      this.dead = true;
      return;
    }
    if (this.shift) {
      this.y += this.shift * 200 * dt;
      var goal = BowlNut.rowY(this.row);
      if ((this.shift < 0 && this.y <= goal) || (this.shift > 0 && this.y >= goal)) {
        this.y = goal;
        this.shift = 0;
      }
    }
    this.aligned = !this.shift && Math.abs(this.y - BowlNut.rowY(this.row)) <= 2;
    if (!this.aligned) return;
    var dir = 0;
    if (this.state === "up") dir = this.row <= 0 ? 1 : -1;
    else if (this.state === "down") dir = this.row >= 4 ? -1 : 1;
    var hit = this.nearest(board);
    if (this.explode) {
      if (!hit) return;
      this.blast(board, hit);
      this.dead = true;
      return;
    }
    if (hit) {
      hit.bowlStrike(board);
      board.flash = Math.max(board.flash, 0.12);
      if (this.row === 4 || this.state === "down") dir = -1;
      else if (this.row === 0 || this.state === "up") dir = 1;
      else dir = Math.random() < 0.5 ? -1 : 1;
    }
    if (dir) this.turn(dir);
  }

  turn(dir) {
    var next = this.row + dir;
    if (next < 0 || next >= Lawn.ROWS) return;
    this.row = next;
    this.shift = dir;
    this.state = dir < 0 ? "up" : "down";
    this.aligned = false;
  }

  nearest(board) {
    var best = null;
    var bestX = 1e9;
    for (var i = 0; i < board.zombies.length; i++) {
      var zombie = board.zombies[i];
      if (!zombie.alive || zombie.jumping || zombie.row !== this.row) continue;
      var left = Math.max(this.x, zombie.x - 8);
      var right = Math.min(this.x + 60, zombie.x + 46);
      if (right - left < 0) continue;
      if (zombie.x < bestX) {
        best = zombie;
        bestX = zombie.x;
      }
    }
    return best;
  }

  blast(board, hit) {
    var x = this.x + 30;
    var row = hit.row;
    AudioBus.play("cherrybomb");
    AudioBus.play("bowlingimpact2");
    board.zombies.forEach(function (zombie) {
      if (!zombie.alive || zombie.jumping) return;
      if (Math.abs(zombie.row - row) > 1) return;
      if (Math.abs(zombie.x + 36 - x) > 90) return;
      zombie.hp = 0;
      zombie.die(board);
    });
    board.flash = 0.4;
  }
}
