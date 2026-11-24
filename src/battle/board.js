// 一局关卡（棋盘）：持有植物/僵尸/阳光/卡槽，驱动镜头、波次、胜负。
// 一局关卡。植物、僵尸、阳光、小推车都挂在这里，行为仍交给各自的 Rules。
// 进关（intro=true）走选卡镜头：look → pan → choose → leave → fight。
// 重试（intro=false）跳过镜头，直接在草坪上倒计时。
class Board {
  constructor(level, cardIds, intro) {
    this.level = level;
    this.sun = level.startSun;
    this.sunTimer = 1.1;
    this.packets = (cardIds || []).map(function (id) {
      var kind = PlantCatalog.get(id);
      return { id: id, cd: 0, cdMax: kind.cooldown };
    });
    this.plants = [];
    this.zombies = [];
    this.peas = [];
    this.lobs = [];
    this.suns = [];
    this.bits = [];
    this.splats = [];
    this.graves = [];
    this.craters = [];
    this.ice = [];
    this.age = 0;
    this.mowers = [];
    this.rake = null;
    this.coins = 0;
    this.dropCoins = false;
    for (var row = 0; row < Lawn.ROWS; row++) {
      this.mowers.push(new LawnMower(row, level.rows.indexOf(row) >= 0));
    }
    // 保龄球关先摆好的三株豌豆射手（原版 1-5 让玩家铲掉再开打）。
    (level.prePlants || []).forEach(function (spot) {
      var plant = PlantCatalog.create("peashooter", spot.col, spot.row);
      this.plants.push(plant);
    }, this);
    // 原版夜晚草坪（含浓雾泳池）开局立墓碑，最终波会从墓碑里钻出僵尸。
    this.layGraves();
    // 花瓶粉碎者：三批花瓶，砸开有植物也有僵尸。
    this.vases = [];
    this.vaseStage = 0;
    if (level.kind === "vase") this.fillVases();
    // 敲僵尸：墓碑陆续立起，僵尸从墓碑里钻出来，用木槌敲。
    this.whackTimer = level.kind === "whack" ? 6 : 0;
    this.whackQueue = [];
    // 暴风雨夜（4-10）：漆黑一片，隔一阵打一次闪电。
    this.storm = level.dark ? { next: 3, flash: 0 } : null;
    // 僵王博士压阵最终关。
    if (level.kind === "boss") {
      var boss = this.spawnExtra("zomboss", 2, Lawn.LAWN_X + Lawn.COLS * Lawn.COL_W - 30);
      if (boss) boss.massive = true;
    }
    this.spawned = 0;
    this.nextSpawn = 0;
    this.clock = 0;
    this.sunsFallen = 0;
    this.waveIndex = 0;
    this.ambushIn = 0;
    this.waveLeft = level.firstDelay || 18;
    this.waveAge = 0;
    this.waveGap = this.waveLeft;
    this.waveHealthStart = 0;
    this.waveRatio = 0.6;
    this.huge = 0;
    this.nuts = [];
    this.beltTimer = 0;
    this.readyTime = 0;
    this.phase = intro ? "look" : "ready";
    this.viewX = Lawn.VIEW_X;
    this.ui = intro ? 0 : 1;
    this.bankIn = intro ? 0 : 1;
    this.introT = 0;
    this.preview = intro ? this.makePreview() : null;
    this.banner = null;
    this.flagsShown = {};
    this.flash = 0;
    this.wonTime = 0;
    if (!intro) AudioBus.play("readysetplant");
  }

  // 马路右侧的站桩预览，不是正式出怪。先各放一个本关的特殊僵尸，其余补普通僵尸，凑满 10 个。
  makePreview() {
    var seen = {};
    var kinds = [];
    this.level.zombies.forEach(function (spawn) {
      if (!seen[spawn.type]) {
        seen[spawn.type] = true;
        kinds.push(spawn.type);
      }
    });
    var list = kinds.filter(function (type) { return type !== "normal"; });
    while (list.length < 10) list.push("normal");
    var lineup = [];
    for (var i = 0; i < 10; i++) {
      var row = i % 5;
      var lane = i < 5 ? 0 : 1;
      var x = 960 + lane * 120 + (row % 2) * 16;
      var zombie = ZombieCatalog.preview(list[i], row, x);
      if (this.level.kind === "little") zombie.scale = 0.45;
      lineup.push(zombie);
    }
    return lineup;
  }

  // 原版夜晚草坪的墓碑：在给定列里随机立碑，避开已有植物和水面。
  layGraves() {
    var spec = this.level.terrain && this.level.terrain.graves;
    if (!spec || this.level.kind === "vase" || this.level.kind === "whack") return;
    var count = spec.min + Math.floor(Math.random() * (spec.max - spec.min + 1));
    var spots = [];
    spec.cols.forEach(function (col) {
      for (var row = 0; row < Lawn.ROWS; row++) {
        if (this.isWater(row)) return;
        spots.push({ col: col, row: row });
      }
    }, this);
    for (var i = 0; i < count && spots.length; i++) {
      var index = Math.floor(Math.random() * spots.length);
      var spot = spots.splice(index, 1)[0];
      this.graves.push({ col: spot.col, row: spot.row, gone: false, rise: 0, variant: Math.floor(Math.random() * 5) });
    }
  }

  // 花瓶粉碎者（原版 4-5，三批）。绿瓶必出植物，普通瓶有植物也有僵尸。
  fillVases() {
    var rounds = [
      { cols: [6, 7, 8, 9], seeds: [["peashooter", 5], ["squash", 5]], zombies: [["normal", 4], ["bucket", 1]], leaf: 0 },
      { cols: [5, 6, 7, 8, 9], seeds: [["peashooter", 4], ["snowpea", 5], ["squash", 4]], zombies: [["normal", 5], ["bucket", 1], ["football", 1]], leaf: 2 },
      { cols: [4, 5, 6, 7, 8, 9], seeds: [["peashooter", 5], ["snowpea", 5], ["hypnoshroom", 5]], zombies: [["normal", 6], ["bucket", 2], ["dancer", 1], ["jack", 1]], leaf: 3 },
    ];
    var round = rounds[this.vaseStage];
    if (!round) return;
    var spots = [];
    round.cols.forEach(function (col) {
      for (var row = 0; row < Lawn.ROWS; row++) spots.push({ col: col, row: row });
    });
    var board = this;
    function take() {
      var index = Math.floor(Math.random() * spots.length);
      return spots.splice(index, 1)[0];
    }
    var leafLeft = round.leaf;
    function addVase(kind, content) {
      var spot = take();
      if (!spot) return;
      var leaf = kind === "seed" && leafLeft > 0;
      if (leaf) leafLeft--;
      board.vases.push({
        col: spot.col,
        row: spot.row,
        kind: kind,
        plant: kind === "seed" ? content : null,
        zombieType: kind === "zombie" ? content : null,
        leaf: leaf,
        broken: false,
        shake: 0,
      });
    }
    round.seeds.forEach(function (entry) {
      for (var i = 0; i < entry[1]; i++) addVase("seed", entry[0]);
    });
    round.zombies.forEach(function (entry) {
      for (var i = 0; i < entry[1]; i++) addVase("zombie", entry[0]);
    });
    while (spots.length && this.vases.length < 30) {
      // 剩下的空位补绿瓶植物，保证每批都是“瓶多植物也多”。
      addVase("seed", round.seeds[Math.floor(Math.random() * round.seeds.length)][0]);
    }
    this.vaseTotal = this.vases.length;
  }

  // 砸花瓶：绿瓶/植物瓶当场种下植物，僵尸瓶在原地钻出僵尸。
  breakVase(vase) {
    if (vase.broken) return;
    vase.broken = true;
    AudioBus.play("throw", 0.6);
    if (vase.plant) {
      var plant = PlantCatalog.create(vase.plant, vase.col, vase.row);
      plant.justArrived = 0.25;
      this.plants.push(plant);
      AudioBus.play("plant", 0.7);
    } else if (vase.zombieType) {
      var zombie = ZombieCatalog.create(vase.zombieType, vase.row, Lawn.cellLeft(vase.col) + 40);
      zombie.rise = 1.1;
      zombie.fromWave = -1;
      this.zombies.push(zombie);
    }
  }

  // 花瓶和僵尸都清空才进下一批；三批全过才算赢。
  updateVases(dt) {
    var board = this;
    this.vases.forEach(function (vase) {
      if (vase.shake > 0) vase.shake -= dt;
    });
    var left = this.vases.some(function (vase) { return !vase.broken; });
    var enemies = this.zombies.some(function (zombie) { return zombie.alive; });
    if (!left && !enemies) {
      if (this.vaseStage >= 2) {
        this.phase = "won";
        this.wonTime = 0;
        AudioBus.stop();
        AudioBus.jingle(this.level.sounds.win, 0.8);
      } else {
        this.vaseStage++;
        this.vases = [];
        this.fillVases();
        AudioBus.play("winmusic", 0.5);
      }
    }
  }

  // 敲僵尸（原版 2-5）。木槌敲中敲死，僵尸从墓碑里一波波钻出来。
  smashAt(x, y) {
    var best = null;
    this.zombies.forEach(function (zombie) {
      if (!zombie.alive || zombie.rise > 0) return;
      var top = Lawn.groundY(zombie.row) - 190;
      if (x < zombie.x - 14 || x > zombie.x + 62 || y < top || y > Lawn.groundY(zombie.row) + 12) return;
      if (!best || zombie.row >= best.row) best = zombie;
    });
    if (!best) return false;
    if (best.armor > 0) {
      AudioBus.play(best.armorId === "cone" ? "plastichit" : "shieldhit", 0.7);
      best.armor = Math.max(0, best.armor - 900);
      if (best.armor <= 0) {
        best.armorId = "none";
        best.type = best.armorBreakInto || best.kindId;
      }
    } else {
      AudioBus.play("bonk", 0.8);
      this.smashFx = { x: x, y: y, life: 0.4 };
      best.hp = 0;
      best.die(this);
      // 敲死的僵尸掉阳光，攒够阳光才能从石板里买卡。
      this.spawnSun(best.x, Lawn.groundY(best.row) - 60, Lawn.groundY(best.row) - 20, false, false, 25);
    }
    return true;
  }

  // 敲僵尸的出怪：碑先立够五座，每波从碑里钻 1–3 只，最后一波二十只。
  updateWhack(dt) {
    this.whackTimer -= dt;
    if (this.whackQueue.length) {
      var next = this.whackQueue[0];
      next.delay -= dt;
      if (next.delay <= 0) {
        this.whackQueue.shift();
        var zombie = ZombieCatalog.create(next.type, next.row, Lawn.cellLeft(next.col) + 40);
        zombie.rise = 1.1;
        zombie.fromWave = next.wave;
        zombie.final = next.final;
        this.zombies.push(zombie);
        this.spawned++;
      }
      return;
    }
    if (this.whackTimer > 0) return;
    var wave = this.waveIndex;
    var count = this.level.waves ? this.level.waves.length : 8;
    if (wave >= count) return;
    // 碑不够五座就补（ weighted 到越靠右越容易）。
    var spec = this.level.terrain.graves;
    while (this.graves.filter(function (grave) { return !grave.gone; }).length < 5) {
      var col = spec.cols[Math.floor(Math.random() * spec.cols.length)];
      var row = Math.floor(Math.random() * Lawn.ROWS);
      if (this.graves.some(function (grave) { return grave.col === col && grave.row === row && !grave.gone; })) continue;
      this.graves.push({ col: col, row: row, gone: false, rise: 1.0, variant: Math.floor(Math.random() * 5) });
    }
    var phase = Math.min(5, Math.floor((wave) * 6 / 12));
    var doubleChance = [0, 30, 10, 10, 15, 18][phase];
    var tripleChance = [0, 0, 0, 0, 10, 13][phase];
    var pailChance = [0, 0, 0, 10, 15, 15][phase];
    var coneChance = [0, 0, 30, 30, 30, 30][phase];
    var isFinal = wave === count - 1;
    var group = 1;
    var roll = Math.random() * 100;
    if (isFinal) group = 20;
    else if (roll < tripleChance) group = 3;
    else if (roll < tripleChance + doubleChance) group = 2;
    var typeRoll = Math.random() * 100;
    var type = "normal";
    if (typeRoll < pailChance && group < 3) type = "bucket";
    else if (typeRoll < pailChance + coneChance) type = "cone";
    var open = this.graves.filter(function (grave) { return !grave.gone; });
    for (var i = 0; i < group; i++) {
      var grave = open[Math.floor(Math.random() * open.length)];
      if (!grave) break;
      this.whackQueue.push({
        type: type,
        col: grave.col,
        row: grave.row,
        delay: i * 0.9,
        wave: wave,
        final: isFinal,
      });
    }
    this.waveIndex++;
    this.whackTimer = isFinal ? 2 : 14 + Math.random() * 8;
    this.flagsShown[wave] = true;
  }

  startLeaves() {
    this.phase = "leave";
    this.introT = 0;
    this.readyTime = 0;
    this.bankIn = 0;
    AudioBus.play("readysetplant");
  }

  // 传送带、保龄球、花瓶不用阳光种植物，这些关不产阳光。敲僵尸要靠阳光买卡，照常掉。
  spendsSun() {
    var kind = this.level && this.level.kind;
    if (kind === "conveyor" || kind === "bowling" || kind === "vase") return false;
    if (this.level && this.level.belt && kind !== "whack") return false;
    return true;
  }

  spawnSun(x, y, ground, falling, small, value, coin) {
    if (!coin && !this.spendsSun()) return null;
    var sun = new SunDrop(x, y, ground, falling, small, value);
    sun.coin = !!coin;
    this.suns.push(sun);
    return sun;
  }

  spawnSplat(x, y, kind) {
    this.splats.push(new HitSplat(x, y, kind));
  }

  isWater(row) {
    var rows = (this.level.terrain && this.level.terrain.waterRows) || [];
    return rows.indexOf(row + 1) >= 0;
  }

  isRoof() {
    return !!(this.level.terrain && this.level.terrain.ground === "roof");
  }

  // 池塘清洁车、屋顶推车没买之前，对应的行没有小推车。金币从打过 1-10 开始掉。
  applyShop(profile) {
    var shop = (profile && profile.shop) || {};
    var self = this;
    this.dropCoins = !!(profile && (shop.open || profile.hasCleared("1-10")));
    this.mowers.forEach(function (mower) {
      if (mower.state === "none") return;
      if (self.isRoof() && !shop.roofCleaner) mower.state = "none";
      else if (self.isWater(mower.row) && !shop.poolCleaner) mower.state = "none";
    });
  }

  // 钉耙放在房子前面的随机一行。调用方负责扣掉这一关的使用次数。
  placeRake(profile) {
    var shop = profile && profile.shop;
    var kind = this.level.kind;
    if (!shop || shop.rake <= 0) return;
    if (kind === "whack" || kind === "vase" || kind === "bowling") return;
    if (!this.level.rows || !this.level.rows.length) return;
    var rows = this.level.rows;
    this.rake = {
      row: rows[Math.floor(Math.random() * rows.length)],
      x: Lawn.LAWN_X + 70,
      alive: true,
    };
    shop.rake -= 1;
  }

  updateRake() {
    if (!this.rake || !this.rake.alive) return;
    if (this.phase !== "fight" && this.phase !== "ready") return;
    var rake = this.rake;
    for (var i = 0; i < this.zombies.length; i++) {
      var zombie = this.zombies[i];
      if (!zombie.alive || zombie.hypno || zombie.row !== rake.row) continue;
      if (zombie.x < rake.x + 36 && zombie.x > rake.x - 90) {
        zombie.die(this);
        rake.alive = false;
        AudioBus.play("bonk");
        return;
      }
    }
  }

  addCrater(col, row, seconds) {
    this.craters.push({ col: col, row: row, until: this.age + seconds });
  }

  craterAt(col, row) {
    var age = this.age;
    return this.craters.some(function (crater) {
      return crater.col === col && crater.row === row && crater.until > age;
    });
  }

  addIce(row, x) {
    var col = Math.floor((x - Lawn.LAWN_X) / Lawn.COL_W);
    if (col < 0 || col >= Lawn.COLS) return;
    var age = this.age;
    var found = this.ice.some(function (cell) {
      return cell.row === row && cell.col === col && cell.until > age;
    });
    if (!found) this.ice.push({ row: row, col: col, until: this.age + 180 });
  }

  iceAt(row, x) {
    var col = Math.floor((x - Lawn.LAWN_X) / Lawn.COL_W);
    var age = this.age;
    return this.ice.some(function (cell) {
      return cell.row === row && cell.col === col && cell.until > age;
    });
  }

  spawnBit(zombie, kind) {
    this.bits.push(new BodyBit(zombie, kind));
  }

  graveAt(col, row) {
    return this.graves.some(function (grave) {
      return grave.col === col && grave.row === row && !grave.gone;
    });
  }

  plantInFront(zombie) {
    var found = null;
    var rank = { platform: 1, body: 2, shell: 3 };
    this.plants.forEach(function (plant) {
      if (plant.dead || plant.passable || plant.laddered) return;
      if (plant.row !== zombie.row) return;
      var span = plant.span || 1;
      var hit = false;
      for (var c = 0; c < span; c++) {
        var left = Lawn.cellLeft(plant.col + c);
        if (zombie.x < left + Lawn.COL_W - 6 && zombie.x > left + 8) hit = true;
      }
      if (!hit) return;
      var mine = rank[plant.seat] || 2;
      var theirs = found ? (rank[found.seat] || 2) : -1;
      if (!found || mine > theirs || (mine === theirs && plant.col > found.col)) found = plant;
    });
    return found;
  }

  tryPlant(id, col, row) {
    var slot = null;
    var board = this;
    this.packets.some(function (packet) {
      if (packet.id !== id) return false;
      if (packet.free && !board.packetReady(packet)) return false;
      slot = packet;
      return true;
    });
    var kind = PlantCatalog.get(slot && slot.copy ? slot.copy : id);
    var free = !!(slot && slot.free);
    if (!kind || !slot || slot.cd > 0 || (!free && this.sun < kind.cost)) return false;
    if (free && !this.packetReady(slot)) return false;
    if (this.craterAt(col, row)) return false;
    // 墓碑占着格子，不能直接种。
    if (this.graveAt(col, row)) return false;
    // 咖啡豆挂在睡着的植物上：扣阳光、进冷却，不往格子里再塞一株。
    if (kind.mount) {
      var under = null;
      this.plants.forEach(function (plant) {
        if (plant.col === col && plant.row === row) under = plant;
      });
      if (!under || !kind.mount(under)) return false;
      this.spendPacket(slot, free);
      if (kind.onMount) kind.onMount(under, this);
      return true;
    }
    if (kind.canPlace && !kind.canPlace(this, col, row)) return false;
    var here = this.plants.filter(function (plant) {
      return plant.col === col && plant.row === row && !plant.dead;
    });
    if (kind.replaces) {
      var span = kind.span || 1;
      for (var i = 0; i < span; i++) {
        var found = this.plants.some(function (plant) {
          return plant.col === col + i && plant.row === row && plant.id === kind.replaces && !plant.dead;
        });
        if (!found) return false;
      }
      this.plants = this.plants.filter(function (plant) {
        if (plant.row !== row || plant.id !== kind.replaces || plant.dead) return true;
        return plant.col < col || plant.col >= col + span;
      });
    } else if (kind.seat === "platform") {
      if (here.some(function (plant) { return plant.seat === "platform"; })) return false;
      if (kind.aquatic && !this.isWater(row)) return false;
      if (!kind.aquatic && this.isWater(row)) return false;
      if (kind.roofOnly && !this.isRoof()) return false;
    } else if (kind.aquatic) {
      if (!this.isWater(row)) return false;
      if (here.length) return false;
    } else if (kind.seat === "shell") {
      if (here.some(function (plant) { return plant.seat === "shell"; })) return false;
      if (this.isWater(row) && !here.some(function (plant) { return plant.seat === "platform"; })) return false;
      if (this.isRoof() && !kind.noPot && !here.some(function (plant) { return plant.id === "pot"; })) return false;
    } else {
      if (here.some(function (plant) { return !plant.seat || plant.seat === "body"; })) return false;
      if (this.isWater(row) && !here.some(function (plant) { return plant.seat === "platform"; })) return false;
      if (this.isRoof() && !kind.noPot && !here.some(function (plant) { return plant.id === "pot"; })) return false;
    }
    this.spendPacket(slot, free);
    var plant = PlantCatalog.create(slot.copy || id, col, row);
    if (slot.copy) {
      plant.imitated = true;
      plant.disguise = 1.05;
      // 模仿者种下时是“倒放爆炸”的现形声。
      AudioBus.play("reverse_explosion", 0.7);
    }
    // 原版：水面上种植物是涉水声，草地是种下声。
    AudioBus.cue(this.isWater(row) ? "plant_water" : ["plant", "plant2"], 0.7);
    this.plants.push(plant);
    return true;
  }

  spendPacket(slot, free) {
    if (!free) this.sun -= PlantCatalog.get(slot.copy || slot.card || slot.id).cost;
    if (free) {
      var index = this.packets.indexOf(slot);
      if (index >= 0) this.packets.splice(index, 1);
      return;
    }
    slot.cd = slot.cdMax;
  }

  beltTarget(index) {
    return 14 + index * 50;
  }

  // 卡片左缘到过这条线，整张就露出传送带右沿。
  beltShown(slide) {
    return slide + 50 <= 520;
  }

  // 保龄球和传送带一样：卡从右端滑进来，履带往左滚。
  // 开局等待照原版 Challenge::StartLevel / InitLevel：迷你关 2 秒，保龄球先给一颗坚果再等 4 秒，
  // 僵王开场固定四张卡，再等 10 秒。
  armBelt() {
    this.packets = [];
    this.lastBelt = "";
    if (this.level.kind === "boss") {
      var openers = ["cabbagepult", "jalapeno", "cabbagepult", "iceshroom"];
      for (var i = 0; i < openers.length; i++) this.pushBelt({ id: openers[i] });
      this.beltTimer = 10;
      return;
    }
    if (this.level.kind === "bowling") {
      this.pushBelt(this.level.belt[0]);
      this.beltTimer = 4;
      return;
    }
    this.beltTimer = 2;
  }

  pushBelt(entry) {
    if (!entry || this.packets.length >= 10) return false;
    this.packets.push({
      id: entry.id,
      token: entry.id,
      card: entry.card || entry.id,
      bowl: entry.bowl || "",
      free: true,
      cd: 0,
      cdMax: 0,
      slide: 520,
    });
    return true;
  }

  packetReady(packet) {
    if (!packet || this.packets.indexOf(packet) < 0) return false;
    if (packet.slide == null) return true;
    return this.beltShown(packet.slide);
  }

  updateBelt(dt) {
    if (!this.level.belt) return;
    var board = this;
    this.packets.forEach(function (packet, index) {
      var target = board.beltTarget(index);
      if (packet.slide == null) packet.slide = target;
      if (packet.slide > target) packet.slide = Math.max(target, packet.slide - 68 * dt);
    });
    this.beltTimer -= dt;
    if (this.beltTimer > 0) return;
    // 间隔看的是出下一张之前带上已有的张数。带上超过 8/6/4 张就拉到 10/5/4.25 秒，否则 4 秒。僵王再乘 0.875。
    var count = this.packets.length;
    var mul = this.level.kind === "boss" ? 0.875 : 1;
    var gap = count > 8 ? 10 : count > 6 ? 5 : count > 4 ? 4.25 : 4;
    this.beltTimer = gap * mul;
    if (count >= 10) return;
    var pick = this.pickBelt();
    if (!pick) return;
    this.pushBelt(pick);
    this.lastBelt = pick.id;
  }

  // 原版 UpdateConveyorBelt：权重不是纯随机。
  // 带上已有 3 张同种压到 5，4 张压到 1；刚出过的种类权重减半。
  // 荷叶、花盆种得越多权重越低；墓碑不够时不再给咬咬碑。
  // 僵王的投手在空盆少时变少，机甲砸屋顶时花盆权重大涨。
  pickBelt() {
    var board = this;
    var bag = this.level.belt || [];
    var many = bag.length > 2;
    var last = this.lastBelt || "";
    var boss = this.level.kind === "boss";
    var emptyPots = 0;
    var dropping = false;
    if (boss) {
      this.plants.forEach(function (pot) {
        if (pot.dead || pot.id !== "pot") return;
        var taken = board.plants.some(function (plant) {
          return !plant.dead && plant.seat === "body" && plant.col === pot.col && plant.row === pot.row;
        });
        if (!taken) emptyPots++;
      });
      dropping = this.zombies.some(function (zombie) {
        return zombie.alive && zombie.kindId === "zomboss" && zombie.bossDrop;
      });
    }
    function curve(start, end, age, from, to) {
      if (end === start) return from;
      var t = (age - start) / (end - start);
      if (t < 0) t = 0;
      if (t > 1) t = 1;
      return Math.round(from + (to - from) * t);
    }
    var weights = bag.map(function (entry) {
      var id = entry.id;
      var onBelt = 0;
      board.packets.forEach(function (packet) {
        if (packet.id === id) onBelt++;
      });
      var planted = 0;
      board.plants.forEach(function (plant) {
        if (!plant.dead && plant.id === id) planted++;
      });
      var total = onBelt + planted;
      var weight = entry.weight;
      if (id === "gravebuster") {
        var graves = board.graves.filter(function (grave) { return !grave.gone; }).length;
        if (graves <= total) weight = 0;
      } else if (id === "lilypad") {
        weight = curve(0, 18, total, weight, 1);
      } else if (id === "pot") {
        weight = curve(0, 35, total, weight, 1);
      }
      if (boss) {
        if (id === "melonpult" || id === "kernelpult" || id === "cabbagepult") {
          if (emptyPots <= 2) weight = Math.floor(weight / 5);
          else if (emptyPots <= 5) weight = Math.floor(weight / 3);
        }
        if (id === "pot" && dropping) weight = 500;
      }
      if (many) {
        if (onBelt >= 4) weight = 1;
        else if (onBelt >= 3) weight = 5;
        else if (id === last) weight = Math.floor(weight / 2);
      }
      return weight;
    });
    var total = 0;
    weights.forEach(function (weight) { total += weight; });
    if (total <= 0) return null;
    var roll = Math.random() * total;
    for (var i = 0; i < bag.length; i++) {
      roll -= weights[i];
      if (roll <= 0) return bag[i];
    }
    return bag[bag.length - 1];
  }

  roll(row, col, token) {
    if (col == null || col > 2 || !token) return false;
    var index = -1;
    for (var i = 0; i < this.packets.length; i++) {
      if ((this.packets[i].token || this.packets[i].id) === token && this.packetReady(this.packets[i])) {
        index = i;
        break;
      }
    }
    if (index < 0) return false;
    var packet = this.packets[index];
    this.packets.splice(index, 1);
    this.nuts.push(new BowlNut(row, Lawn.cellLeft(col) + 10, packet.bowl === "explode"));
    AudioBus.play("bowling", 0.7);
    return true;
  }

  waveHealth(index) {
    var total = 0;
    this.zombies.forEach(function (zombie) {
      if (!zombie.alive || zombie.fromWave !== index) return;
      total += zombie.hp + (zombie.armor || 0);
    });
    return total;
  }

  updateWaves(dt) {
    if (!this.level.waves || this.waveIndex >= this.level.waves.length) return;
    if (this.huge > 0) {
      this.huge -= dt;
      if (this.huge > 0) return;
      this.releaseWave();
      return;
    }
    if (this.waveIndex > 0 && this.waveLeft > 2 && this.waveAge > 4) {
      var left = this.waveHealth(this.waveIndex - 1);
      if (left <= this.waveHealthStart * this.waveRatio) this.waveLeft = 2;
    }
    this.waveLeft -= dt;
    this.waveAge += dt;
    if (this.waveLeft > 0) return;
    if (this.level.flagWaves[this.waveIndex]) {
      // 原版节奏：大波前 7.5 秒先挂“僵尸大军正在接近！”横幅，0.25 秒后传来巨浪声，
      // 3.5 秒前起音乐爆发；横幅收掉才真正出怪并拉响警报。
      this.huge = 7.5;
      this.flagsShown[this.waveIndex] = true;
      this.banner = { image: "APPROACHING", age: 0, life: 7.5, final: false };
      AudioBus.cue(this.level.sounds.wave);
      AudioBus.burst(0, true);
      return;
    }
    this.releaseWave();
  }

  releaseWave() {
    var index = this.waveIndex;
    var types = this.level.waves[index];
    var finalWave = index === this.level.waves.length - 1;
    var isFlag = !!this.level.flagWaves[index];
    if (finalWave) {
      this.banner = { image: "FinalWave", age: 0, life: 1.7 };
      AudioBus.cue(this.level.sounds.final);
    }
    // 原版：第一波到来时先响一声雾号；之后的旗帜波出怪时拉响警报。
    if (index === 0) AudioBus.play("awooga");
    else if (isFlag) AudioBus.cue(this.level.sounds.siren, 0.45);
    for (var i = 0; i < types.length; i++) {
      this.spawn({
        type: types[i],
        wave: index,
        flag: types[i] === "flag",
        final: finalWave,
      });
    }
    // 原版：最后一波放出 2.1 秒后才添头。前院夜晚从墓碑钻，泳池和浓雾从水里钻，屋顶由飞贼投下。
    if (finalWave && this.hasAmbush()) {
      this.ambushIn = 2.1;
      this.ambushWave = index;
    }
    this.waveHealthStart = this.waveHealth(index);
    this.waveRatio = 0.5 + Math.random() * 0.15;
    this.waveIndex++;
    this.waveAge = 0;
    this.waveGap = 25 + Math.random() * 6;
    this.waveLeft = this.waveGap;
  }

  removePlant(col, row) {
    var rank = { platform: 1, body: 2, shell: 3 };
    var best = null;
    this.plants.forEach(function (plant) {
      if (plant.col !== col || plant.row !== row) return;
      if (!best || (rank[plant.seat] || 2) >= (rank[best.seat] || 2)) best = plant;
    });
    if (!best) return false;
    this.plants = this.plants.filter(function (plant) { return plant !== best; });
    return true;
  }

  update(dt) {
    if (this.phase === "lost") return;
    if (this.updateIntro(dt)) return;
    this.age += dt;
    if (this.ambushIn > 0) {
      this.ambushIn -= dt;
      if (this.ambushIn <= 0) {
        this.ambushIn = 0;
        this.spawnAmbush();
      }
    }
    this.flash = Math.max(0, this.flash - dt * 1.4);
    this.updateBanner(dt);
    this.updatePhase(dt);
    this.updateSkySun(dt);
    if (this.phase === "ready" || this.phase === "fight") this.updateBelt(dt);
    this.packets.forEach(function (packet) {
      packet.cd = Math.max(0, packet.cd - dt);
    });
    this.plants.forEach(function (plant) {
      plant.update(this, dt);
    }, this);
    this.plants = this.plants.filter(function (plant) { return !plant.dead && plant.hp > 0; });
    this.peas.forEach(function (pea) { pea.update(dt, this); }, this);
    this.peas = this.peas.filter(function (pea) {
      return !pea.hit && pea.x > -80 && pea.x < Lawn.W + 80 && pea.y > -80 && pea.y < Lawn.H + 80;
    });
    if (this.nuts) {
      this.nuts.forEach(function (nut) { nut.update(dt, this); }, this);
      this.nuts = this.nuts.filter(function (nut) { return !nut.dead; });
    }
    this.zombies.forEach(function (zombie) { zombie.update(dt, this); }, this);
    this.updateRake();
    this.lobs.forEach(function (lob) { lob.update(dt, this); }, this);
    this.lobs = this.lobs.filter(function (lob) { return !lob.hit; });
    this.mowers.forEach(function (mower) { mower.update(dt, this); }, this);
    this.suns.forEach(function (sun) { sun.update(dt, this); }, this);
    this.suns = this.suns.filter(function (sun) { return !sun.done; });
    this.bits.forEach(function (bit) { bit.update(dt); });
    this.bits = this.bits.filter(function (bit) { return bit.life > 0; });
    this.splats.forEach(function (splat) { splat.update(dt); });
    this.splats = this.splats.filter(function (splat) { return splat.life > 0; });
    this.graves.forEach(function (grave) {
      if (grave.rise > 0) grave.rise = Math.max(0, grave.rise - dt);
    });
    if (this.smashFx) {
      this.smashFx.life -= dt;
      if (this.smashFx.life <= 0) this.smashFx = null;
    }
    if (this.storm) {
      this.storm.flash = Math.max(0, this.storm.flash - dt);
      this.storm.next -= dt;
      if (this.storm.next <= 0) {
        this.storm.flash = 0.55;
        this.storm.next = 5 + Math.random() * 7;
        AudioBus.play("thunder", 0.8);
      }
    }
    this.zombies = this.zombies.filter(function (zombie) {
      if (zombie.swallowed) return false;
      if (zombie.alive) return true;
      var reanim = Assets.reanim("Zombie");
      var anim = reanim && reanim.anims.anim_death;
      var duration = anim ? (anim.end - anim.start + 1) / reanim.fps : 3.2;
      return zombie.animTime < duration;
    });
  }

  updateBanner(dt) {
    if (!this.banner) return;
    this.banner.age += dt;
    this.banner.life -= dt;
    if (this.banner.image === "APPROACHING" && this.banner.life <= 0) {
      if (this.banner.final) {
        this.banner = { image: "FinalWave", age: 0, life: 1.7 };
        AudioBus.cue(this.level.sounds.final);
      } else {
        this.banner = null;
      }
    } else if (this.banner.life <= 0) {
      this.banner = null;
    }
  }

  updatePhase(dt) {
    if (this.phase === "ready") {
      this.readyTime += dt;
      this.updateSpawning(dt);
      if (this.readyTime >= 3) this.phase = "fight";
      return;
    }
    if (this.phase === "fight") {
      this.clock += dt;
      this.updateSpawning(dt);
      var living = this.zombies.some(function (zombie) { return zombie.alive; });
      var cleared = this.waveIndex >= this.level.waves.length && this.huge <= 0 && !this.whackQueue.length;
      if (cleared && !living && !(this.ambushIn > 0)) {
        this.phase = "won";
        this.wonTime = 0;
        AudioBus.stop();
        AudioBus.jingle(this.level.sounds.win, 0.8);
      }
      return;
    }
    if (this.phase === "won") {
      this.wonTime += dt;
    }
  }

  // 每个玩法各自的出怪节奏：敲僵尸走墓碑钻怪，花瓶没有波次，其余走进度条。
  updateSpawning(dt) {
    if (this.level.kind === "vase") {
      this.updateVases(dt);
      return;
    }
    if (this.level.kind === "whack") {
      this.updateWhack(dt);
      return;
    }
    if (this.level.waves) this.updateWaves(dt);
  }

  updateSkySun(dt) {
    if (this.phase !== "fight" && this.phase !== "ready") return;
    this.sunTimer -= dt;
    // 传送带、敲僵尸、花瓶这些玩法不落天降阳光；夜晚和浓雾也不落（原版如此）。
    if (!this.spendsSun() || this.level.kind === "whack" || this.level.kind === "vase") return;
    if (this.level.terrain && this.level.terrain.time === "night") return;
    if (this.sunTimer > 0 || this.phase === "won") return;
    // 原版公式：min(9.5s, 4.25s + 已落阳光数*0.1s) + 0..2.75s，越到后面落得越慢。
    this.sunTimer = Math.min(9.5, this.level.sunEvery + this.sunsFallen * 0.1) + Math.random() * (this.level.sunSpan || 0);
    this.sunsFallen++;
    var rows = this.level.rows;
    var row = rows[Math.floor(Math.random() * rows.length)];
    var x = Lawn.LAWN_X + 36 + Math.random() * (Lawn.COLS * Lawn.COL_W - 72);
    var ground = Lawn.LAWN_Y + row * Lawn.ROW_H + 22 + Math.random() * (Lawn.ROW_H - 36);
    this.spawnSun(x, -40, ground, true);
  }

  hasAmbush() {
    var kind = this.level.kind;
    if (kind === "whack" || kind === "vase" || kind === "bowling") return false;
    var terrain = this.level.terrain || {};
    if (terrain.ground === "roof") return true;
    if (terrain.waterRows && terrain.waterRows.length) return true;
    return !!(terrain.graves);
  }

  // 最后一波的添头种类。有墓碑的夜晚只有普通和路障；泳池、浓雾、屋顶还能出铁桶。
  risingType(graves) {
    var roster = (Waves.roster && Waves.roster[this.level.id]) || ["normal"];
    var bag = [{ id: "normal", w: 4000 }];
    if (roster.indexOf("cone") >= 0) bag.push({ id: "cone", w: 4000 });
    if (!graves && roster.indexOf("bucket") >= 0) bag.push({ id: "bucket", w: 3000 });
    var total = 0;
    bag.forEach(function (item) { total += item.w; });
    var roll = Math.random() * total;
    for (var i = 0; i < bag.length; i++) {
      roll -= bag[i].w;
      if (roll <= 0) return bag[i].id;
    }
    return "normal";
  }

  // 原版 SpawnZombiesFromGraves：屋顶改飞贼空投，泳池和浓雾改从水里钻，其余从每座墓碑钻。
  spawnAmbush() {
    var terrain = this.level.terrain || {};
    if (terrain.ground === "roof") return this.spawnFromSky();
    if (terrain.waterRows && terrain.waterRows.length) return this.spawnFromPool();
    if (this.graves && this.graves.length) return this.spawnFromGraves();
  }

  spawnFromGraves() {
    var board = this;
    var wave = this.ambushWave;
    this.graves.forEach(function (grave) {
      if (grave.gone) return;
      var zombie = ZombieCatalog.create(board.risingType(true), grave.row, Lawn.cellLeft(grave.col) + 16);
      zombie.rise = 1.5;
      zombie.fromWave = wave;
      board.zombies.push(zombie);
    });
    AudioBus.play("gravestone_rumble", 0.7);
  }

  spawnFromPool() {
    var number = this.level.number;
    var count = (number === 21 || number === 22 || number === 31 || number === 32) ? 2 : 3;
    var spots = [];
    var col;
    for (col = 5; col <= 8; col++) {
      spots.push({ col: col, row: 2 });
      spots.push({ col: col, row: 3 });
    }
    for (var i = 0; i < count && spots.length; i++) {
      var spot = spots.splice(Math.floor(Math.random() * spots.length), 1)[0];
      var zombie = ZombieCatalog.create(this.risingType(false), spot.row, Lawn.cellLeft(spot.col) + 24);
      zombie.rise = 0.55;
      zombie.fromWave = this.ambushWave;
      if (zombie.species.tube) zombie.tube = true;
      this.zombies.push(zombie);
    }
    AudioBus.play("zombiesplash", 0.8);
  }

  spawnFromSky() {
    var number = this.level.number;
    var count = (number === 41 || number === 42) ? 2 : 3;
    var spots = [];
    var col;
    var row;
    for (col = 4; col <= 8; col++) {
      for (row = 0; row <= 4; row++) spots.push({ col: col, row: row });
    }
    for (var i = 0; i < count && spots.length; i++) {
      var spot = spots.splice(Math.floor(Math.random() * spots.length), 1)[0];
      var x = Lawn.cellLeft(spot.col) + 28;
      var bungee = ZombieCatalog.create("bungee", spot.row, x);
      bungee.delivery = true;
      bungee.col = spot.col;
      bungee.drop = 0;
      bungee.dropIn = 1;
      bungee.fromWave = this.ambushWave;
      bungee.loot = true;
      var cargo = ZombieCatalog.create(this.risingType(false), spot.row, x - 10);
      cargo.carried = true;
      cargo.fromWave = this.ambushWave;
      bungee.cargo = cargo;
      this.zombies.push(bungee);
      this.zombies.push(cargo);
    }
    AudioBus.cue(["bungee_scream", "bungee_scream2", "bungee_scream3"], 0.7);
  }

  // 进度条上的正式出怪。行在本关草坪里随机，并避开地形禁行。
  // 整图都不能出现的种类（例如屋顶上的矿工）不生成，但仍计入进度，避免波次卡住。
  spawn(spec) {
    var row = this.level.rowFor(spec.type, spec.wave);
    if (row == null) {
      this.spawned++;
      if (spec.flag && !this.flagsShown[spec.wave]) {
        this.flagsShown[spec.wave] = true;
        this.banner = { image: "APPROACHING", age: 0, life: 2.6, final: !!spec.final };
        AudioBus.cue(this.level.sounds.wave);
        AudioBus.cue(this.level.sounds.siren, 0.45);
      }
      return;
    }
    var extra = 0;
    var right = Lawn.LAWN_X + Lawn.COLS * Lawn.COL_W - 8;
    this.zombies.forEach(function (zombie) {
      if (zombie.row === row && zombie.alive && zombie.x > right) extra += 42;
    });
    var jitter = Math.random() * 40;
    var zombie = ZombieCatalog.create(spec.type, row, Lawn.LAWN_X + Lawn.COLS * Lawn.COL_W + 36 + extra + jitter);
    zombie.fromWave = spec.wave;
    // 小僵尸大麻烦：这一关的僵尸都是缩小版。
    if (this.level.kind === "little") zombie.scale = 0.45;
    // 带游泳圈：水路里的普通/路障/铁桶/旗手画上鸭子救生圈。
    if (this.isWater(row) && zombie.species.tube) zombie.tube = true;
    // 蹦极闪电战：所有僵尸都由蹦极僵尸从天上放下来。
    if (this.level.kind === "blitz") {
      zombie.dropIn = 1.1;
      if (spec.flag) this.dropBungees(spec.wave);
    }
    this.zombies.push(zombie);
    this.spawned++;
    if (spec.flag && !this.flagsShown[spec.wave]) {
      this.flagsShown[spec.wave] = true;
      this.banner = { image: "APPROACHING", age: 0, life: 2.6, final: !!spec.final };
      AudioBus.cue(this.level.sounds.wave);
      AudioBus.cue(this.level.sounds.siren, 0.45);
    }
  }

  // 蹦极闪电战的大波固定带五只蹦极僵尸（原版 IsBungeeBlitzLevel）。
  dropBungees(wave) {
    for (var i = 0; i < 5; i++) {
      var row = this.level.rows[Math.floor(Math.random() * this.level.rows.length)];
      var bungee = ZombieCatalog.create("bungee", row, Lawn.LAWN_X + 120 + Math.random() * (Lawn.COLS * Lawn.COL_W - 200));
      bungee.fromWave = wave;
      bungee.blitz = true;
      this.zombies.push(bungee);
    }
  }

  // 舞王、巨人等召唤出来的僵尸。不增加 spawned，进度条不会被它们顶满。
  // 目标行如果是水面禁行或这张图根本没有这种僵尸，就不生成。
  spawnExtra(type, row, x) {
    var known = ZombieCatalog.byId[type];
    var config = known || { id: type, locomotion: "" };
    var rows = Terrains.spawnRows(this.level.terrain, this.level.rows, config);
    if (rows.indexOf(row) < 0) return null;
    var zombie = ZombieCatalog.create(type, row, x);
    this.zombies.push(zombie);
    return zombie;
  }

  // 选卡镜头。readyTime 从点“开始战斗”起算，和镜头回草坪重叠，满 3 秒才开战。
  // 卡槽先滑走，镜头接近草坪时再滑回来，否则开打后无法种植物。
  updateIntro(dt) {
    var road = 600;
    if (this.preview && this.phase !== "fight") {
      this.preview.forEach(function (zombie) { zombie.animTime += dt * 0.6; });
    }
    if (this.phase === "look") {
      this.introT += dt;
      if (this.introT >= 0.5) {
        this.phase = "pan";
        this.introT = 0;
      }
      return true;
    }
    if (this.phase === "pan") {
      this.introT += dt;
      var pan = Math.min(1, this.introT / 1.7);
      var t = pan < 0.5 ? 2 * pan * pan : 1 - Math.pow(-2 * pan + 2, 2) / 2;
      this.viewX = Lawn.VIEW_X + (road - Lawn.VIEW_X) * t;
      if (pan >= 1) {
        this.phase = "choose";
        this.introT = 0;
        this.viewX = road;
        this.ui = 0;
      }
      return true;
    }
    if (this.phase === "choose") {
      this.ui = Math.min(1, this.ui + dt / 0.42);
      return true;
    }
    if (this.phase === "leave") {
      this.readyTime += dt;
      this.introT += dt;
      if (this.ui > 0) this.ui = Math.max(0, this.ui - dt / 0.2);
      var back = Math.min(1, this.introT / 0.5);
      this.viewX = road + (Lawn.VIEW_X - road) * back * back;
      if (this.ui <= 0 && this.viewX < Lawn.VIEW_X + 120) {
        this.bankIn = Math.min(1, this.bankIn + dt / 0.26);
      }
      if (this.readyTime >= 3 && back >= 1) {
        this.phase = "fight";
        this.viewX = Lawn.VIEW_X;
        this.bankIn = 1;
        this.ui = 0;
        this.preview = null;
      }
      return true;
    }
    return false;
  }
}
