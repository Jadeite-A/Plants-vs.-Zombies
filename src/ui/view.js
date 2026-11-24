/*
 * view.js — 界面调度器。
 *
 * view-kit / view-menu / view-battle / view-almanac 各自往 ViewKit.screens
 * 登记整屏绘制；本文件负责：
 *   1. 按当前 screen 调用对应绘制（view-menu 家族 / 战斗 / 图鉴）；
 *   2. 命中检测：hoverName（悬停高亮的目标 id）与 actionAt（点击后的动作），
 *      两者按"浮层优先于普通操作"的固定顺序询问各屏幕；
 *   3. 自定义光标：普通时是画出来的白箭头，举着植物/铲子时在 #cursor 画布上
 *      跟着鼠标画被举起的东西。
 *
 * 对外只暴露这一组接口（app/game.js 与 app/main.js 使用的全部 API）：
 *   draw / paintCursor / drawArrow / hoverName / actionAt /
 *   tickMenu / bloomFlower / cellAt / plantUnderChooser / cursorTip
 */
var View = (function () {
  var Kit = window.ViewKit;
  var inside = Kit.inside;
  var shifted = Kit.shifted;
  var font = Kit.font;
  var drawPlant = Kit.drawPlant;
  var menu = Kit.menu;
  var battle = Kit.battle;
  var screens = Kit.screens;

  // ---------- 整屏绘制 ----------

  function draw(ctx, state) {
    ctx.clearRect(0, 0, Data.W, Data.H);
    var painter = screens[state.screen];
    if (painter) painter(ctx, state);
  }

  // ---------- 悬停检测 ----------

  /*
   * 返回悬停目标的 id；不落在任何可点区域返回 null。
   * 顺序约定：菜单家族 → 图鉴 → 战斗浮层（暂停/确认优先于下层卡牌）。
   */
  function hoverName(state, x, y) {
    if (state.screen === "store" && Kit.shop) return Kit.shop.hover(state, x, y);
    if (state.screen === "dave" && Kit.dave) return Kit.dave.hover(state, x, y);
    if (state.screen === "menu") {
      if (inside(x, y, menu.unlockAllRect())) return "unlock-all";
      // 摆件从上往下画，命中从最上层（数组末尾）开始。
      for (var b = menu.MENU_BITS.length - 1; b >= 0; b--) {
        var bit = menu.bitRect(menu.MENU_BITS[b]);
        if (inside(x, y, bit)) return menu.MENU_BITS[b].live ? menu.MENU_BITS[b].id : "noop";
      }
      for (var i = 0; i < menu.SIGNS.length; i++) {
        var rect = menu.signRect(menu.SIGNS[i]);
        // 木牌图案带透明边，命中区往里缩一圈，避免边缘误触。
        var inset = { x: rect.x + 30, y: rect.y + 24, w: rect.w - 70, h: rect.h - 48 };
        if (inside(x, y, inset)) return menu.SIGNS[i].mode;
      }
      var user = menu.trackAt("woodsign2");
      if (inside(x, y, { x: user.x + 24, y: user.y + 8, w: 250, h: 48 })) return "account";
      var motion = menu.ensureMenu();
      if (motion && motion.phase === "idle") {
        for (var f = 0; f < menu.FLOWER_CENTER.length; f++) {
          var spot = menu.FLOWER_CENTER[f];
          if (Math.hypot(spot.x - x, spot.y - y) < 20) return "flower:" + f;
        }
      }
    }
    if (state.screen === "almanac") {
      if (inside(x, y, { x: 676, y: 567, w: 89, h: 26 })) return "almanac-close";
      if ((state.almanacPage || "index") === "index") {
        if (inside(x, y, { x: 130, y: 345, w: 156, h: 42 })) return "almanac-plants";
        if (inside(x, y, { x: 487, y: 345, w: 210, h: 48 })) return "almanac-zombies";
        return null;
      }
      if (inside(x, y, { x: 32, y: 567, w: 164, h: 26 })) return "almanac-index";
      if (state.almanacPage === "plants") {
        var plants = Almanac.plantOrder.filter(function (id) { return PlantCatalog.get(id); });
        var gridIndex = 0;
        for (var p = 0; p < plants.length; p++) {
          var card = Kit.almanac.plantCardRect(plants[p] === "imitater" ? 0 : gridIndex, plants[p]);
          if (plants[p] !== "imitater") gridIndex++;
          if (inside(x, y, card)) return "seed:" + plants[p];
        }
      } else {
        var zombies = Almanac.zombieOrder.filter(function (id) { return ZombieCatalog.get(id); });
        var grid = 0;
        for (var z = 0; z < zombies.length; z++) {
          var zcard = Kit.almanac.zombieCardRect(zombies[z] === "zomboss" ? 0 : grid, zombies[z]);
          if (zombies[z] !== "zomboss") grid++;
          if (inside(x, y, zcard)) return "zed:" + zombies[z];
        }
      }
      return null;
    }
    if (state.screen === "help" && inside(x, y, { x: 300, y: 500, w: 200, h: 46 })) return "back";
    if (state.screen === "rounds") {
      if (inside(x, y, menu.roundButton(1))) return "round-1";
      if (inside(x, y, menu.roundButton(2))) return "round-2";
      if (inside(x, y, menu.roundsBack())) return "back";
      return null;
    }
    if (state.screen === "levels") {
      for (var n = 0; n < Data.levels.length; n++) {
        if (inside(x, y, menu.levelButton(n))) return Data.levels[n].id;
      }
      if (inside(x, y, menu.levelsBack())) return "back";
      return null;
    }
    if (state.screen === "accounts") {
      var acct = state.acct || { mode: "list" };
      if (acct.mode === "dup") {
        // "此用户名已存在"提示框在最上层，只认它的确定。
        if (inside(x, y, menu.acctDupOk())) return "acct-dup-ok";
        return null;
      }
      if (acct.mode !== "list") {
        // 输入对话框在最上层，点名字列表无效，只有确定/取消可点。
        if (inside(x, y, menu.acctInputButton("ok"))) return "acct-ok";
        if (inside(x, y, menu.acctInputButton("cancel"))) return "acct-cancel";
        return null;
      }
      var users = Accounts.list();
      for (var u = 0; u < users.length; u++) {
        if (inside(x, y, menu.acctUserRect(u))) return "acct:" + users[u].id;
      }
      if (inside(x, y, menu.acctNewRect())) return "acct-new";
      if (inside(x, y, menu.acctButtonRect("rename"))) return "acct-rename";
      if (inside(x, y, menu.acctButtonRect("del"))) return "acct-del";
      if (inside(x, y, menu.acctButtonRect("ok"))) return "acct-ok";
      if (inside(x, y, menu.acctButtonRect("cancel"))) return "acct-cancel";
      return null;
    }
    if (state.screen === "soon" && inside(x, y, { x: 300, y: 360, w: 200, h: 44 })) return "back";
    // 暂停时只认继续和回主菜单，避免点到下面的卡牌。
    if (state.screen === "play" && state.paused) {
      if (inside(x, y, { x: 300, y: 260, w: 200, h: 44 })) return "resume";
      if (inside(x, y, { x: 300, y: 320, w: 200, h: 44 })) return "tomenu";
      return null;
    }
    if (state.screen === "play" && state.imitateOpen && state.board && state.board.phase === "choose") {
      if (inside(x, y, battle.pauseButtonRect())) return "pause";
      return null;
    }
    if (state.screen === "play" && state.seedConfirm && state.board && state.board.phase === "choose") {
      var asks = state.seedConfirm;
      if (inside(x, y, Kit.confirmYes(asks))) return "confirm-yes";
      if (inside(x, y, Kit.confirmNo(asks))) return "confirm-no";
      if (inside(x, y, battle.pauseButtonRect())) return "pause";
      return null;
    }
    if (state.screen === "play" && state.board && state.board.phase === "choose" && state.chosen.length && inside(x, y, shifted(Kit.rockButton(), Kit.poolSlide(state.board)))) return "rock";
    if (state.screen === "play" && state.board && state.board.phase !== "lost" && state.board.phase !== "look" && state.board.phase !== "pan" && !state.paused) {
      if (inside(x, y, battle.pauseButtonRect())) return "pause";
    }
    if (state.screen === "play" && state.board && state.board.phase === "lost") {
      if (inside(x, y, { x: 300, y: 290, w: 200, h: 46 })) return "retry";
      if (inside(x, y, { x: 300, y: 350, w: 200, h: 46 })) return "tomenu";
    }
    return null;
  }

  // ---------- 点击动作 ----------

  /*
   * 把点击翻译成动作对象；没有可点的东西返回 null。动作类型：
   *   { type:"hover", id }        命中了某个悬停目标（按钮/入口）
   *   { type:"imitate", id }      变身茄子对话框里选了一株
   *   { type:"imitate-close" }    点击对话框外关闭
   *   { type:"pick" / "unpick" }  选卡面板选入 / 从卡槽取回
   *   { type:"sun" }              收阳光
   *   { type:"shovel" }           铲子
   *   { type:"packet" }           点卡槽卡片
   *   { type:"cell" }             点草坪格子（种植 / 保龄球放球 / 玉米炮开火）
   *   { type:"award-continue" }   奖励画面点击继续
   */
  function actionAt(state, x, y) {
    // 变身茄子对话框打开时整屏都被它接管。
    if (state.screen === "play" && state.imitateOpen && state.board && state.board.phase === "choose" && !state.paused) {
      if (inside(x, y, battle.pauseButtonRect())) return { type: "hover", id: "pause" };
      var copies = Kit.imitateSlots(state.progress.unlocked);
      for (var n = 0; n < copies.length; n++) {
        if (inside(x, y, copies[n])) return { type: "imitate", id: copies[n].id };
      }
      return { type: "imitate-close" };
    }
    var hover = hoverName(state, x, y);
    if (hover) return { type: "hover", id: hover };
    if (state.screen === "play" && (state.paused || state.seedConfirm)) return null;
    if (state.screen === "play" && state.board && state.board.phase === "choose") {
      var slots = Kit.chooserSlots(state.progress.unlocked);
      var dy = Kit.poolSlide(state.board);
      for (var i = 0; i < slots.length; i++) {
        if (inside(x, y, shifted(slots[i], dy))) return { type: "pick", id: slots[i].id, locked: slots[i].locked };
      }
      var corners = Kit.cornerPlants(state.progress.unlocked);
      if (corners.length && inside(x, y, shifted(Kit.cornerSlot(), dy))) return { type: "pick", id: corners[0] };
      var bankDy = Kit.bankSlide(state.board);
      for (var s = 0; s < state.chosen.length; s++) {
        if (inside(x, y, shifted(Kit.packetGeom(s), bankDy))) return { type: "unpick", index: s };
      }
    }
    if (state.screen === "play" && state.board && state.board.phase !== "lost" && state.board.phase !== "choose" && state.board.phase !== "look" && state.board.phase !== "pan" && state.board.phase !== "leave" && !state.paused) {
      // 敲僵尸：木槌点哪儿砸哪儿，点中僵尸才有效。
      if (state.board.level.kind === "whack") {
        return { type: "smash", x: x, y: y };
      }
      for (var p = 0; p < state.board.suns.length; p++) {
        var sun = state.board.suns[p];
        if (!sun.collect && Math.hypot(sun.x - x, sun.y - y) < (sun.hit || 64)) return { type: "sun", index: p };
      }
      // 花瓶粉碎者：点花瓶砸开。
      if (state.board.level.kind === "vase") {
        for (var v = 0; v < state.board.vases.length; v++) {
          var vase = state.board.vases[v];
          if (vase.broken) continue;
          var box = { x: Lawn.cellLeft(vase.col), y: Lawn.LAWN_Y + vase.row * Lawn.ROW_H, w: Lawn.COL_W, h: Lawn.ROW_H };
          if (inside(x, y, box)) return { type: "vase", index: v };
        }
      }
      if (state.board.level.kind !== "bowling" && inside(x, y, Kit.shovelGeom())) return { type: "shovel" };
      for (var c = 0; c < state.board.packets.length; c++) {
        var box = state.board.level.belt ? Kit.beltBox(state.board.packets[c], c) : Kit.packetGeom(c);
        if (inside(x, y, box)) return { type: "packet", index: c };
      }
      var cell = Kit.cellAt(x, y, state.board.level.rows);
      if (cell) return { type: "cell", col: cell.col, row: cell.row };
      if (inside(x, y, battle.pauseButtonRect())) return { type: "pause" };
    }
    if (state.screen === "award") return { type: "award-continue" };
    return null;
  }

  // ---------- 自定义光标 ----------

  // 举起植物时光标的抓取点（Data.aim 里每种植物一个）。
  var cursorTip = { x: 120, y: 148 };
  var cursorShown = false;

  function paintCursor(ctx, state) {
    var playing = state.screen === "play" && state.board && (state.board.phase === "fight" || state.board.phase === "ready") && !state.paused;
    // 敲僵尸的木槌光标：锤头跟着鼠标，砸中时下压。
    if (playing && state.board.level.kind === "whack") {
      cursorShown = true;
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      var mx = cursorTip.x;
      var my = cursorTip.y;
      ctx.save();
      ctx.translate(mx, my);
      if (state.smashSwing > 0) ctx.rotate(-0.5);
      ctx.fillStyle = "#8a5a2b";
      ctx.strokeStyle = "#3d2410";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(-4, -6, 8, 44, 3) : ctx.rect(-4, -6, 8, 44);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#b8b8c0";
      ctx.beginPath();
      ctx.rect(-16, -26, 32, 22);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
      return;
    }
    var holding = state.screen === "play" && state.selected && !state.paused;
    if (!holding) {
      if (cursorShown) {
        cursorShown = false;
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      }
      return;
    }
    cursorShown = true;
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    var x = cursorTip.x;
    var y = cursorTip.y;
    if (state.selected === "shovel") {
      var icon = Assets.image("Shovel");
      if (icon) ctx.drawImage(icon, x - 24, y - 40, 48, 48);
      return;
    }
    var cursorId = state.selected === "imitater" ? Kit.heldCopy(state) || "imitater" : state.selected;
    var aim = Data.aim[cursorId] || { x: 40, y: 52 };
    if (state.selected === "imitater" && cursorId !== "imitater") {
      ctx.save();
      ctx.filter = "grayscale(1)";
      drawPlant(ctx, cursorId, x - aim.x, y - aim.y, state.time, 0, 1);
      ctx.restore();
      return;
    }
    drawPlant(ctx, cursorId, x - aim.x, y - aim.y, state.time, 0, 1);
  }

  // 系统光标用的白箭头（app/main.js 把它烤成 data-uri 当 cursor 样式）。
  function drawArrow(ctx, x, y) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1.45, 1.45);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, 26);
    ctx.lineTo(7, 19);
    ctx.lineTo(11, 30);
    ctx.lineTo(16, 27);
    ctx.lineTo(12, 16);
    ctx.lineTo(21, 16);
    ctx.closePath();
    ctx.fillStyle = "#fffef8";
    ctx.strokeStyle = "#161616";
    ctx.lineWidth = 2;
    ctx.lineJoin = "round";
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  return {
    draw: draw,
    paintCursor: paintCursor,
    cursorTip: cursorTip,
    drawArrow: drawArrow,
    hoverName: hoverName,
    actionAt: actionAt,
    tickMenu: menu.tickMenu,
    bloomFlower: menu.bloomFlower,
    cellAt: Kit.cellAt,
    plantUnderChooser: battle.plantUnderChooser,
    // 加载画面的可点区域：显示"点击开始！"的土带草皮那一横条。
    loadingPanel: function () {
      return Kit.menu.loadingBarRect();
    },
  };
})();
