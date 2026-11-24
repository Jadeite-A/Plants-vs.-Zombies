/*
 * view-menu.js — 主菜单与它的家族界面。
 *
 * 负责 Game.state.screen 为以下取值时的整屏绘制：
 *   menu     主菜单（原版 SelectorScreen reanim 播放：墓碑滑入、云飘、叶落、花开）
 *   rounds   冒险模式难度选择（简单 / 困难）
 *   levels   关卡网格（5 大关 × 10 关）
 *   accounts 多存档管理
 *   soon     未开放模式的占位提示
 *   help     帮助（僵尸便条）
 *   award    通关奖励画面（新植物卡片）
 *
 * 依赖 ViewKit 的绘制基元；命中检测需要的几何函数（signRect / bitRect /
 * levelButton / roundButton / unlockAllRect …）也在这里定义并导出，
 * 由 view.js 调度器在 hoverName/actionAt 里统一使用。
 */
(function () {
  var Kit = window.ViewKit;
  var label = Kit.label;
  var button = Kit.button;
  var stoneButton = Kit.stoneButton;
  var panel = Kit.panel;
  var inside = Kit.inside;
  var font = Kit.font;
  var stoneFont = Kit.stoneFont;
  var almanacTitle = Kit.almanacTitle;
  var drawPacket = Kit.drawPacket;
  var drawStoneDialog = Kit.drawStoneDialog;
  var screens = Kit.screens;

  // 原版按钮文件名和模式对不上：Survival 图是迷你游戏，Challenges 是益智，Vasebreaker 是生存。
  var SIGNS = [
    { mode: "adventure", track: "SelectorScreen_Adventure_button", image: "SelectorScreen_Adventure_button", hi: "SelectorScreen_Adventure_highlight" },
    { mode: "minigame", track: "SelectorScreen_Survival_button", image: "SelectorScreen_Survival_button", hi: "SelectorScreen_Survival_highlight" },
    { mode: "puzzle", track: "SelectorScreen_Challenges_button", image: "SelectorScreen_Challenges_button", hi: "SelectorScreen_Challenges_highlight" },
    { mode: "survival", track: "SelectorScreen_ZenGarden_button", image: "SelectorScreen_Vasebreaker_button", hi: "SelectorScreen_vasebreaker_highlight" },
  ];

  // 三朵可点击开花的花的中心点（主菜单彩蛋）。
  var FLOWER_CENTER = [
    { x: 765, y: 483 },
    { x: 663, y: 455 },
    { x: 701, y: 439 },
  ];

  // 主菜单上的固定摆件：禅境花园、成就台、图鉴、商店、选项、帮助、退出。
  // live: true 表示这个摆件有悬停高亮并且可点。
  var MENU_BITS = [
    { id: "zen", image: "SelectorScreen_ZenGarden", anchor: "SelectorScreen_BG_Right", ox: 100, oy: 360 },
    { id: "achieve", image: "Achievements_pedestal", anchor: "SelectorScreen_BG_Left", ox: 20, oy: 480 },
    { id: "almanac", image: "SelectorScreen_Almanac", hi: "SelectorScreen_AlmanacHighlight", anchor: "SelectorScreen_BG_Right", ox: 256, oy: 387, live: true },
    { id: "store", image: "SelectorScreen_Store", hi: "SelectorScreen_StoreHighlight", anchor: "SelectorScreen_BG_Right", ox: 334, oy: 441, live: true },
    { id: "options", image: "SelectorScreen_Options1", anchor: "SelectorScreen_BG_Right", ox: 494, oy: 434 },
    { id: "help", image: "SelectorScreen_Help1", hi: "SelectorScreen_Help2", anchor: "SelectorScreen_BG_Right", ox: 576, oy: 458, live: true },
    { id: "quit", image: "SelectorScreen_Quit1", anchor: "SelectorScreen_BG_Right", ox: 644, oy: 469 },
  ];

  // ---------- 菜单动画 ----------

  // 主菜单跟原版一样拆开播：墓碑滑上来后停住。云原来按 0.5 帧/秒一帧一帧跳，
  // 看起来又卡又快；改成 0.36 帧/秒并在两帧之间插值，飘得顺、也慢一点。
  // 叶子隔几秒落一次，花要点了才开。
  var CLOUD_RATE = 0.36;
  var menuMotion = null;

  function ensureMenu() {
    if (menuMotion) return menuMotion;
    var reanim = Assets.reanim("SelectorScreen");
    if (!reanim) return null;
    var clouds = ["anim_cloud1", "anim_cloud7", "anim_cloud2", "anim_cloud4", "anim_cloud6", "anim_cloud5"].map(function (name) {
      var span = reanim.anims[name];
      var count = span.end - span.start + 1;
      // 开场时随机给每朵云一个相位，避免六朵云齐步走。
      var ticks = -6000 + Math.random() * 8000;
      var cloud = { name: name, track: "Cloud" + name.replace("anim_cloud", ""), start: span.start, count: count, time: 0, rate: 0, wait: 0 };
      if (ticks < 0) {
        cloud.time = (-ticks / 6000) * count;
        cloud.rate = CLOUD_RATE;
      } else cloud.wait = ticks / 100;
      return cloud;
    });
    var flowers = [1, 2, 3].map(function (n) {
      var name = "anim_flower" + n;
      var span = reanim.anims[name];
      return { name: name, track: "flower" + n, start: span.start, count: span.end - span.start + 1, time: 0, rate: 0 };
    });
    var sign = reanim.anims.anim_sign;
    menuMotion = { phase: "idle", frame: sign.end - sign.start, leafTime: 0, leafRate: 0, leafWait: 0.5, leafHold: 0, flowers: flowers, clouds: clouds };
    return menuMotion;
  }

  // 菜单大场景当前的整体帧号（open → sign → idle）。
  function menuPose() {
    var reanim = Assets.reanim("SelectorScreen");
    var motion = ensureMenu();
    if (!reanim || !motion) return 40;
    if (motion.phase === "open") {
      var open = reanim.anims.anim_open;
      return open.start + Math.min(open.end - open.start, Math.floor(motion.frame));
    }
    var sign = reanim.anims.anim_sign;
    return sign.start + Math.min(sign.end - sign.start, Math.floor(motion.frame));
  }

  // 每帧推进：开场动画、落叶循环、花开、云飘。
  function tickMenu(dt) {
    var reanim = Assets.reanim("SelectorScreen");
    var motion = ensureMenu();
    if (!reanim || !motion) return;
    if (motion.phase === "open") {
      var openCount = reanim.anims.anim_open.end - reanim.anims.anim_open.start + 1;
      motion.frame += dt * 30;
      if (motion.frame >= openCount) {
        motion.phase = "sign";
        motion.frame = 0;
      }
    } else if (motion.phase === "sign") {
      var signCount = reanim.anims.anim_sign.end - reanim.anims.anim_sign.start + 1;
      motion.frame += dt * 30;
      if (motion.frame >= signCount - 1) {
        motion.phase = "idle";
        motion.frame = signCount - 1;
      }
    }
    var grass = reanim.anims.anim_grass;
    var grassCount = grass.end - grass.start + 1;
    if (motion.leafWait > 0) {
      motion.leafWait -= dt;
      if (motion.leafWait <= 0) {
        motion.leafRate = 3 + Math.random() * 9;
        motion.leafTime = 0;
        motion.leafHold = 2 + Math.random() * 2;
      }
    } else {
      motion.leafTime += dt * motion.leafRate;
      if (motion.leafTime >= grassCount) motion.leafTime %= grassCount;
      motion.leafHold -= dt;
      if (motion.leafHold <= 0) {
        motion.leafRate = 3 + Math.random() * 9;
        motion.leafTime = 0;
        motion.leafHold = 2 + Math.random() * 2;
      }
    }
    motion.flowers.forEach(function (flower) {
      if (flower.rate <= 0) return;
      flower.time += dt * flower.rate;
      if (flower.time >= flower.count - 1) {
        flower.time = flower.count - 1;
        flower.rate = 0;
      }
    });
    motion.clouds.forEach(function (cloud) {
      if (cloud.wait > 0) {
        cloud.wait -= dt;
        if (cloud.wait <= 0) {
          cloud.time = 0;
          cloud.rate = CLOUD_RATE;
        }
        return;
      }
      cloud.time += dt * cloud.rate;
      if (cloud.time >= cloud.count - 1) {
        cloud.time = cloud.count - 1;
        cloud.rate = 0;
        cloud.wait = 20 + Math.random() * 20;
      }
    });
  }

  // 点击主菜单的花：让它播放一遍开花动画。
  function bloomFlower(index) {
    var motion = ensureMenu();
    if (!motion || motion.phase !== "idle") return false;
    var flower = motion.flowers[index];
    if (!flower || flower.rate > 0) return false;
    flower.time = 0;
    flower.rate = 24;
    return true;
  }

  // 取某条轨道在当前整体帧号下的变换。
  function trackAt(name) {
    var reanim = Assets.reanim("SelectorScreen");
    var track = reanim && Reanim.trackByName(reanim, name);
    if (!track) return { x: 0, y: 0, sx: 1, sy: 1 };
    var index = Math.max(0, Math.min(track.frames.length - 1, menuPose()));
    return track.frames[index];
  }

  function signRect(sign) {
    var frame = trackAt(sign.track);
    var image = Assets.image(sign.image);
    var w = image ? image.width * (frame.sx || 1) : 260;
    var h = image ? image.height * (frame.sy || 1) : 90;
    return { x: frame.x, y: frame.y, w: w, h: h, mode: sign.mode };
  }

  function bitRect(bit) {
    var frame = trackAt(bit.anchor);
    var image = Assets.image(bit.image);
    return {
      x: frame.x + bit.ox,
      y: frame.y + bit.oy,
      w: image ? image.width : 48,
      h: image ? image.height : 32,
      id: bit.id,
    };
  }

  // ---------- 主菜单场景 ----------

  function drawMenuScene(ctx, state) {
    var reanim = Assets.reanim("SelectorScreen");
    var motion = ensureMenu();
    if (!reanim || !motion) return;
    var pose = menuPose();
    // 天空是整幅底图；三块草皮（左/中/右）用 yardLayer 抠出来叠上。
    var sky = Reanim.trackByName(reanim, "SelectorScreen_BG");
    if (sky) Reanim.drawTrack(ctx, reanim, sky, pose, 0, 0);
    // 云在草皮和墓碑后面。墓碑画在中间那块草皮上，云就不会从碑身中间穿过去。
    motion.clouds.forEach(function (cloud) {
      var frame = cloud.start + Math.min(cloud.count - 1.001, cloud.time);
      Reanim.draw(ctx, reanim, frame, 0, 0, {
        only: function (track) { return track.name === cloud.track; },
      });
    });
    ["SelectorScreen_BG_Left", "SelectorScreen_BG_Center", "SelectorScreen_BG_Right"].forEach(function (name) {
      var track = Reanim.trackByName(reanim, name);
      var image = Kit.yardLayer(name);
      if (!track || !image) return;
      var frame = track.frames[Math.min(pose, track.frames.length - 1)];
      ctx.drawImage(image, frame.x, frame.y, image.width * (frame.sx || 1), image.height * (frame.sy || 1));
    });
    Reanim.draw(ctx, reanim, pose, 0, 0, {
      skip: function (track) {
        var name = track.name;
        if (/^Cloud/i.test(name) || /^anim_/i.test(name) || /^leaf/i.test(name)) return true;
        if (/SelectorScreen_BG/.test(name)) return true;
        if (/_button$/i.test(name)) return true;
        if (name === "woodsign2" && state.hover === "account") return true;
        for (var i = 0; i < motion.flowers.length; i++) {
          if (motion.flowers[i].track === name && (motion.flowers[i].rate > 0 || motion.flowers[i].time > 0)) return true;
        }
        return false;
      },
      replaceImage: function (imageId) {
        if (state.hover === "account" && /WOODSIGN2/i.test(imageId)) return "SelectorScreen_WoodSign2_press";
        return null;
      },
    });
    if (state.hover === "account") {
      var pressed = Assets.image("SelectorScreen_WoodSign2_press");
      var sign = trackAt("woodsign2");
      if (pressed) ctx.drawImage(pressed, sign.x, sign.y);
    }
    var grass = reanim.anims.anim_grass;
    var right = trackAt("SelectorScreen_BG_Right");
    var leafFrame = grass.start + (Math.floor(motion.leafTime) % (grass.end - grass.start + 1));
    Reanim.draw(ctx, reanim, leafFrame, right.x - 71, right.y - 41, {
      only: function (track) { return /^leaf/i.test(track.name); },
    });
    motion.flowers.forEach(function (flower) {
      if (flower.rate <= 0 && flower.time <= 0) return;
      var frame = flower.start + Math.min(flower.count - 1, Math.floor(flower.time));
      Reanim.draw(ctx, reanim, frame, 0, 0, {
        only: function (track) { return track.name === flower.track; },
      });
    });
  }

  function drawSigns(ctx, hover) {
    SIGNS.forEach(function (sign) {
      var rect = signRect(sign);
      var image = Assets.image(hover === sign.mode ? sign.hi : sign.image) || Assets.image(sign.image);
      if (image) ctx.drawImage(image, rect.x, rect.y, rect.w, rect.h);
    });
  }

  // 右侧木牌上的进度号：显示"冒险进行到第几关"。
  function drawLevelMark(ctx, progress) {
    var sheet = Assets.image("SelectorScreen_LevelNumbers");
    var right = trackAt("SelectorScreen_BG_Right");
    if (!sheet || !progress) return;
    var levels = Data.levels;
    var index = 0;
    for (var i = 0; i < levels.length; i++) {
      // progress 是原始 adventure 数据（{unlocked, cleared}），通关列表直接查。
      if (progress.cleared.indexOf(levels[i].id) >= 0) index = i + 1;
      else break;
    }
    if (index >= levels.length) index = levels.length - 1;
    var parts = String(levels[index].id).split("-");
    var stage = +parts[0] || 1;
    var sub = +parts[1] || 1;
    var cel = sheet.width / 10;
    function digit(n, x, y) {
      var d = Math.max(0, Math.min(9, n));
      ctx.drawImage(sheet, d * cel, 0, cel, sheet.height, x, y, cel, sheet.height);
    }
    digit(stage, right.x + 486, right.y + 47);
    if (sub < 10) digit(sub, right.x + 509, right.y + 50);
    else {
      digit(1, right.x + 509, right.y + 50);
      digit(0, right.x + 518, right.y + 51);
    }
  }

  function drawMenuChrome(ctx, state) {
    MENU_BITS.forEach(function (bit) {
      var rect = bitRect(bit);
      var image = Assets.image(bit.live && state.hover === bit.id ? bit.hi : bit.image) || Assets.image(bit.image);
      if (image) ctx.drawImage(image, rect.x, rect.y);
    });
    var top = trackAt("woodsign1");
    var name = (state.accountName || "园丁") + "!";
    label(ctx, name, top.x + 146, top.y + 112, { font: font(16), align: "center", fill: "#fff6c8", line: 3 });
    drawLevelMark(ctx, state.progress);
  }

  // 测试用的一键解锁按钮，挂在主菜单左下角。
  function unlockAllRect() {
    return { x: 14, y: 548, w: 158, h: 40 };
  }

  function drawUnlockAll(ctx, hover) {
    button(ctx, unlockAllRect(), "解锁全部(测试)", hover === "unlock-all");
  }

  // ---------- 菜单家族界面 ----------

  // 难度选择：简单是第一轮五十关，困难是黄金雕塑后的第二轮（戴夫会锁三张卡）。
  function drawRounds(ctx, state) {
    drawMenuScene(ctx, state);
    ctx.fillStyle = "rgba(0,0,0,0.28)";
    ctx.fillRect(0, 0, Data.W, Data.H);
    panel(ctx, 190, 120, 420, 400);
    label(ctx, "冒险模式", 400, 158, { font: font(32), align: "center" });
    var hardOpen = state.profile && state.profile.round2Open();
    stoneButton(ctx, roundButton(1), "简单模式", state.hover === "round-1");
    if (hardOpen) stoneButton(ctx, roundButton(2), "困难模式", state.hover === "round-2");
    else {
      ctx.globalAlpha = 0.85;
      stoneButton(ctx, roundButton(2), "困难模式（未开放）", false);
      ctx.globalAlpha = 1;
    }
    label(ctx, "困难：戴夫会强制塞给你三张植物卡", 400, 404, { font: font(14), align: "center", fill: "#ffe7b0", line: 3 });
    button(ctx, roundsBack(), "返回", state.hover === "back");
  }

  // 关卡网格：5 大关 × 10 关。已通的打绿勾，没解锁的置灰。
  function levelButton(index) {
    var col = index % 10;
    var row = Math.floor(index / 10);
    return { x: 44 + col * 72, y: 168 + row * 66, w: 66, h: 54 };
  }

  function levelsBack() {
    return { x: 300, y: 520, w: 200, h: 42 };
  }

  function roundButton(which) {
    return which === 1
      ? { x: 240, y: 232, w: 320, h: 62 }
      : { x: 240, y: 330, w: 320, h: 62 };
  }

  function roundsBack() {
    return { x: 300, y: 430, w: 200, h: 42 };
  }

  function drawLevels(ctx, state) {
    drawMenuScene(ctx, state);
    ctx.fillStyle = "rgba(0,0,0,0.28)";
    ctx.fillRect(0, 0, Data.W, Data.H);
    panel(ctx, 24, 78, 752, 424);
    label(ctx, (state.round === 2 ? "困难" : "简单") + " · 选择关卡", 400, 112, { font: font(30), align: "center" });
    Data.levels.forEach(function (level, index) {
      var rect = levelButton(index);
      var cleared = state.profile.hasCleared(level.id);
      var locked = state.profile.levelLocked(level.id);
      var tag = cleared ? "√" : locked ? "锁" : String(level.id);
      if (locked) {
        var disabled = Assets.image("SeedChooser_Button_Disabled");
        if (disabled) ctx.drawImage(disabled, rect.x, rect.y, rect.w, rect.h);
        label(ctx, String(level.id), rect.x + rect.w / 2, rect.y + rect.h / 2, { font: font(16), align: "center", fill: "#b7a58c", line: 2 });
      } else {
        button(ctx, rect, String(level.id), state.hover === level.id);
      }
      if (cleared && level.id !== state.hover) {
        label(ctx, tag, rect.x + rect.w - 14, rect.y + 12, { font: font(14), align: "center", fill: "#9dff9a", line: 3 });
      }
      if (state.hover === level.id && !locked) {
        var terrain = level.terrain ? level.terrain.label : "";
        label(ctx, level.name + "  " + terrain + (level.kind === "bowling" ? " · 保龄球" : level.kind === "conveyor" ? " · 传送带" : ""), 400, 148, { font: font(14), align: "center", fill: "#ffe7b0", line: 3 });
      }
    });
    button(ctx, levelsBack(), "返回", state.hover === "back");
  }

  // 通关奖励：新植物卡片特写。
  function drawAward(ctx, state) {
    var back = Assets.image("AwardScreen_Back");
    if (back) ctx.drawImage(back, 0, 0, Data.W, Data.H);
    else {
      ctx.fillStyle = "#203018";
      ctx.fillRect(0, 0, Data.W, Data.H);
    }
    label(ctx, "你得到了一张新的植物卡片！", 400, 120, { font: font(28), align: "center", fill: "#fff6c8" });
    drawPacket(ctx, state.award, { x: 350, y: 168, w: 100, h: 140 }, { time: state.time });
    label(ctx, Data.plants[state.award].name, 400, 348, { font: font(32), align: "center", fill: "#ffe14a" });
    label(ctx, "点击继续", 400, 470, { font: font(20), align: "center" });
  }

  function drawSoon(ctx, state) {
    drawMenuScene(ctx, state);
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fillRect(0, 0, Data.W, Data.H);
    panel(ctx, 175, 150, 450, 280);
    var title = (GameModes.get(state.soonMode) || {}).name || "这个模式";
    label(ctx, title, 400, 210, { font: font(36), align: "center" });
    label(ctx, "这个模式还没开放", 400, 270, { font: font(22), align: "center" });
    label(ctx, "先从冒险模式开始", 400, 310, { font: font(18), align: "center", fill: "#ffe7b0" });
    button(ctx, { x: 300, y: 360, w: 200, h: 44 }, "返回", state.hover === "back");
  }

  // ---------- 用户对话框（对照原版：你是谁 / 新用户） ----------

  /*
   * 主菜单左上角的"点击这里，更改用户"木牌点进来，是三层石头对话框：
   *   list    "你是谁?"——用户列表（当前选中的那一行压绿条），
   *           下面一行"（创建一个新的玩家）"，底部 重命名/删除、确定/取消 两排石钮；
   *   new     "新用户"——输入名字的小对话框叠在上面，确定/取消；
   *   rename  与 new 同一个框，标题换成"修改名字"，预填旧名字；
   * 点用户名只是选中（绿条跟着走），点"确定"才真正切换用户。
   */

  // 框体/面板/按钮几何全部来自对原版截图的逐像素测量（tools/measure2.ps1）：
  //   面板（暗区）= 框左右各缩 28；面板下沿 y398 / y342 / y349（底片随之压缩）；
  //   列表行距 30，首行中心 = 框顶 + 109；选中绿条 268×24 居中；
  //   按钮 140×35，左右两列 x234 / x410；两层按钮 y = 框底-112/-66，单层 -64，
  //   提示框的宽确定钮 306 宽居中、y = 框底-73。
  var ACCT_LIST_BOX = { x: 197, y: 92, w: 393, h: 456 };
  var ACCT_INPUT_BOX = { x: 197, y: 193, w: 393, h: 249 };
  var ACCT_DUP_BOX = { x: 197, y: 218, w: 393, h: 206 };
  var ACCT_ROW_PITCH = 30;
  var ACCT_FIRST_CENTER = 109; // 首行中心，相对列表框顶
  var ACCT_BAR_W = 268;
  var ACCT_BAR_H = 24;
  var ACCT_BTN_W = 140;
  var ACCT_BTN_H = 35;
  var ACCT_COL_LEFT = 234;
  var ACCT_COL_RIGHT = 410;

  function acctUserRect(index) {
    var cy = ACCT_LIST_BOX.y + ACCT_FIRST_CENTER + index * ACCT_ROW_PITCH;
    return { x: 394 - ACCT_BAR_W / 2, y: cy - ACCT_BAR_H / 2, w: ACCT_BAR_W, h: ACCT_BAR_H, cy: cy };
  }

  // "（创建一个新的玩家）"跟在最后一个用户槽后 24px。
  function acctNewRect() {
    var count = Accounts.list().length;
    var cy = ACCT_LIST_BOX.y + ACCT_FIRST_CENTER + (count - 1) * ACCT_ROW_PITCH + 24;
    return { x: 260, y: cy - 12, w: 268, h: 24, cy: cy };
  }

  function acctButtonRect(which) {
    var bottom = ACCT_LIST_BOX.y + ACCT_LIST_BOX.h;
    var y1 = bottom - 112;
    var y2 = bottom - 66;
    if (which === "rename") return { x: ACCT_COL_LEFT, y: y1, w: ACCT_BTN_W, h: ACCT_BTN_H };
    if (which === "del") return { x: ACCT_COL_RIGHT, y: y1, w: ACCT_BTN_W, h: ACCT_BTN_H };
    if (which === "ok") return { x: ACCT_COL_LEFT, y: y2, w: ACCT_BTN_W, h: ACCT_BTN_H };
    return { x: ACCT_COL_RIGHT, y: y2, w: ACCT_BTN_W, h: ACCT_BTN_H };
  }

  function acctInputRect() {
    return { x: 233, y: ACCT_INPUT_BOX.y + 103, w: 322, h: 33 };
  }

  function acctInputButton(which) {
    var y = ACCT_INPUT_BOX.y + ACCT_INPUT_BOX.h - 64;
    if (which === "ok") return { x: ACCT_COL_LEFT, y: y, w: ACCT_BTN_W, h: ACCT_BTN_H };
    return { x: ACCT_COL_RIGHT, y: y, w: ACCT_BTN_W, h: ACCT_BTN_H };
  }

  // "此用户名已存在"提示框：单个居中宽确定钮。
  function acctDupOk() {
    return { x: 241, y: ACCT_DUP_BOX.y + ACCT_DUP_BOX.h - 73, w: 306, h: ACCT_BTN_H };
  }

  // 深色圆角矩形（选中绿条用）。
  function fillRoundRect(ctx, rect, radius, fill) {
    ctx.fillStyle = fill;
    ctx.beginPath();
    var r = Math.min(radius, rect.w / 2, rect.h / 2);
    ctx.moveTo(rect.x + r, rect.y);
    ctx.arcTo(rect.x + rect.w, rect.y, rect.x + rect.w, rect.y + rect.h, r);
    ctx.arcTo(rect.x + rect.w, rect.y + rect.h, rect.x, rect.y + rect.h, r);
    ctx.arcTo(rect.x, rect.y + rect.h, rect.x, rect.y, r);
    ctx.arcTo(rect.x, rect.y, rect.x + rect.w, rect.y, r);
    ctx.closePath();
    ctx.fill();
  }

  function drawAccounts(ctx, state) {
    drawMenuScene(ctx, state);
    ctx.fillStyle = "rgba(0,0,0,0.42)";
    ctx.fillRect(0, 0, Data.W, Data.H);
    var acct = state.acct || { mode: "list", value: "", selected: null };
    drawStoneDialog(ctx, ACCT_LIST_BOX, 398);
    label(ctx, "你是谁?", 394, ACCT_LIST_BOX.y + 47, { font: stoneFont(24, true), align: "center", fill: "#f4ce4a", line: 2 });
    // 用户列表直接画在面板暗区上：选中的压绿条，其余只写名字。
    Accounts.list().forEach(function (user, index) {
      var slot = acctUserRect(index);
      var hot = user.id === acct.selected;
      if (hot) fillRoundRect(ctx, slot, 6, "#14b40f");
      label(ctx, user.name, 394, slot.cy, {
        font: stoneFont(16, true),
        align: "center",
        fill: hot ? "#ffffff" : "#d8cba0",
        line: 0,
      });
    });
    var newRect = acctNewRect();
    label(ctx, "（创建一个新的玩家）", 394, newRect.cy, {
      font: stoneFont(15),
      align: "center",
      fill: "#ece5d3",
      line: 0,
    });
    stoneButton(ctx, acctButtonRect("rename"), "重命名", state.hover === "acct-rename");
    stoneButton(ctx, acctButtonRect("del"), "删除", state.hover === "acct-del");
    stoneButton(ctx, acctButtonRect("ok"), "确定", state.hover === "acct-ok");
    stoneButton(ctx, acctButtonRect("cancel"), "取消", state.hover === "acct-cancel");
    if (acct.mode === "new" || acct.mode === "rename") drawAcctInput(ctx, acct, state);
    if (acct.mode === "dup") drawAcctDup(ctx, state);
  }

  // "新用户 / 修改名字"：叠在列表框上的输入对话框。
  function drawAcctInput(ctx, acct, state) {
    drawStoneDialog(ctx, ACCT_INPUT_BOX, 342);
    label(ctx, acct.mode === "rename" ? "修改名字" : "新用户", 394, ACCT_INPUT_BOX.y + 47, {
      font: stoneFont(24),      align: "center",      fill: "#f4ce4a",
      line: 2,
    });
    label(ctx, "请输入你的名字:", 394, ACCT_INPUT_BOX.y + 82, {
      font: stoneFont(15),
      align: "center",
      fill: "#dcbf6e",
      line: 0,
    });
    var input = acctInputRect();
    // 金边棕底的输入框（原版实测：边 #decb6b、底 #634110，右下 2px 硬投影）。
    ctx.fillStyle = "#000000";
    ctx.fillRect(input.x + 3, input.y + 3, input.w, input.h);
    ctx.fillStyle = "#634110";
    ctx.fillRect(input.x, input.y, input.w, input.h);
    ctx.strokeStyle = "#decb6b";
    ctx.lineWidth = 3;
    ctx.strokeRect(input.x + 1.5, input.y + 1.5, input.w - 3, input.h - 3);
    var nameFont = stoneFont(18);
    var shown = acct.value || "";
    label(ctx, shown, input.x + 12, input.y + input.h / 2, { font: nameFont, align: "left", fill: "#ffffff", line: 0 });
    // 输入光标一闪一闪（跟原版一样是竖线）。
    if ((state.time || 0) % 1 < 0.55) {
      ctx.font = nameFont;
      var width = ctx.measureText(shown).width;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(input.x + 14 + width, input.y + 6, 2, input.h - 12);
    }
    stoneButton(ctx, acctInputButton("ok"), "确定", state.hover === "acct-ok");
    stoneButton(ctx, acctInputButton("cancel"), "取消", state.hover === "acct-cancel");
    // 原版里上层框会在底下的按钮区投下一片紫黑阴影（实测 y436..468 变暗一半）。
    ctx.fillStyle = "rgba(12, 0, 40, 0.5)";
    ctx.fillRect(202, 436, 396, 34);
  }

  // "此用户名已存在"：建号/改名撞了重名时的提示框（对照原版第三层弹窗）。
  function drawAcctDup(ctx, state) {
    drawStoneDialog(ctx, ACCT_DUP_BOX, 349);
    label(ctx, "此用户名已存在", 394, ACCT_DUP_BOX.y + 47, {
      font: stoneFont(24),      align: "center",      fill: "#f4ce4a",
      line: 2,
    });
    label(ctx, "你输入的用户名已被使用，请输入一个新的用户名。", 394, ACCT_DUP_BOX.y + 85, {
      font: stoneFont(14),
      align: "center",
      fill: "#eed9a0",
      line: 0,
    });
    stoneButton(ctx, acctDupOk(), "确定", state.hover === "acct-dup-ok");
    // 提示框同样在底层按钮区投阴影。
    ctx.fillStyle = "rgba(12, 0, 40, 0.5)";
    ctx.fillRect(202, 424, 396, 46);
  }

  // ---------- 帮助 / 加载画面 ----------
  // 帮助：僵尸便条铺在草坪背景上。
  function drawHelp(ctx, state) {
    var lawn = Assets.image("background1");
    if (lawn) ctx.drawImage(lawn, 360, 210, 620, 370, 0, 0, Data.W, Data.H);
    else {
      ctx.fillStyle = "#3c8a28";
      ctx.fillRect(0, 0, Data.W, Data.H);
    }
    var paper = Kit.keyedImage("ZombieNote", "paper");
    var ink = Kit.keyedImage("ZombieNoteHelp", "ink");
    if (paper) ctx.drawImage(paper, (Data.W - paper.width) / 2, 36);
    if (ink) ctx.drawImage(ink, (Data.W - ink.width) / 2, 78);
    button(ctx, { x: 300, y: 500, w: 200, h: 46 }, "主菜单", state.hover === "back");
  }

  // ---------- 登记 ----------

  /*
   * 加载画面（Game.state.screen === "loading"）。整幅画在 canvas 上，分两段，
   * 参数全部对照原版 TitleScreen.cpp：
   *
   *   1. 开场 splash：黑底 + PopCap 圆标居中，淡入 0.5s → 停留 1.0s → 淡出 0.5s。
   *      音乐在 splash 之前就已经响起（boot 里直接切主菜单曲，原版同款行为）。
   *   2. 加载画面：背景固定为 titlescreen.jpg（原版就是它；带广告牌的版本
   *      titlescreen_new 只在有广告时使用，这里不用）。游戏 logo 从屏幕顶上
   *      落下来弹一下停稳；进度条吊牌从屏幕底下滑上来弹一下停稳。
   *      土带在 (239, 530)，草皮条在 (239, 512)，草皮只在裁剪窗里静态露出
   *      （原版没有纹理滚动）；绿螺旋草卷滚在草皮前沿，边滚边缩小（1→0.5 倍），
   *      这是原版的"滚动"效果——正视图、无厚度。
   *      草皮越过 11%/32%/54%/72% 宽度冒小苗（第 2、4 株镜像，第 3 株放大），
   *      越过 91% 右端探出小僵尸头（画在草皮后面，草叶盖住下巴）。
   *      铺满后土带上显示"点击开始！"，只有点这一条才进主菜单。
   */
  var BAR_X = 239;      // 原版 mStartButton->mX = (800 - 321) / 2
  var GRASS_Y = 512;    // 原版 aGrassY = mStartButton->mY - 17（按钮最终停在 529）
  var BAR_TOTAL = 314;
  var GRASS_H = 33;

  // splash 的三段时长（秒）：淡入 / 停留 / 淡出。
  var SPLASH_IN = 0.5;
  var SPLASH_HOLD = 1.0;
  var SPLASH_OUT = 0.5;

  // 三片花瓣停住时，右上两片离绿茎还有 6～8 像素。按张开程度把它们拉回茎顶。
  function sproutNudge(track, frame) {
    if (!track || track.name !== "sprout_petal") return null;
    var open = Math.max(0, Math.min(1, (frame.sx - 0.35) / 0.45));
    if (open <= 0) return null;
    var dx = -1;
    var dy = 0.6;
    if (frame.x > 8) { dx = -6.9; dy = 9.8; }
    else if (frame.x > 0) { dx = -6.2; dy = 7.4; }
    else { dx = 1.5; dy = 1.9; }
    return { x: dx * open, y: dy * open };
  }

  // 只播一遍并停在最后一帧的动画帧号（Reanim.frameIn 会循环，这里手动夹住）。
  function playOnceFrame(reanim, animName, time, rate) {
    var anim = reanim && reanim.anims[animName];
    if (!anim) return 0;
    var length = anim.end - anim.start + 1;
    var index = Math.min(length - 1, Math.max(0, Math.floor(time * (rate || reanim.fps))));
    return anim.start + index;
  }

  // 二次缓入：counter 从 a 数到 b（递减计数器），值从 va 到 vb。
  function easeInDown(counter, a, b, va, vb) {
    var u = Math.max(0, Math.min(1, (a - counter) / (a - b)));
    return va + (vb - va) * u * u;
  }

  function drawLoading(ctx, state) {
    var splashT = state.splashT || 0;
    // ---- 第一段：PopCap 标志 splash（淡入 → 停留 → 淡出）----
    if (splashT < SPLASH_IN + SPLASH_HOLD + SPLASH_OUT) {
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, Data.W, Data.H);
      var cap = Assets.image("PopCap_Logo");
      if (cap) {
        var alpha;
        if (splashT < SPLASH_IN) alpha = splashT / SPLASH_IN;
        else if (splashT < SPLASH_IN + SPLASH_HOLD) alpha = 1;
        else alpha = Math.max(0, 1 - (splashT - SPLASH_IN - SPLASH_HOLD) / SPLASH_OUT);
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.drawImage(cap, (Data.W - cap.width) / 2, (Data.H - cap.height) / 2);
        ctx.restore();
      }
      return;
    }
    // ---- 第二段：加载画面 ----
    var bg = Assets.image("titlescreen");
    if (bg) ctx.drawImage(bg, 0, 0);
    else {
      ctx.fillStyle = "#6eb7ea";
      ctx.fillRect(0, 0, Data.W, Data.H);
    }
    // 入场计数器（1.0 → 0）：游戏 logo 从顶上落下弹稳，进度条吊牌从底下滑上来。
    var c = state.titleCounter == null ? 0 : state.titleCounter;
    var logoY;
    if (c > 0.6) logoY = -150;                                   // 还在屏幕外
    else if (c > 0.5) logoY = easeInDown(c, 0.6, 0.5, -150, 10); // 落下（原版 100→60 tick）
    else if (c > 0.4) logoY = easeInDown(c, 0.5, 0.4, 10, 15);   // 弹一下（60→50）
    else logoY = 15;
    var logo = Assets.image("Logo"); // ad/Logo.png（透明底的游戏标志）
    if (logo) ctx.drawImage(logo, (Data.W - logo.width) / 2, logoY);
    // 吊牌（土带+草皮+文字）整体位置：滑入时在屏幕下方，最后停在 529。
    var barY;
    if (c > 0.6) barY = 650;
    else if (c > 0.1) barY = easeInDown(c, 0.6, 0.1, 650, 534);
    else if (c > 0) barY = 534 + (529 - 534) * (1 - c / 0.1); // 最后 0.1s 轻轻落定
    else barY = 529;
    var grassY = barY - 17; // 原版 aGrassY = mStartButton->mY - 17
    var p = Math.min(1, (state.barCur || 0) / BAR_TOTAL);
    var dirt = Assets.image("LoadBar_dirt");
    var grass = Assets.image("LoadBar_grass");
    if (dirt) ctx.drawImage(dirt, BAR_X, grassY + 18);
    // 小僵尸头：草皮快满（越过 91% 刻度）时从右端草叶后面探出来。
    var headEffect = (state.effects || []).filter(function (item) { return item.kind === "head"; })[0];
    if (headEffect) {
      var head = Assets.reanim("LoadBar_Zombiehead");
      if (head) {
        ctx.save();
        ctx.translate(headEffect.x, headEffect.y);
        ctx.scale(headEffect.sx, headEffect.sy);
        Reanim.draw(ctx, head, playOnceFrame(head, "anim_zombie", headEffect.t, 18), 0, 0, { center: true });
        ctx.restore();
      }
    }
    // 草皮：只在裁剪窗里静态露出（原版无纹理滚动，"滚动"的是草卷）。
    if (grass) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(240, grassY, Math.max(0, (state.barCur || 0)), GRASS_H);
      ctx.clip();
      ctx.drawImage(grass, BAR_X, grassY);
      ctx.restore();
    }
    // 草卷：绿螺旋端面滚在草皮前沿，边滚边转、边滚边缩小（1→0.5 倍，原版参数）。
    if (p > 0.001 && p < 1) {
      var rollCap = Assets.image("SodRollCap");
      if (rollCap) {
        var scale = 1 - 0.5 * p;
        var cx = BAR_X + 11 + (state.barCur || 0) * 0.94;
        var cy = grassY + 32 - 35 * scale;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(-((state.barCur || 0) * 0.94) / 180 * Math.PI * 2);
        ctx.scale(scale, scale);
        ctx.drawImage(rollCap, -rollCap.width / 2, -rollCap.height / 2);
        ctx.restore();
      }
    }
    // 草皮上的小苗：从土里冒出来、长高、开花，常驻（第 2、4 株是镜像的）。
    var sprout = Assets.reanim("LoadBar_sprout");
    if (sprout) {
      (state.effects || []).forEach(function (item) {
        if (item.kind !== "sprout") return;
        ctx.save();
        ctx.translate(item.x, item.y);
        ctx.scale(item.sx, item.sy);
        Reanim.draw(ctx, sprout, playOnceFrame(sprout, "anim_sprout", item.t, 18), 0, 0, {
          center: true,
          nudge: sproutNudge,
        });
        ctx.restore();
      });
    }
    // 状态文字：就是那枚"开始按钮"的标签，读取中 → 点击开始！
    // 鼠标悬在按钮上时变橙色（原版 HyperlinkWidget 的 mOverColor）。
    var hoverBar = inside(state.pointer.x, state.pointer.y, { x: BAR_X, y: grassY, w: BAR_TOTAL + 7, h: 76 });
    label(ctx, state.grassLaid ? "点击开始！" : "读取中...", BAR_X + 157, barY + 25, {
      font: font(17),
      align: "center",
      fill: hoverBar && state.grassLaid ? "#fa5a0f" : "#dab821",
      stroke: "#3b2410",
      line: 3,
    });
  }

  // 加载画面的可点区域：土带 + 草皮那一横条（"点击开始！"显示的地方）。
  function loadingBarRect() {
    return { x: BAR_X - 6, y: GRASS_Y - 22, w: BAR_TOTAL + 18, h: 100 };
  }

  screens.menu = function (ctx, state) {
    drawMenuScene(ctx, state);
    drawSigns(ctx, state.hover);
    drawMenuChrome(ctx, state);
    drawUnlockAll(ctx, state.hover);
  };
  screens.loading = drawLoading;
  screens.rounds = drawRounds;
  screens.levels = drawLevels;
  screens.accounts = drawAccounts;
  screens.soon = drawSoon;
  screens.help = drawHelp;
  screens.award = drawAward;

  // 导出给调度器（view.js）做命中检测用的几何与动画句柄。
  Kit.menu = {
    SIGNS: SIGNS,
    FLOWER_CENTER: FLOWER_CENTER,
    MENU_BITS: MENU_BITS,
    loadingBarRect: loadingBarRect, // 加载画面的可点区域（土带+草皮那一横条）
    ensureMenu: ensureMenu,
    tickMenu: tickMenu,
    bloomFlower: bloomFlower,
    trackAt: trackAt,
    signRect: signRect,
    bitRect: bitRect,
    unlockAllRect: unlockAllRect,
    roundButton: roundButton,
    roundsBack: roundsBack,
    levelButton: levelButton,
    levelsBack: levelsBack,
    // 用户对话框（你是谁 / 新用户 / 此用户名已存在）的几何，view.js 命中检测用。
    acctUserRect: acctUserRect,
    acctNewRect: acctNewRect,
    acctButtonRect: acctButtonRect,
    acctInputRect: acctInputRect,
    acctInputButton: acctInputButton,
    acctDupOk: acctDupOk,
  };
})();

