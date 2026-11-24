/*
 * electron/store.js — 账户文件的落盘（主进程）。
 *
 * 存储位置（便携优先）：
 *   开发时   项目根/account/
 *   打包后   exe 同级目录/account/（跟游戏放在一起，拷走目录即拷走存档）
 *   退路     上面不可写（如装进 Program Files）时改用系统 userData/account/
 *
 * 文件布局：
 *   account/index.json          账户索引 { activeId, users: [{id,name,createdAt}] }
 *   account/users/<id>.json     每个用户一个独立档案（解锁进度、通关记录、钱包…）
 *
 * 意外情况的处理原则：存档坏了、被删了，都不能让游戏起不来——
 *   · 文件损坏（JSON 解析失败）→ 把坏文件改名成 .bak-<时间戳> 留证，按"不存在"处理；
 *   · 索引指向的用户文件被删   → 该用户按默认新档重建，索引不炸；
 *   · 整个目录被删             → 当成首次启动，新建"园丁"默认档；
 *   · 写盘失败                 → console 警告，游戏继续用内存里的数据。
 */
const fs = require("fs");
const path = require("path");

let cachedDir = null;

// 决定账户根目录：
//   开发（npm start）→ 项目根（package.json 所在目录）；
//   打包后 → exe 同级目录（便携式，拷走目录即拷走存档）；
//   上面不可写 → 系统 userData/account 兜底。
function baseDir() {
  if (cachedDir) return cachedDir;
  const candidates = [];
  try {
    const electron = require("electron");
    if (electron.app.isPackaged) {
      candidates.push(path.join(path.dirname(electron.app.getPath("exe")), "account"));
    } else {
      candidates.push(path.join(electron.app.getAppPath(), "account"));
    }
  } catch (err) {
    /* app 还没就绪时取不到，忽略 */
  }
  try {
    candidates.push(path.join(require("electron").app.getPath("userData"), "account"));
  } catch (err) {
    /* 同上 */
  }
  for (const dir of candidates) {
    try {
      fs.mkdirSync(dir, { recursive: true });
      fs.accessSync(dir, fs.constants.W_OK);
      cachedDir = dir;
      return dir;
    } catch (err) {
      /* 换下一个候选 */
    }
  }
  // 全都不行：用当前工作目录兜底（至少不抛异常）。
  cachedDir = path.join(process.cwd(), "account");
  fs.mkdirSync(cachedDir, { recursive: true });
  return cachedDir;
}

function fileOf(rel) {
  // 只允许相对路径里的安全字符，防止越出 account 目录。
  const clean = String(rel).replace(/\\/g, "/").replace(/\.\./g, "");
  return path.join(baseDir(), clean);
}

// 读一个 JSON 文件。不存在/损坏都返回 null；损坏的先改名备份。
function read(rel) {
  const file = fileOf(rel);
  try {
    const text = fs.readFileSync(file, "utf8");
    try {
      return JSON.parse(text);
    } catch (err) {
      const backup = file + ".bak-" + Date.now();
      try {
        fs.renameSync(file, backup);
        console.error("存档损坏，已备份到", backup);
      } catch (err2) {
        console.error("存档损坏且无法备份", file);
      }
      return null;
    }
  } catch (err) {
    return null; // 不存在视为空
  }
}

// 原子写：先写临时文件再改名，掉电也不会留下半个 JSON。
function write(rel, payload) {
  const file = fileOf(rel);
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const tmp = file + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(payload, null, 2), "utf8");
    fs.renameSync(tmp, file);
    return true;
  } catch (err) {
    console.error("存档写入失败", file, err && err.message);
    return false;
  }
}

// 删除一个存档文件（删除用户时用）。文件本来就不存在也算成功。
function unlink(rel) {
  const file = fileOf(rel);
  try {
    fs.rmSync(file, { force: true });
    return true;
  } catch (err) {
    console.error("存档删除失败", file, err && err.message);
    return false;
  }
}

module.exports = { read, write, unlink, baseDir };
