const fs = require("fs");

function tracks(xml) {
  const out = [];
  const re = /<track>([\s\S]*?)<\/track>/g;
  let m;
  while ((m = re.exec(xml))) {
    const body = m[1];
    const name = (body.match(/<name>([^<]*)<\/name>/) || [])[1];
    const ts = [...body.matchAll(/<t>([\s\S]*?)<\/t>/g)].map((x) => x[1]);
    out.push({ name, ts });
  }
  return out;
}

const file = process.argv[2];
const xml = fs.readFileSync(file, "utf8");
const tr = tracks(xml);
console.log("file", file, "tracks", tr.length, "frames", tr[0] && tr[0].ts.length);
const anims = tr.filter((t) => t.name.startsWith("anim_") || t.name.startsWith("_"));
for (const a of anims) {
  let lastF = null;
  const visible = [];
  a.ts.forEach((t, i) => {
    const fm = t.match(/<f>(-?\d+)<\/f>/);
    if (fm) lastF = +fm[1];
    else if (lastF === null) lastF = 0;
    if (lastF !== -1) visible.push(i);
  });
  const nonempty = a.ts.map((t, i) => (t.trim() ? i : -1)).filter((i) => i >= 0);
  const range = visible.length ? `${visible[0]}-${visible[visible.length - 1]} n=${visible.length}` : "none";
  console.log(
    a.name.padEnd(28),
    "vis",
    range,
    "nonempty",
    nonempty.length,
    nonempty.slice(0, 12).join(",")
  );
}

console.log("--- sprite visibility windows (first/last f!=-1) ---");
for (const a of tr) {
  if (a.name.startsWith("anim_") || a.name.startsWith("_")) continue;
  let lastF = null;
  let lastI = null;
  const visible = [];
  a.ts.forEach((t, i) => {
    const fm = t.match(/<f>(-?\d+)<\/f>/);
    const im = t.match(/<i>([^<]*)<\/i>/);
    if (fm) lastF = +fm[1];
    if (im) lastI = im[1];
    if (lastF !== -1 && lastI) visible.push(i);
  });
  if (!visible.length) {
    console.log(a.name.padEnd(36), "HIDDEN");
    continue;
  }
  // compress to ranges
  const ranges = [];
  let s = visible[0];
  let p = visible[0];
  for (let k = 1; k < visible.length; k++) {
    if (visible[k] === p + 1) p = visible[k];
    else {
      ranges.push(`${s}-${p}`);
      s = p = visible[k];
    }
  }
  ranges.push(`${s}-${p}`);
  console.log(a.name.padEnd(36), ranges.join(" "));
}
