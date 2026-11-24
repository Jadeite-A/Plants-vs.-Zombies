# 植物大战僵尸（中文年度版复刻）· 项目结构说明

以宝开中国 2012 中文年度版为参照的 Electron 复刻。所有资源（贴图/reanim/音频）
都来自 `123/main.pak` 的解包（`tools/pak-list.js` 可查看包内容），
经 `tools/copy-assets.js` 挑选复制到 `assets/`。

## 目录结构

```
electron/           主进程
  main.js             窗口、IPC 路由
  audio.js            BASS 音乐系统（mainmusic.mo3 按 Order 切曲 + burst 动态配乐）
  store.js            账户文件读写（account/ 目录，原子写、损坏恢复）
  preload.js          渲染端桥（pvzAudio / pvzStore）
  bass.dll            64 位 BASS

src/
  core/               引擎核心（与玩法无关）
    loader.js           唯一脚本入口：按依赖顺序注入全部模块（见文件头说明）
    reanim.js           PopCap reanim 动画解析与绘制
    assets.js           贴图/reanim 装载（assets/manifest.json）
    audio-bus.js        音效与音乐的总线（渲染端）
    rules.js            规则注册表（护甲/行进/召唤/玩法钩子）
    lawn.js             草坪几何（格子、镜头、锚点）

  data/               内容数据（纯数据 + 数据类，不含玩法逻辑）
    terrains.js         五大场景地形：种植规则、僵尸禁行、背景图、音乐曲段
    waves.js            出怪表生成（原版点数/权重/登场关规则）
    levels.js           Level 类 + Adventure 名册 + prepare(id, round)
    levels/             50 个关卡文件，一关一文件，只写自己的波数/玩法
    modes.js            主菜单模式 + 关卡玩法（kind）钩子分发
    almanac.js          图鉴文案（LawnStrings.txt 解析）

  plants/             植物模块（与关卡完全解耦）
    define.js           definePlant 注册器
    tactics.js          通用战斗机制（攻击循环/射击/投掷/产阳光/范围伤害）
    registry.js         PlantCatalog 名册与 Plant 实例
    species/            49 个物种文件（每个文件一种植物，零 import）

  zombies/            僵尸模块（与关卡完全解耦）
    define.js           defineZombie 注册器（默认音效/动画表）
    tactics.js          通用行为（行进、啃咬、护甲浸泡、爆炸）
    behaviors.js        公共规则：走/飞/钻地/撑杆行进、啃咬攻击、召唤、护甲
    registry.js         ZombieCatalog 名册与 Zombie 实例
    species/            27 个物种文件

  battle/             一局战斗
    board.js            棋盘：镜头、波次、胜负、实体容器
    props.js            实体：豌豆/投掷物/阳光/小推车/零件/保龄球坚果

  app/                应用层（界面流转与用户数据）
    store.js            存档读写门面（Electron 走文件 / 浏览器退 localStorage）
    profile.js          单用户档案（解锁/通关/二周目开放判定）
    accounts.js         多存档管理（index.json + users/<id>.json，损坏自恢复）
    data.js             只读门面（界面用的常量与换算）
    game.js             流程状态机（菜单/选关/选卡/暂停/胜负的点击与推进）
    main.js             输入与帧循环（启动入口）

  ui/                 界面绘制
    view-kit.js         绘制基元与共享几何（文字/按钮/角色/卡片/缓存）
    view-menu.js        主菜单家族（菜单/难度/关卡网格/存档/帮助/奖励）
    view-battle.js      战斗界面（草坪层/屏幕层/浮层）
    view-almanac.js     大图鉴
    view.js             调度器：绘制分发、命中检测、自定义光标
    style.css           启动画面与画布样式
```

## 模块边界约定

- **关卡 ↔ 物种完全分离**：关卡文件只声明数据（id/波数/地形/玩法 kind）；
  物种文件只声明行为与数值。两边的联系只有两个登记表：
  `Terrains`（地形约束谁能在哪出现/种植）和 `Rules` 的 `mode`/`mode-zombie`
  （保龄球等玩法钩子，物种按 "玩法:僵尸id" 注册行为，`Zombie.update` 统一分发）。
- **通用攻击机制**全部抽在 `plants/tactics.js`（攻击循环、射击、投掷、产阳光、
  范围伤害）和 `zombies/tactics.js`（行进、啃咬、护甲浸泡），物种文件只写
  差异化的数值与钩子。
- **加载顺序**由 `src/core/loader.js` 的清单保证（拓扑序见文件头注释），
  改动清单后跑 `node tools/check-loader.js` 校验。

## 用户存档

- 位置：开发时 `项目根/account/`；打包后 `exe 同级/account/`（便携式）；
  不可写时退系统 userData。`electron/store.js` 里有完整的意外处理策略
  （损坏备份、缺档重建、旧 localStorage 自动迁移）。
- 格式：`index.json`（索引）+ `users/<id>.json`（每人一个独立档案）。

## 常用工具

```
npm start                    开发运行
npm run assets               从 resource/ 重新复制资源并生成 manifest
node tools/check-loader.js   校验脚本清单与磁盘一致
node tools/check-reanim.js   校验 reanim 图片/动画名引用完整
node tools/check-sounds.js   校验音效引用完整
node tools/pak-list.js       查看 123/main.pak 内文件清单
node tools/anim-list.js      列出某个 reanim 可用的动画段
node tools/check-waves.js    校验 50 关出怪表（波数/旗帜/登场僵尸对照原版）
node tools/restore-levels.js 按原版数据重写 50 个关卡文件（波数/玩法/传送带）
node tools/test-music.js     无头测试 BASS 音乐系统
node tools/reanim-test-main.js  单独渲染苗/僵尸头 reanim 的测试窗（配 reanim-test.html）
PVZ_SHOT="1000,3000" npm start  无头截图校准界面（存 tools/shot-*.png 后自动退出）
PVZ_GOTO=almanac-plants         配合 PVZ_SHOT 直达某界面（#goto= 机制，仅菜单家族）
PVZ_AUTO=1 npm start         无头走一遍"更改用户"流程并存截图（tools/auto-*.png）
```
