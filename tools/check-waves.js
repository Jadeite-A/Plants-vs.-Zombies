// 无头自检：把 50 个关卡都按原版规则生成一遍出怪表，核对波数/旗帜/登场僵尸。
const path = require("path");
const fs = require("fs");
const vm = require("vm");

global.AudioBus = { cue: function () {}, play: function () {}, burst: function () {}, music: function () {}, musicPause: function () {}, stop: function () {}, jingle: function () {} };
global.Assets = { image: function () { return null; }, reanim: function () { return null; } };
global.Reanim = { draw: function () {}, drawLayers: function () {}, frameIn: function () { return 0; }, trackByName: function () { return null; } };
global.Rules = { add: function () {}, use: function () { return null; } };
global.ZombieCatalog = { byId: {}, get: function () { return { id: "normal", locomotion: "walk" }; }, create: function () { return {}; }, preview: function () { return {}; } };
global.PlantCatalog = { get: function (id) { return id ? { id: id } : null; }, anchor: function () { return { x: 40, y: 48 }; }, defs: {}, anchors: {}, aim: {}, order: [], create: function () { return {}; } };
global.Lawn = { ROWS: 5, COLS: 9, LAWN_X: 51, LAWN_Y: 82, COL_W: 80, ROW_H: 96, VIEW_X: 200, W: 800, H: 600, plantAt: function () { return { x: 0, y: 0 }; }, groundY: function () { return 0; }, cellLeft: function () { return 0; } };

function load(file) {
  const text = fs.readFileSync(path.join(__dirname, "..", "src", file), "utf8");
  vm.runInThisContext(text, { filename: file });
}

// 手动按拓扑序装：地形 → 波次 → 关卡类 → 各关卡 → 模式 → 图鉴。
["data/terrains.js", "data/waves.js", "data/levels.js"].forEach(load);
fs.readdirSync(path.join(__dirname, "..", "src/data/levels")).forEach(function (f) {
  if (f.endsWith(".js")) load("data/levels/" + f);
});
load("data/modes.js");
load("data/almanac.js");

let fail = 0;
const expectedWaves = { "1-1": 4, "1-2": 6, "1-3": 8, "1-4": 10, "1-5": 8, "1-6": 10, "1-7": 20, "1-8": 10, "1-9": 20, "1-10": 20, "2-1": 10, "2-2": 20, "2-3": 10, "2-4": 20, "2-5": 8, "2-6": 10, "2-7": 20, "2-8": 10, "2-9": 20, "2-10": 20, "3-1": 10, "3-2": 20, "3-3": 20, "3-4": 30, "3-5": 20, "3-6": 20, "3-7": 30, "3-8": 20, "3-9": 30, "3-10": 30, "4-1": 10, "4-2": 20, "4-3": 10, "4-4": 20, "4-5": 20, "4-6": 10, "4-7": 20, "4-8": 10, "4-9": 20, "4-10": 20, "5-1": 10, "5-2": 20, "5-3": 20, "5-4": 30, "5-5": 20, "5-6": 20, "5-7": 30, "5-8": 20, "5-9": 30, "5-10": 30 };
const debutByLevel = { "1-3": "cone", "1-6": "pole", "1-8": "bucket", "2-1": "newspaper", "2-3": "screen", "2-6": "football", "2-8": "dancer", "3-3": "snorkel", "3-6": "zamboni", "3-8": "dolphin", "4-1": "jack", "4-3": "balloon", "4-6": "digger", "4-8": "pogo", "5-1": "bungee", "5-3": "ladder", "5-6": "catapult", "5-8": "gargantuar" };

Object.keys(expectedWaves).forEach(function (id) {
  const level = Adventure.byId(id);
  const built = Waves.build(level);
  const flags = built.flagWaves.filter(Boolean).length;
  const expectedFlags = expectedWaves[id] < 10 ? (id === "1-1" ? 0 : 1) : expectedWaves[id] / 10;
  if (built.waveCount !== expectedWaves[id] || flags !== expectedFlags) {
    console.log("MISMATCH", id, "waves=" + built.waveCount + " flags=" + flags, "expect waves=" + expectedWaves[id] + " flags=" + expectedFlags);
    fail++;
  }
  const want = debutByLevel[id];
  if (want && built.zombies.every(function (z) { return z.type !== want; })) {
    console.log("NO DEBUT", id, want);
    fail++;
  }
  const roster = Waves.roster[id];
  built.zombies.forEach(function (z) {
    if (roster.indexOf(z.type) < 0 && z.type !== "flag") {
      console.log("FOREIGN ZOMBIE", id, z.type);
      fail++;
    }
  });
});

// 二周目：1-2 应为 20 波两面旗；1-10 保持 20 波。
const l12 = Adventure.byId("1-2");
l12.round = 2;
const b12 = Waves.build(l12);
if (b12.waveCount !== 20 || b12.flagWaves.filter(Boolean).length !== 2) { console.log("ROUND2 1-2 wrong", b12.waveCount, b12.flagWaves.filter(Boolean).length); fail++; }
const l110 = Adventure.byId("1-10");
l110.round = 2;
if (Waves.build(l110).waveCount !== 20) { console.log("ROUND2 1-10 should stay 20"); fail++; }
if (fail) {
  console.log("FAILED:", fail);
  process.exit(1);
}
console.log("waves self-check OK for", Adventure.levels.length, "levels");
