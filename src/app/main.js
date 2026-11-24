/*
 * main.js — 输入与帧循环（启动入口，loader 清单里的最后一个文件）。
 *
 * 职责：
 *   · 把屏幕坐标换算成游戏坐标（画布是固定 800×600 逻辑分辨率）；
 *   · 鼠标/键盘事件 → Game（点击动作、右键取消、Esc 暂停）；
 *   · 自定义光标：平时用烤成 data-uri 的白箭头；举着植物/铲子时把
 *     View.paintCursor 画到 #cursor 画布上跟手移动；
 *   · requestAnimationFrame 帧循环：Game.update（逻辑）→ View.draw（画面）。
 *
 * 启动顺序：先等账户档案从本地文件装载完成（Accounts.init），再
 * Game.boot() 开始加载资源。存档读取失败也有兜底（见 accounts.js），
 * 所以这里不会卡住不启动。
 */
(function () {
  var canvas = document.getElementById("game");
  var cursor = document.getElementById("cursor");
  var ctx = canvas.getContext("2d", { alpha: false, desynchronized: true });
  var cursorCtx = cursor.getContext("2d", { alpha: true, desynchronized: true });
  var last = performance.now();
  var view = canvas.getBoundingClientRect();

  function refreshView() {
    view = canvas.getBoundingClientRect();
  }

  // 屏幕 CSS 像素 → 游戏 800×600 逻辑坐标。
  function point(event) {
    var x = ((event.clientX - view.left) / view.width) * Data.W;
    var y = ((event.clientY - view.top) / view.height) * Data.H;
    return { x: x, y: y };
  }

  // 把 #cursor 画布挪到鼠标处，再减去光标热点（抓取点）。
  function placeCursor(p) {
    var tip = View.cursorTip;
    cursor.style.transform = "translate3d(" + (p.x - tip.x) + "px," + (p.y - tip.y) + "px,0)";
    if (cursor.style.visibility !== "visible") cursor.style.visibility = "visible";
  }

  function follow(event) {
    var p = point(event);
    Game.pointer(p.x, p.y);
    placeCursor(p);
  }

  // 烤一支白箭头当系统光标（比每帧在画布里画省事，也不会被游戏帧卡住）。
  var arrow = document.createElement("canvas");
  arrow.width = 40;
  arrow.height = 52;
  View.drawArrow(arrow.getContext("2d"), 2, 2);
  var arrowCursor = "url(" + arrow.toDataURL("image/png") + ") 2 2, auto";
  document.documentElement.style.cursor = arrowCursor;
  document.body.style.cursor = arrowCursor;
  canvas.style.cursor = arrowCursor;

  window.addEventListener("resize", refreshView);
  canvas.addEventListener("mousemove", follow, { passive: true });
  canvas.addEventListener("mouseleave", function () {
    cursor.style.visibility = "hidden";
  });
  canvas.addEventListener("mousedown", function (event) {
    var p = point(event);
    Game.click(p.x, p.y, event.button);
  });
  canvas.addEventListener("contextmenu", function (event) {
    event.preventDefault();
  });
  window.addEventListener("keydown", function (event) {
    // 用户对话框（你是谁 / 新用户）优先接键盘：打字、回车确定、Esc 取消。
    if (Game.key(event)) {
      event.preventDefault();
      return;
    }
    if (event.key === "Escape" && Game.state.screen === "play" && Game.state.board && Game.state.board.phase !== "lost") {
      Game.setPaused(!Game.state.paused);
      AudioBus.play("pause");
    }
  });

  function frame(now) {
    // 开发直达（#goto=play-…）多用于无头截图：后台窗口的 rAF 会被节流，
    // 把逻辑时钟加快 20 倍，保证截图时间点能看到选卡/开战的画面。
    var speed = String(location.hash || "").indexOf("goto=play-") === 0 ? 20 : 1;
    var dt = Math.min(0.05, (now - last) / 1000) * speed;
    last = now;
    Game.update(dt);
    View.draw(ctx, Game.state);
    View.paintCursor(cursorCtx, Game.state);
    requestAnimationFrame(frame);
  }

  // 先读本地账户（account/ 目录），再加载资源、开帧循环。
  Accounts.init().then(function () {
    Game.boot();
    requestAnimationFrame(frame);
  });
})();
