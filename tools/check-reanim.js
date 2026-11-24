// 物种与贴图审计：
// 1) 每个 .reanim 引用到的图片 id 是否都能在 assets 里找到；
// 2) 每个植物/僵尸种类文件里引用的 anim_* 动画名是否真的存在于它的 reanim 里；
// 3) 汇总缺失清单。
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");

function norm(id) {
  return String(id)
    .replace(/^IMAGE_REANIM_/i, "")
    .replace(/^IMAGE_/i, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

// assets 里可用的图片键
const haveImages = new Set();
const manifest = JSON.parse(fs.readFileSync(path.join(root, "assets", "manifest.json"), "utf8"));
manifest.forEach((file) => {
  if (!/\.(png|jpg|jpeg)$/i.test(file)) return;
  const base = path.basename(file).replace(/\.[^.]+$/, "");
  let key = norm(base);
  if (/_$/.test(base)) key += "mask";
  haveImages.add(key);
});

// 每个 reanim 的动画名和图片引用
function parseReanim(file) {
  const xml = fs.readFileSync(file, "utf8");
  const images = new Set();
  const anims = new Set();
  const trackRe = /<track>([\s\S]*?)<\/track>/g;
  let m;
  while ((m = trackRe.exec(xml))) {
    const body = m[1];
    const name = (body.match(/<name>([^<]*)<\/name>/) || [])[1] || "";
    // 帧是稀疏的：动画段的成立只看轨道有没有帧（时间轴本身就有意义），
    // 自己帧全是 -1 的轨道是纯时间轴，配合其它轨道的帧使用。
    if (name.indexOf("anim_") === 0) anims.add(name);
    const imgRe = /<i>([^<]+)<\/i>/g;
    let im;
    while ((im = imgRe.exec(body))) images.add(im[1]);
  }
  return { images: [...images], anims: [...anims] };
}

const missingImages = {};
const reanimDir = path.join(root, "assets", "reanim");
const reanimByName = {};
fs.readdirSync(reanimDir).forEach((file) => {
  if (!file.endsWith(".reanim")) return;
  const name = file.replace(/\.reanim$/, "");
  const parsed = parseReanim(path.join(reanimDir, file));
  reanimByName[name] = parsed.anims;
  parsed.images.forEach((id) => {
    let key = norm(id);
    // 引用带下划线后缀的 id 是遮罩用法；引用不带下划线的 id 如果其遮罩文件存在，
    // 说明这是受击变色一类的颜色叠加层（原版用 trackColor 上色），不算缺图。
    if (/_$/.test(id)) key += "mask";
    if (!haveImages.has(key) && !haveImages.has(key + "mask")) {
      (missingImages[name] = missingImages[name] || new Set()).add(id);
    }
  });
});

// 物种文件里引用的动画名
const speciesIssues = [];
function walk(dir, list) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) walk(full, list);
    else if (name.endsWith(".js")) list.push(full);
  }
}
const speciesFiles = [];
walk(path.join(root, "src", "plants"), speciesFiles);
walk(path.join(root, "src", "zombies"), speciesFiles);
speciesFiles.forEach((file) => {
  const text = fs.readFileSync(file, "utf8");
  const reanimMatch = text.match(/"reanim":\s*"([^"]+)"/);
  if (!reanimMatch) return; // 没写 reanim 的文件是公共默认值，不针对单个模型
  const animRefs = [...text.matchAll(/"(anim_[A-Za-z0-9_]+)"/g)].map((m) => m[1]).filter((a) => !a.endsWith("_"));
  if (!animRefs.length) return;
  const names = [reanimMatch[1]];
  const known = new Set();
  names.forEach((n) => (reanimByName[n] || []).forEach((a) => known.add(a)));
  const unknown = animRefs.filter((a) => !known.has(a));
  if (unknown.length) {
    speciesIssues.push(path.relative(root, file) + " (" + names.join(",") + "): " + [...new Set(unknown)].join(", "));
  }
});

console.log("reanim files:", Object.keys(reanimByName).length, "image keys:", haveImages.size);
const missingFiles = Object.keys(missingImages);
if (missingFiles.length) {
  console.log("缺失图片引用：");
  missingFiles.forEach((f) => console.log(" ", f, "→", [...missingImages[f]].slice(0, 8).join(", ")));
} else {
  console.log("所有 reanim 引用的图片都在 assets 里");
}
if (speciesIssues.length) {
  console.log("动画名引用问题：");
  speciesIssues.forEach((s) => console.log(" ", s));
} else {
  console.log("所有物种引用的动画名都存在");
}
