// 应用流程状态机：主菜单、存档、选关、选卡、暂停、胜负的界面流转。
// 会话和界面流程：主菜单、存档、选关、选卡、暂停、胜负。棋盘里的战斗不写在这里。
var Game = (function () {
  var state = {
    screen: "loading",
    load: 0,
    ready: false,
    almanacPage: "index",
    almanacPlant: "peashooter",
    almanacZombie: "normal",
    time: 0,
    progress: null,
    accountName: "",
    accountId: "",
    // 用户对话框（你是谁 / 新用户）。mode: list 用户列表；new 创建；rename 改名。
    acct: { mode: "list", value: "", selected: null },
    hover: null,
    pointer: { x: 0, y: 0 },
    soonMode: "",
    level: null,
    round: 1,
    davePicks: [],
    chosen: [],
    imitate: null,
    imitateOpen: false,
    tipId: null,
    selected: null,
    award: null,
    paused: false,
    seedConfirm: null,
    board: null,
  };

  function bindAccount() {
    var profile = Accounts.current();
    // progress 是原始数据（{unlocked, cleared}），给界面直读；
    // 需要判定方法（levelLocked / round2Open…）时用 state.profile。
    state.progress = profile.adventure;
    state.profile = profile;
    state.accountName = profile.name;
    state.accountId = profile.id;
  }

  function boot() {
    bindAccount();
    var strings = fetch("assets/properties/LawnStrings.txt")
      .then(function (res) { return res.ok ? res.arrayBuffer() : null; })
      .then(function (buf) {
        if (!buf) return;
        var bytes = new Uint8Array(buf);
        var utf16 = bytes.length >= 2 && bytes[0] === 0xFF && bytes[1] === 0xFE;
        var text = new TextDecoder(utf16 ? "utf-16le" : "utf-8").decode(buf);
        if (text) Almanac.parse(text);
      })
      .catch(function () {});
    state.load = 0;
    state.loadDone = false;
    state.barCur = 0;        // 草皮已铺宽度（0..314，原版 mCurBarWidth）
    state.barStart = 0;      // 开始追进度条时的资源进度基点（原版 mBarStartProgress）
    state.titleCounter = null; // 加载画面的入场计数器（logo 下落 + 吊牌滑入，秒）
    state.splashT = 0;       // 开场 PopCap 标志的计时（淡入 + 停留 + 淡出）
    state.effects = [];      // 草皮上的小苗 / 满格探头（{kind,x,y,sx,sy,t}）
    state.grassLaid = false; // 草皮铺满（原版 mCurBarWidth >= mTotalBarWidth）
    // 加载一开始就放主菜单曲（和原版一致：加载与主菜单同一首，连续不断）。
    // Electron 关掉了自动播放限制，这里可以直接响。
    AudioBus.music("title");
    Promise.all([
      Assets.load(function (progress) {
        state.load = progress;
      }),
      strings,
    ]).then(function () {
      state.load = 1;
      state.loadDone = true;
      // 开发直达：URL 带 #goto=almanac 等时，加载完直接跳到目标界面（配合截图工具用）。
      // goto=play-2-1 这类写法直接开打对应关卡（无头校准战斗/选卡界面用）。
      var match = String(location.hash || "").match(/goto=([a-z0-9-]+)/);
      if (match && match[1].indexOf("play-") === 0) {
        state.barCur = 314;
        state.grassLaid = true;
        state.ready = true;
        var id = match[1].slice(5);
        var level = Adventure.prepare(id, 1);
        if (level) {
          openLevel(level);
          // 无头校准：自动选满卡开打（写死在开发直达里，正常进关不受影响）。
          state.autoFight = true;
          return;
        }
      }
      var gotoId = match && match[1];
      var gotoStore = gotoId === "store" || gotoId === "store-2";
      if (match && (screens.indexOf(gotoId) >= 0 || gotoStore)) {
        state.barCur = 314;
        state.grassLaid = true;
        state.ready = true;
        state.screen = gotoId.indexOf("almanac") === 0 ? "almanac" : (gotoStore ? "store" : gotoId);
        if (gotoId.indexOf("almanac-") === 0) state.almanacPage = gotoId.slice(8);
        var plantPick = String(location.hash || "").match(/plant=([a-z0-9]+)/);
        var zombiePick = String(location.hash || "").match(/zombie=([a-z0-9]+)/);
        if (plantPick) state.almanacPlant = plantPick[1];
        if (zombiePick) state.almanacZombie = zombiePick[1];
        if (gotoStore) {
          var shopper = Accounts.current();
          if (shopper) shopper.shop.open = true;
          state.store = newStore(gotoId === "store-2" ? 1 : 0);
        }
        AudioBus.music(gotoId.indexOf("almanac") === 0 ? "zen" : "title");
      }
    });
  }

  // 允许直达的界面名单（仅菜单家族；almanac-plants / almanac-zombies 直达图鉴分页）。
  var screens = ["menu", "almanac", "almanac-plants", "almanac-zombies", "rounds", "levels", "help", "accounts", "store"];

  /*
   * 加载进度条（画在 canvas 上，绘制见 view-menu.js 的 screens.loading）。
   * 全部参数照抄原版 TitleScreen.cpp：
   *   · 总宽 314px；草皮只在 240..240+宽度 的裁剪窗里静态露出（不做纹理滚动）；
   *   · 草卷只剩绿螺旋端面（SodRollCap），随进度边滚边缩小（1→0.5 倍）；
   *   · 四朵花和僵尸头的视觉中心把 314px 草皮切成 6 等份，草皮铺到那一格才冒出来；
   *     第 2、4 株水平翻转，第 3 株放大 1.1/1.3。茎根落在草叶区的中线，花从那里长出来；
   *     僵尸头的下巴埋进草皮。每株配一声 loadingbar_flower，头再加一声 loadingbar_zombie；
   *   · 资源没读完草皮最多铺到 99%，读完立刻冲满并显示"点击开始！"。
   */
  var BAR_TOTAL = 314;
  var GRASS_LEFT = 239;
  var GRASS_TOP = 512;
  // 最后一帧、按贴图中心绘制时的视觉中心（相对关键帧原点）。镜像花的中心要取反。
  var SPROUT_CX = 2.5;
  var HEAD_CX = -17.5;
  var HEAD_CHIN = 8.5; // 脸的底端。再往下 16px，下巴埋进草皮，头不会悬空
  var STEM_BASE = 12;  // 绿茎底端，相对花的原点
  var STEM_ROOT = 518; // 草皮贴图 0..12px 是草叶，中线在 512+6
  function grassSixth(k) { return GRASS_LEFT + BAR_TOTAL * k / 6; }
  var TRIGGERS = [1, 2, 3, 4, 5].map(function (k) { return grassSixth(k) - 240; });
  var EFFECT_SPECS = [
    { x: grassSixth(1) - SPROUT_CX, y: STEM_ROOT - STEM_BASE, sx: 1, sy: 1 },
    { x: grassSixth(2) + SPROUT_CX, y: STEM_ROOT - STEM_BASE, sx: -1, sy: 1 },
    { x: grassSixth(3) - SPROUT_CX * 1.1, y: STEM_ROOT - STEM_BASE * 1.3, sx: 1.1, sy: 1.3 },
    { x: grassSixth(4) + SPROUT_CX, y: STEM_ROOT - STEM_BASE, sx: -1, sy: 1 },
    { x: grassSixth(5) - HEAD_CX, y: GRASS_TOP + 16 - HEAD_CHIN, sx: 1, sy: 1 },
  ];

  function spawnLoadingEffect(index) {
    var spec = EFFECT_SPECS[index];
    state.effects.push({
      kind: index === 4 ? "head" : "sprout",
      x: spec.x,
      y: spec.y,
      sx: spec.sx,
      sy: spec.sy,
      t: 0,
    });
    AudioBus.play("loadingbar_flower", 0.5);
    if (index === 4) AudioBus.play("loadingbar_zombie", 0.6);
  }

  function rollGrass(dt) {
    // 开场 PopCap 标志：淡入 0.5s + 停留 1.0s + 淡出 0.5s（总 2.0s，对照原版）。
    if ((state.splashT || 0) < 2.0) {
      state.splashT = (state.splashT || 0) + dt;
      return;
    }
    // splash 结束 → 进入加载画面：先播 1 秒的入场（logo 下落、吊牌滑入）。
    if (state.titleCounter == null) state.titleCounter = 1.0;
    if (state.titleCounter > 0) {
      state.titleCounter = Math.max(0, state.titleCounter - dt);
      return;
    }
    // 效果（小苗/僵尸头）的生长动画一直推进。
    state.effects.forEach(function (item) {
      item.t += dt;
    });
    if (state.grassLaid) return;
    var prev = state.barCur;
    // 目标宽度：资源没读完最多 99%；读完冲满。
    var frac = state.loadDone ? 1 : Math.max(0, (state.load - state.barStart) / (1 - state.barStart));
    var target = state.loadDone ? BAR_TOTAL : Math.min(BAR_TOTAL * 0.99, BAR_TOTAL * frac);
    var diff = target - prev;
    if (diff > 0) {
      // 速度限制对照原版：最快 200px/s、最慢 20px/s（0.2~2 px/tick × 100Hz）。
      var speed = Math.max(20, Math.min(200, Math.abs(diff) * 2 + 20));
      state.barCur = Math.min(target, prev + speed * dt);
    }
    // 越过刻度 → 冒苗/探头 + 提示音。
    TRIGGERS.forEach(function (mark, index) {
      if (prev < mark && state.barCur >= mark) spawnLoadingEffect(index);
    });
    if (state.loadDone && state.barCur >= BAR_TOTAL) {
      state.barCur = BAR_TOTAL;
      state.grassLaid = true;
      state.ready = true;
    }
  }

  // 资源到齐后仍停在海报上，点一下才进主菜单，避免一打开就是黑屏。
  function startFromBoot() {
    if (!state.ready || state.screen !== "loading") return;
    state.screen = "menu";
    View.tickMenu(0);
    AudioBus.music("title");
    AudioBus.play("buttonclick");
    maybeShopIntro("menu");
  }

  function setPaused(value) {
    if (state.paused === value) return;
    state.paused = value;
    if (state.screen === "play") AudioBus.musicPause(value);
  }

  // 从选关进来会播完整的镜头和选卡。卡组先空着，点“开始战斗”才写进卡槽。
  // 原版选卡阶段放 Choose Your Seeds，点开始才切到本关曲子。
  // 二周目（困难）戴夫按关卡序号替你锁三张卡，锁在卡槽最前面，不能取消。
  // 传送带/保龄球/敲僵尸/花瓶这些特殊关卡没有选卡阶段（原版如此），
  // 敲僵尸的卡组固定是咬咬碑和樱桃炸弹。
  // 卡槽上限记在当前账户的 shop.slots 上，开局 6 格，商店买到 10 格。
  function directKind(level) {
    return !!level.belt || level.kind === "whack" || level.kind === "vase";
  }

  function slotCap() {
    var shop = state.profile && state.profile.shop;
    return shop && shop.slots ? shop.slots : 6;
  }

  function playVoice(line, index) {
    if (!line) return;
    if (line.scream) AudioBus.play("crazydavescream");
    else if ((line.text || "").length > 28) AudioBus.play("crazydavelong" + ((index % 3) + 1));
    else AudioBus.play("crazydaveshort" + ((index % 3) + 1));
  }

  function presentBeat(beat) {
    beat.index = 0;
    beat.asking = !!(beat.offer && beat.lines && beat.lines.length <= 1);
    state.dave = beat;
    state.screen = "dave";
    playVoice(beat.lines && beat.lines[0], 0);
  }

  function maybeShopIntro(then) {
    if (String(location.hash || "").indexOf("goto=") >= 0) return false;
    var profile = Accounts.current();
    if (!profile || !profile.shop.open) return false;
    if (profile.shop.seen.indexOf("shop-open") >= 0) return false;
    state.daveQueue = [];
    state.daveThen = then || "menu";
    presentBeat(Shop.shopIntro(Accounts.current()));
    return true;
  }

  function finishBeat(bought) {
    var beat = state.dave;
    var profile = Accounts.current();
    var fresh = false;
    if (beat && profile) {
      if (beat.remember !== false && beat.id) {
        var bag = beat.remember === "offered" ? profile.shop.offered : profile.shop.seen;
        if (bag.indexOf(beat.id) < 0) {
          bag.push(beat.id);
          fresh = true;
        }
      }
      if (bought && beat.offer && Shop.buy(profile, beat.offer)) AudioBus.play("prize");
      else if (beat.offer && !bought) AudioBus.play("crazydaveshort2");
      if (fresh && beat.grant) profile.wallet.add(beat.grant);
      if (fresh && beat.taco) {
        profile.shop.taco = true;
        profile.shop.open = true;
      }
      Accounts.save();
      bindAccount();
    }
    var next = state.daveQueue && state.daveQueue.shift();
    var then = state.daveThen;
    if (next) {
      presentBeat(next);
      return;
    }
    state.dave = null;
    state.daveQueue = null;
    if (then === "play") beginLevel(true);
    else state.screen = then || "menu";
  }

  function handleDave(action) {
    var dave = state.dave;
    if (!dave) {
      state.screen = state.daveThen || "menu";
      return;
    }
    if (!action) return;
    if (dave.asking) {
      if (action.id === "dave-yes") finishBeat(true);
      else if (action.id === "dave-no") finishBeat(false);
      return;
    }
    if (action.id !== "dave-next") return;
    if (dave.index < dave.lines.length - 1) {
      dave.index++;
      playVoice(dave.lines[dave.index], dave.index);
      if (dave.offer && dave.index === dave.lines.length - 1) dave.asking = true;
      return;
    }
    if (dave.offer) {
      dave.asking = true;
      return;
    }
    finishBeat(false);
  }

  function openStore() {
    var profile = Accounts.current();
    if (!profile.shop.open) {
      AudioBus.play("buzzer");
      state.daveQueue = [];
      state.daveThen = "menu";
      presentBeat({
        id: "store-locked",
        remember: false,
        lines: [{ text: "你还没找到我的车钥匙，杂货店没开门。", scream: false }],
      });
      return;
    }
    state.store = newStore(0);
    state.screen = "store";
    AudioBus.play("buttonclick");
  }

  function newStore(page) {
    return {
      page: page || 0,
      confirm: null,
      age: 0,
      hatch: 0,
      shake: 0,
      bubble: "",
      bubbleT: 0,
      talkId: "",
      talkAnim: "",
      talkT: 0,
      ambientT: 2,
    };
  }

  // 原版按字数选戴夫的说话动作，12 帧/秒播一遍就回到左右摇摆的待机。
  function beginStoreTalk(store, id, line) {
    var text = (line && line.text) || "";
    var count = text.length;
    var anim = "anim_mediumtalk";
    if (line && line.scream) anim = "anim_smalltalk";
    else if (count < 23) anim = "anim_smalltalk";
    else if (count >= 52) anim = "anim_blahblah";
    store.talkId = id;
    store.bubble = text;
    store.bubbleT = id === "ambient" ? 8 : 1;
    store.talkAnim = anim;
    store.talkT = 0;
    if (line && line.noSound) return;
    if (line && line.scream) AudioBus.play("crazydavescream");
    else if (count < 23) AudioBus.play("crazydaveshort1");
    else if (count < 52) AudioBus.play("crazydavelong1");
    else AudioBus.play("crazydaveextralong1");
  }

  function clearStoreTalk(store) {
    store.bubble = "";
    store.bubbleT = 0;
    store.talkId = "";
    store.talkAnim = "";
  }

  function updateStore(dt) {
    var store = state.store;
    if (!store) return;
    store.age = (store.age || 0) + dt;
    if (store.hatch > 0) {
      store.hatch -= dt;
      if (store.hatch > 0.35) store.shake = 1 + Math.floor(Math.random() * 3);
      else store.shake = 0;
      if (store.hatch <= 0) {
        store.hatch = 0;
        store.shake = 0;
      }
      return;
    }
    if (store.talkAnim) {
      store.talkT = (store.talkT || 0) + dt;
      var reanim = Assets.reanim("CrazyDave");
      var anim = reanim && reanim.anims[store.talkAnim];
      var length = anim ? anim.end - anim.start + 1 : 1;
      if (store.talkT * 12 >= length) store.talkAnim = "";
    }
    var hover = state.hover || "";
    var itemId = hover.indexOf("goods:") === 0 ? hover.slice(6) : "";
    if (store.age < 1.2 || store.confirm) itemId = "";
    if (itemId) {
      if (store.talkId !== itemId) {
        var item = Shop.find(Accounts.current(), itemId);
        var line = item && item.key ? Shop.say(item.key, Accounts.current()) : null;
        beginStoreTalk(store, itemId, { text: item ? item.blurb : "", scream: line && line.scream, noSound: !line || line.noSound });
      } else store.bubbleT = 1;
    } else if (store.bubbleT > 0) {
      store.bubbleT -= dt;
      if (store.bubbleT <= 0) clearStoreTalk(store);
    } else {
      store.ambientT = (store.ambientT == null ? 2 : store.ambientT) - dt;
      if (store.ambientT <= 0) {
        var keys = ["CRAZY_DAVE_2015", "CRAZY_DAVE_2016", "CRAZY_DAVE_2017"];
        var profile = Accounts.current();
        if (profile && profile.round2Open && profile.round2Open()) keys.push("CRAZY_DAVE_2018");
        var key = keys[Math.floor(Math.random() * keys.length)];
        if (key === store.lastAmbient && keys.length > 1) key = keys[(keys.indexOf(key) + 1) % keys.length];
        store.lastAmbient = key;
        store.ambientT = 5 + Math.random() * 5;
        beginStoreTalk(store, "ambient", Shop.say(key, profile));
      }
    }
  }

  function handleStore(action) {
    if (!action) return;
    var profile = Accounts.current();
    var store = state.store || (state.store = { page: 0, confirm: null });
    if (store.confirm) {
      if (action.id === "store-yes") {
        if (Shop.buy(profile, store.confirm)) {
          AudioBus.play("prize");
          Accounts.save();
          bindAccount();
        } else AudioBus.play("buzzer");
        store.confirm = null;
        return;
      }
      if (action.id === "store-no") {
        store.confirm = null;
        AudioBus.play("buttonclick");
      }
      return;
    }
    if (action.id === "back") return goMenu();
    if (action.id === "store-prev" || action.id === "store-next") {
      if (store.hatch > 0) return;
      var pages = Math.max(1, Math.ceil(Shop.stock(profile).length / 8));
      if (pages < 2) return;
      var dir = action.id === "store-prev" ? -1 : 1;
      store.page = ((store.page || 0) + dir + pages) % pages;
      store.hatch = 0.5;
      store.shake = 2;
      clearStoreTalk(store);
      AudioBus.play("hatchback_close");
      return;
    }
    if (action.id && action.id.indexOf("goods:") === 0) {
      var item = Shop.find(profile, action.id.slice(6));
      if (!item || item.owned || !profile.wallet.canAfford(item.cost)) {
        AudioBus.play("buzzer");
        return;
      }
      store.confirm = item.id;
      AudioBus.play("buttonclick");
    }
  }

  function openLevel(level) {
    state.level = level;
    state.chosen = [];
    state.davePicks = [];
    state.rakeArmed = false;
    if (level.round === 2 && !directKind(level)) {
      state.davePicks = Shop.pickSeeds(level, state.progress.unlocked);
      while (state.davePicks.length > slotCap()) state.davePicks.pop();
      state.chosen = state.davePicks.slice();
    }
    state.imitate = null;
    state.imitateOpen = false;
    state.tipId = null;
    state.selected = null;
    state.paused = false;
    state.seedConfirm = null;
    var profile = Accounts.current();
    var beats = Shop.beatsFor(profile, level);
    if (beats.length) {
      state.daveQueue = beats.slice(1);
      state.daveThen = "play";
      presentBeat(beats[0]);
      return;
    }
    beginLevel(true);
  }

  // 钉耙在真正开打时扣次数。选卡阶段返回主菜单不消耗。
  function armRake(profile) {
    if (state.rakeArmed || !state.board) return;
    state.rakeArmed = true;
    state.board.placeRake(profile);
    if (state.board.rake) Accounts.save();
  }

  function beginLevel(fresh) {
    var level = state.level;
    var direct = directKind(level);
    var preset = level.kind === "whack" ? ["gravebuster", "cherry"] : [];
    if (fresh) state.rakeArmed = false;
    state.board = new Board(level, direct ? preset : [], fresh ? !direct : false);
    if (direct && level.belt) state.board.armBelt();
    if (!direct && !fresh) state.board.packets = packetsFrom(state.chosen, state.imitate);
    var profile = Accounts.current();
    state.board.applyShop(profile);
    if (!fresh) state.rakeArmed = true;
    else if (direct) armRake(profile);
    state.screen = "play";
    state.paused = false;
    AudioBus.musicPause(false);
    AudioBus.music(fresh && !direct ? "choose" : (level.musicTune || "day"));
  }

  // 失败重试沿用刚才的卡组，跳过选卡镜头。钉耙这一关已经放过，重试不再放。
  function retryLevel() {
    state.selected = null;
    state.paused = false;
    state.seedConfirm = null;
    state.imitateOpen = false;
    beginLevel(false);
  }

  // 本关奖励如果已经在商店买过，就顺着图鉴往下找下一张还没有的。
  function claimReward(profile, preferred) {
    var order = (typeof Almanac !== "undefined" && Almanac.plantOrder) ? Almanac.plantOrder : [];
    var start = preferred ? order.indexOf(preferred) : 0;
    if (start < 0) start = 0;
    for (var i = start; i < order.length; i++) {
      if (!profile.hasPlant(order[i]) && PlantCatalog.get(order[i])) return order[i];
    }
    return null;
  }

  function salvageCoins(profile) {
    if (!state.board || !state.board.dropCoins) return;
    var purse = state.board.coins || 0;
    state.board.coins = 0;
    state.board.mowers.forEach(function (mower) {
      if (mower.state === "idle") purse += 50;
    });
    state.board.suns.forEach(function (sun) {
      if (sun.coin && !sun.done) purse += sun.value || 0;
    });
    if (purse) profile.wallet.add(purse);
  }

  function finishLevel() {
    var profile = Accounts.current();
    salvageCoins(profile);
    profile.clearLevel(state.level.id);
    if (state.level.id === "2-4") profile.shop.open = true;
    state.award = claimReward(profile, state.level.reward);
    if (state.award) profile.unlockPlant(state.award);
    var intro = profile.shop.open && profile.shop.seen.indexOf("shop-open") < 0;
    Accounts.save();
    bindAccount();
    state.thenDave = intro ? "shop-open" : null;
    if (state.award) {
      state.screen = "award";
      return;
    }
    if (intro) {
      state.daveQueue = [];
      state.daveThen = "levels";
      presentBeat(Shop.shopIntro(Accounts.current()));
      return;
    }
    state.screen = "levels";
  }

  function update(dt) {
    state.time += dt;
    state.smashSwing = Math.max(0, (state.smashSwing || 0) - dt);
    // 开发直达的自动选卡开打（仅 #goto=play-… 时为真）。
    if (state.autoFight && state.screen === "play" && state.board && state.board.phase === "choose") {
      state.autoFight = false;
      PlantCatalog.order.forEach(function (plant) {
        if (state.chosen.length >= 6) return;
        if (plant.place === "corner" || state.chosen.indexOf(plant.id) >= 0) return;
        if (state.progress.unlocked.indexOf(plant.id) < 0) return;
        state.chosen.push(plant.id);
      });
      if (state.chosen.length) startBattle();
    }
    if (state.screen === "loading") rollGrass(dt);
    if (state.screen === "menu" || state.screen === "accounts" || state.screen === "soon" || state.screen === "rounds" || state.screen === "levels") View.tickMenu(dt);
    state.hover = View.hoverName(state, state.pointer.x, state.pointer.y);
    state.tipId = View.plantUnderChooser(state, state.pointer.x, state.pointer.y);
    if (state.screen === "store") updateStore(dt);
    if (state.screen === "play" && state.board && !state.paused && state.board.phase !== "lost") {
      state.board.update(dt);
      if (state.board.coins) {
        Accounts.current().wallet.add(state.board.coins);
        state.board.coins = 0;
        Accounts.save();
      }
      if (state.board && state.board.phase === "won" && state.board.wonTime > 1.35) finishLevel();
    }
    // 战况强度喂给音乐系统：僵尸多于 10 只起镲片鼓组，少于 4 只退掉。暂停时冻结。
    if (state.screen === "play" && state.board && !state.paused) {
      var phase = state.board.phase;
      if (phase === "fight" || phase === "ready") {
        var count = 0;
        state.board.zombies.forEach(function (zombie) {
          if (zombie.alive && !zombie.hypno && zombie.x > -80 && zombie.x < Lawn.W + 80) count++;
        });
        AudioBus.burst(count);
      } else {
        AudioBus.burst(0);
      }
    }
  }

  function pointer(x, y) {
    state.pointer.x = x;
    state.pointer.y = y;
  }

  function packetsFrom(ids, imitate) {
    return (ids || []).map(function (id) {
      if (id === "imitater" && imitate) {
        var copy = PlantCatalog.get(imitate);
        return { id: "imitater", copy: imitate, cd: 0, cdMax: copy.cooldown * 0.5 };
      }
      return { id: id, cd: 0, cdMax: PlantCatalog.get(id).cooldown };
    });
  }

  // 选够卡后真正离开选卡。缺必带植物时不走这里，先弹出确认。
  function startBattle() {
    state.seedConfirm = null;
    state.imitateOpen = false;
    state.board.packets = packetsFrom(state.chosen, state.imitate);
    armRake(Accounts.current());
    state.board.startLeaves();
    AudioBus.music(state.level.musicTune || "day");
  }

  // 从关卡/图鉴回主菜单时切回主菜单曲。只是退出选关列表则不动。
  function goMenu() {
    var from = state.screen;
    var fromLevel = from === "play" || from === "award" || !!state.board;
    state.screen = "menu";
    state.board = null;
    state.paused = false;
    state.seedConfirm = null;
    state.imitateOpen = false;
    state.selected = null;
    if (fromLevel || from === "almanac") {
      AudioBus.musicPause(false);
      AudioBus.music("title");
    }
    AudioBus.play("buttonclick");
  }

  // ---------- 用户对话框（你是谁 / 新用户） ----------

  function userById(id) {
    return Accounts.list().filter(function (user) { return user.id === id; })[0] || null;
  }

  // 从主菜单的"更改用户"木牌进来：默认选中当前用户。
  function openAccounts() {
    state.acct = { mode: "list", value: "", selected: state.accountId || null };
    state.screen = "accounts";
  }

  function closeAcctInput() {
    state.acct.mode = "list";
    state.acct.value = "";
    AudioBus.play("gravebutton");
  }

  // 输入框的"确定"：新建直接建号并选中；改名改的是选中的那个用户。
  // 撞了重名不落盘，弹出"此用户名已存在"提示，回来接着改。
  function confirmAcctInput() {
    var acct = state.acct;
    if (acct.mode === "new") {
      if (Accounts.nameTaken(acct.value, null)) return openAcctDup("new");
      var created = Accounts.create(acct.value);
      if (!created) {
        AudioBus.play("buzzer");
        return;
      }
      bindAccount();
      acct.selected = created.id;
      AudioBus.play("prize");
    } else {
      if (Accounts.nameTaken(acct.value, acct.selected)) return openAcctDup("rename");
      if (Accounts.rename(acct.selected, acct.value)) {
        bindAccount();
        AudioBus.play("gravebutton");
      } else {
        AudioBus.play("buzzer");
        return;
      }
    }
    acct.mode = "list";
    acct.value = "";
  }

  // "此用户名已存在"提示框。from 记住是从建号还是改名进来的，
  // 点确定回到原来的输入框，已敲的名字保留着继续改。
  function openAcctDup(from) {
    state.acct.from = from;
    state.acct.mode = "dup";
    AudioBus.play("buzzer");
  }

  function closeAcctDup() {
    state.acct.mode = state.acct.from || "new";
    AudioBus.play("gravebutton");
  }

  /*
   * 键盘：只在用户对话框里接字。可打印字符进输入框（最长 12 字），
   * 回车等于"确定"，Esc 等于"取消/返回"。返回 true 表示这个键被对话框
   * 吃掉了（main.js 不再做暂停之类的处理）。
   */
  function key(event) {
    if (state.screen !== "accounts" || !state.acct) return false;
    var acct = state.acct;
    if (acct.mode === "list") {
      if (event.key === "Escape") {
        goMenu();
        return true;
      }
      if (event.key === "Enter" && acct.selected && Accounts.switchTo(acct.selected)) {
        bindAccount();
        goMenu();
        return true;
      }
      return false;
    }
    if (acct.mode === "dup") {
      // 提示框开着时键盘只认回车/Esc，都等于"确定"回输入框。
      if (event.key === "Enter" || event.key === "Escape") closeAcctDup();
      return true;
    }
    if (event.key === "Enter") {
      confirmAcctInput();
      return true;
    }
    if (event.key === "Escape") {
      closeAcctInput();
      return true;
    }
    if (event.key === "Backspace") {
      acct.value = acct.value.slice(0, -1);
      AudioBus.play("bleep", 0.35);
      return true;
    }
    if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      if (acct.value.length < 12) {
        acct.value += event.key;
        AudioBus.play("bleep", 0.35);
      }
      return true;
    }
    return false;
  }

  function click(x, y, button) {
    if (button === 2) {
      if (state.selected) {
        state.selected = null;
        AudioBus.play("seedlift");
      }
      return;
    }
    // 加载画面：只有点在显示"点击开始！"的土带草皮上才进主菜单，点别处没反应。
    if (state.screen === "loading") {
      if (state.ready) {
        var panel = View.loadingPanel();
        if (x >= panel.x && x < panel.x + panel.w && y >= panel.y && y < panel.y + panel.h) {
          startFromBoot();
        }
      }
      return;
    }
    var action = View.actionAt(state, x, y);
    if (!action) return;

    if (state.screen === "menu" && action.type === "hover") {
      if (action.id === "noop") return;
      if (action.id === "unlock-all") {
        Accounts.current().unlockAll();
        Accounts.save();
        bindAccount();
        AudioBus.play("prize");
        maybeShopIntro("menu");
        return;
      }
      if (action.id.indexOf("flower:") === 0) {
        if (View.bloomFlower(+action.id.slice(7))) AudioBus.play("limbs_pop");
        return;
      }
      if (action.id === "store") {
        openStore();
        return;
      }
      AudioBus.play("buttonclick");
      if (action.id === "account") {
        openAccounts();
        return;
      }
      if (action.id === "almanac") {
        state.almanacPage = "index";
        state.screen = "almanac";
        // 原版图鉴有自己的舒缓配乐（禅境花园曲段）。
        AudioBus.music("zen");
        return;
      }
      if (action.id === "help") {
        state.screen = "help";
        return;
      }
      var mode = GameModes.get(action.id);
      if (mode && mode.open) {
        state.screen = "rounds";
      } else {
        state.soonMode = action.id;
        state.screen = "soon";
      }
      return;
    }
    if (state.screen === "rounds") {
      if (action.id === "back") return goMenu();
      var round = action.id === "round-2" ? 2 : 1;
      if (round === 2 && !Accounts.current().round2Open()) {
        AudioBus.play("buzzer");
        return;
      }
      state.round = round;
      AudioBus.play("buttonclick");
      state.screen = "levels";
      return;
    }
    if (state.screen === "accounts") {
      var acct = state.acct;
      // 输入对话框打开时（新用户 / 修改名字），只认它的确定和取消。
      if (acct.mode === "dup") {
        if (action.id === "acct-dup-ok") closeAcctDup();
        return;
      }
      if (acct.mode !== "list") {
        if (action.id === "acct-ok") confirmAcctInput();
        else if (action.id === "acct-cancel") closeAcctInput();
        return;
      }
      if (action.id === "acct-cancel") {
        AudioBus.play("gravebutton");
        goMenu();
        return;
      }
      if (action.id === "acct-new") {
        acct.mode = "new";
        acct.value = "";
        AudioBus.play("gravebutton");
        return;
      }
      if (action.id === "acct-rename") {
        var named = userById(acct.selected);
        if (!named) {
          AudioBus.play("buzzer");
          return;
        }
        acct.mode = "rename";
        acct.value = named.name;
        AudioBus.play("gravebutton");
        return;
      }
      if (action.id === "acct-del") {
        if (!acct.selected || !Accounts.remove(acct.selected)) {
          AudioBus.play("buzzer");
          return;
        }
        bindAccount();
        var alive = Accounts.current();
        acct.selected = alive ? alive.id : null;
        AudioBus.play("gravestone_rumble");
        return;
      }
      if (action.id === "acct-ok") {
        // 原版逻辑：点用户名只是选中，点"确定"才切换。
        if (!acct.selected || !Accounts.switchTo(acct.selected)) {
          AudioBus.play("buzzer");
          return;
        }
        bindAccount();
        AudioBus.play("gravebutton");
        goMenu();
        return;
      }
      if (action.id && action.id.indexOf("acct:") === 0) {
        acct.selected = action.id.slice(5);
        AudioBus.play("bleep", 0.5);
      }
      return;
    }
    if (state.screen === "levels" && action.type === "hover") {
      if (action.id === "back") {
        state.screen = "rounds";
        AudioBus.play("buttonclick");
        return;
      }
      var level = Adventure.byId(action.id);
      if (!level || Accounts.current().levelLocked(level.id)) {
        AudioBus.play("buzzer");
        return;
      }
      AudioBus.play("buttonclick");
      openLevel(Adventure.prepare(action.id, state.round));
      return;
    }
    if (state.screen === "dave") {
      handleDave(action);
      return;
    }
    if (state.screen === "store") {
      handleStore(action);
      return;
    }
    if (state.screen === "soon" && action.id === "back") return goMenu();
    if (state.screen === "help" && action.id === "back") return goMenu();
    if (state.screen === "almanac" && action.type === "hover") {
      if (action.id === "almanac-close") return goMenu();
      if (action.id === "almanac-plants") {
        state.almanacPage = "plants";
        AudioBus.play("buttonclick");
        return;
      }
      if (action.id === "almanac-zombies") {
        state.almanacPage = "zombies";
        AudioBus.play("buttonclick");
        return;
      }
      if (action.id === "almanac-index") {
        state.almanacPage = "index";
        AudioBus.play("buttonclick");
        return;
      }
      if (action.id.indexOf("seed:") === 0) {
        state.almanacPlant = action.id.slice(5);
        AudioBus.play("seedlift");
        return;
      }
      if (action.id.indexOf("zed:") === 0) {
        state.almanacZombie = action.id.slice(4);
        AudioBus.play("seedlift");
        return;
      }
      return;
    }
    if (state.screen === "award") {
      AudioBus.play("buttonclick");
      state.award = null;
      if (state.thenDave === "shop-open") {
        state.thenDave = null;
        state.daveQueue = [];
        state.daveThen = "levels";
        presentBeat(Shop.shopIntro(Accounts.current()));
        return;
      }
      state.screen = "levels";
      return;
    }
    // 暂停优先于选卡。否则选卡阶段点“继续游戏”会被选卡逻辑吃掉。
    if (state.screen === "play" && state.paused) {
      if (action.id === "resume") {
        setPaused(false);
        AudioBus.play("pause");
      }
      if (action.id === "tomenu") goMenu();
      return;
    }
    if (state.screen === "play" && state.board && state.board.phase === "choose") {
      if (action.type === "imitate") {
        if (state.chosen.indexOf(action.id) < 0) {
          AudioBus.play("buzzer");
          return;
        }
        state.imitate = action.id;
        if (state.chosen.indexOf("imitater") < 0) state.chosen.push("imitater");
        state.imitateOpen = false;
        AudioBus.play("seedlift");
        return;
      }
      if (action.type === "imitate-close") {
        state.imitateOpen = false;
        AudioBus.play("buttonclick");
        return;
      }
      if (action.type === "pick") {
        if (action.locked) {
          // 没解锁的植物是剪影，点了只响提示音。
          AudioBus.play("buzzer");
          return;
        }
        if (action.id === "imitater") {
          if (state.chosen.indexOf("imitater") >= 0) return;
          if (state.chosen.length >= slotCap()) {
            AudioBus.play("buzzer");
            return;
          }
          state.imitateOpen = true;
          AudioBus.play("seedlift");
          return;
        }
        if (state.chosen.length >= slotCap() || state.chosen.indexOf(action.id) >= 0) return;
        state.chosen.push(action.id);
        AudioBus.play("seedlift");
        return;
      }
      if (action.type === "unpick") {
        if (action.index < state.davePicks.length) {
          // 戴夫锁的卡不能拿下来。
          AudioBus.play("buzzer");
          return;
        }
        var removed = state.chosen.splice(action.index, 1)[0];
        if (removed === "imitater") state.imitate = null;
        AudioBus.play("seedlift");
        return;
      }
      if (action.id === "rock" && state.chosen.length) {
        var missing = Terrains.missingRequired(state.level.terrain, state.chosen, state.progress.unlocked);
        if (missing.length) {
          state.seedConfirm = missing;
          AudioBus.play("buzzer");
          return;
        }
        startBattle();
        return;
      }
      if (action.id === "confirm-yes") {
        startBattle();
        return;
      }
      if (action.id === "confirm-no") {
        state.seedConfirm = null;
        AudioBus.play("buttonclick");
        return;
      }
      if (action.id === "pause") {
        setPaused(true);
        state.selected = null;
        AudioBus.play("pause");
      }
      return;
    }
    if (state.screen !== "play" || !state.board) return;
    if (state.board.phase === "lost") {
      if (action.id === "retry") retryLevel();
      if (action.id === "tomenu") goMenu();
      return;
    }
    if (action.type === "pause" || action.id === "pause") {
      setPaused(true);
      state.selected = null;
      AudioBus.play("pause");
      return;
    }
    if (action.type === "sun") {
      var sun = state.board.suns[action.index];
      if (sun && !sun.collect) sun.collect = true;
      return;
    }
    // 敲僵尸：木槌砸下去。
    if (action.type === "smash") {
      state.smashSwing = 0.18;
      if (!state.board.smashAt(action.x, action.y)) AudioBus.play("swing", 0.4);
      return;
    }
    // 花瓶粉碎者：砸开花瓶。
    if (action.type === "vase") {
      state.smashSwing = 0.18;
      state.board.breakVase(state.board.vases[action.index]);
      return;
    }
    if (action.type === "shovel") {
      state.selected = state.selected === "shovel" ? null : "shovel";
      AudioBus.play("shovel", 0.6);
      return;
    }
    if (action.type === "packet") {
      var packet = state.board.packets[action.index];
      var token = packet.token || packet.id;
      if (state.selected === token) {
        state.selected = null;
        AudioBus.play("seedlift");
        return;
      }
      if (!packet.free) {
        var shown = PlantCatalog.get(packet.copy || packet.card || packet.id);
        if (packet.cd > 0 || state.board.sun < shown.cost) {
          AudioBus.play("buzzer");
          return;
        }
      } else if (!state.board.packetReady(packet)) {
        AudioBus.play("buzzer");
        return;
      }
      state.selected = token;
      AudioBus.play("seedlift");
      return;
    }
    if (action.type === "cell") {
      if (state.level.kind === "bowling") {
        if (!state.board.roll(action.row, action.col, state.selected)) {
          AudioBus.play("buzzer");
          return;
        }
        state.selected = null;
        return;
      }
      if (state.selected === "shovel") {
        if (!state.board.removePlant(action.col, action.row)) return;
        state.selected = null;
        AudioBus.play("shovel", 0.7);
        return;
      }
      if (!state.selected) {
        var armed = null;
        var cob = null;
        state.board.plants.forEach(function (plant) {
          if (plant.aiming) armed = plant;
          if (plant.col === action.col && plant.row === action.row && plant.species.arm) cob = plant;
        });
        if (armed && armed.species.fireAt && armed.species.fireAt(armed, state.board, action.col, action.row)) {
          AudioBus.play("plant2");
          return;
        }
        if (cob && cob.species.arm(cob, state.board)) {
          AudioBus.play("seedlift");
          return;
        }
        return;
      }
      if (!state.board.tryPlant(state.selected, action.col, action.row)) {
        AudioBus.play("buzzer");
        return;
      }
      state.selected = null;
    }
  }

  return {
    state: state,
    boot: boot,
    startFromBoot: startFromBoot,
    update: update,
    pointer: pointer,
    click: click,
    key: key,
    setPaused: setPaused,
  };
})();
