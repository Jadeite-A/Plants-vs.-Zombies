/*
 * view-kit.js — 界面绘制基元与共享几何。
 *
 * 这是所有界面模块（view-menu / view-battle / view-almanac / view 调度器）的
 * 公共工具箱，只放"被两个以上界面用到"的东西：
 *
 *   文字与控件    font / label / button / stoneButton / panel
 *   命中与几何    inside / shifted / cellAt / 各矩形函数
 *   角色绘制      drawPlant / drawZombie / drawBit / drawMower / drawSun
 *   卡片          packetGeom / beltBox / bakedPacket / drawPacket
 *   选卡面板      chooserPanel / chooserSlots / imitate 系列与滑入曲线
 *   缓存          yardLayer（主菜单草皮）/ keyedImage / plantSpriteBox
 *
 * 约定：本文件不引用任何界面状态（state），只依赖引擎全局
 * （Assets / Reanim / Data / Lawn / PlantCatalog）。
 */
var ViewKit = (function () {
  // ---------- 文字 ----------

  function font(size, bold) {
    return (bold === false ? "" : "bold ") + size + "px Microsoft YaHei, Segoe UI, sans-serif";
  }

  // 图鉴标题是华文琥珀，正文是宋体。原版没有粗黑描边。
  function almanacTitle(size) {
    return size + 'px STHupo, "华文琥珀", YouYuan, SimHei, sans-serif';
  }

  function almanacBody(size) {
    return size + 'px SimSun, NSimSun, "宋体", serif';
  }

  // 对话框/石钮用的字体（原版"你是谁?/新用户/按钮绿字"逐像素比对：字面高约
  // 21px、步进约 20px，笔画带楷书笔锋——楷体加粗正吻合；琥珀体宽了 50%）。
  function stoneFont(size, bold) {
    return (bold ? "bold " : "") + size + 'px KaiTi, "楷体", "楷体_GB2312", STKaiti, SimHei, sans-serif';
  }

  function numberFont(size) {
    return "400 " + size + "px Segoe UI, Microsoft YaHei, sans-serif";
  }

  /*
   * 通用描边文字。opt: { font, align, base, fill, stroke, line }
   * line 是描边宽度，0 表示不描边。
   */
  function label(ctx, str, x, y, opt) {
    opt = opt || {};
    ctx.font = opt.font || font(22);
    ctx.textAlign = opt.align || "left";
    ctx.textBaseline = opt.base || "middle";
    ctx.lineJoin = "round";
    ctx.lineWidth = opt.line == null ? 4 : opt.line;
    if (ctx.lineWidth > 0) {
      ctx.strokeStyle = opt.stroke || "#2a160c";
      ctx.strokeText(str, x, y);
    }
    ctx.fillStyle = opt.fill || "#fff4c8";
    ctx.fillText(str, x, y);
  }

  // ---------- 命中与几何 ----------

  function inside(x, y, r) {
    return x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h;
  }

  function shifted(rect, dy) {
    return { x: rect.x, y: rect.y + dy, w: rect.w, h: rect.h };
  }

  // 屏幕坐标 → 草坪格。rows 用来限定本关铺了草的行。
  function cellAt(x, y, rows) {
    var col = Math.floor((x - Data.LAWN_X) / Data.COL_W);
    var row = Math.floor((y - Data.LAWN_Y) / Data.ROW_H);
    if (col < 0 || row < 0 || col >= Data.COLS || row >= Data.ROWS) return null;
    if (rows && rows.indexOf(row) < 0) return null;
    return { col: col, row: row };
  }

  function frameOf(reanim, anim, time) {
    if (!reanim || !reanim.anims[anim]) return 0;
    return Reanim.frameIn(reanim, anim, time);
  }

  // ---------- 角色绘制 ----------

  // 原版：身体循环 anim_idle，头在 anim_head_idle 上跟着摇；开枪时头改播 anim_shooting。
  // 机枪的头盔和枪管、寒冰的冰晶、双向的后脑，名字对不上“头”，但身体那一帧是藏起来的。
  // 叠头部时按“身体这一帧看不见”来收零件，不再靠名字过滤。
  var HEAD_GROUPS = {
    peashooter: [{ idle: "anim_head_idle", shoot: "anim_shooting", key: "main" }],
    snowpea: [{ idle: "anim_head_idle", shoot: "anim_shooting", key: "main" }],
    repeater: [{ idle: "anim_head_idle", shoot: "anim_shooting", key: "main" }],
    gatlingpea: [{ idle: "anim_head_idle", shoot: "anim_shooting", key: "main" }],
    splitpea: [
      { idle: "anim_head_idle", shoot: "anim_shooting", key: "front" },
      { idle: "anim_splitpea_idle", shoot: "anim_splitpea_shooting", key: "back" },
    ],
    threepeater: [
      { idle: "anim_head_idle1", shoot: "anim_shooting1", key: "main" },
      { idle: "anim_head_idle3", shoot: "anim_shooting3", key: "main" },
      { idle: "anim_head_idle2", shoot: "anim_shooting2", key: "main" },
    ],
  };

  function swayTime(reanim, time, plant) {
    var rate = (plant && plant.swayRate) || 12;
    return time * (rate / reanim.fps);
  }

  // 播放一次并停在最后一帧（原版 PLAY_ONCE_AND_HOLD）。
  function holdFrame(reanim, name, elapsed, rate) {
    var anim = reanim.anims[name];
    if (!anim) return 0;
    var length = anim.end - anim.start + 1;
    var played = Math.max(0, elapsed * rate);
    if (played >= length) played = length - 0.001;
    return anim.start + played;
  }

  function activeSlot(plant) {
    if (!plant || !plant.cycles) return null;
    var best = null;
    Object.keys(plant.cycles).forEach(function (key) {
      var slot = plant.cycles[key];
      if (!slot || slot.phase === "wait" || slot.phase === "done") return;
      if (!best || (slot.animTime || 0) > (best.animTime || 0)) best = slot;
    });
    return best;
  }

  function trackShown(track, frameIndex) {
    var frame = Reanim.sampleFrame(track, frameIndex);
    return !!(frame && frame.f !== -1 && frame.i);
  }

  function faceDelta(reanim, fromFrame, toFrame) {
    var face = Reanim.trackByName(reanim, "anim_face");
    if (!face) return { x: 0, y: 0 };
    var a = Reanim.sampleFrame(face, fromFrame);
    var b = Reanim.sampleFrame(face, toFrame);
    if (!a || !b) return { x: 0, y: 0 };
    return { x: a.x - b.x, y: a.y - b.y };
  }

  function drawPlant(ctx, id, x, y, time, shoot, hpRatio, animName, plant) {
    var def = Data.plants[id];
    var reanim = Assets.reanim(def.reanim);
    if (!reanim) return;
    var sway = swayTime(reanim, time, plant);
    var glow = plant && plant.glow > 0.02 ? plant.glow : 0;
    ctx.save();
    if (glow) {
      var prev = ctx.filter && ctx.filter !== "none" ? ctx.filter + " " : "";
      ctx.filter = prev + "brightness(" + (1 + glow * 1.15).toFixed(2) + ")";
    }
    // 这套植物图的关键帧对的是贴图左上角，按中心去画会把头、嘴、叶子拆开。
    var options = null;
    if ((id === "wallnut" || id === "tallnut") && hpRatio < 1) {
      var stage = hpRatio < 0.34 ? 2 : hpRatio < 0.67 ? 1 : 0;
      var cracked = null;
      if (id === "wallnut") cracked = stage === 2 ? "IMAGE_REANIM_WALLNUT_CRACKED2" : stage === 1 ? "IMAGE_REANIM_WALLNUT_CRACKED1" : null;
      if (id === "tallnut") cracked = stage === 2 ? "IMAGE_REANIM_TALLNUT_CRACKED2" : stage === 1 ? "IMAGE_REANIM_TALLNUT_CRACKED1" : null;
      if (cracked) {
        options = {
          replaceImage: function (imageId) {
            var body = imageId.indexOf("WALLNUT_BODY") >= 0 || imageId.indexOf("TALLNUT_BODY") >= 0;
            return body ? cracked : null;
          },
        };
      }
    }
    if (id === "pumpkin" && hpRatio < 0.7) {
      var shell = hpRatio < 0.2 ? "IMAGE_REANIM_PUMPKIN_DAMAGE3" : hpRatio < 0.45 ? "IMAGE_REANIM_PUMPKIN_DAMAGE2" : "IMAGE_REANIM_PUMPKIN_DAMAGE1";
      options = {
        replaceImage: function (imageId) {
          return imageId.indexOf("PUMPKIN_FRONT") >= 0 ? shell : null;
        },
      };
    }
    var groups = HEAD_GROUPS[id];
    var slot = activeSlot(plant);
    var bodyAttack = !!(plant && plant.attackBody && slot && plant.attackAnim && reanim.anims[plant.attackAnim]);
    if (plant && plant.asleep && animName && reanim.anims[animName]) {
      Reanim.draw(ctx, reanim, frameOf(reanim, animName, sway), x, y, options);
      ctx.restore();
      return;
    }
    if (bodyAttack) {
      var looping = plant.phase === "recover" && def.attack && def.attack.recoverAnim;
      var elapsed = looping ? (plant.phaseTime || 0) : (slot.animTime || 0);
      var rate = slot.rate || 24;
      var frame = looping
        ? frameOf(reanim, plant.attackAnim, elapsed * (rate / reanim.fps))
        : holdFrame(reanim, plant.attackAnim, elapsed, rate);
      Reanim.draw(ctx, reanim, frame, x, y, options);
      ctx.restore();
      return;
    }
    if (groups && reanim.anims.anim_idle) {
      var idleFrame = frameOf(reanim, "anim_idle", sway);
      Reanim.draw(ctx, reanim, idleFrame, x, y, options);
      groups.forEach(function (group) {
        if (!reanim.anims[group.idle]) return;
        var headSlot = plant && plant.cycles && plant.cycles[group.key];
        var shooting = headSlot && headSlot.phase !== "wait" && headSlot.phase !== "done" && reanim.anims[group.shoot];
        var headFrame = shooting
          ? holdFrame(reanim, group.shoot, headSlot.animTime || 0, headSlot.rate || 35)
          : frameOf(reanim, group.idle, sway);
        var shift = shooting ? faceDelta(reanim, idleFrame, headFrame) : { x: 0, y: 0 };
        Reanim.draw(ctx, reanim, headFrame, x + shift.x, y + shift.y, {
          replaceImage: options && options.replaceImage,
          only: function (track) { return !trackShown(track, idleFrame); },
        });
      });
      ctx.restore();
      return;
    }
    if (!animName && def.layers) {
      Reanim.drawLayers(ctx, reanim, def.layers, sway, x, y, options);
      ctx.restore();
      return;
    }
    var anim = animName || def.anim || "anim_idle";
    if (!reanim.anims[anim] && reanim.anims.anim_idle) anim = "anim_idle";
    Reanim.draw(ctx, reanim, frameOf(reanim, anim, sway), x, y, options);
    ctx.restore();
  }

  // 共用一份僵尸动画。不是本种类的零件藏掉。
  // 旗手藏掉张开的小臂和手（innerarm2/3），保留袖子，旗杆另画在 flaghand 上。
  function zombieHidden(name, zombie) {
    var n = name.toLowerCase();
    var parts = zombie.species && zombie.species.parts;
    if (parts && parts.show) {
      for (var s = 0; s < parts.show.length; s++) {
        if (n.indexOf(parts.show[s]) < 0) continue;
        if (parts.showWhenArmor && zombie.armor <= 0) return true;
        return false;
      }
    }
    if (zombie.type === "screen" && zombie.armor > 0) {
      if (n === "anim_innerarm1" || n === "anim_innerarm2" || n === "anim_innerarm3") return true;
      if (n.indexOf("outerarm_hand") >= 0 || n.indexOf("outerarm_lower") >= 0) return true;
      if (n.indexOf("flaghand") >= 0) return true;
    }
    if ((zombie.type === "cone" || zombie.type === "bucket" || zombie.type === "football") && zombie.armor > 0 && n.indexOf("hair") >= 0) return true;
    if (zombie.type === "flag") {
      if (n === "anim_innerarm1" || n === "anim_innerarm2" || n === "anim_innerarm3") return true;
      if (n.indexOf("screendoor") >= 0 && n !== "zombie_innerarm_screendoor") return true;
    }
    if (n.indexOf("flag") >= 0) return zombie.type !== "flag";
    if (n.indexOf("screendoor") >= 0) return true;
    // 水路里的普通/路障/铁桶/旗手要画上鸭子救生圈（原版 ReanimShowPrefix）。
    if (n.indexOf("ducky") >= 0 || n.indexOf("whitewater") >= 0) return !zombie.tube;
    if (n.indexOf("mustache") >= 0) return true;
    if (n.indexOf("tongue") >= 0 || n.indexOf("bucket") >= 0) return true;
    if (n.indexOf("cone") >= 0) return zombie.type !== "cone" || zombie.armor <= 0;
    if (zombie.armDropped && (n.indexOf("outerarm_hand") >= 0 || n.indexOf("outerarm_lower") >= 0)) return true;
    return false;
  }

  // 旗杆跟握手共用变换，这样旗子会跟着胳膊走。
  function drawFlagPole(ctx, handFrame, time) {
    var pole = Assets.reanim("Zombie_flagpole");
    if (!pole || !handFrame || handFrame.f === -1) return;
    var count = pole.tracks[0].frames.length || 1;
    var index = (time * pole.fps) % count;
    if (index < 0) index += count;
    ctx.save();
    var kx = (handFrame.kx * Math.PI) / 180;
    var ky = (handFrame.ky * Math.PI) / 180;
    ctx.transform(
      handFrame.sx * Math.cos(kx),
      handFrame.sx * Math.sin(kx),
      -handFrame.sy * Math.sin(ky),
      handFrame.sy * Math.cos(ky),
      handFrame.x,
      handFrame.y
    );
    Reanim.draw(ctx, pole, index, 0, 0);
    ctx.restore();
  }

  function drawZombie(ctx, zombie) {
    if (zombie.swallowed || zombie.carried) return;
    var reanim = Assets.reanim(zombie.reanim || "Zombie");
    if (!reanim) return;
    var book = (zombie.species && zombie.species.anims) || {};
    var anim = zombie.animName || (zombie.animFor && zombie.animFor[zombie.state]) || book[zombie.state];
    if (!anim) anim = zombie.state === "die" ? "anim_death" : zombie.state === "eat" ? "anim_eat" : zombie.state === "idle" ? "anim_idle" : "anim_walk";
    // 兜底：种类配的动画段在它的 reanim 里不存在时，退到可用的相近段。
    if (!reanim.anims[anim]) {
      var chain = ["anim_walk", "anim_idle2", "anim_idle", "anim_eat", "anim_death"];
      anim = chain.filter(function (name) { return reanim.anims[name]; })[0] || anim;
    }
    var rate = zombie.animRate || 1;
    var shown = zombie.state === "die" ? zombie.animTime : zombie.animTime * rate;
    // 啃咬从动画开头播：先停步举手，再咬到。不要一贴上就停在啃咬的第一帧。
    if (zombie.state === "eat") shown = zombie.eatAge || 0;
    var death = reanim.anims.anim_death;
    var deathLen = death ? (death.end - death.start + 1) / reanim.fps : 3.2;
    // 死亡动画约 3.25 秒，只在最后 0.55 秒淡出，避免倒到一半就消失。
    if (zombie.state === "die") shown = Math.min(zombie.animTime, Math.max(0, deathLen - 0.04));
    var frame = frameOf(reanim, anim, shown);
    var y = Data.groundY(zombie.row) - 128 + (zombie.preview ? 26 : 0);
    // 从墓碑里往上钻：整体沉在地面以下；蹦极空投则从天上降下来。
    if (zombie.rise > 0) y += zombie.rise * 90;
    if (zombie.dropIn > 0) y -= zombie.dropIn * 260;
    ctx.save();
    var ox = zombie.x - 18;
    var oy = y;
    if (zombie.species && zombie.species.drawOffset) {
      ox += zombie.species.drawOffset.x;
      oy += zombie.species.drawOffset.y;
    }
    ctx.translate(ox, oy);
    if (zombie.scale && zombie.scale !== 1) ctx.scale(zombie.scale, zombie.scale);
    if (zombie.state === "die" && zombie.animTime > deathLen - 0.55) {
      ctx.globalAlpha = Math.max(0, 1 - (zombie.animTime - (deathLen - 0.55)) / 0.55);
    }
    var paint = {
      skip: function (track) {
        return zombieHidden(track.name, zombie);
      },
      replaceImage: function (imageId) {
        // 路障按剩余耐久换三档破损贴图；掉了胳膊的手臂换断臂贴图。
        if (imageId.indexOf("CONE1") >= 0 && zombie.type === "cone") {
          var max = zombie.maxArmor || 220;
          var ratio = zombie.armor / max;
          if (ratio > 0.66) return null;
          if (ratio > 0.33) return "IMAGE_REANIM_ZOMBIE_CONE2";
          return "IMAGE_REANIM_ZOMBIE_CONE3";
        }
        if (zombie.armDropped && imageId.indexOf("OUTERARM_UPPER") >= 0 && imageId.indexOf("UPPER2") < 0) {
          return "IMAGE_REANIM_ZOMBIE_OUTERARM_UPPER2";
        }
        if (imageId.indexOf("BUCKET1") >= 0 && zombie.type === "bucket" && zombie.maxArmor) {
          var bucketRatio = zombie.armor / zombie.maxArmor;
          if (bucketRatio <= 0.66 && bucketRatio > 0.33) return "IMAGE_REANIM_ZOMBIE_BUCKET2";
          if (bucketRatio <= 0.33) return "IMAGE_REANIM_ZOMBIE_BUCKET3";
        }
        if (imageId.indexOf("SCREENDOOR1") >= 0 && zombie.armor > 0 && zombie.maxArmor) {
          var doorRatio = zombie.armor / zombie.maxArmor;
          if (doorRatio <= 0.66 && doorRatio > 0.33) return "IMAGE_REANIM_ZOMBIE_SCREENDOOR2";
          if (doorRatio <= 0.33) return "IMAGE_REANIM_ZOMBIE_SCREENDOOR3";
        }
        return null;
      },
    };
    // 走路融进啃咬、啃完再融回走路，大约 0.18 秒，对应原版 StartBlend(20)。
    var eatIn = zombie.state === "eat" ? Math.min(1, (zombie.eatAge || 0) / 0.18) : 1;
    var eatOut = zombie.state !== "eat" && zombie.state !== "die" && zombie.leaveEat > 0 ? Math.min(1, zombie.leaveEat / 0.18) : 0;
    if (eatIn < 1) {
      var walkAnim = (zombie.animFor && zombie.animFor.walk) || book.walk || "anim_walk";
      if (reanim.anims[walkAnim]) {
        ctx.save();
        ctx.globalAlpha *= 1 - eatIn;
        Reanim.draw(ctx, reanim, frameOf(reanim, walkAnim, zombie.animTime * rate), 0, 0, paint);
        ctx.restore();
      }
      ctx.globalAlpha *= eatIn;
    }
    var bodyAlpha = ctx.globalAlpha;
    if (eatOut > 0) {
      var eatAnim = (zombie.animFor && zombie.animFor.eat) || book.eat || "anim_eat";
      if (reanim.anims[eatAnim]) {
        ctx.globalAlpha = bodyAlpha * eatOut;
        Reanim.draw(ctx, reanim, frameOf(reanim, eatAnim, zombie.eatHold || 0), 0, 0, paint);
      }
      ctx.globalAlpha = bodyAlpha * (1 - eatOut);
    }
    if (zombie.type === "bungee") drawBungeeCord(ctx, reanim, frame);
    Reanim.draw(ctx, reanim, frame, 0, 0, paint);
    ctx.globalAlpha = bodyAlpha;
    if (zombie.type === "flag") {
      var hand = Reanim.trackByName(reanim, "Zombie_flaghand");
      if (hand) drawFlagPole(ctx, Reanim.sampleFrame(hand, frame), zombie.animTime * (zombie.animRate || 1));
    }
    if (zombie.type === "balloon" && zombie.altitude > 0) drawBalloonPropeller(ctx, reanim, frame, zombie.animTime);
    ctx.restore();
  }

  // 掉落的护甲/断臂。kind 决定飞出的是哪张图。
  function drawBit(ctx, bit) {
    ctx.save();
    ctx.translate(bit.x, bit.y);
    ctx.rotate(bit.angle);
    ctx.globalAlpha = bit.fade;
    if (bit.kind === "cone") {
      var cone = Assets.image("Zombie_cone3") || Assets.image("Zombie_cone1");
      if (cone) ctx.drawImage(cone, -cone.width / 2, -cone.height / 2);
    } else if (bit.kind === "bucket") {
      var bucket = Assets.image("Zombie_bucket1");
      if (bucket) ctx.drawImage(bucket, -bucket.width / 2, -bucket.height / 2);
    } else if (bit.kind === "helmet") {
      var helmet = Assets.image("Zombie_football_helmet");
      if (helmet) ctx.drawImage(helmet, -helmet.width / 2, -helmet.height / 2);
    } else if (bit.kind === "door") {
      var door = Assets.image("Zombie_screendoor1");
      if (door) ctx.drawImage(door, -door.width / 2, -door.height / 2);
    } else {
      // 断臂是小臂加手连在一起掉下去，上臂骨留在身上，不把三截贴图散着甩。
      var lower = Assets.image("Zombie_outerarm_lower");
      var hand = Assets.image("Zombie_outerarm_hand");
      ctx.scale(0.8, 0.8);
      if (lower) ctx.drawImage(lower, -lower.width * 0.35, -lower.height * 0.2);
      if (hand && lower) ctx.drawImage(hand, lower.width * 0.15, lower.height * 0.45);
      else if (hand) ctx.drawImage(hand, 0, 8);
    }
    ctx.restore();
  }

  function drawSplat(ctx, splat) {
    var sheet = Assets.image(splat.sheet);
    var u = splat.age / 0.24;
    ctx.save();
    ctx.translate(splat.x, splat.y);
    if (sheet) {
      var frames = Math.max(1, splat.frames || 1);
      var fw = sheet.width / frames;
      var scale = (splat.scale || 1) * (0.6 + Math.min(1, u) * 0.9);
      ctx.save();
      ctx.rotate(splat.spin || 0);
      ctx.globalAlpha = Math.max(0, 0.92 * (1 - u));
      ctx.drawImage(sheet, splat.frame * fw, 0, fw, sheet.height, -fw * scale / 2, -sheet.height * scale / 2, fw * scale, sheet.height * scale);
      ctx.restore();
    }
    var bits = splat.bitsSheet ? Assets.image(splat.bitsSheet) : null;
    if (bits && splat.bits) {
      var bw = bits.width / 3;
      splat.bits.forEach(function (bit) {
        if (bit.life <= 0) return;
        ctx.globalAlpha = Math.max(0, Math.min(1, bit.life / 0.18));
        ctx.drawImage(bits, bit.frame * bw, 0, bw, bits.height, bit.x - bw / 2, bit.y - bits.height / 2);
      });
    }
    ctx.restore();
  }

  function drawMower(ctx, mower, time, ground, water) {
    if (mower.state === "gone" || mower.state === "none") return;
    // 原版分场景：草地用小推车，泳池用泳池清洁车，屋顶用屋顶清洁车。
    var name = ground === "roof" ? "RoofCleaner" : water ? "PoolCleaner" : "LawnMower";
    var reanim = Assets.reanim(name);
    if (!reanim) reanim = Assets.reanim("LawnMower");
    if (!reanim) return;
    var y = Data.groundY(mower.row) - (water ? 64 : 70);
    Reanim.draw(ctx, reanim, frameOf(reanim, "anim_normal", mower.state === "run" ? time * 2 : 0), mower.x, y);
  }

  function drawSun(ctx, sun) {
    var reanim = Assets.reanim("Sun");
    ctx.save();
    ctx.translate(sun.x, sun.y);
    ctx.globalAlpha = sun.fade;
    if (sun.coin) ctx.filter = "sepia(1) saturate(4)";
    if (sun.small) ctx.scale(0.58, 0.58);
    if (reanim) {
      var frames = reanim.tracks[0].frames.length || 1;
      var frame = Math.floor((sun.time || 0) * reanim.fps) % frames;
      if (frame < 0) frame += frames;
      Reanim.draw(ctx, reanim, frame, 0, 0);
    } else {
      var image = Assets.image("Sun2") || Assets.image("Sun1");
      var s = sun.small ? 42 : 78;
      if (image) ctx.drawImage(image, -s / 2, -s / 2, s, s);
    }
    ctx.restore();
  }

  // ---------- 卡片（种子袋） ----------
  //
  // 逐条对照原版 DrawSeedPacket / SeedPacketDrawSeed / MakeCachedPlantFrame：
  //   · 袋底取 seeds.png 的格子：0 = 模仿者灰、1 = 升级紫、2 = 普通绿；
  //   · 土豆雷/大嘴花/魅惑菇/高坚果/三叶草/南瓜头/双子向日葵/玉米炮/卷心菜/
  //     玉米投手/西瓜投手/冰西瓜/地刺钢地刺这 13 株用 packet_plants.png 的现成贴图；
  //   · 其余植物画 reanim 的 anim_idle 第 0 帧再叠头部层，缩放/偏移逐株照抄原表；
  //   · 价格画在袋子左下（原版 PICO129 字体，黑色）。
  var PACKET_W = 50;
  var PACKET_H = 70;

  var packetPlantsCel = {
    potatomine: 0, chomper: 1, hypnoshroom: 2, tallnut: 3, blover: 4,
    pumpkin: 5, twinsunflower: 6, cobcannon: 7, cabbagepult: 8,
    kernelpult: 9, melonpult: 10, wintermelon: 11, spikerock: 12,
  };

  // 原版 DrawSeedPacket 的逐株 aScale / aOffsetX / aOffsetY；没列出的用默认 0.5/5/8。
  var packetPose = {
    tallnut: { scale: 0.3, x: 12, y: 22 },
    coffee: { scale: 0.55, x: 0, y: 9 },
    cobcannon: { scale: 0.26, x: 6, y: 22 },
    cactus: { scale: 0.5, x: 9, y: 13 },
    potatomine: { scale: 0.4, x: 8, y: 12 },
    magnetshroom: { scale: 0.5, x: 5, y: 12 },
    fumeshroom: { scale: 0.4, x: 8, y: 12 },
    pumpkin: { scale: 0.4, x: 8, y: 12 },
    chomper: { scale: 0.4, x: 8, y: 12 },
    doomshroom: { scale: 0.4, x: 8, y: 12 },
    squash: { scale: 0.4, x: 8, y: 12 },
    hypnoshroom: { scale: 0.4, x: 8, y: 12 },
    spikeweed: { scale: 0.4, x: 8, y: 12 },
    spikerock: { scale: 0.4, x: 8, y: 12 },
    plantern: { scale: 0.4, x: 8, y: 12 },
    torchwood: { scale: 0.4, x: 8, y: 12 },
    tanglekelp: { scale: 0.4, x: 8, y: 12 },
    twinsunflower: { scale: 0.45, x: 7, y: 14 },
    gloomshroom: { scale: 0.45, x: 7, y: 14 },
    cattail: { scale: 0.45, x: 8, y: 13 },
    umbrellaleaf: { scale: 0.5, x: 5, y: 10 },
    kernelpult: { scale: 0.4, x: 13, y: 14 },
    cabbagepult: { scale: 0.4, x: 15, y: 14 },
    melonpult: { scale: 0.35, x: 18, y: 19 },
    wintermelon: { scale: 0.35, x: 18, y: 19 },
    gravebuster: { scale: 0.4, x: 10, y: 15 },
    splitpea: { scale: 0.45, x: 12, y: 12 },
    blover: { scale: 0.4, x: 8, y: 17 },
    starfruit: { scale: 0.5, x: 6, y: 8 },
    threepeater: { scale: 0.5, x: 5, y: 10 },
    gatlingpea: { scale: 0.5, x: 2, y: 8 },
  };

  // 卡片里的静态植物。原版烤的是 anim_idle 第 0 帧，豌豆家族再叠对应的头部待机，
  // 不用 anim_full_idle（那一段和头部不是同一拍，叠上去头会偏）。
  function drawPacketSeed(g, id) {
    var def = Data.plants[id];
    if (!def) return;
    var reanim = Assets.reanim(def.reanim);
    if (!reanim) return;
    var groups = HEAD_GROUPS[id];
    var seedOpt = null;
    if (groups && reanim.anims.anim_idle) {
      var idleFrame = frameOf(reanim, "anim_idle", 0);
      Reanim.draw(g, reanim, idleFrame, 0, 0, seedOpt);
      groups.forEach(function (group) {
        if (!reanim.anims[group.idle]) return;
        var headFrame = frameOf(reanim, group.idle, 0);
        Reanim.draw(g, reanim, headFrame, 0, 0, {
          only: function (track) { return !trackShown(track, idleFrame); },
        });
      });
      return;
    }
    if (def.layers) {
      Reanim.drawLayers(g, reanim, def.layers, 0, 0, 0, seedOpt);
      return;
    }
    var idleName = reanim.anims.anim_idle ? "anim_idle" : (def.anim || "anim_idle");
    if (id === "potatomine" && reanim.anims.anim_armed) idleName = "anim_armed";
    Reanim.draw(g, reanim, frameOf(reanim, idleName, 0), 0, 0, seedOpt);
  }

  // 把整株（含头部零件）的不透明范围放进卡片上半截，左右居中，下面留给阳光价格。
  function placeSeedArt(g, id, imitate) {
    var size = 480;
    var origin = 80;
    var scratch = document.createElement("canvas");
    scratch.width = size;
    scratch.height = size;
    var sg = scratch.getContext("2d", { alpha: true });
    sg.translate(origin, origin);
    if (imitate) sg.filter = "grayscale(1) brightness(1.18) contrast(0.82)";
    drawPacketSeed(sg, id);
    var data;
    try {
      data = sg.getImageData(0, 0, size, size).data;
    } catch (err) {
      return false;
    }
    var minX = size;
    var minY = size;
    var maxX = -1;
    var maxY = -1;
    for (var i = 3; i < data.length; i += 4) {
      if (data[i] < 16) continue;
      var p = (i - 3) >> 2;
      var x = p % size;
      var y = (p / size) | 0;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
    if (maxX < 0) return false;
    var bw = maxX - minX + 1;
    var bh = maxY - minY + 1;
    var art = { x: 5, y: 4, w: 40, h: 48 };
    var scale = Math.min(art.w / bw, art.h / bh);
    var dw = bw * scale;
    var dh = bh * scale;
    g.drawImage(
      scratch,
      minX, minY, bw, bh,
      art.x + (art.w - dw) / 2,
      art.y + (art.h - dh) / 2,
      dw, dh
    );
    return true;
  }

  function packetGeom(index) {
    // 原版 GetSeedPacketPositionX：卡槽里的卡按数量拉开间距，槽宽随张数伸展。
    var n = bankCount == null ? 10 : bankCount;
    var x = n <= 7 ? index * 59 + 85 : n === 8 ? index * 54 + 81 : n === 9 ? index * 52 + 80 : index * 51 + 79;
    return { x: 10 + x, y: 8, w: PACKET_W, h: PACKET_H };
  }

  // 当前卡槽的张数（决定间距和卡槽宽度），战斗界面每帧写入。
  var bankCount = null;

  function beltBox(packet, index) {
    var x = packet && packet.slide != null ? packet.slide : 91 + index * 50;
    return { x: x, y: 8, w: PACKET_W, h: PACKET_H };
  }

  function bankWidth(count) {
    var n = count == null ? 10 : count;
    return 446 + (n <= 6 ? 0 : n === 7 ? 60 : n === 8 ? 76 : n === 9 ? 112 : 153);
  }

  function shovelGeom() {
    var x = 10 + bankWidth(bankCount) + 8;
    return { x: x, y: 0, w: 70, h: 72 };
  }

  var packetCache = {};

  // 按原版 DrawSeedPacket 烤一张 50×70 的卡片。
  function bakedPacket(id, filter, imitate) {
    var key = id + "@" + (filter || "full") + (imitate ? "@imitate" : "");
    var found = packetCache[key];
    if (found) return found;
    var canvas = document.createElement("canvas");
    canvas.width = PACKET_W;
    canvas.height = PACKET_H;
    var g = canvas.getContext("2d", { alpha: true });
    if (filter) g.filter = filter;
    // 袋底：模仿者用灰袋，升级植物用紫袋，其余绿袋。
    var cel = id === "imitater" ? 0 : Data.plants[id] && Data.plants[id].upgrade ? 1 : 2;
    var seeds = Assets.image("seeds");
    if (seeds) g.drawImage(seeds, cel * PACKET_W, 0, PACKET_W, PACKET_H, 0, 0, PACKET_W, PACKET_H);
    var preview = id;
    var celArt = packetPlantsCel[preview];
    if (celArt != null) {
      var sheet = Assets.image("packetplants");
      if (sheet) g.drawImage(sheet, celArt * PACKET_W, 0, PACKET_W, PACKET_H, 0, 0, PACKET_W, PACKET_H);
    } else if (!placeSeedArt(g, preview, imitate)) {
      var pose = packetPose[preview] || { scale: 0.5, x: 5, y: 8 };
      g.save();
      g.translate(pose.x, pose.y);
      g.scale(pose.scale, pose.scale);
      if (imitate) g.filter = "grayscale(1) brightness(1.18) contrast(0.82)";
      drawPacketSeed(g, preview);
      g.restore();
    }
    packetCache[key] = canvas;
    return canvas;
  }

  // 阳光够且冷却完：原色。阳光不够：整张灰、价格变红。
  // 冷却中且阳光够：下半原色，上半灰色并向上缩短。又缺阳光时下半浅灰、上半深灰。
  function drawPacket(ctx, id, rect, opt) {
    opt = opt || {};
    var cooling = opt.cd > 0;
    var poor = !!opt.poor;
    var split = rect.y + rect.h * (cooling ? opt.cd : 0);
    ctx.save();
    if (opt.selected) ctx.translate(0, -8);
    function blit(filter) {
      ctx.drawImage(bakedPacket(id, filter, opt.imitate), rect.x, rect.y, rect.w, rect.h);
    }
    function clip(y, h) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(rect.x, y, rect.w, Math.max(0, h));
      ctx.clip();
    }
    if (opt.locked) {
      // 没解锁的植物在选卡面板上是剪影。
      var shadow = Assets.image("seedpacketsilhouette");
      if (shadow) ctx.drawImage(shadow, rect.x, rect.y, rect.w, rect.h);
      ctx.restore();
      return;
    }
    if (opt.imitate && !cooling) {
      blit(poor ? "grayscale(1) brightness(0.78)" : "grayscale(1)");
    } else if (opt.picked && !cooling) {
      blit("grayscale(1) brightness(0.42)");
    } else if (opt.dim && !cooling) {
      // 原版“不推荐”的灰度是 115/255。
      blit("grayscale(1) brightness(0.45)");
    } else if (!cooling) {
      blit(poor ? "grayscale(1) brightness(0.5)" : "");
    } else if (opt.imitate) {
      clip(split, rect.y + rect.h - split);
      blit(poor ? "grayscale(1) brightness(0.78)" : "grayscale(1)");
      ctx.restore();
      clip(rect.y, split - rect.y);
      blit("grayscale(1) brightness(0.42)");
      ctx.restore();
    } else if (!poor) {
      clip(split, rect.y + rect.h - split);
      blit("");
      ctx.restore();
      clip(rect.y, split - rect.y);
      blit("grayscale(1) brightness(0.5)");
      ctx.restore();
    } else {
      clip(split, rect.y + rect.h - split);
      blit("grayscale(1) brightness(0.9)");
      ctx.restore();
      clip(rect.y, split - rect.y);
      blit("grayscale(1) brightness(0.42)");
      ctx.restore();
    }
    // 保龄球的爆炸坚果在卡片上盖一个红条。
    if (opt.explode) {
      ctx.fillStyle = "rgba(220, 36, 16, 0.42)";
      ctx.fillRect(rect.x + 8, rect.y + 18, rect.w - 16, 18);
      ctx.fillStyle = "#fff6e8";
      ctx.font = font(12, true);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("爆", rect.x + rect.w / 2, rect.y + 27);
    }
    var def = Data.plants[id];
    if (opt.free || !def) {
      ctx.restore();
      return;
    }
    // 原版价格：PICO129 黑字，右缘贴在 x+32、基线约 y+61。
    ctx.font = numberFont(11);
    ctx.textAlign = "right";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = poor ? "#c42020" : "#0d0d0d";
    ctx.fillText(String(def.cost), rect.x + 33, rect.y + 61);
    ctx.restore();
  }

  // ---------- 通用控件 ----------

  // 石板对话框底（SeedChooser_Background 整铺）。
  function panel(ctx, x, y, w, h) {
    var image = Assets.image("SeedChooser_Background");
    if (image) ctx.drawImage(image, x, y, w, h);
    else {
      ctx.fillStyle = "#6a3d22";
      ctx.fillRect(x, y, w, h);
    }
  }

  // 石质按钮（三片拼接，按下换下压贴图）。框比贴图矮时整体等比压扁、
  // 字号跟着缩（用户对话框里的小号石钮），框更高就照旧居中不拉伸。
  function stoneButton(ctx, rect, text, hot) {
    var left = Assets.image(hot ? "button_down_left" : "button_left");
    var mid = Assets.image(hot ? "button_down_middle" : "button_middle");
    var right = Assets.image(hot ? "button_down_right" : "button_right");
    if (!left || !mid || !right) {
      button(ctx, rect, text, hot);
      return;
    }
    var imgH = left.height;
    var drawH = Math.min(rect.h, imgH);
    var k = drawH / imgH;
    var lw = left.width * k;
    var rw = right.width * k;
    var y = rect.y + (rect.h - drawH) / 2;
    ctx.drawImage(left, rect.x, y, lw, drawH);
    ctx.drawImage(mid, rect.x + lw, y, Math.max(1, rect.w - lw - rw), drawH);
    ctx.drawImage(right, rect.x + rect.w - rw, y, rw, drawH);
    var size = Math.max(11, Math.min(18, Math.round(drawH * 0.42)));
    label(ctx, text, rect.x + rect.w / 2, y + drawH / 2 + 1, { font: stoneFont(size, true), align: "center", fill: "#5dff6a", line: 3 });
  }

  // 木牌按钮（选卡面板上的"开始战斗"等）。
  function button(ctx, rect, text, hot) {
    var image = Assets.image(hot ? "SeedChooser_Button_Glow" : "SeedChooser_Button") || Assets.image("SeedChooser_Button");
    if (image) ctx.drawImage(image, rect.x, rect.y, rect.w, rect.h);
    else {
      ctx.fillStyle = hot ? "#c47a32" : "#8a4e22";
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    }
    label(ctx, text, rect.x + rect.w / 2, rect.y + rect.h / 2, { font: font(18), align: "center", fill: "#fff6d2", line: 3 });
  }

  // ---------- 选卡面板与变身茄子 ----------
  //
  // 几何逐项对照原版 SeedChooserScreen：
  //   · 石板底图 465×513 画在 (0, 87)；
  //   · 卡片 50×70，第 col 列 x = col*53 + 22；行距按有没有升级植物分两档
  //     （Has7Rows：y = row*70 + 123，否则 row*73 + 128）；
  //   · 没解锁的植物画剪影，"不推荐"的压灰；变身茄子挂在 (464, 515)；
  //   · "开始战斗"按钮 (154, 545) 156×42。

  function chooserPanel() {
    return { x: 0, y: 87, w: 465, h: 513 };
  }

  function chooserMetrics() {
    return { cols: 8, w: PACKET_W, h: PACKET_H };
  }

  // 选卡界面里全部 48 种卡的顺序 = 原版 SeedType 枚举顺序 = 图鉴解锁顺序。
  // 存档里万一记乱了也按这个顺序摆，保证和原版一致。
  function chooserOrder() {
    var order = (typeof Almanac !== "undefined" && Almanac.plantOrder) || [];
    var list = order.filter(function (id) { return !!PlantCatalog.get(id); });
    if (!list.length) list = gridPlants(PlantCatalog.order.map(function (plant) { return plant.id; }));
    return list;
  }

  function gridPlants(ids) {
    var list = [];
    (ids || []).forEach(function (id) {
      var plant = PlantCatalog.get(id);
      if (plant && plant.place !== "corner") list.push(id);
    });
    return list;
  }

  function cornerPlants(ids) {
    var list = [];
    (ids || []).forEach(function (id) {
      var plant = PlantCatalog.get(id);
      if (plant && plant.place === "corner") list.push(id);
    });
    return list;
  }

  // 原版 Has7Rows：拿到双子向日葵这一档的升级植物后格子变矮、行距变紧。
  function chooserHas7Rows(owned) {
    var upgrades = ["twinsunflower", "gloomshroom", "cattail", "wintermelon", "goldmagnet", "gatlingpea", "cobcannon"];
    return (owned || []).some(function (id) { return upgrades.indexOf(id) >= 0; });
  }

  function chooserSlots(ids) {
    var m = chooserMetrics();
    var owned = ids || [];
    var has7 = chooserHas7Rows(owned);
    var order = chooserOrder();
    return order.map(function (id, index) {
      if (PlantCatalog.get(id) && PlantCatalog.get(id).place === "corner") return null;
      var col = index % m.cols;
      var row = Math.floor(index / m.cols);
      return {
        id: id,
        x: col * 53 + 22,
        y: row * (has7 ? 70 : 73) + (has7 ? 123 : 128),
        w: m.w,
        h: m.h,
        locked: owned.indexOf(id) < 0,
      };
    }).filter(function (slot) { return !!slot; });
  }

  // 变身茄子的卡不在格子里，挂在面板右下角（原版位置）。
  function cornerSlot() {
    return { x: 464, y: 515, w: 50, h: 70 };
  }

  // 当前模仿者复制的是哪株植物（选卡阶段看 state.imitate，战斗里看卡槽）。
  function heldCopy(state) {
    var copy = state.imitate || null;
    if (state.board && state.board.packets) {
      state.board.packets.forEach(function (packet) {
        if (packet.id === "imitater" && packet.copy) copy = packet.copy;
      });
    }
    return copy;
  }

  function drawImitaterCorner(ctx, slot, picked) {
    var frame = Assets.image("SeedChooser_ImitaterAddOn");
    if (frame) ctx.drawImage(frame, 459, 503);
    var seed = Assets.image(picked ? "ImitaterSeedDisabled" : "ImitaterSeed");
    if (!seed) return;
    ctx.drawImage(seed, slot.x, slot.y, slot.w, slot.h);
  }

  function imitateBox() {
    return { x: 116, y: 16, w: 540, h: 568 };
  }

  function imitateSlots(ids) {
    var box = imitateBox();
    var cols = 8;
    var w = PACKET_W;
    var h = PACKET_H;
    var gapX = 3;
    var gapY = 3;
    var owned = {};
    (ids || []).forEach(function (id) { owned[id] = true; });
    // 只列已解锁的，顺序仍按图鉴（原版如此）。
    var grid = chooserOrder().filter(function (id) { return owned[id] && PlantCatalog.get(id).place !== "corner"; });
    var gridW = cols * w + (cols - 1) * gapX;
    var x0 = box.x + Math.round((box.w - gridW) / 2);
    var y0 = box.y + 108;
    return grid.map(function (id, index) {
      return {
        id: id,
        x: x0 + (index % cols) * (w + gapX),
        y: y0 + Math.floor(index / cols) * (h + gapY),
        w: w,
        h: h,
      };
    });
  }

  // 石头拼的对话框（九宫格 + 顶部骷髅拱门）。
  // 拱门用原生尺寸（素材 187×64）压在框顶上，拱顶在框顶上方 43px——
  // 这个偏移是按原版截图量的（你是谁/新用户两个框都吻合）。
  // bottomY 可选：面板（暗区）的下沿，底片从那里压缩到框底；不传则按
  // 底片原高 148 处理。上/中片的高度取素材原值（顶 97、中片随意拉伸）。
  function drawStoneDialog(ctx, box, bottomY) {
    var lw = 107;
    var rw = 120;
    var th = 97;
    var midW = Math.max(8, box.w - lw - rw);
    if (bottomY == null) bottomY = box.y + box.h - 148;
    var midH = Math.max(8, bottomY - (box.y + th));
    var botH = Math.max(8, box.y + box.h - bottomY);
    function piece(name, x, y, w, h) {
      var image = Assets.image(name);
      if (image) ctx.drawImage(image, x, y, w, h);
    }
    piece("dialog_topleft", box.x, box.y, lw, th);
    piece("dialog_topmiddle", box.x + lw, box.y, midW, th);
    piece("dialog_topright", box.x + box.w - rw, box.y, rw, th);
    piece("dialog_centerleft", box.x, box.y + th, lw, midH);
    piece("dialog_centermiddle", box.x + lw, box.y + th, midW, midH);
    piece("dialog_centerright", box.x + box.w - rw, box.y + th, rw, midH);
    piece("dialog_bigbottomleft", box.x, bottomY, lw, botH);
    piece("dialog_bigbottommiddle", box.x + lw, bottomY, midW, botH);
    piece("dialog_bigbottomright", box.x + box.w - rw, bottomY, rw, botH);
    var header = Assets.image("dialog_header");
    if (header) ctx.drawImage(header, box.x + (box.w - header.width) / 2, box.y - 43);
  }

  // 选卡面板上"开始战斗"按钮的位置（原版 154,545，156×42）。
  function rockButton() {
    return { x: 154, y: 545, w: 156, h: 42 };
  }

  // 缺必带植物时的确认框及两个按钮。
  function confirmBox(asks) {
    var h = 118 + asks.length * 34;
    return { x: 150, y: 188, w: 500, h: h };
  }

  function confirmYes(asks) {
    var box = confirmBox(asks);
    return { x: box.x + 40, y: box.y + box.h - 62, w: 180, h: 44 };
  }

  function confirmNo(asks) {
    var box = confirmBox(asks);
    return { x: box.x + box.w - 220, y: box.y + box.h - 62, w: 180, h: 44 };
  }

  // 卡槽垂直滑入。离开选卡时先滑走，镜头回到草坪附近再滑下来。
  function bankSlide(board) {
    if (!board) return 0;
    if (board.phase === "look" || board.phase === "pan") return -130;
    if (board.phase === "choose") return -130 * (1 - board.ui);
    if (board.phase === "leave") {
      if (board.ui > 0) return -130 * (1 - board.ui);
      return -130 * (1 - board.bankIn);
    }
    return 0;
  }

  // 选卡面板从屏幕底部滑上来的距离。
  function poolSlide(board) {
    if (!board || (board.phase !== "choose" && board.phase !== "leave")) return 700;
    return (1 - board.ui) * 680;
  }

  // ---------- 素材加工缓存 ----------

  var composed = {};

  // 主菜单的草皮是"彩色 jpg + 白色剪影 _png"两层：把剪影转成 alpha 遮罩
  // 再 destination-in 抠掉彩色图的透明区，得到能叠在天空上的草皮。
  function yardLayer(colorId) {
    if (composed[colorId]) return composed[colorId];
    var color = Assets.image(colorId);
    var mask = Assets.imageMask(colorId);
    if (!color) return null;
    if (!mask) {
      composed[colorId] = color;
      return color;
    }
    var canvas = document.createElement("canvas");
    canvas.width = color.width;
    canvas.height = color.height;
    var g = canvas.getContext("2d");
    g.drawImage(color, 0, 0);
    var scratch = document.createElement("canvas");
    scratch.width = mask.width;
    scratch.height = mask.height;
    var sg = scratch.getContext("2d");
    sg.drawImage(mask, 0, 0);
    var data = sg.getImageData(0, 0, scratch.width, scratch.height);
    var px = data.data;
    for (var i = 0; i < px.length; i += 4) {
      var lum = (px[i] + px[i + 1] + px[i + 2]) / 3;
      px[i] = 255;
      px[i + 1] = 255;
      px[i + 2] = 255;
      px[i + 3] = lum;
    }
    sg.putImageData(data, 0, 0);
    g.globalCompositeOperation = "destination-in";
    g.drawImage(scratch, 0, 0, canvas.width, canvas.height);
    composed[colorId] = canvas;
    return canvas;
  }

  var keyedCache = {};

  // 带遮罩的彩图（PopCap 的 "xxx.jpg + xxx_.png 遮罩" 约定）：把遮罩亮度转成
  // alpha 抠掉 JPG 的黑底。墓碑、花瓶这类"JPG 彩图 + 下划线遮罩"的素材都用它。
  var maskedCache = {};

  function maskedImage(colorId) {
    if (maskedCache[colorId]) return maskedCache[colorId];
    var color = Assets.image(colorId);
    var mask = Assets.imageMask(colorId);
    if (!color) return null;
    if (!mask) {
      maskedCache[colorId] = color;
      return color;
    }
    var canvas = document.createElement("canvas");
    canvas.width = color.width;
    canvas.height = color.height;
    var g = canvas.getContext("2d");
    g.drawImage(color, 0, 0);
    var scratch = document.createElement("canvas");
    scratch.width = mask.width;
    scratch.height = mask.height;
    var sg = scratch.getContext("2d");
    sg.drawImage(mask, 0, 0);
    var data = sg.getImageData(0, 0, scratch.width, scratch.height);
    var px = data.data;
    for (var i = 0; i < px.length; i += 4) {
      var lum = (px[i] + px[i + 1] + px[i + 2]) / 3;
      px[i] = 255;
      px[i + 1] = 255;
      px[i + 2] = 255;
      px[i + 3] = lum;
    }
    sg.putImageData(data, 0, 0);
    g.globalCompositeOperation = "destination-in";
    g.drawImage(scratch, 0, 0, canvas.width, canvas.height);
    maskedCache[colorId] = canvas;
    return canvas;
  }

  // 按亮度抠色：paper 模式保留灰阶做纸，ink 模式把亮部变成棕墨。
  function keyedImage(id, mode) {
    var key = id + ":" + mode;
    if (keyedCache[key]) return keyedCache[key];
    var image = Assets.image(id);
    if (!image) return null;
    var canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;
    var g = canvas.getContext("2d");
    g.drawImage(image, 0, 0);
    var data = g.getImageData(0, 0, canvas.width, canvas.height);
    var px = data.data;
    for (var i = 0; i < px.length; i += 4) {
      var lum = (px[i] + px[i + 1] + px[i + 2]) / 3;
      if (mode === "paper") px[i + 3] = lum < 18 ? 0 : 255;
      else {
        px[i] = 48;
        px[i + 1] = 32;
        px[i + 2] = 18;
        px[i + 3] = lum < 24 ? 0 : Math.min(255, lum * 1.35);
      }
    }
    g.putImageData(data, 0, 0);
    keyedCache[key] = canvas;
    return canvas;
  }

  // 把精灵的包围盒放进目标矩形里居中缩放（配合 translate 使用）。
  function placeSprite(ctx, box, rect, maxScale, pad) {
    var bw = Math.max(1, box.maxX - box.minX);
    var bh = Math.max(1, box.maxY - box.minY);
    var scale = Math.min((rect.w - pad * 2) / bw, (rect.h - pad * 2) / bh);
    if (maxScale) scale = Math.min(scale, maxScale);
    ctx.translate(rect.x + rect.w / 2, rect.y + rect.h / 2);
    ctx.scale(scale, scale);
    ctx.translate(-(box.minX + box.maxX) / 2, -(box.minY + box.maxY) / 2);
  }

  var spriteBoxCache = {};

  // 离屏渲染一株植物并扫描像素，得到它的包围盒（相对锚点原点）。
  // 用于卡片窗口和图鉴预览窗里自动摆正。
  function plantSpriteBox(id) {
    if (Object.prototype.hasOwnProperty.call(spriteBoxCache, id)) return spriteBoxCache[id];
    var size = 480;
    var origin = 240;
    var canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    var g = canvas.getContext("2d", { alpha: true });
    try {
      drawPlant(g, id, origin, origin, 0, 0, 1);
    } catch (err) {
      spriteBoxCache[id] = null;
      return null;
    }
    var data;
    try {
      data = g.getImageData(0, 0, size, size).data;
    } catch (err) {
      spriteBoxCache[id] = null;
      return null;
    }
    var minX = size;
    var minY = size;
    var maxX = -1;
    var maxY = -1;
    for (var i = 3; i < data.length; i += 4) {
      if (data[i] < 20) continue;
      var p = (i - 3) >> 2;
      var x = p % size;
      var y = (p / size) | 0;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
    spriteBoxCache[id] = maxX < 0 ? null : {
      minX: minX - origin,
      minY: minY - origin,
      maxX: maxX + 1 - origin,
      maxY: maxY + 1 - origin,
    };
    return spriteBoxCache[id];
  }

  // 逐字换行画正文，返回结束时的 y。用于图鉴描述等长文本。
  function wrapText(ctx, text, x, y, maxW, maxY, opt) {
    opt = opt || {};
    var fontName = opt.font || font(13, false);
    var lineH = opt.lineH || 17;
    var paragraphs = String(text || "").split("\n");
    var yy = y;
    ctx.font = fontName;
    for (var p = 0; p < paragraphs.length; p++) {
      var line = paragraphs[p];
      if (!line) {
        yy += lineH * 0.45;
        continue;
      }
      var buf = "";
      for (var i = 0; i < line.length; i++) {
        var next = buf + line.charAt(i);
        if (ctx.measureText(next).width > maxW && buf) {
          if (yy > maxY) return yy;
          label(ctx, buf, x, yy, { font: fontName, fill: opt.fill, line: opt.line == null ? 0 : opt.line, align: "left" });
          yy += lineH;
          buf = line.charAt(i);
          ctx.font = fontName;
        } else buf = next;
      }
      if (buf && yy <= maxY) {
        label(ctx, buf, x, yy, { font: fontName, fill: opt.fill, line: opt.line == null ? 0 : opt.line, align: "left" });
        yy += lineH;
      }
    }
    return yy;
  }

  // 蹦极绳子不在 reanim 里。原版从身体往上把 BungeeCord 一截截铺到画面外。
  function drawBungeeCord(ctx, reanim, frameIndex) {
    var cord = Assets.image("BungeeCord");
    if (!cord || !reanim) return;
    var body = Reanim.trackByName(reanim, "Zombie_bungi_body");
    var frame = body && Reanim.sampleFrame(body, frameIndex);
    if (!frame || frame.f === -1) return;
    var img = frame.i && Assets.image(frame.i);
    var w = img ? img.width * (frame.sx || 1) : 40;
    var cx = frame.x + w * 0.42;
    var top = frame.y + 6;
    var cw = cord.width;
    var ch = cord.height || 1;
    for (var y = top - ch; y > top - ch * 12; y -= ch) {
      ctx.drawImage(cord, cx - cw / 2, y);
    }
  }

  // 气球帽子上的螺旋桨是另挂的一段动画，身体的 anim_idle 里这条轨道是藏着的。
  function drawBalloonPropeller(ctx, reanim, frameIndex, time) {
    var hat = Reanim.trackByName(reanim, "hat");
    var frame = hat && Reanim.sampleFrame(hat, frameIndex);
    if (!frame || frame.f === -1 || !frame.i) return;
    var spin = (Math.floor((time || 0) * 24) % 2) ? "Zombie_balloon_propeller2" : "Zombie_balloon_propeller";
    var img = Assets.image(spin);
    if (!img) return;
    ctx.save();
    var kx = (frame.kx * Math.PI) / 180;
    var ky = (frame.ky * Math.PI) / 180;
    ctx.transform(
      frame.sx * Math.cos(kx),
      frame.sx * Math.sin(kx),
      -frame.sy * Math.sin(ky),
      frame.sy * Math.cos(ky),
      frame.x - 1.2,
      frame.y - 5.5
    );
    ctx.drawImage(img, 0, 0);
    ctx.restore();
  }

  // ---------- 界面模块注册表 ----------
  // view-menu / view-battle / view-almanac 各自往 screens 里登记绘制函数，
  // 键名就是 Game.state.screen 的取值。
  var screens = {};

  return {
    // 文字与控件
    font: font,
    almanacTitle: almanacTitle,
    almanacBody: almanacBody,
    stoneFont: stoneFont,
    numberFont: numberFont,
    label: label,
    button: button,
    stoneButton: stoneButton,
    panel: panel,
    // 命中与几何
    inside: inside,
    shifted: shifted,
    cellAt: cellAt,
    frameOf: frameOf,
    // 角色绘制
    drawPlant: drawPlant,
    drawZombie: drawZombie,
    drawBungeeCord: drawBungeeCord,
    drawBalloonPropeller: drawBalloonPropeller,
    drawBit: drawBit,
    drawSplat: drawSplat,
    drawMower: drawMower,
    drawSun: drawSun,
    // 卡片
    packetGeom: packetGeom,
    beltBox: beltBox,
    shovelGeom: shovelGeom,
    bankWidth: bankWidth,
    setBankCount: function (count) { bankCount = count; },
    bakedPacket: bakedPacket,
    drawPacket: drawPacket,
    // 选卡面板
    chooserPanel: chooserPanel,
    chooserMetrics: chooserMetrics,
    gridPlants: gridPlants,
    cornerPlants: cornerPlants,
    chooserSlots: chooserSlots,
    cornerSlot: cornerSlot,
    heldCopy: heldCopy,
    drawImitaterCorner: drawImitaterCorner,
    imitateBox: imitateBox,
    imitateSlots: imitateSlots,
    drawStoneDialog: drawStoneDialog,
    rockButton: rockButton,
    confirmBox: confirmBox,
    confirmYes: confirmYes,
    confirmNo: confirmNo,
    bankSlide: bankSlide,
    poolSlide: poolSlide,
    // 素材加工
    yardLayer: yardLayer,
    maskedImage: maskedImage,
    keyedImage: keyedImage,
    placeSprite: placeSprite,
    plantSpriteBox: plantSpriteBox,
    wrapText: wrapText,
    // 模块注册
    screens: screens,
  };
})();
