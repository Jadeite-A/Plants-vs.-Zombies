const fs = require("fs");
function parse(xml) {
  const tracks = [];
  const re = /<track>([\s\S]*?)<\/track>/g;
  let match;
  while ((match = re.exec(xml))) {
    const body = match[1];
    const name = (body.match(/<name>([^<]*)<\/name>/) || [])[1] || "";
    const raw = [];
    const fr = /<t>([\s\S]*?)<\/t>/g;
    let fm;
    while ((fm = fr.exec(body))) raw.push(fm[1]);
    let f = 0, i = "";
    const frames = raw.map((raw) => {
      const fv = raw.match(/<f>(-?[\d.]*)<\/f>/);
      const iv = raw.match(/<i>([^<]*)<\/i>/);
      if (fv) f = +fv[1];
      if (iv) i = iv[1];
      return { f, i };
    });
    tracks.push({ name, frames });
  }
  return tracks;
}
function vis(tracks, frame) {
  return tracks.filter((t) => {
    const fr = t.frames[frame];
    return fr && fr.f !== -1 && fr.i;
  }).map((t) => t.name + (t.frames[frame].i ? ":" + t.frames[frame].i.replace("IMAGE_REANIM_", "") : ""));
}
function firstVis(tracks, name) {
  const t = tracks.find((x) => x.name === name);
  if (!t) return -1;
  for (let i = 0; i < t.frames.length; i++) if (t.frames[i].f !== -1) return i;
  return 0;
}
function report(file) {
  const xml = fs.readFileSync(file, "utf8");
  const tracks = parse(xml);
  const idle = firstVis(tracks, "anim_idle");
  const head = firstVis(tracks, "anim_head_idle") >= 0 ? firstVis(tracks, "anim_head_idle") : firstVis(tracks, "anim_head_idle1");
  console.log("\n==", file.split(/[/\\]/).pop(), "idleFrame", idle, "headFrame", head);
  const a = vis(tracks, idle < 0 ? 0 : idle);
  const b = vis(tracks, head < 0 ? 0 : head);
  console.log("idle visible", a.join(", "));
  console.log("head visible", b.join(", "));
  const onlyHead = b.filter((n) => a.indexOf(n) < 0);
  const onlyIdle = a.filter((n) => b.indexOf(n) < 0);
  console.log("only head", onlyHead.join(", "));
  console.log("only idle", onlyIdle.join(", "));
}
[
  "GatlingPea.reanim",
  "SnowPea.reanim",
  "PeaShooterSingle.reanim",
  "Cactus.reanim",
  "Plantern.reanim",
  "GoldMagnet.reanim",
  "GloomShroom.reanim",
  "PotatoMine.reanim",
].forEach((name) => {
  const p = "D:/PVZ/assets/reanim/" + name;
  if (fs.existsSync(p)) report(p);
  else console.log("missing", name);
});
