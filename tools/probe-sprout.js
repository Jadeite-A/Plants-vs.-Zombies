const fs = require("fs");
const path = require("path");

function pngSize(file) {
  const buf = fs.readFileSync(file);
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

function parse(file) {
  const xml = fs.readFileSync(file, "utf8");
  const tracks = [];
  const re = /<track>([\s\S]*?)<\/track>/g;
  let m;
  while ((m = re.exec(xml))) {
    const body = m[1];
    const name = (body.match(/<name>([^<]*)<\/name>/) || [])[1] || "";
    const raw = [];
    const fr = /<t>([\s\S]*?)<\/t>/g;
    let fm;
    while ((fm = fr.exec(body))) raw.push(fm[1]);
    const cur = { x: 0, y: 0, kx: 0, ky: 0, sx: 1, sy: 1, f: 0, i: "" };
    const frames = raw.map((chunk) => {
      const grab = (tag) => {
        const found = chunk.match(new RegExp("<" + tag + ">(-?[\\d.]*)</" + tag + ">"));
        return found ? found[1] : null;
      };
      const image = chunk.match(/<i>([^<]*)<\/i>/);
      if (grab("x") != null) cur.x = +grab("x");
      if (grab("y") != null) cur.y = +grab("y");
      if (grab("kx") != null) cur.kx = +grab("kx");
      if (grab("ky") != null) cur.ky = +grab("ky");
      if (grab("sx") != null) cur.sx = +grab("sx");
      if (grab("sy") != null) cur.sy = +grab("sy");
      if (grab("f") != null) cur.f = +grab("f");
      if (image) cur.i = image[1];
      return { ...cur };
    });
    tracks.push({ name, frames });
  }
  return tracks;
}

function corners(frame, w, h, center) {
  const ox = center ? -w / 2 : 0;
  const oy = center ? -h / 2 : 0;
  const kx = (frame.kx * Math.PI) / 180;
  const ky = (frame.ky * Math.PI) / 180;
  const a = frame.sx * Math.cos(kx);
  const b = frame.sx * Math.sin(kx);
  const c = -frame.sy * Math.sin(ky);
  const d = frame.sy * Math.cos(ky);
  const pts = [
    [ox, oy],
    [ox + w, oy],
    [ox, oy + h],
    [ox + w, oy + h],
  ].map(([x, y]) => [a * x + c * y + frame.x, b * x + d * y + frame.y]);
  return pts;
}

function report(file, center) {
  const tracks = parse(file);
  const marker = tracks.find((t) => t.name.indexOf("anim_") === 0);
  let last = marker.frames.length - 1;
  const sizes = {};
  console.log("\n==", path.basename(file), "center", center, "frame", last);
  let minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
  for (const t of tracks) {
    const f = t.frames[last];
    if (!f || f.f === -1 || !f.i) continue;
    const id = f.i.replace(/^IMAGE_REANIM_/i, "").replace(/^IMAGE_/i, "");
    const imgPath = path.join("D:/PVZ/resource/reanim", id + ".png");
    const alt = path.join("D:/PVZ/resource/reanim", id.toLowerCase() + ".png");
    let filePath = fs.existsSync(imgPath) ? imgPath : null;
    if (!filePath) {
      const dir = fs.readdirSync("D:/PVZ/resource/reanim");
      const hit = dir.find((n) => n.toLowerCase() === (id + ".png").toLowerCase());
      if (hit) filePath = path.join("D:/PVZ/resource/reanim", hit);
    }
    if (!filePath) { console.log(" missing", id); continue; }
    const sz = pngSize(filePath);
    const pts = corners(f, sz.w, sz.h, center);
    const xs = pts.map((p) => p[0]);
    const ys = pts.map((p) => p[1]);
    const b = { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
    minX = Math.min(minX, b.minX); maxX = Math.max(maxX, b.maxX);
    minY = Math.min(minY, b.minY); maxY = Math.max(maxY, b.maxY);
    console.log(t.name, id, sz.w + "x" + sz.h, "box", b.minX.toFixed(1), b.minY.toFixed(1), b.maxX.toFixed(1), b.maxY.toFixed(1));
  }
  console.log("ALL", minX.toFixed(1), minY.toFixed(1), maxX.toFixed(1), maxY.toFixed(1), "cx", ((minX+maxX)/2).toFixed(1), "cy", ((minY+maxY)/2).toFixed(1));
}

report("D:/PVZ/resource/reanim/LoadBar_sprout.reanim", false);
report("D:/PVZ/resource/reanim/LoadBar_sprout.reanim", true);
report("D:/PVZ/resource/reanim/LoadBar_Zombiehead.reanim", false);
report("D:/PVZ/resource/reanim/LoadBar_Zombiehead.reanim", true);
