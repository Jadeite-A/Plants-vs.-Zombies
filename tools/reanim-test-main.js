// 临时：reanim 渲染测试窗口（配合 tools/reanim-test.html），截 tools/reanim-test.png 后退出。
const { app, BrowserWindow } = require("electron");
const path = require("path");
const fs = require("fs");

app.whenReady().then(function () {
  const win = new BrowserWindow({
    width: 820,
    height: 340,
    show: false,
    webPreferences: { webSecurity: false },
  });
  win.loadFile(path.join(__dirname, "reanim-test.html"));
  win.webContents.once("did-finish-load", function () {
    setTimeout(function () {
      win.webContents.capturePage().then(function (image) {
        fs.writeFileSync(path.join(__dirname, "reanim-test.png"), image.toPNG());
        console.log("saved reanim-test.png");
        app.quit();
      });
    }, 1200);
  });
});
