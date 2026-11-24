/*
 * store.js — 存档读写门面（渲染端）。
 *
 * 统一"按名字读/写一个 JSON"的接口，屏蔽两套后端：
 *   · Electron：window.pvzStore → 主进程读写 account/ 目录（见 electron/store.js）；
 *   · 纯浏览器：localStorage（键名 pvz-store:<名字>），仅作开发兜底。
 *
 * 所有接口都返回 Promise，调用方（accounts.js）只管 await。
 * 约定的文件名：
 *   "index.json"      账户索引
 *   "users/<id>.json" 每个用户的档案
 */
var Store = (function () {
  function localStorageKey(name) {
    return "pvz-store:" + name;
  }

  function read(name) {
    if (window.pvzStore) {
      return window.pvzStore.read(name);
    }
    // 浏览器兜底：读不到或解析失败都按 null 处理（损坏数据同样不留着）。
    var raw = null;
    try {
      raw = localStorage.getItem(localStorageKey(name));
    } catch (err) {
      raw = null;
    }
    if (!raw) return Promise.resolve(null);
    try {
      return Promise.resolve(JSON.parse(raw));
    } catch (err) {
      return Promise.resolve(null);
    }
  }

  function write(name, payload) {
    if (window.pvzStore) {
      return window.pvzStore.write(name, payload);
    }
    try {
      localStorage.setItem(localStorageKey(name), JSON.stringify(payload));
    } catch (err) {
      console.error("存档写入失败", name, err);
    }
    return Promise.resolve(true);
  }

  // 删除一个存档文件（删除用户时用）。浏览器兜底走 removeItem。
  function unlink(name) {
    if (window.pvzStore) {
      return window.pvzStore.unlink(name);
    }
    try {
      localStorage.removeItem(localStorageKey(name));
    } catch (err) {
      console.error("存档删除失败", name, err);
    }
    return Promise.resolve(true);
  }

  return { read: read, write: write, unlink: unlink };
})();
