/*
 * view-almanac.js — 大图鉴（Game.state.screen === "almanac"）。
 *
 * 三个页面：
 *   index   目录：左右各一个预览窗（向日葵 / 普通僵尸），两个入口按钮
 *   plants  植物网格 + 选中植物的预览窗与说明卡（文案来自 LawnStrings）
 *   zombies 僵尸网格 + 同上
 *
 * 文案解析在 data/almanac.js；这里只管摆布局和画角色。
 */
(function () {
  var Kit = window.ViewKit;
  var label = Kit.label;
  var button = Kit.button;
  var stoneButton = Kit.stoneButton;
  var inside = Kit.inside;
  var font = Kit.font;
  var almanacTitle = Kit.almanacTitle;
  var almanacBody = Kit.almanacBody;
  var frameOf = Kit.frameOf;
  var drawPlant = Kit.drawPlant;
  var drawPacket = Kit.drawPacket;
  var placeSprite = Kit.placeSprite;
  var plantSpriteBox = Kit.plantSpriteBox;
  var wrapText = Kit.wrapText;
  var drawBungeeCord = Kit.drawBungeeCord;
  var drawBalloonPropeller = Kit.drawBalloonPropeller;

  var screens = Kit.screens;

  // 植物卡预览窗在卡片图上的透明洞：67,28 起，185×137。
  var PLANT_PREVIEW = { x: 526, y: 114, w: 185, h: 137 };
  var ZOMBIE_PREVIEW = { x: 524, y: 134, w: 188, h: 173 };

  // 图鉴里植物脚下的地面贴图按习性选：水生在池边、蘑菇在夜里、花盆在屋顶。
  function plantGround(id) {
    if (id === "seashroom") return "Almanac_GroundNightPool";
    if (id === "lilypad" || id === "tanglekelp" || id === "cattail") return "Almanac_GroundPool";
    if (id === "pot") return "Almanac_GroundRoof";
    var plant = PlantCatalog.get(id);
    if (plant && (plant.sleep === "day" || id === "gravebuster" || id === "plantern")) return "Almanac_GroundNight";
    return "Almanac_GroundDay";
  }

  function plantCardRect(index, id) {
    // 模仿者的卡片单独放在左上角的小框里，不占网格。
    if (id === "imitater") return { x: 20, y: 23, w: 34, h: 46, id: id };
    return { x: index % 8 * 52 + 26, y: Math.floor(index / 8) * 78 + 92, w: 50, h: 70, id: id };
  }

  function zombieCardRect(index, id) {
    // 僵王博士在页面最底下独占一格。
    if (id === "zomboss") return { x: 192, y: 486, w: 76, h: 76, id: id };
    return { x: index % 5 * 85 + 22, y: Math.floor(index / 5) * 80 + 86, w: 76, h: 76, id: id };
  }

  // 图鉴里的僵尸只显示本种类的零件（共用一套基础僵尸 reanim）。
  // 原版 SetupReanimLayers：路障/铁桶换掉头花，铁门换握门的胳膊，旗手藏起空手只留旗杆那条胳膊。
  function almanacZombieHidden(name, id) {
    var n = name.toLowerCase();
    if (n.indexOf("mustache") >= 0 || n.indexOf("tongue") >= 0) return true;
    if (n.indexOf("whitewater") >= 0 || n.indexOf("ducky") >= 0) return id !== "ducky";
    if (n.indexOf("bucket") >= 0) return id !== "bucket";
    if (n.indexOf("cone") >= 0) return id !== "cone";
    if ((id === "cone" || id === "bucket" || id === "football") && n.indexOf("hair") >= 0) return true;
    if (id === "screen") {
      if (n.indexOf("flaghand") >= 0) return true;
      if (n === "anim_innerarm1" || n === "anim_innerarm2" || n === "anim_innerarm3") return true;
      if (n.indexOf("outerarm_hand") >= 0 || n.indexOf("outerarm_lower") >= 0) return true;
      return false;
    }
    if (id === "flag") {
      if (n === "anim_innerarm1" || n === "anim_innerarm2" || n === "anim_innerarm3") return true;
      if (n.indexOf("screendoor") >= 0 && n !== "zombie_innerarm_screendoor") return true;
      return false;
    }
    if (n.indexOf("screendoor") >= 0 || n.indexOf("flag") >= 0) return true;
    return false;
  }

  // 图鉴小窗照原版 MakeCachedZombieFrame：半倍缩放，画在 200×210 缓存的 (40,40)。
  var CARD_NUDGE = {
    pole: [2, -3], flag: [2, 10], cone: [0, 12], bucket: [0, 9], football: [-15, -1],
    zomboni: [0, 3], dolphin: [-2, -10], pogo: [0, -3], gargantuar: [15, 17], imp: [-8, -7],
    bungee: [-4, 3], dancer: [0, 15], backup: [-4, 20], snorkel: [-10, 0], yeti: [0, 4],
    catapult: [-24, -1], bobsled: [0, -8], ladder: [0, -3],
  };

  var zombieBoxCache = {};

  function zombieSpriteBox(id) {
    if (Object.prototype.hasOwnProperty.call(zombieBoxCache, id)) return zombieBoxCache[id];
    var size = 720;
    var origin = 360;
    var canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    var g = canvas.getContext("2d", { alpha: true });
    drawAlmanacZombie(g, id, origin, origin, 1, 0);
    var data;
    try {
      data = g.getImageData(0, 0, size, size).data;
    } catch (err) {
      zombieBoxCache[id] = null;
      return null;
    }
    var minX = size;
    var minY = size;
    var maxX = -1;
    var maxY = -1;
    for (var i = 3; i < data.length; i += 16) {
      if (data[i] < 24) continue;
      var p = (i - 3) >> 2;
      var x = p % size;
      var y = (p / size) | 0;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
    zombieBoxCache[id] = maxX < 0 ? null : {
      minX: minX - origin,
      minY: minY - origin,
      maxX: maxX + 1 - origin,
      maxY: maxY + 1 - origin,
    };
    return zombieBoxCache[id];
  }

  // 在矩形里摆一只僵尸；scale/time 直接给时按坐标画（目录页大图）。
  // 大图用原版图鉴里那一段：不在场上时舞王举手、雪橇正常开、气球挂着、撑杆带着杆、僵王只露驾驶室。
  // dx/dy 是 DrawZombies 里的 TranslateF。ix 是 GetDrawPos 的横向修正（蹦极 -18），
  // iy 是离地高度。缩放补偿和 +15/-8 在绘制时按 UpdateReanim 的 SetPosition 加上。
  var PORTRAIT = {
    dancer: { anim: "anim_armraise", scale: 0.8 },
    backup: { anim: "anim_armraise", scale: 0.8 },
    zomboni: { anim: "anim_drive", dx: -30, dy: 5 },
    bobsled: { anim: "anim_idle" },
    bungee: { anim: "anim_drop", dx: 15, ix: -18, iy: -20 },
    balloon: { anim: "anim_idle", dy: -20 },
    pole: { anim: "anim_run" },
    pogo: { anim: "anim_pogo" },
    catapult: { anim: "anim_idle", dx: -10 },
    gargantuar: { dy: 40 },
    football: { dx: -10 },
    zomboss: { anim: "anim_head_idle", dx: -540, dy: -175 },
  };

  function almanacAnim(reanim, id) {
    var preferred = PORTRAIT[id] && PORTRAIT[id].anim;
    if (!preferred) preferred = id === "pogo" ? "anim_pogo" : id === "zomboss" ? "anim_head_idle" : "anim_idle";
    if (reanim.anims[preferred]) return preferred;
    var chain = ["anim_idle", "anim_idle2", "anim_walk", "anim_head_idle", "anim_run", "anim_drive", "anim_armraise"];
    return chain.filter(function (name) { return reanim.anims[name]; })[0] || preferred;
  }

  function drawAlmanacZombie(ctx, id, x, y, scale, time, fit, card) {
    var species = ZombieCatalog.get(id);
    if (!species) return;
    var reanim = Assets.reanim(species.reanim || "Zombie");
    if (!reanim) return;
    var anim = almanacAnim(reanim, id);
    var frameIndex = frameOf(reanim, anim, card ? 0 : (time || 0));
    ctx.save();
    if (card) {
      var nudge = CARD_NUDGE[id] || [0, 0];
      ctx.beginPath();
      ctx.rect(card.x + 2, card.y + 2, 72, 72);
      ctx.clip();
      ctx.translate(card.x + 1 + nudge[0], card.y - 6 + nudge[1]);
      ctx.scale(0.5, 0.5);
      if (id === "zomboss") {
        x = -524;
        y = -88;
      } else {
        x = 40;
        y = id === "gargantuar" ? 60 : 40;
      }
    } else if (fit && fit.portrait) {
      var pose = PORTRAIT[id] || {};
      ctx.beginPath();
      ctx.rect(ZOMBIE_PREVIEW.x, ZOMBIE_PREVIEW.y, ZOMBIE_PREVIEW.w, ZOMBIE_PREVIEW.h);
      ctx.clip();
      var zoom = pose.scale || 1;
      // 预览洞对应裁剪 (-42,-51)，僵尸站在 (566, 185)。再叠原版 SetPosition 的 15 与 -8。
      var px = 566 + (pose.dx || 0) + (pose.ix || 0) + 15 + (30 - zoom * 30);
      var py = 185 + (pose.dy || 0) + (pose.iy || 0) - 8 + (120 - zoom * 120);
      ctx.translate(px, py);
      ctx.scale(zoom, zoom);
      x = 0;
      y = 0;
    } else if (fit) {
      ctx.beginPath();
      ctx.rect(fit.x, fit.y, fit.w, fit.h);
      ctx.clip();
      var box = zombieSpriteBox(id);
      if (box) placeSprite(ctx, box, fit, fit.max || 1, fit.pad == null ? 4 : fit.pad);
      else ctx.translate(fit.x + fit.w / 2, fit.y + fit.h / 2);
      x = 0;
      y = 0;
    } else {
      ctx.translate(x, y);
      ctx.scale(scale, scale);
      x = 0;
      y = 0;
    }
    if (id === "bungee") {
      ctx.save();
      ctx.translate(x, y);
      drawBungeeCord(ctx, reanim, frameIndex);
      ctx.restore();
    }
    Reanim.draw(ctx, reanim, frameIndex, x, y, {
      skip: function (track) {
        if (almanacZombieHidden(track.name, id)) return true;
        return /ground|shadow/i.test(track.name);
      },
    });
    if (id === "flag") {
      var pole = Assets.reanim("Zombie_flagpole");
      if (pole) Reanim.draw(ctx, pole, frameOf(pole, "Zombie_flag", 0) || 0, x, y);
    }
    if (id === "balloon") {
      ctx.save();
      ctx.translate(x, y);
      drawBalloonPropeller(ctx, reanim, frameIndex, time || 0);
      ctx.restore();
    }
    ctx.restore();
  }

  function drawAlmanacPlant(ctx, id, time) {
    var ground = Assets.image(plantGround(id));
    if (ground) ctx.drawImage(ground, 521, 107);
    ctx.save();
    ctx.beginPath();
    ctx.rect(PLANT_PREVIEW.x, PLANT_PREVIEW.y, PLANT_PREVIEW.w, PLANT_PREVIEW.h);
    ctx.clip();
    var box = plantSpriteBox(id);
    if (box) placeSprite(ctx, box, PLANT_PREVIEW, 1, 8);
    else ctx.translate(PLANT_PREVIEW.x + PLANT_PREVIEW.w / 2, PLANT_PREVIEW.y + PLANT_PREVIEW.h / 2);
    drawPlant(ctx, id, 0, 0, time, 0, 1);
    ctx.restore();
  }

  // 说明和戴夫对话框同一套 BrianneTod 点阵字。图鉴用 12 号，底色是原文的蓝，
  // 关键字和风味在字符串里的 {KEYWORD}/{FLAVOR}/{STAT} 上换色。
  function drawAlmanacCopy(ctx, kind, id, copy, box) {
    var raw = Almanac.description(kind, id) || "";
    var body = raw.replace(/^(\s|\{SHORTLINE\})+/, "");
    var header = copy.header || "";
    var text = header ? header + (body ? "\n" + body : "") : body;
    if (!text) return;
    if (BitmapFont.drawTagged(ctx, "BrianneTod12", text, box, "#2c3a66", "left")) return;
    wrapText(ctx, header || body, box.x, box.y, box.w, box.y + box.h, {
      font: almanacBody(14), fill: "#2c3a66", line: 0, lineH: 19,
    });
  }

  function drawAlmanac(ctx, state) {
    var page = state.almanacPage || "index";
    if (page === "index") {
      var back = Assets.image("Almanac_IndexBack");
      if (back) ctx.drawImage(back, 0, 0, Data.W, Data.H);
      label(ctx, "大图鉴 — 目录", 400, 46, { font: almanacTitle(22), align: "center", fill: "#e4e4e4", line: 2 });
      ctx.save();
      ctx.beginPath();
      ctx.rect(52, 128, 330, 200);
      ctx.clip();
      drawPlant(ctx, "sunflower", 150, 210, state.time, 0, 1);
      ctx.restore();
      ctx.save();
      ctx.beginPath();
      ctx.rect(430, 118, 330, 210);
      ctx.clip();
      drawAlmanacZombie(ctx, "normal", 520, 155, 1, state.time);
      ctx.restore();
      button(ctx, { x: 130, y: 345, w: 156, h: 42 }, "查看植物", state.hover === "almanac-plants");
      stoneButton(ctx, { x: 487, y: 345, w: 210, h: 48 }, "查看僵尸", state.hover === "almanac-zombies");
    } else if (page === "plants") {
      var plantBack = Assets.image("Almanac_PlantBack");
      if (plantBack) ctx.drawImage(plantBack, 0, 0, Data.W, Data.H);
      label(ctx, "大图鉴 — 植物", 400, 40, { font: almanacTitle(20), align: "center", fill: "#d59f2b", line: 0 });
      var plants = Almanac.plantOrder.filter(function (id) { return PlantCatalog.get(id); });
      var gridIndex = 0;
      plants.forEach(function (id) {
        var rect = plantCardRect(id === "imitater" ? 0 : gridIndex, id);
        if (id !== "imitater") gridIndex++;
        drawPacket(ctx, id, rect, { time: state.time, center: true });
        if (state.hover === "seed:" + id || state.almanacPlant === id) {
          ctx.strokeStyle = state.almanacPlant === id ? "#ffe14a" : "#fff6c8";
          ctx.lineWidth = 2;
          ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
        }
      });
      var shown = state.almanacPlant || "peashooter";
      drawAlmanacPlant(ctx, shown, state.time);
      var card = Assets.image("Almanac_PlantCard");
      if (card) ctx.drawImage(card, 459, 86);
      var info = PlantCatalog.get(shown);
      var plantName = info ? info.name : shown;
      var copy = Almanac.present("plant", shown, {
        hp: info ? info.hp : null,
        damage: info && info.attack && info.attack.damage ? info.attack.damage : null,
        armor: info && info.armor ? info.armor.hp : 0,
      });
      if (!copy.header && !copy.body && info && info.tip) copy.header = info.tip;
      if (copy.header === plantName) copy.header = "";
      label(ctx, plantName, 618, 280, { font: almanacTitle(17), align: "center", fill: "#d59f2b", line: 0 });
      drawAlmanacCopy(ctx, "plant", shown, copy, { x: 485, y: 309, w: 258, h: 196 });
      if (shown !== "imitater" && info) {
        // 花费、恢复时间和正文同一套点阵字，关键字棕色、数值红色。
        BitmapFont.drawTagged(ctx, "BrianneTod12", "{KEYWORD}花费：{STAT}" + info.cost, { x: 485, y: 508, w: 134, h: 20 }, "#ffffff", "left");
        BitmapFont.drawTagged(ctx, "BrianneTod12", "{KEYWORD}恢复时间：{STAT}" + Almanac.rechargeWord(info.cd), { x: 600, y: 508, w: 139, h: 20 }, "#2c3a66", "right");
      }
      var indexBtn = Assets.image(state.hover === "almanac-index" ? "Almanac_IndexButtonHighlight" : "Almanac_IndexButton");
      if (indexBtn) ctx.drawImage(indexBtn, 32, 567);
      label(ctx, "图鉴索引", 114, 580, { font: almanacBody(13), align: "center", fill: "#7a4018", line: 0 });
    } else {
      var zombieBack = Assets.image("Almanac_ZombieBack");
      if (zombieBack) ctx.drawImage(zombieBack, 0, 0, Data.W, Data.H);
      label(ctx, "大图鉴 — 僵尸", 400, 45, { font: almanacTitle(20), align: "center", fill: "#00c400", line: 0 });
      var zombies = Almanac.zombieOrder.filter(function (id) { return ZombieCatalog.get(id); });
      var grid = 0;
      zombies.forEach(function (id) {
        var rect = zombieCardRect(id === "zomboss" ? 0 : grid, id);
        if (id !== "zomboss") grid++;
        var frame = Assets.image("Almanac_ZombieWindow");
        if (frame) ctx.drawImage(frame, rect.x, rect.y);
        drawAlmanacZombie(ctx, id, 0, 0, 1, 0, null, rect);
        var rim = Assets.image("Almanac_ZombieWindow2");
        if (rim) ctx.drawImage(rim, rect.x, rect.y);
        if (state.almanacZombie === id || state.hover === "zed:" + id) {
          ctx.strokeStyle = state.almanacZombie === id ? "#9dff9a" : "#d7ffe0";
          ctx.lineWidth = 2;
          ctx.strokeRect(rect.x + 1, rect.y + 1, rect.w - 2, rect.h - 2);
        }
      });
      var zid = state.almanacZombie || "normal";
      var ground = Assets.image(zid === "zomboni" || zid === "bobsled" ? "Almanac_GroundIce" : "Almanac_GroundDay");
      if (ground) ctx.drawImage(ground, 518, 110);
      drawAlmanacZombie(ctx, zid, 0, 0, 1, state.time, { portrait: true });
      var zcard = Assets.image("Almanac_ZombieCard");
      if (zcard) ctx.drawImage(zcard, 455, 78);
      var species = ZombieCatalog.get(zid);
      var zcopy = Almanac.present("zombie", zid, {
        hp: species.hp,
        damage: species.attack && species.attack.damage ? species.attack.damage : null,
        armor: species.armor && species.armor.hp ? species.armor.hp : 0,
      });
      if (zcopy.header === species.name) zcopy.header = "";
      label(ctx, species.name, 618, 359, { font: almanacTitle(16), align: "center", fill: "#00c400", line: 0 });
      drawAlmanacCopy(ctx, "zombie", zid, zcopy, {
        x: 484,
        y: zid === "zamboni" ? 372 : 377,
        w: 258,
        h: 160,
      });
      var indexBtnZ = Assets.image(state.hover === "almanac-index" ? "Almanac_IndexButtonHighlight" : "Almanac_IndexButton");
      if (indexBtnZ) ctx.drawImage(indexBtnZ, 32, 567);
      label(ctx, "图鉴索引", 114, 580, { font: almanacBody(13), align: "center", fill: "#7a4018", line: 0 });
    }
    var close = Assets.image(state.hover === "almanac-close" ? "Almanac_CloseButtonHighlight" : "Almanac_CloseButton");
    if (close) ctx.drawImage(close, 676, 567);
    label(ctx, "关闭", 712, 580, { font: almanacBody(13), align: "center", fill: "#7a4018", line: 0 });
  }

  screens.almanac = drawAlmanac;
  Kit.almanac = {
    plantCardRect: plantCardRect,
    zombieCardRect: zombieCardRect,
  };
})();
