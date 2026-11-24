// 按原版冒险模式数据重写 50 个关卡文件。
// 数据来源：原版 exe 反编译（gZombieWaves 波数表、传送带配卡、特殊关卡玩法）
// 与官方攻略的旗帜数/新增僵尸记录。每关一个文件，只写自己的波数/地形/玩法。
const fs = require("fs");
const path = require("path");

const outDir = path.join(__dirname, "..", "src", "data", "levels");

// 每大关的说明头。
const stageLabel = {
  1: "前院白天",
  2: "前院夜晚",
  3: "后院泳池",
  4: "后院浓雾",
  5: "屋顶",
};

// gZombieWaves[50]：每关的僵尸波数（第一轮）。旗帜每 10 波一面，不满 10 波的
// 关最后一波就是大波；1-1 第一轮没有任何旗帜波。
const waveCounts = [
  4, 6, 8, 10, 8, 10, 20, 10, 20, 20,
  10, 20, 10, 20, 8, 10, 20, 10, 20, 20,
  10, 20, 20, 30, 20, 20, 30, 20, 30, 30,
  10, 20, 10, 20, 20, 10, 20, 10, 20, 20,
  10, 20, 20, 30, 20, 20, 30, 20, 30, 30,
];

// 特殊关卡（每 5 关一个 + 每大关第 10 关的传送带）。
const specials = {
  "1-5": {
    title: "坚果保龄球",
    note: "用滚动的坚果撞僵尸；第二周目也是八波。场上先摆好三株豌豆射手，戴夫让你铲掉它们。",
    kind: "bowling",
    waveCount: 8,
    belt: [
      { id: "wallnut", weight: 85 },
      { id: "explodenut", card: "wallnut", bowl: "explode", weight: 15 },
    ],
    prePlants: [
      { col: 5, row: 1 },
      { col: 7, row: 2 },
      { col: 6, row: 3 },
    ],
  },
  "1-10": {
    title: "传送带",
    note: "第一台传送带：卡从右边滚进来，没有向日葵，阳光从天上掉。",
    kind: "conveyor",
    waveCount: 20,
    belt: [
      { id: "peashooter", weight: 20 },
      { id: "cherry", weight: 20 },
      { id: "wallnut", weight: 15 },
      { id: "repeater", weight: 20 },
      { id: "snowpea", weight: 10 },
      { id: "chomper", weight: 5 },
      { id: "potatomine", weight: 10 },
    ],
  },
  "2-5": {
    title: "敲僵尸",
    note: "木槌敲僵尸：普通一锤、路障两锤、铁桶三锤。敲死的僵尸掉阳光，攒够了从石板里买咬咬碑和樱桃炸弹。",
    kind: "whack",
    waveCount: 8,
  },
  "2-10": {
    title: "传送带",
    note: "黑夜传送带：咬咬碑、寒冰菇、毁灭菇、魅惑菇、胆小菇、大喷菇、小喷菇。",
    kind: "conveyor",
    waveCount: 20,
    belt: [
      { id: "gravebuster", weight: 20 },
      { id: "iceshroom", weight: 15 },
      { id: "doomshroom", weight: 15 },
      { id: "hypnoshroom", weight: 10 },
      { id: "scaredyshroom", weight: 15 },
      { id: "fumeshroom", weight: 15 },
      { id: "puffshroom", weight: 10 },
    ],
  },
  "3-5": {
    title: "小僵尸大麻烦",
    note: "僵尸全是缩小版，走传送带：荷叶、坚果、豌豆射手、樱桃炸弹。",
    kind: "little",
    waveCount: 20,
    belt: [
      { id: "lilypad", weight: 25 },
      { id: "wallnut", weight: 15 },
      { id: "peashooter", weight: 25 },
      { id: "cherry", weight: 35 },
    ],
  },
  "3-10": {
    title: "传送带",
    note: "泳池传送带：荷叶、窝瓜、三线射手、缠绕海草、火爆辣椒、地刺、火炬树桩、高坚果。",
    kind: "conveyor",
    waveCount: 30,
    belt: [
      { id: "lilypad", weight: 25 },
      { id: "squash", weight: 5 },
      { id: "threepeater", weight: 25 },
      { id: "tanglekelp", weight: 5 },
      { id: "jalapeno", weight: 10 },
      { id: "spikeweed", weight: 10 },
      { id: "torchwood", weight: 10 },
      { id: "tallnut", weight: 10 },
    ],
  },
  "4-5": {
    title: "花瓶粉碎者",
    note: "砸开三批花瓶：绿瓶是植物，其余瓶里可能蹦出僵尸。清完所有瓶子和僵尸才算赢。这一关是普通黑夜草坪，不是浓雾。",
    kind: "vase",
    waveCount: 20,
    terrain: "front-night",
  },
  "4-10": {
    title: "暴风雨夜",
    note: "漆黑的传送带：荷叶、海蘑菇、磁力菇、三叶草、仙人掌、杨桃、双向射手、南瓜头。",
    kind: "conveyor",
    waveCount: 20,
    belt: [
      { id: "lilypad", weight: 30 },
      { id: "seashroom", weight: 10 },
      { id: "magnetshroom", weight: 5 },
      { id: "blover", weight: 5 },
      { id: "cactus", weight: 15 },
      { id: "starfruit", weight: 25 },
      { id: "splitpea", weight: 5 },
      { id: "pumpkin", weight: 10 },
    ],
  },
  "5-5": {
    title: "蹦极闪电战",
    note: "所有僵尸都由蹦极僵尸从天上空投；每面大波固定五只蹦极。传送带给花盆、大嘴花、南瓜头、樱桃炸弹。",
    kind: "blitz",
    waveCount: 20,
    belt: [
      { id: "pot", weight: 50 },
      { id: "chomper", weight: 25 },
      { id: "pumpkin", weight: 15 },
      { id: "cherry", weight: 10 },
    ],
  },
  "5-10": {
    title: "僵王博士的复仇",
    note: "最终关。黑夜屋顶上的传送带：花盆、西瓜投手、火爆辣椒、卷心菜投手、玉米投手、寒冰菇；僵王博士压阵。",
    kind: "boss",
    waveCount: 30,
    terrain: "boss",
    belt: [
      { id: "pot", weight: 55 },
      { id: "melonpult", weight: 10 },
      { id: "jalapeno", weight: 12 },
      { id: "cabbagepult", weight: 10 },
      { id: "kernelpult", weight: 5 },
      { id: "iceshroom", weight: 8 },
    ],
  },
};

// 1-1 只有中间一行草皮，1-2 / 1-3 三行，1-4 起铺满。
const rowOverrides = {
  "1-1": [2],
  "1-2": [1, 2, 3],
  "1-3": [1, 2, 3],
};

// 浓雾从第几列开始（0 基）：越往后雾越往里压；4-10 是漆黑的暴风雨夜。
const fogFrom = { "4-1": 5, "4-2": 4, "4-3": 4, "4-4": 4, "4-6": 4, "4-7": 3, "4-8": 3, "4-9": 3 };
const darkLevels = { "4-10": true };

for (let stage = 1; stage <= 5; stage++) {
  for (let sub = 1; sub <= 10; sub++) {
    const id = stage + "-" + sub;
    const index = (stage - 1) * 10 + sub - 1;
    const special = specials[id];
    const waveCount = special ? special.waveCount : waveCounts[index];
    const kind = special ? special.kind : "defend";
    const rows = rowOverrides[id];
    const head = "// " + stageLabel[stage] + " " + id + (special ? "。" + special.title + "。" : "。") + (special ? special.note : "") + "\n";
    const fields = [];
    fields.push("  id: " + JSON.stringify(id) + ",");
    fields.push("  name: " + JSON.stringify("关卡 " + id) + ",");
    fields.push("  waveCount: " + waveCount + ",");
    if (kind !== "defend") fields.push('  kind: "' + kind + '",');
    if (rows) fields.push("  rows: [" + rows.join(", ") + "],");
    if (special && special.terrain) fields.push('  terrain: "' + special.terrain + '",');
    if (fogFrom[id] != null) fields.push("  fogFrom: " + fogFrom[id] + ",");
    if (darkLevels[id]) fields.push("  dark: true,");
    if (special && special.belt) {
      fields.push("  belt: [");
      special.belt.forEach(function (entry) {
        var item = '    { id: "' + entry.id + '", weight: ' + entry.weight + " }";
        if (entry.card || entry.bowl) {
          var extra = [];
          if (entry.card) extra.push('card: "' + entry.card + '"');
          if (entry.bowl) extra.push('bowl: "' + entry.bowl + '"');
          item = '    { id: "' + entry.id + '", ' + extra.join(", ") + ", weight: " + entry.weight + " }";
        }
        fields.push(item + ",");
      });
      fields.push("  ],");
    }
    if (special && special.prePlants) {
      fields.push("  prePlants: [");
      special.prePlants.forEach(function (spot) {
        fields.push("    { col: " + spot.col + ", row: " + spot.row + " },");
      });
      fields.push("  ],");
    }
    var text = fields.join("\n");
    if (text.endsWith(",")) text = text.slice(0, -1);
    const body = "defineLevel({\n" + text + ",\n});\n";
    fs.writeFileSync(path.join(outDir, id + ".js"), head + "\n" + body);
  }
}
console.log("rewrote 50 level files");
