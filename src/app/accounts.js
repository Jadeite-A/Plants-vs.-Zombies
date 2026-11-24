/*
 * accounts.js — 多存档管理（渲染端）。
 *
 * 存档落在本地文件（经 Store 门面，见 app/store.js 与 electron/store.js）：
 *   index.json       账户索引：activeId + 用户名片列表（id/名字/创建时间）
 *   users/<id>.json  每个用户一个独立档案（Profile.toJSON 的完整内容）
 *
 * 生命周期与意外处理：
 *   启动时 Accounts.init()（异步）：
 *     1. 读索引。索引缺失或损坏 → 看看本地有没有旧版 localStorage 存档
 *        （"pvz-accounts" / 更老的 "pvz-annual-adventure"），有就迁移成文件；
 *        什么都没有 → 新建默认账户"园丁"。
 *     2. 按索引逐个读用户文件。某个文件被删/损坏 → 该用户按默认新档重建，
 *        名字保留（索引里还有），游戏照常可用；
 *     3. activeId 指向的用户不存在 → 切到第一个用户。
 *   之后任何改动调用 Accounts.save()：只重写脏的两类文件（当前用户 + 索引）。
 *
 * 注意：init() 完成前 current() 返回 null，app/main.js 会等 init 后再 boot。
 */
var Accounts = (function () {
  var INDEX_FILE = "index.json";
  var LEGACY_MULTI = "pvz-accounts";      // 旧版：整套存档挤在一个 localStorage 键里
  var LEGACY_SINGLE = "pvz-annual-adventure"; // 更老：只有一个冒险进度

  var book = {
    activeId: "",
    users: [], // Profile 实例
  };
  var ready = false;

  function freshId() {
    return "u" + Date.now().toString(36) + Math.floor(Math.random() * 1000).toString(36);
  }

  function userFile(id) {
    return "users/" + id + ".json";
  }

  function persistIndex() {
    return Store.write(INDEX_FILE, {
      activeId: book.activeId,
      users: book.users.map(function (user) {
        return { id: user.id, name: user.name, createdAt: user.createdAt };
      }),
    });
  }

  function persistUser(user) {
    return Store.write(userFile(user.id), user.toJSON());
  }

  function save() {
    if (!ready) return;
    var current = currentProfile();
    if (current) persistUser(current);
    persistIndex();
  }

  function currentProfile() {
    for (var i = 0; i < book.users.length; i++) {
      if (book.users[i].id === book.activeId) return book.users[i];
    }
    return book.users[0] || null;
  }

  // ---------- 启动 ----------

  function readIndex() {
    return Store.read(INDEX_FILE).then(function (index) {
      if (index && index.users && index.users.length) return index;
      // 索引不在了：尝试从旧版 localStorage 迁移（用户手动清了 account 目录，
      // 但浏览器/Electron 分区里可能还留着旧数据）。
      return migrateLegacy().then(function (index) {
        return index || null;
      });
    });
  }

  // 把旧 localStorage 存档翻译成文件格式；没有旧数据返回 null。
  function migrateLegacy() {
    var legacy = null;
    try {
      legacy = JSON.parse(localStorage.getItem(LEGACY_MULTI) || "null");
    } catch (err) {
      legacy = null;
    }
    if (legacy && legacy.users && legacy.users.length) {
      return Promise.resolve({
        activeId: legacy.activeId,
        users: legacy.users.map(function (user) {
          return { id: user.id, name: user.name, createdAt: user.createdAt };
        }),
        legacyUsers: legacy.users, // 原始档案一起带走
      });
    }
    var single = null;
    try {
      single = JSON.parse(localStorage.getItem(LEGACY_SINGLE) || "null");
    } catch (err) {
      single = null;
    }
    if (single && single.unlocked) {
      var first = { id: freshId(), name: "园丁", createdAt: Date.now() };
      return Promise.resolve({
        activeId: first.id,
        users: [first],
        legacyUsers: [{ id: first.id, name: "园丁", adventure: single }],
      });
    }
    return Promise.resolve(null);
  }

  function loadUsers(index) {
    // 并发读所有用户文件；被删/损坏的按默认档重建。返回时带上"哪些是重建的"，
    // init 结束时要把它们立刻落盘一次（否则下次启动还要走一遍恢复流程）。
    var missing = 0;
    var jobs = index.users.map(function (card) {
      return Store.read(userFile(card.id)).then(function (spec) {
        if (!spec) missing++;
        var profile = Profile.fromJSON(spec);
        // 文件被删时 Profile.fromJSON 会给默认值；这里把索引里的名片补回去。
        profile.id = card.id || profile.id || freshId();
        profile.name = card.name || profile.name;
        profile.createdAt = card.createdAt || profile.createdAt;
        // 索引附带的旧版档案（迁移场景）：没有独立文件时用它。
        if (!spec && index.legacyUsers) {
          var raw = index.legacyUsers.filter(function (u) { return u.id === profile.id; })[0];
          if (raw) {
            var merged = Profile.fromJSON(raw);
            merged.id = profile.id;
            merged.name = profile.name;
            return merged;
          }
        }
        return profile;
      });
    });
    return Promise.all(jobs).then(function (users) {
      return { users: users, missing: missing };
    });
  }

  function init() {
    return readIndex()
      .then(function (index) {
        if (index) return loadUsers(index).then(function (result) {
          book.users = result.users;
          book.activeId = index.activeId;
          // 有重建/迁移的用户：立刻把完整存档写一遍，恢复流程只走这一次。
          if (result.missing > 0) {
            book.users.forEach(persistUser);
            persistIndex();
          }
          return null;
        });
        // 全新的开始：默认账户"园丁"。
        var first = new Profile({ id: freshId(), name: "园丁" });
        book.users = [first];
        book.activeId = first.id;
        ready = true;
        save();
        return null;
      })
      .then(function () {
        ready = true;
        if (!currentProfile()) {
          var first = new Profile({ id: freshId(), name: "园丁" });
          book.users = [first];
          book.activeId = first.id;
          save();
        }
        if (book.users.indexOf(currentProfile()) < 0 || book.activeId !== currentProfile().id) {
          book.activeId = book.users[0].id;
          save();
        }
      })
      .catch(function (err) {
        console.error("存档初始化失败，先用空档进游戏", err);
        var first = new Profile({ id: freshId(), name: "园丁" });
        book.users = [first];
        book.activeId = first.id;
        ready = true;
      });
  }

  // ---------- 对外操作 ----------

  function current() {
    return currentProfile();
  }

  function list() {
    return book.users.slice();
  }

  function switchTo(id) {
    var target = null;
    for (var i = 0; i < book.users.length; i++) {
      if (book.users[i].id === id) target = book.users[i];
    }
    if (!target) return null;
    book.activeId = id;
    save();
    return target;
  }

  // 重名检查：建号和改名都要过这道关（忽略大小写，exceptId 用来在改名时排除自己）。
  function nameTaken(name, exceptId) {
    var key = String(name || "").trim().toLowerCase();
    if (!key) return false;
    return book.users.some(function (user) {
      return user.id !== exceptId && user.name.toLowerCase() === key;
    });
  }

  function create(name) {
    var trimmed = String(name || "").trim();
    if (!trimmed || nameTaken(trimmed, null)) return null;
    var user = new Profile({ id: freshId(), name: trimmed.slice(0, 12) });
    book.users.push(user);
    book.activeId = user.id;
    save();
    return user;
  }

  function rename(id, name) {
    var trimmed = String(name || "").trim();
    if (!trimmed || nameTaken(trimmed, id)) return false;
    var target = book.users.filter(function (item) { return item.id === id; })[0];
    if (!target) return false;
    target.name = trimmed.slice(0, 12);
    save();
    return true;
  }

  // 删除一个用户：档案文件直接删掉，索引同步收紧。
  // 删的是当前用户 → 切到剩下的第一个；一个都不剩 → 立一个全新默认档，
  // 保证游戏任何时刻都有"当前用户"可用。
  function remove(id) {
    var index = -1;
    for (var i = 0; i < book.users.length; i++) {
      if (book.users[i].id === id) {
        index = i;
        break;
      }
    }
    if (index < 0) return false;
    book.users.splice(index, 1);
    Store.unlink(userFile(id)).catch(function () {});
    if (!book.users.length) {
      var first = new Profile({ id: freshId(), name: "园丁" });
      book.users.push(first);
      book.activeId = first.id;
    } else if (book.activeId === id) {
      // 激活指针别悬在已删除的 id 上，改指剩下的第一个。
      book.activeId = book.users[0].id;
    }
    save();
    return true;
  }

  return {
    init: init,
    current: current,
    list: list,
    switchTo: switchTo,
    create: create,
    rename: rename,
    remove: remove,
    nameTaken: nameTaken,
    save: save,
  };
})();
