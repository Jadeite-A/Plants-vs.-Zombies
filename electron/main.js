const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const audio = require("./audio");
const store = require("./store");

function createWindow() {
  // useContentSize 让 800×600 是页面尺寸，不含标题栏。webSecurity 关掉才能用 file:// 读本地贴图。
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    useContentSize: true,
    resizable: false,
    maximizable: false,
    show: !process.env.PVZ_SHOT, // 截图模式先后台创建，加载完再不抢焦点地显示（隐藏窗口不渲染）
    backgroundColor: "#6eb7ea",
    title: "植物大战僵尸",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false,
    },
  });
  win.setMenuBarVisibility(false);
  win.webContents.setVisualZoomLevelLimits(1, 1).catch(function () {});
  // 截图模式可再配 PVZ_GOTO=almanac 直达某个界面（game.js 里解析 #goto=）。
  var hash = process.env.PVZ_GOTO ? "#goto=" + process.env.PVZ_GOTO : "";
  win.loadFile(path.join(__dirname, "..", "index.html"), { hash: hash.slice(1) });
  win.webContents.setBackgroundThrottling(false);
  // 隐藏的窗口合成器不渲染、rAF 停摆，截图会永远停在第一帧；改成不抢焦点地显示。
  if (process.env.PVZ_SHOT) win.showInactive();

  // 截图模式：PVZ_SHOT="500,1500,3000" 表示启动后这些毫秒点各存一张
  // tools/shot-<毫秒>.png，截完自动退出。用来无头校准界面细节。
  if (process.env.PVZ_SHOT) {
    const delays = process.env.PVZ_SHOT.split(",").map(Number);
    const started = Date.now();
    const pending = new Set(delays);
    const timer = setInterval(function () {
      const elapsed = Date.now() - started;
      for (const delay of delays) {
        if (elapsed >= delay && pending.has(delay)) {
          pending.delete(delay);
          win.webContents.executeJavaScript(
            "JSON.stringify({screen:Game.state.screen,phase:Game.state.board&&Game.state.board.phase,age:Game.state.board&&Math.round(Game.state.board.age),ready:Game.state.board&&Math.round(Game.state.board.readyTime)})"
          ).then(function (info) { console.log("STATE", info); }).catch(function () {});
          win.webContents.capturePage().then(function (image) {
            const out = path.join(__dirname, "..", "tools", "shot-" + delay + ".png");
            require("fs").writeFileSync(out, image.toPNG());
            console.log("shot saved", out);
          });
        }
      }
      if (!pending.size) {
        clearInterval(timer);
        setTimeout(function () { app.quit(); }, 300);
      }
    }, 100);
  }

  // 自动化联调（PVZ_AUTO=1）：在页面里用真实输入事件走一遍"更改用户"的
  // 全流程（打开对话框 → 新建 → 切换 → 重命名 → 删除），关键节点截图到
  // tools/auto-<步骤>.png。页面脚本在关键帧 console.log("AUTO_SHOT:标签")，
  // 主进程听到就截一张。截完自动退出。
  // 平时也把页面里的报错转发出来，方便无头排查。
  win.webContents.on("console-message", function (_event, level, message) {
    if (process.env.PVZ_AUTO) return;
    if (level >= 2 && typeof message === "string" && message.indexOf("AUTO_SHOT:") !== 0) {
      console.log("[page]", message);
    }
  });
  if (process.env.PVZ_AUTO) {
    win.webContents.on("console-message", function (_event, _level, message) {
      if (typeof message !== "string") return;
      if (message.indexOf("AUTO_SHOT:") === 0) {
        const label = message.slice("AUTO_SHOT:".length).replace(/[^\w-]/g, "");
        win.webContents.capturePage().then(function (image) {
          const out = path.join(__dirname, "..", "tools", "auto-" + label + ".png");
          require("fs").writeFileSync(out, image.toPNG());
          console.log("auto shot", label);
        });
      } else if (message === "AUTO_DONE") {
        setTimeout(function () { app.quit(); }, 400);
      }
    });
    win.webContents.on("did-finish-load", function () {
      const scenario = require("./auto-accounts");
      win.webContents.executeJavaScript("(" + scenario.toString() + ")()").catch(function (err) {
        console.error("auto scenario failed", err);
      });
    });
  }
}

app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required");
// 无头截图时窗口是隐藏的，默认的后台节流会把 rAF 压到接近停摆，关掉它。
app.commandLine.appendSwitch("disable-background-timer-throttling");
app.commandLine.appendSwitch("disable-renderer-backgrounding");

ipcMain.on("pvz-sfx", function (_event, name, volume) {
  audio.playSfx(name, volume);
});
ipcMain.on("pvz-jingle", function (_event, name, volume) {
  audio.playJingle(name, volume);
});
ipcMain.on("pvz-tune", function (_event, name) {
  audio.playMusic(name);
});
ipcMain.on("pvz-burst", function (_event, count, force) {
  audio.burst(count, force);
});
ipcMain.on("pvz-music-pause", function (_event, paused) {
  audio.pauseMusic(!!paused);
});
ipcMain.on("pvz-music-stop", function () {
  audio.stopMusic();
});

// 账户文件的读写。invoke（有返回值）而不是 send：渲染端要等读到数据才能继续。
ipcMain.handle("pvz-store-read", function (_event, rel) {
  return store.read(rel);
});
ipcMain.handle("pvz-store-write", function (_event, rel, payload) {
  return store.write(rel, payload);
});
ipcMain.handle("pvz-store-unlink", function (_event, rel) {
  return store.unlink(rel);
});
ipcMain.handle("pvz-store-dir", function () {
  return store.baseDir();
});

app.whenReady().then(createWindow);
app.on("window-all-closed", function () {
  audio.shutdown();
  app.quit();
});
