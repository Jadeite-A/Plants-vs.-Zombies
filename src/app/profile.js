/*
 * profile.js — 单个用户的档案（解锁进度、通关记录、钱包、禅境花园）。
 *
 * 一个 Profile 对应存档目录里的一个文件：account/users/<id>.json。
 * 对象只负责数据与规则判断，落盘由 accounts.js 通过 Store 完成。
 *
 * 解锁规则（对照原版冒险模式）：
 *   · 植物：开局只有豌豆射手，每通一关按图鉴顺序（Almanac.plantOrder）
 *     领下一张新卡（Level.reward 提供本关的奖励）；
 *   · 关卡：按冒险流程顺序解锁，上一关没通下一关就是锁着的；
 *   · 二周目（困难）：要打完第一轮全部关卡才开放；
 *   · 测试用一键解锁（unlockAll）：全部植物 + 全部关卡 + 二周目直接开放。
 */
// 金币跟账户走。商店开门之后，打僵尸掉的银币/金币和没用掉的小推车都会进这个钱包。
class Wallet {
  constructor(coins) {
    this.coins = coins || 0;
  }

  add(amount) {
    this.coins += amount;
    return this.coins;
  }

  canAfford(amount) {
    return this.coins >= amount;
  }

  spend(amount) {
    if (!this.canAfford(amount)) return false;
    this.coins -= amount;
    return true;
  }
}

// 禅境花园只存槽位，没有对应画面。
class ZenGarden {
  constructor(plants) {
    this.plants = plants || [];
  }

  place(plantId, slot) {
    this.plants = this.plants.filter(function (item) { return item.slot !== slot; });
    this.plants.push({ plantId: plantId, slot: slot });
  }

  remove(slot) {
    this.plants = this.plants.filter(function (item) { return item.slot !== slot; });
  }
}

class Profile {
  constructor(spec) {
    spec = spec || {};
    this.id = spec.id;
    this.name = spec.name || "园丁";
    this.createdAt = spec.createdAt || Date.now();
    var adventure = spec.adventure || {};
    // 存档只记植物 id。老档里存过就沿用，新档从豌豆射手开始。
    var saved = adventure.unlocked && adventure.unlocked.length ? adventure.unlocked.slice() : ["peashooter"];
    this.adventure = {
      unlocked: saved,
      cleared: adventure.cleared ? adventure.cleared.slice() : [],
    };
    this.wallet = new Wallet(spec.wallet && spec.wallet.coins);
    this.shop = normalizeShop(spec.shop);
    this.zenGarden = new ZenGarden(spec.zenGarden && spec.zenGarden.plants);
    this.modes = spec.modes || { minigame: {}, puzzle: {}, survival: {} };
    // 老档没有商店字段。已经打过 2-4 的，杂货店视为开过门；
    // 打过 4-5 的，玉米卷已经归戴夫，多嘴小蘑菇和猫尾草上架。
    if (!this.shop.open && this.hasCleared("2-4")) this.shop.open = true;
    if (!this.shop.taco && this.hasCleared("4-5")) this.shop.taco = true;
  }

  // 从存档 JSON 还原一个档案；数据残缺时各字段自动落到默认值。
  static fromJSON(spec) {
    try {
      return new Profile(spec || {});
    } catch (err) {
      return new Profile({});
    }
  }

  // 落盘用的纯数据视图。
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      createdAt: this.createdAt,
      adventure: {
        unlocked: this.adventure.unlocked.slice(),
        cleared: this.adventure.cleared.slice(),
      },
      wallet: { coins: this.wallet.coins },
      shop: {
        open: this.shop.open,
        slots: this.shop.slots,
        rake: this.shop.rake,
        poolCleaner: this.shop.poolCleaner,
        roofCleaner: this.shop.roofCleaner,
        taco: this.shop.taco,
        seen: this.shop.seen.slice(),
        offered: this.shop.offered.slice(),
      },
      zenGarden: { plants: this.zenGarden.plants.slice() },
      modes: this.modes,
    };
  }

  // ---------- 植物 ----------

  hasPlant(id) {
    return this.adventure.unlocked.indexOf(id) >= 0;
  }

  unlockPlant(id) {
    if (!id || this.hasPlant(id)) return false;
    this.adventure.unlocked.push(id);
    return true;
  }

  // ---------- 关卡 ----------

  hasCleared(levelId) {
    return this.adventure.cleared.indexOf(levelId) >= 0;
  }

  clearLevel(levelId) {
    if (this.hasCleared(levelId)) return false;
    this.adventure.cleared.push(levelId);
    return true;
  }

  // 按冒险流程顺序解锁：上一关没通，这一关就锁着。
  levelLocked(levelId) {
    var index = Adventure.indexOf(levelId);
    if (index < 0) return true;
    for (var i = 0; i < index; i++) {
      if (this.adventure.cleared.indexOf(Adventure.levels[i].id) < 0) return true;
    }
    return false;
  }

  // 二周目（困难）要打完第一轮全部 50 关才开放。
  round2Open() {
    for (var i = 0; i < Adventure.levels.length; i++) {
      if (this.adventure.cleared.indexOf(Adventure.levels[i].id) < 0) return false;
    }
    return Adventure.levels.length > 0;
  }

  // 测试用：一键解锁全部植物和全部关卡。
  // 卡的顺序跟原版选卡界面一致：按图鉴（SeedType）顺序，不按加载顺序。
  unlockAll() {
    var order = (typeof Almanac !== "undefined" && Almanac.plantOrder) || [];
    this.adventure.unlocked = order.filter(function (id) { return !!PlantCatalog.get(id); });
    if (!this.adventure.unlocked.length) {
      this.adventure.unlocked = PlantCatalog.order.map(function (plant) { return plant.id; });
    }
    this.adventure.cleared = Adventure.levels.map(function (level) { return level.id; });
    this.shop.open = true;
    if (this.wallet.coins < 200000) this.wallet.coins = 200000;
  }
}

// 商店进度只活在这个档案里：换账户就是另一套卡槽、清洁车和戴夫说过的话。
function normalizeShop(raw) {
  raw = raw || {};
  var slots = raw.slots | 0;
  if (slots < 6) slots = 6;
  if (slots > 10) slots = 10;
  return {
    open: !!raw.open,
    slots: slots,
    rake: Math.max(0, raw.rake | 0),
    poolCleaner: !!raw.poolCleaner,
    roofCleaner: !!raw.roofCleaner,
    taco: !!raw.taco,
    seen: stringList(raw.seen),
    offered: stringList(raw.offered),
  };
}

function stringList(value) {
  if (!Array.isArray(value)) return [];
  return value.filter(function (item) { return typeof item === "string"; });
}
