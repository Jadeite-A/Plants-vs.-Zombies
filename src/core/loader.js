/*
 * 启动加载器（唯一入口）。
 *
 * 这个项目刻意不用 ES 模块：植物、僵尸、关卡都是"注册式"的纯数据/行为文件，
 * 全局命名空间（Reanim / Assets / AudioBus / Rules / Lawn / PlantCatalog /
 * ZombieCatalog / Adventure / Terrains / Waves / Game / View …）就是它们之间
 * 的约定接口。这样物种文件和关卡文件可以做到零 import——加一个新植物或新关卡
 * 只需要丢一个文件进 species/ 或 levels/，在下面的清单里补一行（或跑 tools/
 * sync-loader.js 自动重生成清单）。
 *
 * 清单必须满足的加载顺序（拓扑序）：
 *   1. core     引擎：贴图、音频、reanim、规则注册表、草坪几何
 *   2. plants   注册器 → 通用战斗机制 → 各物种 → 名册封口
 *   3. zombies  同上（behaviors 是护甲/行进/召唤等公共规则）
 *   4. data     地形 → 出怪表 → 关卡类 → 各关卡 → 模式 → 图鉴文案
 *   5. battle   战场实体（豌豆/阳光/小推车…）与棋盘
 *   6. app      本地存档 → 用户档案 → 多存档管理 → 只读门面 → 游戏流程
 *   7. ui       绘制基元 → 各界面 → 绘制调度
 *   8. boot     帧循环与输入（app/main.js，必须最后）
 */
(function () {
  "use strict";

  var MANIFEST = [
    // ---- 1. core 引擎 ----
    "core/reanim.js",
    "core/assets.js",
    "core/audio-bus.js",
    "core/rules.js",
    "core/lawn.js",

    // ---- 2. plants 植物 ----
    "plants/define.js",
    "plants/tactics.js",
    // 物种文件按字母序，彼此无依赖，顺序不敏感
    "plants/species/blover.js",
    "plants/species/cabbagepult.js",
    "plants/species/cactus.js",
    "plants/species/cattail.js",
    "plants/species/cherry.js",
    "plants/species/chomper.js",
    "plants/species/cobcannon.js",
    "plants/species/coffee.js",
    "plants/species/doomshroom.js",
    "plants/species/fumeshroom.js",
    "plants/species/garlic.js",
    "plants/species/gatlingpea.js",
    "plants/species/gloomshroom.js",
    "plants/species/goldmagnet.js",
    "plants/species/gravebuster.js",
    "plants/species/hypnoshroom.js",
    "plants/species/iceshroom.js",
    "plants/species/imitater.js",
    "plants/species/jalapeno.js",
    "plants/species/kernelpult.js",
    "plants/species/lilypad.js",
    "plants/species/magnetshroom.js",
    "plants/species/marigold.js",
    "plants/species/melonpult.js",
    "plants/species/peashooter.js",
    "plants/species/plantern.js",
    "plants/species/pot.js",
    "plants/species/potatomine.js",
    "plants/species/puffshroom.js",
    "plants/species/pumpkin.js",
    "plants/species/repeater.js",
    "plants/species/scaredyshroom.js",
    "plants/species/seashroom.js",
    "plants/species/snowpea.js",
    "plants/species/spikerock.js",
    "plants/species/spikeweed.js",
    "plants/species/splitpea.js",
    "plants/species/squash.js",
    "plants/species/starfruit.js",
    "plants/species/sunflower.js",
    "plants/species/sunshroom.js",
    "plants/species/tallnut.js",
    "plants/species/tanglekelp.js",
    "plants/species/threepeater.js",
    "plants/species/torchwood.js",
    "plants/species/twinsunflower.js",
    "plants/species/umbrellaleaf.js",
    "plants/species/wallnut.js",
    "plants/species/wintermelon.js",
    "plants/registry.js",

    // ---- 3. zombies 僵尸 ----
    "zombies/define.js",
    "zombies/tactics.js",
    "zombies/behaviors.js",
    "zombies/species/backup.js",
    "zombies/species/balloon.js",
    "zombies/species/bobsled.js",
    "zombies/species/bucket.js",
    "zombies/species/bungee.js",
    "zombies/species/catapult.js",
    "zombies/species/cone.js",
    "zombies/species/dancer.js",
    "zombies/species/digger.js",
    "zombies/species/dolphin.js",
    "zombies/species/ducky.js",
    "zombies/species/flag.js",
    "zombies/species/football.js",
    "zombies/species/gargantuar.js",
    "zombies/species/giga.js",
    "zombies/species/imp.js",
    "zombies/species/jack.js",
    "zombies/species/ladder.js",
    "zombies/species/newspaper.js",
    "zombies/species/normal.js",
    "zombies/species/pogo.js",
    "zombies/species/pole.js",
    "zombies/species/screen.js",
    "zombies/species/snorkel.js",
    "zombies/species/yeti.js",
    "zombies/species/zomboni.js",
    "zombies/species/zomboss.js",
    "zombies/registry.js",

    // ---- 4. data 内容数据 ----
    "data/terrains.js",
    "data/waves.js",
    "data/levels.js",
    "data/levels/1-1.js",
    "data/levels/1-2.js",
    "data/levels/1-3.js",
    "data/levels/1-4.js",
    "data/levels/1-5.js",
    "data/levels/1-6.js",
    "data/levels/1-7.js",
    "data/levels/1-8.js",
    "data/levels/1-9.js",
    "data/levels/1-10.js",
    "data/levels/2-1.js",
    "data/levels/2-2.js",
    "data/levels/2-3.js",
    "data/levels/2-4.js",
    "data/levels/2-5.js",
    "data/levels/2-6.js",
    "data/levels/2-7.js",
    "data/levels/2-8.js",
    "data/levels/2-9.js",
    "data/levels/2-10.js",
    "data/levels/3-1.js",
    "data/levels/3-2.js",
    "data/levels/3-3.js",
    "data/levels/3-4.js",
    "data/levels/3-5.js",
    "data/levels/3-6.js",
    "data/levels/3-7.js",
    "data/levels/3-8.js",
    "data/levels/3-9.js",
    "data/levels/3-10.js",
    "data/levels/4-1.js",
    "data/levels/4-2.js",
    "data/levels/4-3.js",
    "data/levels/4-4.js",
    "data/levels/4-5.js",
    "data/levels/4-6.js",
    "data/levels/4-7.js",
    "data/levels/4-8.js",
    "data/levels/4-9.js",
    "data/levels/4-10.js",
    "data/levels/5-1.js",
    "data/levels/5-2.js",
    "data/levels/5-3.js",
    "data/levels/5-4.js",
    "data/levels/5-5.js",
    "data/levels/5-6.js",
    "data/levels/5-7.js",
    "data/levels/5-8.js",
    "data/levels/5-9.js",
    "data/levels/5-10.js",
    "data/modes.js",
    "data/almanac.js",

    // ---- 5. battle 战斗 ----
    "battle/props.js",
    "battle/board.js",

    // ---- 6. app 应用层 ----
    "app/store.js",
    "app/profile.js",
    "app/shop.js",
    "app/accounts.js",
    "app/data.js",
    "app/game.js",

    // ---- 7. ui 界面 ----
    "ui/view-kit.js",
    "ui/view-menu.js",
    "ui/bitmap-font.js",
    "ui/view-shop.js",
    "ui/view-battle.js",
    "ui/view-almanac.js",
    "ui/view.js",

    // ---- 8. boot 启动（必须最后）----
    "app/main.js",
  ];

  // 经典脚本设置 async=false 后按插入顺序执行（规范行为），
  // 比 document.write 干净，也比打包工具少一个构建环节。
  MANIFEST.forEach(function (file) {
    var script = document.createElement("script");
    script.src = "src/" + file;
    script.async = false;
    document.currentScript.parentNode.appendChild(script);
  });
})();
