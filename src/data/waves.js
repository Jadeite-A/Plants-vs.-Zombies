// 出怪表生成：逐条对照原版反编译代码（Board::PickZombieWaves / PickZombieType /
// ZombieDefinition），把每关每波的具体僵尸算出来。
//
// 原版规则：
//   · 波数 gZombieWaves[50]：第一轮按原表；二周目不满 10 波的变 20 波，其余 +10，
//     但传送带（x-10）、敲僵尸（2-5）、花瓶（4-5）、蹦极闪电战（5-5）、僵王（5-10）不变。
//   · 点数：第一轮 aWave/3 + 1；二周目 aWave*2/5 + 1。旗帜波先放 min(点数,8) 只
//     普通僵尸再 ×2.5；保龄球/小僵尸 ×4、蹦极闪电战 ×2、僵王 ×3。
//   · 僵尸定义（点数/登场关/最早波/权重）照抄 ZombieDefinition。
//   · 每关能出哪些僵尸照抄 exe 里的 50 份出怪名单（mZombieAllowed）。
//   · 新登场的僵尸在半程波和最终波必出（矿工/气球在第 7 波）；最终波把本关
//     名单里的每种僵尸各补一只（二周目 4-10 半程加雪人）。
var Waves = (function () {
  // value=点数 starts=登场关(全局序号) first=最早波 weight=权重（0 为不出现在随机池）
  var book = {
    normal: { id: "normal", value: 1, starts: 1, first: 1, weight: 4000 },
    flag: { id: "flag", value: 1, starts: 1, first: 1, weight: 0 },
    cone: { id: "cone", value: 2, starts: 3, first: 1, weight: 4000 },
    pole: { id: "pole", value: 2, starts: 6, first: 5, weight: 2000 },
    bucket: { id: "bucket", value: 4, starts: 8, first: 1, weight: 3000 },
    newspaper: { id: "newspaper", value: 2, starts: 11, first: 1, weight: 1000 },
    screen: { id: "screen", value: 4, starts: 13, first: 5, weight: 3500 },
    football: { id: "football", value: 7, starts: 16, first: 5, weight: 2000 },
    dancer: { id: "dancer", value: 5, starts: 18, first: 5, weight: 1000 },
    backup: { id: "backup", value: 1, starts: 18, first: 1, weight: 0 },
    ducky: { id: "ducky", value: 1, starts: 21, first: 5, weight: 0 },
    snorkel: { id: "snorkel", value: 3, starts: 23, first: 10, weight: 2000 },
    zamboni: { id: "zamboni", value: 7, starts: 26, first: 10, weight: 2000 },
    bobsled: { id: "bobsled", value: 3, starts: 26, first: 10, weight: 2000 },
    dolphin: { id: "dolphin", value: 3, starts: 28, first: 10, weight: 1500 },
    jack: { id: "jack", value: 3, starts: 31, first: 10, weight: 1000 },
    balloon: { id: "balloon", value: 2, starts: 33, first: 10, weight: 2000 },
    digger: { id: "digger", value: 4, starts: 36, first: 10, weight: 1000 },
    pogo: { id: "pogo", value: 4, starts: 38, first: 10, weight: 1000 },
    yeti: { id: "yeti", value: 4, starts: 40, first: 1, weight: 1 },
    bungee: { id: "bungee", value: 3, starts: 41, first: 10, weight: 1000 },
    ladder: { id: "ladder", value: 4, starts: 43, first: 10, weight: 1000 },
    catapult: { id: "catapult", value: 5, starts: 46, first: 10, weight: 1500 },
    gargantuar: { id: "gargantuar", value: 10, starts: 48, first: 15, weight: 1500 },
    imp: { id: "imp", value: 10, starts: 48, first: 1, weight: 0 },
    zomboss: { id: "zomboss", value: 10, starts: 50, first: 1, weight: 0 },
  };

  // exe 里 50 份出怪名单（1=会出现）。旗手只在旗帜波出，鸭子圈由水路规则另算。
  var names = [
    "1-1 normal", "1-2 normal", "1-3 normal cone", "1-4 normal cone", "1-5 normal cone",
    "1-6 normal cone pole", "1-7 normal cone pole", "1-8 normal cone bucket",
    "1-9 normal cone pole bucket", "1-10 normal cone pole bucket",
    "2-1 normal newspaper", "2-2 normal cone bucket newspaper", "2-3 normal cone screen",
    "2-4 normal cone pole screen", "2-5 normal cone bucket", "2-6 normal cone football",
    "2-7 normal cone screen football", "2-8 normal cone dancer", "2-9 normal cone screen dancer",
    "2-10 normal cone screen football dancer",
    "3-1 normal cone", "3-2 normal cone bucket newspaper football", "3-3 normal cone snorkel",
    "3-4 normal cone pole bucket newspaper snorkel", "3-5 normal cone football snorkel",
    "3-6 normal cone zamboni bobsled", "3-7 normal cone bucket snorkel zamboni bobsled",
    "3-8 normal cone dolphin", "3-9 normal cone pole bucket zamboni bobsled dolphin",
    "3-10 normal cone bucket snorkel zamboni bobsled dolphin",
    "4-1 normal cone jack", "4-2 normal cone football jack", "4-3 normal cone balloon",
    "4-4 normal cone dolphin balloon", "4-5 normal cone", "4-6 normal cone digger",
    "4-7 normal cone bucket jack digger", "4-8 normal cone pogo",
    "4-9 normal cone bucket balloon pogo", "4-10 normal cone bucket jack balloon digger pogo",
    "5-1 normal cone bungee", "5-2 normal cone pole bucket bungee", "5-3 normal cone ladder",
    "5-4 normal cone football pogo ladder catapult", "5-5 normal cone bucket ladder",
    "5-6 normal cone catapult", "5-7 normal cone bungee ladder catapult",
    "5-8 normal cone gargantuar", "5-9 normal cone bucket jack bungee ladder catapult gargantuar",
    "5-10 normal cone bucket jack bungee ladder catapult gargantuar",
  ];
  var roster = {};
  names.forEach(function (line) {
    var parts = line.split(" ");
    roster[parts[0]] = parts.slice(1);
  });

  // 保龄球和敲僵尸只砸这些；二周目 4-10 才有雪人。
  var bowlingPool = ["normal", "cone"];
  var keepLength = { "1-10": 1, "2-5": 1, "2-10": 1, "3-10": 1, "4-5": 1, "5-10": 1 };

  function allowed(level) {
    if (level.kind === "bowling") return bowlingPool.slice();
    return (roster[level.id] || ["normal"]).slice();
  }

  // 新登场僵尸：这关名单里新出现（前一关没有）的种类。雪人不算登场僵尸。
  function debut(level) {
    var list = allowed(level);
    var number = level.number;
    if (number <= 1) return null;
    var previous = roster[levelId(number - 1)] || [];
    for (var i = 0; i < list.length; i++) {
      if (list[i] !== "normal" && previous.indexOf(list[i]) < 0) return list[i];
    }
    return null;
  }

  function levelId(number) {
    var stage = Math.floor((number - 1) / 10) + 1;
    var sub = number - (stage - 1) * 10;
    return stage + "-" + sub;
  }

  function roundCount(base, round, level) {
    if (round === 1) return base;
    if (keepLength[level.id]) return base;
    return base < 10 ? 20 : base + 10;
  }

  // GetNumWavesPerFlag：第一轮不满 10 波的关，整关只有最后一面旗；否则每 10 波一面。
  // 1-1 特殊：第一轮没有任何旗帜波。
  function flagWave(index, count, round, number) {
    if (round === 1 && number === 1) return false;
    var per = round === 1 && count < 10 ? count : 10;
    return index % per === per - 1;
  }

  function pick(points, waveNumber, pool) {
    var bag = [];
    var total = 0;
    pool.forEach(function (id) {
      var def = book[id];
      if (waveNumber < def.first || points < def.value) return;
      bag.push(def);
      total += def.weight;
    });
    if (!bag.length) return null;
    var roll = Math.random() * total;
    for (var i = 0; i < bag.length; i++) {
      roll -= bag[i].weight;
      if (roll <= 0) return bag[i].id;
    }
    return bag[bag.length - 1].id;
  }

  function build(level) {
    var number = level.number;
    var round = level.round == null ? 1 : level.round;
    var count = roundCount(level.waveCount, round, level);
    var pool = allowed(level);
    var introduced = debut(level);
    var kind = level.kind;
    var waves = [];
    var flags = [];
    for (var wave = 0; wave < count; wave++) {
      var list = [];
      // 点数公式（Board::PickZombieWaves）：第一轮 aWave/3+1，二周目 aWave*2/5+1。
      var points = round !== 1 ? Math.floor(wave * 2 / 5) + 1 : Math.floor(wave / 3) + 1;
      var flag = flagWave(wave, count, round, number);
      flags.push(flag);
      if (flag) {
        var plains = Math.min(points, 8);
        points = Math.floor(points * 2.5);
        for (var n = 0; n < plains; n++) {
          list.push("normal");
          points -= 1;
        }
        list.push("flag");
        points -= 1;
      }
      if (kind === "bowling" || kind === "little") points *= 4;
      else if (kind === "blitz") points *= 2;
      else if (kind === "boss") points *= 3;
      var finalWave = wave === count - 1;
      // 新登场僵尸必出：半程波和最终波（矿工/气球固定第 7 波）。
      if (introduced) {
        var introWave = introduced === "digger" || introduced === "balloon" ? 6 : Math.floor(count / 2);
        if (wave === introWave || finalWave) {
          list.push(introduced);
          points -= book[introduced].value;
        }
      }
      if (kind === "boss" && finalWave) list.push("gargantuar");
      // 最终波把本关名单里的每种僵尸各补一只（雪人除外）。
      if (finalWave) {
        pool.forEach(function (id) {
          if (id === "yeti" || list.indexOf(id) >= 0) return;
          list.push(id);
          points -= book[id].value;
        });
      }
      // 二周目 4-10：半程波钻出雪人僵尸。
      if (round !== 1 && level.id === "4-10" && wave === Math.floor(count / 2)) list.push("yeti");
      var guard = 0;
      while (points > 0 && list.length < 50 && guard < 80) {
        var id = pick(points, wave + 1, pool);
        if (!id) break;
        list.push(id);
        points -= book[id].value;
        guard++;
      }
      waves.push(list);
    }
    var flat = [];
    waves.forEach(function (list, index) {
      list.forEach(function (type) {
        flat.push({
          type: type,
          wave: index,
          flag: type === "flag",
          final: index === count - 1,
        });
      });
    });
    var firstDelay = level.firstDelay;
    if (firstDelay == null) {
      if (kind === "bowling") firstDelay = 2;
      else if (round === 1 && number === 2) firstDelay = 50;
      else firstDelay = 18;
    }
    return { waves: waves, flagWaves: flags, zombies: flat, firstDelay: firstDelay, waveCount: count };
  }

  return { build: build, roster: roster };
})();
