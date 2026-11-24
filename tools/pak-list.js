// 按正则列出 main.pak 索引里的文件名。用法：node tools/pak-list.js [pak路径] [正则]
const fs = require("fs");

const pakPath = process.argv[2] || "D:/PVZ/123/main.pak";
const pattern = process.argv[3] || ".";
const raw = fs.readFileSync(pakPath);
const b = Buffer.from(raw);
for (let i = 0; i < b.length; i++) b[i] ^= 0xf7;

let p = 9;
const entries = [];
while (p + 14 < b.length) {
  const nlen = b[p];
  if (nlen < 2 || nlen > 200) break;
  const name = b.slice(p + 1, p + 1 + nlen).toString("latin1");
  if (!/^[A-Za-z0-9_.\\\- \(\)]+$/.test(name)) break;
  p += 1 + nlen;
  p += 13; // u32 大小 + u32 校验 + u32 数据起点 + u8 压缩标记
  entries.push(name);
}
console.log("total", entries.length);
const re = new RegExp(pattern, "i");
const list = entries.filter((n) => re.test(n));
console.log("matched", list.length);
list.forEach((n) => console.log(n));
