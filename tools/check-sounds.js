// 静态检查：src 里 AudioBus 引用到的音效名是否都在 assets/sounds 里有 ogg。
// 再把植物/僵尸种类里 sounds 字段的名字也扫一遍。
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const soundsDir = path.join(root, "assets", "sounds");
const have = new Set(fs.readdirSync(soundsDir).map((f) => f.toLowerCase()));

function walk(dir, list) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) walk(full, list);
    else if (name.endsWith(".js")) list.push(full);
  }
}

const files = [];
["src", "tools"].forEach((d) => walk(path.join(root, d), files));

const missing = new Set();
const used = new Set();
const re = /AudioBus\.(?:play|cue|jingle)\(([^;)]*?)\)/g;
for (const file of files) {
  const text = fs.readFileSync(file, "utf8");
  let m;
  while ((m = re.exec(text))) {
    const arg = m[1];
    const names = arg.match(/"([^"]+)"/g) || [];
    if (!names.length) continue;
    // 第一个引号串可能是音效名或音效数组；都记下来。
    names.forEach((raw) => {
      const name = raw.slice(1, -1);
      used.add(name);
      if (!have.has((name + ".ogg").toLowerCase())) missing.add(name + "  <- " + path.relative(root, file));
    });
  }
}

// 种类配置里的 sounds: { key: "name" 或 ["a","b"] }
const cfgRe = /"(?:shoot|sparkle|explode|sun|mount|spawn)"\s*:\s*([\[\]"'][^,}]*)/g;
for (const file of files) {
  const text = fs.readFileSync(file, "utf8");
  let m;
  while ((m = cfgRe.exec(text))) {
    const names = m[1].match(/"([^"]+)"/g) || [];
    names.forEach((raw) => {
      const name = raw.slice(1, -1);
      used.add(name);
      if (!have.has((name + ".ogg").toLowerCase())) missing.add(name + "  <- " + path.relative(root, file));
    });
  }
}

console.log("sounds on disk:", have.size, "referenced:", used.size);
if (missing.size) {
  console.log("MISSING:");
  [...missing].forEach((n) => console.log(" ", n));
  process.exitCode = 1;
} else {
  console.log("all referenced sounds exist");
}
