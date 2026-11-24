/*
 * view-battle.js — 战斗界面（Game.state.screen === "play"）。
 *
 * 一屏画三层：
 *   草坪层   跟着镜头横向卷动：背景、小推车、植物、僵尸、豌豆、投掷物、保龄球坚果
 *   屏幕层   不随镜头动：阳光、卡槽、传送带、波次横幅、进度条
 *   浮层     选卡面板、变身茄子对话框、缺卡确认、暂停、失败结算
 *
 * 另外提供选卡阶段的悬停提示（plantUnderChooser / drawPlantTip）。
 * 命中检测的主体逻辑在 view.js 调度器里；这里只出绘制与提示。
 */
(function () {
  var Kit = window.ViewKit;
  var label = Kit.label;
  var button = Kit.button;
  var panel = Kit.panel;
  var inside = Kit.inside;
  var shifted = Kit.shifted;
  var font = Kit.font;
  var frameOf = Kit.frameOf;
  var drawPlant = Kit.drawPlant;
  var drawZombie = Kit.drawZombie;
  var drawBit = Kit.drawBit;
  var drawSplat = Kit.drawSplat;
  var drawMower = Kit.drawMower;
  var drawSun = Kit.drawSun;
  var drawPacket = Kit.drawPacket;
  var packetGeom = Kit.packetGeom;
  var beltBox = Kit.beltBox;
  var shovelGeom = Kit.shovelGeom;
  var cellAt = Kit.cellAt;
  var chooserPanel = Kit.chooserPanel;
  var chooserSlots = Kit.chooserSlots;
  var cornerPlants = Kit.cornerPlants;
  var cornerSlot = Kit.cornerSlot;
  var drawImitaterCorner = Kit.drawImitaterCorner;
  var imitateBox = Kit.imitateBox;
  var imitateSlots = Kit.imitateSlots;
  var drawStoneDialog = Kit.drawStoneDialog;
  var bankSlide = Kit.bankSlide;
  var poolSlide = Kit.poolSlide;
  var heldCopy = Kit.heldCopy;
  var rockButton = Kit.rockButton;
  var confirmYes = Kit.confirmYes;
  var confirmNo = Kit.confirmNo;

  var screens = Kit.screens;

  // ---------- 草坪层 ----------

  function drawLawn(ctx, rows, terrainName, terrain) {
    var active = rows && rows.length ? rows : [0, 1, 2, 3, 4];
    var full = active.length >= Data.ROWS;
    // 背景跟地形走：白天草地、黑夜、泳池、雾夜、屋顶各一张。
    var name = terrainName || "background1";
    var bg = Assets.image(!full && name === "background1" ? "background1unsodded" : name) || Assets.image(name) || Assets.image("background1");
    if (bg) ctx.drawImage(bg, -Data.VIEW_X, 0);
    // 泳池/浓雾的背景图里水面是留白的占位块，原版引擎在这里叠水贴图
    // （原版 PoolEffectDraw 的软件渲染路径就是直接画 pool.jpg / pool_night.jpg）。
    if (terrain && terrain.waterRows && terrain.waterRows.length) {
      var water = Assets.image(terrain.time === "night" ? "poolnight" : "pool");
      // 水贴图比留白区矮一截，纵向略拉开盖住白边。
      if (water) ctx.drawImage(water, 53, 271, 721, 168);
    }
    if (full) return;
    // 没铺满草的关卡（1-1 到 1-3）：土背景 + 每个已铺行贴一条草皮。
    var sod = Assets.image("sod1row");
    if (!sod) return;
    active.forEach(function (row) {
      ctx.drawImage(sod, 30, Data.LAWN_Y + row * Data.ROW_H - 14);
    });
  }

  // 保龄球红线画在第 3 列和第 4 列之间。线左边才能放坚果。
  function drawBowlingLine(ctx) {
    var img = Assets.image("Wallnut_bowlingstripe");
    var x = Data.LAWN_X + 3 * Data.COL_W;
    var y = Data.LAWN_Y - 8;
    var h = Data.ROW_H * 5 + 16;
    if (img) ctx.drawImage(img, x - img.width / 2, y);
    else {
      ctx.fillStyle = "rgba(210, 24, 24, 0.85)";
      ctx.fillRect(x - 3, y, 6, h);
    }
  }

  // 植物当前该播哪段动画：睡觉、攻击中、或种类自带的姿态。
  function plantPose(plant) {
    if (plant.asleep) return Data.plants[plant.id].sleepAnim;
    if (plant.shoot > 0 && plant.attackBody && plant.attackAnim) return plant.attackAnim;
    return plant.pose || null;
  }

  function drawPlay(ctx, state) {
    var board = state.board;
    // 镜头：board.viewX 偏离 VIEW_X 时整层草坪平移（选卡阶段的镜头运动）。
    var shift = -((board.viewX || Data.VIEW_X) - Data.VIEW_X);
    var playing = board.phase === "fight" || board.phase === "ready";
    ctx.save();
    ctx.translate(shift, 0);
    drawLawn(ctx, board.level.rows, board.level.terrain && board.level.terrain.background, board.level.terrain);
    if (board.level.kind === "bowling") drawBowlingLine(ctx);
    var shadow = Assets.image("plantshadow");
    // 逐行画：小推车 → 植物（座位从后到前：荷叶 → 本体 → 壳）→ 僵尸 → 预览僵尸。
    for (var row = 0; row < Data.ROWS; row++) {
      board.mowers.forEach(function (mower) {
        if (mower.row === row) {
          drawMower(ctx, mower, state.time, board.level.terrain && board.level.terrain.ground, board.isWater(row));
        }
      });
      if (board.rake && board.rake.alive && board.rake.row === row) {
        var rakeAnim = Assets.reanim("Rake");
        if (rakeAnim) Reanim.draw(ctx, rakeAnim, 0, board.rake.x, Data.groundY(row) - 10);
      }
      var rowPlants = board.plants.filter(function (plant) { return plant.row === row; });
      rowPlants.sort(function (a, b) {
        var rank = { platform: 0, body: 1, shell: 2 };
        return (rank[a.seat] || 1) - (rank[b.seat] || 1);
      });
      rowPlants.forEach(function (plant) {
        var pos = Data.plantAt(plant.col, plant.row, plant.id);
        var anchor = Data.anchors[plant.id] || { x: 40, y: 48 };
        var x = pos.x;
        var y = pos.y;
        if (shadow) ctx.drawImage(shadow, x + anchor.x - 28, y + anchor.y + 18, 54, 22);
        ctx.save();
        // 模仿者种的植物整株灰度；现形阶段画茄子蛋。
        if (plant.imitated) ctx.filter = "grayscale(1) brightness(0.92)";
        if (plant.imitated && plant.disguise > 0) {
          var egg = Assets.reanim("Imitater");
          var eggAnim = plant.disguise > 0.42 ? "anim_idle" : "anim_explode";
          if (egg) Reanim.draw(ctx, egg, frameOf(egg, eggAnim, plant.time), x + 6, y + 8);
        } else if (plant.fuse != null && plant.fuse < 0.35) {
          // 引信快烧完的炸弹类植物闪烁。
          ctx.save();
          ctx.globalAlpha = 0.45 + Math.sin(state.time * 40) * 0.4;
          drawPlant(ctx, plant.id, x, y, plant.time, plant.shoot, plant.hp / plant.maxHp, plantPose(plant), plant);
          ctx.restore();
        } else {
          drawPlant(ctx, plant.id, x, y, plant.time, plant.shoot, plant.hp / plant.maxHp, plantPose(plant), plant);
        }
        ctx.restore();
      });
      board.zombies.forEach(function (zombie) {
        if (zombie.row === row) drawZombie(ctx, zombie);
      });
      if (board.preview) {
        board.preview.forEach(function (zombie) {
          if (zombie.row === row) drawZombie(ctx, zombie);
        });
      }
      // 墓碑压在僵尸上面，从墓碑里往上钻的僵尸就会被碑挡住下半身。
      // 原版墓碑 = 土堆（Tombstone_mounds）+ 石碑（Tombstones 五种造型）。
      board.graves.forEach(function (grave) {
        if (grave.row !== row || grave.gone) return;
        var mound = Assets.image("tombstonemounds");
        var stone = Kit.maskedImage("tombstones");
        var x = Lawn.cellLeft(grave.col) + Lawn.COL_W / 2;
        var bottom = Lawn.LAWN_Y + grave.row * Lawn.ROW_H + Lawn.ROW_H - 4;
        var variant = (grave.variant == null ? 0 : grave.variant) % 5;
        if (grave.rise > 0) {
          ctx.save();
          ctx.beginPath();
          ctx.rect(x - 48, bottom - 104, 96, 104);
          ctx.clip();
          ctx.globalAlpha = 0.35 + 0.65 * (1 - grave.rise);
          if (mound) ctx.drawImage(mound, variant * 86, 273, 86, 91, x - 43, bottom - 88, 86, 88);
          if (stone) ctx.drawImage(stone, variant * 86, 0, 86, 91, x - 43, bottom - 100, 86, 96);
          ctx.restore();
        } else {
          if (mound) ctx.drawImage(mound, variant * 86, 273, 86, 91, x - 43, bottom - 88, 86, 88);
          if (stone) ctx.drawImage(stone, variant * 86, 0, 86, 91, x - 43, bottom - 100, 86, 96);
        }
      });
      // 花瓶压在僵尸上面；被点中时左右发抖然后碎掉。
      (board.vases || []).forEach(function (vase) {
        if (vase.row !== row || vase.broken) return;
        var image = Assets.image("scarypot");
        if (!image) return;
        var shake = vase.shake > 0 ? Math.sin(vase.shake * 60) * 3 : 0;
        ctx.drawImage(image, Lawn.cellLeft(vase.col) + shake, Lawn.LAWN_Y + vase.row * Lawn.ROW_H + 4, Lawn.COL_W - 6, Lawn.ROW_H - 14);
      });
    }
    if (board.bits) board.bits.forEach(function (bit) { drawBit(ctx, bit); });
    // 木槌敲中僵尸的白星。
    if (board.smashFx) {
      var pow = Assets.image("ExplosionPowie");
      if (pow) {
        ctx.save();
        ctx.globalAlpha = Math.min(1, board.smashFx.life * 3);
        ctx.drawImage(pow, board.smashFx.x - 40, board.smashFx.y - 40, 80, 80);
        ctx.restore();
      }
    }
    function blitShot(shot, fallback, scale) {
      var art = {
        pea: "ProjectilePea", snow: "ProjectileSnowPea", fire: "FirePea",
        puff: "puff_1", star: "Projectile_star", spike: "ProjectileCactus",
        cabbage: "Cabbagepult_cabbage", melon: "Melonpult_melon",
        winter: "WinterMelon_projectile", kernel: "Cornpult_kernal",
        butter: "Cornpult_butter", cob: "CobCannon_cob",
      };
      var image = Assets.image(art[shot.kind] || fallback);
      if (!image) return;
      var s = scale == null ? 1 : scale;
      if (shot.kind === "cob") s = 0.5;
      else if (shot.kind === "puff") s = 0.72;
      else if (shot.kind === "melon" || shot.kind === "winter") s = 0.82;
      else if (shot.kind === "butter") s = 0.62;
      else if (shot.kind === "fire") s = 0.85;
      else if (shot.sky) s = 0.55;
      var w = image.width * s;
      var h = image.height * s;
      ctx.drawImage(image, shot.x - w / 2, shot.y - h / 2, w, h);
    }
    board.peas.forEach(function (shot) { blitShot(shot, "ProjectilePea", 1); });
    if (board.splats) board.splats.forEach(function (splat) { drawSplat(ctx, splat); });
    if (board.lobs) {
      board.lobs.forEach(function (lob) { blitShot(lob, "Cabbagepult_cabbage", 1); });
    }
    if (board.nuts) {
      // 保龄球坚果：滚动中旋转，爆炸坚果带一圈焦色。
      board.nuts.forEach(function (nut) {
        ctx.save();
        ctx.translate(nut.x + 30, nut.y);
        ctx.rotate(nut.spin);
        if (nut.explode) ctx.filter = "sepia(1) saturate(6) hue-rotate(-20deg)";
        drawPlant(ctx, "wallnut", -40, -48, 0, 0, 1);
        ctx.restore();
      });
    }
    // 保龄球举卡瞄准时，在第 3 列前显示半透明预放坚果。
    if (playing && board.level.kind === "bowling" && state.selected) {
      var aim = cellAt(state.pointer.x, state.pointer.y, board.level.rows);
      if (aim && aim.col <= 2) {
        ctx.save();
        ctx.globalAlpha = 0.45;
        drawPlant(ctx, "wallnut", Data.plantAt(aim.col, aim.row, "wallnut").x, Data.plantAt(aim.col, aim.row, "wallnut").y, state.time, 0, 1);
        ctx.restore();
      }
    }
    // 种植预览：半透明幽灵；模仿者幽灵是灰度的。
    if (playing && state.selected && state.selected !== "shovel" && board.level.kind !== "bowling") {
      var ghostId = state.selected === "imitater" ? heldCopy(state) || "imitater" : state.selected;
      var cell = cellAt(state.pointer.x, state.pointer.y, board.level.rows);
      if (cell && !board.plants.some(function (plant) { return plant.col === cell.col && plant.row === cell.row; })) {
        ctx.save();
        ctx.globalAlpha = 0.5;
        if (state.selected === "imitater" && ghostId !== "imitater") ctx.filter = "grayscale(1)";
        var ghost = Data.plantAt(cell.col, cell.row, ghostId);
        drawPlant(ctx, ghostId, ghost.x, ghost.y, state.time, 0, 1);
        ctx.restore();
      }
    }
    // 浓雾压在场面上方（原版 FogRender），灯笼草能照开一片。
    drawFog(ctx, board, state.time);
    ctx.restore();
    // 爆炸/受击的整屏泛光。
    if (board.flash > 0) {
      ctx.fillStyle = "rgba(255, 240, 180, " + Math.min(0.65, board.flash) + ")";
      ctx.fillRect(0, 0, Data.W, Data.H);
    }
    // 暴风雨夜：整屏漆黑，闪电瞬间照亮。
    if (board.storm) {
      var dark = Math.max(0, 0.74 - board.storm.flash * 1.4);
      ctx.fillStyle = "rgba(6, 6, 24, " + dark + ")";
      ctx.fillRect(0, 0, Data.W, Data.H);
    }
    board.suns.forEach(drawSun.bind(null, ctx));

    // 浓雾：一排排雾团从雾线开始往右铺（贴图取原版 fog_software 的三朵雾团），
  // 缓慢左右漂移；灯笼草周围照出一片空地。
  function drawFog(ctx, board, time) {
    var from = board.level.fogFrom;
    if (from == null || from >= Lawn.COLS) return;
    var image = Assets.image("fogsoftware");
    if (!image) return;
    var puffW = 188;
    var puffH = 145;
    var clearers = board.plants.filter(function (plant) {
      return !plant.dead && plant.id === "plantern";
    }).map(function (plant) {
      var pos = Data.plantAt(plant.col, plant.row, plant.id);
      return { x: pos.x + 40, y: pos.y + 48 };
    });
    var startX = Lawn.cellLeft(from) - 30;
    for (var band = 0; band < 4; band++) {
      var drift = Math.sin(time * 0.3 + band * 1.7) * 16;
      var y = 34 + band * 132 + Math.sin(time * 0.7 + band * 2.1) * 5;
      for (var x = startX + drift; x < Data.W + 60; x += puffW * 0.78) {
        var cx = x + puffW / 2;
        var cy = y + puffH / 2;
        if (clearers.some(function (lamp) { return Math.hypot(lamp.x - cx, lamp.y - cy) < 185; })) continue;
        ctx.save();
        ctx.globalAlpha = 0.94;
        ctx.drawImage(image, (band % 3) * puffW, 0, puffW, puffH, x, y, puffW, puffH);
        ctx.restore();
      }
    }
  }

  // ---------- 屏幕层：卡槽与选卡 ----------
    var cards = board.phase === "choose"
      ? state.chosen.map(function (id) {
        if (id === "imitater" && state.imitate) return { id: "imitater", copy: state.imitate, cd: 0, cdMax: 1 };
        return { id: id, cd: 0, cdMax: 1 };
      })
      : board.packets;
    var picking = board.phase === "choose" || (board.phase === "leave" && board.ui > 0);
    var showShovel = board.level.kind !== "bowling" && board.level.kind !== "whack" && board.level.kind !== "vase"
      && (playing || (board.phase === "leave" && board.bankIn > 0.65));
    // 花瓶粉碎者整局都没有卡槽和铲子（原版如此）。
    if (board.level.kind !== "vase") {
      drawBank(ctx, cards, board.sun, state.selected, state.time, {
        dy: bankSlide(board),
        shovel: showShovel,
        gray: !picking,
        belt: !!board.level.belt,
      });
    }
    var purse = state.profile && state.profile.wallet ? state.profile.wallet.coins : 0;
    if (board.dropCoins || purse > 0) {
      label(ctx, "金币 " + purse, 620, 22, { font: font(16), align: "left", fill: "#ffe14a", line: 3 });
    }
    if (board.phase === "choose" || (board.phase === "leave" && board.ui > 0.02)) {
      drawChooser(ctx, state, poolSlide(board));
    }
    // 选卡阶段把卡片下的植物说明顶在鼠标旁。
    if (state.tipId && board.phase === "choose" && !state.paused && !state.seedConfirm && !state.imitateOpen) {
      drawPlantTip(ctx, state.tipId, state.pointer.x, state.pointer.y);
    }
    if (state.imitateOpen && board.phase === "choose" && !state.paused) {
      drawImitateDialog(ctx, state);
      if (state.tipId) drawPlantTip(ctx, state.tipId, state.pointer.x, state.pointer.y);
    }
    if (state.seedConfirm && board.phase === "choose") drawSeedConfirm(ctx, state);

    // ---------- 屏幕层：进度与横幅 ----------
    if (playing || board.phase === "won" || board.phase === "lost") drawFlagMeter(ctx, board);
    if (board.phase !== "look" && board.phase !== "pan") {
      button(ctx, { x: 724, y: 52, w: 68, h: 28 }, "菜单", state.hover === "pause");
    }
    drawBanner(ctx, board.banner);
    // "预备…安放…植物!" 三段口号，跟 readysetplant 语音同步。
    if (board.phase === "ready" || (board.phase === "leave" && board.ui < 0.2)) {
      var words = ["预备", "安放", "植物!"];
      var step = Math.min(2, Math.floor(board.readyTime / 1));
      label(ctx, words[step], 400, 280, { font: font(64), align: "center", fill: "#ffe14a", stroke: "#3a2208", line: 8 });
    }

    // ---------- 浮层 ----------
    if (state.paused) {
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      ctx.fillRect(0, 0, Data.W, Data.H);
      panel(ctx, 250, 180, 300, 220);
      label(ctx, "暂停", 400, 220, { font: font(32), align: "center" });
      button(ctx, { x: 300, y: 260, w: 200, h: 44 }, "继续游戏", state.hover === "resume");
      button(ctx, { x: 300, y: 320, w: 200, h: 44 }, "返回主菜单", state.hover === "tomenu");
    }
    if (board.phase === "lost") {
      ctx.fillStyle = "rgba(40, 0, 0, 0.45)";
      ctx.fillRect(0, 0, Data.W, Data.H);
      label(ctx, "僵尸吃掉了你的脑子！", 400, 230, { font: font(36), align: "center", fill: "#ffd0d0" });
      button(ctx, { x: 300, y: 290, w: 200, h: 46 }, "再试一次", state.hover === "retry");
      button(ctx, { x: 300, y: 350, w: 200, h: 46 }, "返回主菜单", state.hover === "tomenu");
    }
  }

  // ---------- 卡槽与传送带 ----------

  function drawBank(ctx, packets, sun, selected, time, opt) {
    opt = opt || {};
    var dy = opt.dy || 0;
    Kit.setBankCount(packets.length);
    ctx.save();
    ctx.translate(0, dy);
    if (opt.belt) drawConveyor(ctx, time);
    else {
      var bank = Assets.image("SeedBank");
      if (bank) drawSeedBank(ctx, bank, packets.length);
    }
    if (!opt.belt && typeof sun === "number" && sun < 5000) {
      ctx.font = "12px Tahoma, 'Segoe UI', sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#2a2a2a";
      ctx.fillText(String(sun), 46, 73);
    }
    if (opt.belt) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(16, 6, 500, 74);
      ctx.clip();
    }
    packets.forEach(function (packet, index) {
      var shown = packet.card || packet.copy || packet.id;
      var cost = Data.plants[shown] ? Data.plants[shown].cost : 0;
      drawPacket(ctx, shown, opt.belt ? beltBox(packet, index) : packetGeom(index), {
        time: time,
        selected: selected === (packet.token || packet.id),
        poor: opt.gray !== false && !packet.free && typeof sun === "number" && sun < cost,
        cd: packet.cdMax ? packet.cd / packet.cdMax : 0,
        imitate: !!packet.copy,
        free: !!packet.free,
        explode: packet.bowl === "explode",
      });
    });
    if (opt.belt) ctx.restore();
    if (opt.shovel !== false) {
      var shovel = shovelGeom();
      var bankImage = Assets.image("ShovelBank");
      var shovelImage = Assets.image("Shovel");
      if (bankImage) ctx.drawImage(bankImage, shovel.x, shovel.y, shovel.w, shovel.h);
      if (shovelImage && selected !== "shovel") ctx.drawImage(shovelImage, shovel.x + 6, shovel.y + 4, 54, 54);
      if (selected === "shovel" && shovelImage) ctx.drawImage(shovelImage, shovel.x + 8, shovel.y - 6, 58, 58);
    }
    ctx.restore();
  }

  // 传送带是另一套卡槽：底框、往左滚的履带，卡片从右端滑到左边排好。
  function drawConveyor(ctx, time) {
    var x = 10;
    var y = 0;
    var back = Assets.image("ConveyorBelt_backdrop");
    var w = back ? back.width : 516;
    var h = back ? back.height : 86;
    if (back) ctx.drawImage(back, x, y);
    else {
      ctx.fillStyle = "#1a1a1a";
      ctx.fillRect(x, y, w, h);
    }
    var belt = Assets.image("ConveyorBelt");
    if (!belt) return;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x + 6, y + 8, w - 12, h - 16);
    ctx.clip();
    var scroll = Math.floor(time * 68) % belt.width;
    var tileH = h - 24;
    for (var sx = x + 6 - scroll; sx < x + w; sx += belt.width) {
      ctx.drawImage(belt, sx, y + 12, belt.width, tileH);
    }
    ctx.restore();
  }

  // 原版卡槽随卡数变宽（GetSeedBankExtraWidth）：左端阳光区 + 可拉伸的中段 + 右端盖。
  function drawSeedBank(ctx, bank, count) {
    var left = 86;
    var cap = 22;
    var x = 10;
    var h = 87;
    var width = Kit.bankWidth(count);
    var mid = width - left - cap;
    ctx.drawImage(bank, 0, 0, left, bank.height, x, 0, left, h);
    ctx.drawImage(bank, left, 0, bank.width - left - cap, bank.height, x + left, 0, mid, h);
    ctx.drawImage(bank, bank.width - cap, 0, cap, bank.height, x + left + mid, 0, cap, h);
  }

  // "一大波僵尸正在接近" / "最后一波" 横幅。
  function drawBanner(ctx, banner) {
    if (!banner) return;
    var image = Assets.image(banner.image);
    ctx.save();
    ctx.globalAlpha = Math.min(1, banner.life * 2, banner.age * 3);
    if (image) {
      var w = Math.min(520, image.width);
      var h = (image.height * w) / image.width;
      ctx.drawImage(image, (Data.W - w) / 2, 250, w, h);
    }
    ctx.restore();
  }

  // 关卡进度在右下角。旗帜落在这一面旗结束的位置，头像按已放出的波次走。
  function drawFlagMeter(ctx, board) {
    var waves = board.level.waves;
    var total = waves ? waves.length : (board.level.zombies || []).length;
    var done = waves ? board.waveIndex || 0 : board.spawned;
    var progress = total ? Math.min(1, done / total) : 0;
    var w = 168;
    var h = 18;
    var x = Data.W - w - 16;
    var y = Data.H - h - 16;
    var labelImage = Assets.image("FlagMeterLevelProgress");
    if (labelImage) ctx.drawImage(labelImage, x + (w - 86) / 2, y - 28, 86, 11);
    var meter = Assets.image("FlagMeter");
    if (meter) {
      ctx.drawImage(meter, 2, 2, 155, 19, x, y, w, h);
      ctx.save();
      ctx.beginPath();
      ctx.rect(x + 6, y + 3, (w - 12) * progress, h - 6);
      ctx.clip();
      ctx.drawImage(meter, 0, 26, 158, 22, x, y - 1, w, h + 2);
      ctx.restore();
    }
    var parts = Assets.image("FlagMeterParts");
    if (!parts) return;
    var flags = board.level.flagWaves || [];
    flags.forEach(function (on, index) {
      if (!on) return;
      var fx = x + 10 + (w - 36) * ((index + 1) / Math.max(1, total));
      ctx.drawImage(parts, 28, 0, 4, 25, fx, y - 11, 3, 13);
      ctx.drawImage(parts, 53, 0, 20, 25, fx + 2, y - 12, 12, 12);
    });
    var hx = x - 6 + (w - 18) * progress;
    ctx.drawImage(parts, 2, 0, 24, 25, hx, y - 6, 22, 22);
  }

  // ---------- 选卡面板与浮层对话框 ----------

  function drawChooser(ctx, state, dy) {
    var panelRect = chooserPanel();
    ctx.save();
    ctx.translate(0, dy || 0);
    panel(ctx, panelRect.x, panelRect.y, panelRect.w, panelRect.h);
    // 原版标题画在石板顶上（229, 110）。
    label(ctx, "选择你的植物吧！", 229, 104, { font: font(20), align: "center" });
    var terrain = state.level.terrain;
    var slots = chooserSlots(state.progress.unlocked);
    slots.forEach(function (slot) {
      if (slot.locked) {
        drawPacket(ctx, slot.id, slot, { locked: true });
        return;
      }
      var tone = PlantCatalog.cardTone(slot.id, terrain, state.chosen);
      drawPacket(ctx, slot.id, slot, {
        time: state.time,
        dim: tone === "dim",
        picked: tone === "picked",
      });
      // 二周目里戴夫替你选的卡不能取消，画上小锁标。
      if (state.davePicks && state.davePicks.indexOf(slot.id) >= 0) {
        label(ctx, "戴夫", slot.x + slot.w - 16, slot.y + 10, { font: font(11), align: "center", fill: "#ff7a6a", line: 2 });
      }
    });
    cornerPlants(state.progress.unlocked).forEach(function (id) {
      drawImitaterCorner(ctx, cornerSlot(), state.chosen.indexOf(id) >= 0);
    });
    var ready = state.chosen.length > 0;
    var rock = rockButton();
    if (!ready) {
      var disabled = Assets.image("SeedChooser_Button_Disabled");
      if (disabled) ctx.drawImage(disabled, rock.x, rock.y, rock.w, rock.h);
      label(ctx, "开始战斗", rock.x + rock.w / 2, rock.y + rock.h / 2, { font: font(18), align: "center", fill: "#d7c3a4", line: 2 });
    } else {
      button(ctx, rock, "开始战斗", state.hover === "rock");
    }
    ctx.restore();
  }

  // 选卡阶段：鼠标正压在哪张卡上（含变身茄子木框）。战斗里每帧询问。
  function plantUnderChooser(state, x, y) {
    if (!state.board || state.board.phase !== "choose" || state.paused || state.seedConfirm) return null;
    if (state.imitateOpen) {
      var slots = imitateSlots(state.progress.unlocked);
      for (var n = 0; n < slots.length; n++) {
        if (inside(x, y, slots[n])) return slots[n].id;
      }
      return null;
    }
    var dy = poolSlide(state.board);
    var slots = chooserSlots(state.progress.unlocked);
    for (var i = 0; i < slots.length; i++) {
      if (slots[i].locked) continue;
      if (inside(x, y, shifted(slots[i], dy))) return slots[i].id;
    }
    var corners = cornerPlants(state.progress.unlocked);
    if (corners.length && inside(x, y, shifted(cornerSlot(), dy))) return corners[0];
    return null;
  }

  // 悬停提示小气泡：第一行植物名，其余是说明。
  function drawPlantTip(ctx, id, x, y) {
    var plant = PlantCatalog.get(id);
    if (!plant) return;
    var lines = [plant.name].concat((plant.tip || "").split("\n"));
    ctx.save();
    ctx.font = font(15);
    var width = 0;
    lines.forEach(function (line, index) {
      ctx.font = index === 0 ? font(16) : font(12, false);
      width = Math.max(width, ctx.measureText(line).width);
    });
    var boxW = Math.ceil(width) + 22;
    var boxH = 8 + 20 + (lines.length - 1) * 16;
    var left = Math.max(8, Math.min(Data.W - boxW - 8, x - boxW / 2));
    var top = Math.min(Data.H - boxH - 8, y + 22);
    ctx.fillStyle = "rgba(255, 248, 226, 0.96)";
    ctx.strokeStyle = "#5c4630";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.rect(left, top, boxW, boxH);
    ctx.fill();
    ctx.stroke();
    lines.forEach(function (line, index) {
      label(ctx, line, left + boxW / 2, top + 16 + index * 16, {
        font: index === 0 ? font(16) : font(12, false),
        align: "center",
        fill: index === 0 ? "#2a2118" : "#5c4a38",
        stroke: "#2a2118",
        line: 0,
        base: "middle",
      });
    });
    ctx.restore();
  }

  // 变身茄子选择对话框。
  function drawImitateDialog(ctx, state) {
    var box = imitateBox();
    ctx.save();
    ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
    ctx.fillRect(0, 0, Data.W, Data.H);
    drawStoneDialog(ctx, box);
    label(ctx, "请选择一株植物进行复制", box.x + box.w / 2, box.y + 72, {
      font: font(22),
      align: "center",
      fill: "#ffe56a",
      stroke: "#3a2a12",
      line: 4,
    });
    imitateSlots(state.progress.unlocked).forEach(function (slot) {
      var picked = state.chosen.indexOf(slot.id) >= 0;
      drawPacket(ctx, slot.id, slot, { imitate: !picked, dim: !picked });
    });
    ctx.restore();
  }

  // 缺必带植物时的确认框。
  function drawSeedConfirm(ctx, state) {
    var asks = state.seedConfirm || [];
    var box = Kit.confirmBox(asks);
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(0, 0, Data.W, Data.H);
    panel(ctx, box.x, box.y, box.w, box.h);
    label(ctx, "确定开始吗？", box.x + box.w / 2, box.y + 36, { font: font(26), align: "center" });
    asks.forEach(function (text, index) {
      label(ctx, text, box.x + box.w / 2, box.y + 78 + index * 34, { font: font(16), align: "center", fill: "#fff6d2", line: 3 });
    });
    button(ctx, confirmYes(asks), "确定开始", state.hover === "confirm-yes");
    button(ctx, confirmNo(asks), "返回选择", state.hover === "confirm-no");
  }

  // ---------- 登记 ----------

  screens.play = drawPlay;
  Kit.battle = {
    drawPlay: drawPlay,
    plantUnderChooser: plantUnderChooser,
    pauseButtonRect: function () {
      return { x: 724, y: 52, w: 68, h: 28 };
    },
  };
})();
