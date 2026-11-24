// 图鉴文案：解析 LawnStrings.txt（原版文本），组织成图鉴页需要的数据。
// 图鉴文案。正文来自 LawnStrings。伤害、护甲、强度用种类里的数字，括号里留原版的评价。
var Almanac = (function () {
  var strings = {};

  var plantOrder = [
    "peashooter", "sunflower", "cherry", "wallnut", "potatomine", "snowpea", "chomper", "repeater",
    "puffshroom", "sunshroom", "fumeshroom", "gravebuster", "hypnoshroom", "scaredyshroom", "iceshroom", "doomshroom",
    "lilypad", "squash", "threepeater", "tanglekelp", "jalapeno", "spikeweed", "torchwood", "tallnut",
    "seashroom", "plantern", "cactus", "blover", "splitpea", "starfruit", "pumpkin", "magnetshroom",
    "cabbagepult", "pot", "kernelpult", "coffee", "garlic", "umbrellaleaf", "marigold", "melonpult",
    "gatlingpea", "twinsunflower", "gloomshroom", "cattail", "wintermelon", "goldmagnet", "spikerock", "cobcannon",
    "imitater",
  ];

  var zombieOrder = [
    "normal", "flag", "cone", "pole", "bucket", "newspaper", "screen", "football",
    "dancer", "backup", "ducky", "snorkel", "zomboni", "bobsled", "dolphin", "jack",
    "balloon", "digger", "pogo", "yeti", "bungee", "ladder", "catapult", "gargantuar",
    "imp", "zomboss",
  ];

  var plantKey = {
    peashooter: "PEASHOOTER", sunflower: "SUNFLOWER", cherry: "CHERRY_BOMB", wallnut: "WALL_NUT",
    potatomine: "POTATO_MINE", snowpea: "SNOW_PEA", chomper: "CHOMPER", repeater: "REPEATER",
    puffshroom: "PUFF_SHROOM", sunshroom: "SUN_SHROOM", fumeshroom: "FUME_SHROOM", gravebuster: "GRAVE_BUSTER",
    hypnoshroom: "HYPNO_SHROOM", scaredyshroom: "SCAREDY_SHROOM", iceshroom: "ICE_SHROOM", doomshroom: "DOOM_SHROOM",
    lilypad: "LILY_PAD", squash: "SQUASH", threepeater: "THREEPEATER", tanglekelp: "TANGLE_KELP",
    jalapeno: "JALAPENO", spikeweed: "SPIKEWEED", torchwood: "TORCHWOOD", tallnut: "TALL_NUT",
    seashroom: "SEA_SHROOM", plantern: "PLANTERN", cactus: "CACTUS", blover: "BLOVER",
    splitpea: "SPLIT_PEA", starfruit: "STARFRUIT", pumpkin: "PUMPKIN", magnetshroom: "MAGNET_SHROOM",
    cabbagepult: "CABBAGE_PULT", pot: "FLOWER_POT", kernelpult: "KERNEL_PULT", coffee: "COFFEE_BEAN",
    garlic: "GARLIC", umbrellaleaf: "UMBRELLA_LEAF", marigold: "MARIGOLD", melonpult: "MELON_PULT",
    gatlingpea: "GATLING_PEA", twinsunflower: "TWIN_SUNFLOWER", gloomshroom: "GLOOM_SHROOM", cattail: "CATTAIL",
    wintermelon: "WINTER_MELON", goldmagnet: "GOLD_MAGNET", cobcannon: "COB_CANNON", imitater: "IMITATER",
    spikerock: "SPIKEROCK",
  };

  var zombieKey = {
    normal: "ZOMBIE", flag: "FLAG_ZOMBIE", cone: "CONEHEAD_ZOMBIE", bucket: "BUCKETHEAD_ZOMBIE",
    pole: "POLE_VAULTING_ZOMBIE", newspaper: "NEWSPAPER_ZOMBIE", screen: "SCREEN_DOOR_ZOMBIE",
    football: "FOOTBALL_ZOMBIE", dancer: "DANCING_ZOMBIE", backup: "BACKUP_DANCER",
    ducky: "DUCKY_TUBE_ZOMBIE", snorkel: "SNORKEL_ZOMBIE", zomboni: "ZOMBONI",
    bobsled: "ZOMBIE_BOBSLED_TEAM", dolphin: "DOLPHIN_RIDER_ZOMBIE", yeti: "ZOMBIE_YETI",
    jack: "JACK_IN_THE_BOX_ZOMBIE", balloon: "BALLOON_ZOMBIE", digger: "DIGGER_ZOMBIE",
    pogo: "POGO_ZOMBIE", bungee: "BUNGEE_ZOMBIE", ladder: "LADDER_ZOMBIE",
    catapult: "CATAPULT_ZOMBIE", gargantuar: "GARGANTUAR", imp: "IMP", zomboss: "BOSS",
  };

  function parse(text) {
    var key = "";
    var buf = [];
    String(text || "").split(/\r?\n/).forEach(function (line) {
      var found = line.match(/^\[([^\]]+)\]$/);
      if (found) {
        if (key) strings[key] = buf.join("\n").trim();
        key = found[1];
        buf = [];
      } else if (key) buf.push(line);
    });
    if (key) strings[key] = buf.join("\n").trim();
  }

  function plain(raw) {
    if (!raw) return "";
    return raw
      .replace(/\r/g, "")
      .replace(/\{SHORTLINE\}/g, "\n")
      .replace(/\{FLAVOR\}/g, "\n")
      .replace(/\{KEYWORD\}/g, "")
      .replace(/\{STAT\}/g, "")
      .replace(/\{METAL\}/g, "")
      .replace(/\{\d+\}/g, "")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  function statLines(block) {
    if (block.indexOf("{STAT}") < 0 && block.indexOf("{NOCTURNAL}") < 0 && block.indexOf("{AQUATIC}") < 0) return null;
    var text = block
      .replace(/\{KEYWORD\}/g, "\n")
      .replace(/\{NOCTURNAL\}/g, "\n")
      .replace(/\{AQUATIC\}/g, "\n")
      .replace(/\{STAT\}/g, "")
      .replace(/\{\d+\}/g, "")
      .replace(/\{[^}]+\}/g, "");
    var lines = [];
    text.split(/\n/).forEach(function (line) {
      line = line.replace(/[ \t]+/g, " ").replace(/：\s+/g, "：").trim();
      if (line) lines.push(line);
    });
    return lines;
  }

  function description(kind, id) {
    var key = (kind === "zombie" ? zombieKey : plantKey)[id];
    if (!key) return "";
    return strings[key + "_DESCRIPTION"] || "";
  }

  function text(kind, id) {
    var key = (kind === "zombie" ? zombieKey : plantKey)[id];
    if (!key) return { header: "", body: "", stats: [] };
    var raw = strings[key + "_DESCRIPTION"] || "";
    var stats = [];
    var flavor = [];
    raw.split(/\{SHORTLINE\}/).forEach(function (block) {
      var parts = block.split("{FLAVOR}");
      var lines = statLines(parts[0]);
      if (lines) lines.forEach(function (line) { stats.push(line); });
      else {
        var rest = plain(parts[0]);
        if (rest) flavor.push(rest);
      }
      if (parts.length > 1) {
        var tail = plain(parts.slice(1).join("\n"));
        if (tail) flavor.push(tail);
      }
    });
    return {
      header: strings[key + "_DESCRIPTION_HEADER"] || "",
      body: flavor.join("\n"),
      stats: stats,
    };
  }

  function rechargeWord(cd) {
    if (cd <= 10) return "短";
    if (cd >= 45) return "非常长";
    return "长";
  }

  function recharge(cd) {
    if (cd == null) return "";
    var num = Math.round(cd * 10) / 10;
    return num + "s（" + rechargeWord(cd) + "）";
  }

  function toughnessWord(hp) {
    if (hp >= 8000) return "很高";
    if (hp >= 4000) return "高";
    if (hp >= 1000) return "中等";
    return "低";
  }

  // 原版样式优先：LawnStrings 文本里自带的数据行（伤害/强度/特点…）原样展示；
  // 只有当文本没有数据行时，才用种类数值拼兜底三行，保证图鉴卡片不空。
  function present(kind, id, info) {
    info = info || {};
    var copy = text(kind, id);
    if (copy.stats.length) {
      return { header: copy.header, body: copy.body, stats: copy.stats };
    }
    var damageLine = "伤害：" + (info.damage || "无");
    var armorLine = "护甲：" + (info.armor || "无");
    var hp = info.hp == null ? "—" : info.hp;
    var toughLine = "强度：" + hp + "（" + toughnessWord(info.hp || 0) + "）";
    return {
      header: copy.header,
      body: copy.body,
      stats: [damageLine, armorLine, toughLine],
    };
  }

  function line(key) {
    return strings[key] || "";
  }

  return {
    parse: parse,
    line: line,
    text: text,
    description: description,
    present: present,
    recharge: recharge,
    rechargeWord: rechargeWord,
    plantOrder: plantOrder,
    zombieOrder: zombieOrder,
  };
})();
