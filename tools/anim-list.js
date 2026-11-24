// 列出若干 reanim 里可用的动画段，用于校正物种引用的动画名。
const fs = require("fs");
const path = require("path");

const dir = path.join(__dirname, "..", "assets", "reanim");
const want = process.argv.slice(2);
fs.readdirSync(dir).filter((f) => f.endsWith(".reanim")).forEach((file) => {
  if (want.length && !want.some((w) => file.toLowerCase().indexOf(w.toLowerCase()) >= 0)) return;
  const xml = fs.readFileSync(path.join(dir, file), "utf8");
  const anims = [];
  const trackRe = /<track>([\s\S]*?)<\/track>/g;
  let m;
  while ((m = trackRe.exec(xml))) {
    const name = (m[1].match(/<name>([^<]*)<\/name>/) || [])[1] || "";
    if (name.indexOf("anim_") === 0) {
      const fs2 = [...m[1].matchAll(/<f>(-?\d+)<\/f>/g)].map((x) => +x[1]);
      // 没写 <f> 就沿用上一帧（默认 0，全程可见）。
      const visible = fs2.length === 0 || fs2.some((f) => f !== -1);
      if (visible) anims.push(name);
    }
  }
  console.log(file, "→", anims.join(", "));
});
