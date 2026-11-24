// 校验 src/core/loader.js 清单：每个文件都存在；species/levels 目录里的
// 文件没有漏登（防止加了新植物/新关卡忘了进清单）。
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const loader = fs.readFileSync(path.join(root, "src", "core", "loader.js"), "utf8");
const listed = new Set([...loader.matchAll(/"(?:data|plants|zombies|core|battle|app|ui)\/[^"]+\.js"/g)].map((m) => m[0].slice(1, -1)));

let bad = 0;
listed.forEach((rel) => {
  if (!fs.existsSync(path.join(root, "src", rel))) {
    console.log("清单里有但磁盘上没有:", rel);
    bad++;
  }
});

// 目录里的 .js 必须都在清单里
["plants/species", "zombies/species", "data/levels"].forEach((dir) => {
  fs.readdirSync(path.join(root, "src", dir)).forEach((file) => {
    if (!file.endsWith(".js")) return;
    const rel = dir + "/" + file;
    if (!listed.has(rel)) {
      console.log("磁盘上有但清单里没有:", rel);
      bad++;
    }
  });
});

console.log(bad ? "发现 " + bad + " 处不一致" : "loader 清单与磁盘一致（" + listed.size + " 项）");
process.exitCode = bad ? 1 : 0;
