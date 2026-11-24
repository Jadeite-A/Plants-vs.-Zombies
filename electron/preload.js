const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("pvzAudio", {
  playSfx: function (name, volume) {
    ipcRenderer.send("pvz-sfx", name, volume);
  },
  // 胜利/失败曲：可被 stopMusic 停掉的独立通道。
  jingle: function (name, volume) {
    ipcRenderer.send("pvz-jingle", name, volume);
  },
  // 切曲子：曲名对应 mainmusic.mo3 里的 Order 段（title/choose/day/night/...）。
  tune: function (name) {
    ipcRenderer.send("pvz-tune", name);
  },
  // 战况强度：场上僵尸数量驱动镲片鼓组淡入淡出。
  burst: function (count, force) {
    ipcRenderer.send("pvz-burst", count, !!force);
  },
  musicPause: function (paused) {
    ipcRenderer.send("pvz-music-pause", !!paused);
  },
  stopMusic: function () {
    ipcRenderer.send("pvz-music-stop");
  },
});

// 账户文件存取（主进程读写 account/ 目录）。read 返回 Promise<JSON|null>。
contextBridge.exposeInMainWorld("pvzStore", {
  read: function (rel) {
    return ipcRenderer.invoke("pvz-store-read", rel);
  },
  write: function (rel, payload) {
    return ipcRenderer.invoke("pvz-store-write", rel, payload);
  },
  unlink: function (rel) {
    return ipcRenderer.invoke("pvz-store-unlink", rel);
  },
  dir: function () {
    return ipcRenderer.invoke("pvz-store-dir");
  },
});
