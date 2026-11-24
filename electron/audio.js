// 主进程里的 BASS。必须用 electron/bass.dll（64 位）。原版包里的 bass.dll 是 32 位，加载不了。
//
// 音乐系统和原版一致：
//   mainmusic.mo3 是一个 30 通道的 MOD，里面按 Order 段装着全部曲子
//   （白天草地 0x00、黑夜 0x30、泳池 0x5E、选卡 0x7A、雾夜 0x7D、
//     主菜单 0x98、最终 Boss 0x9E、小游戏 0xA6、益智 0xB1、屋顶 0xB8、
//     传送带 0xD4、禅境花园 0xDD）。
//   播放时跳到对应 Order，用 BASS_ATTRIB_MUSIC_VOL_CHAN 逐通道控制音量：
//   旋律通道常开，鼓组和镲片通道按战场强度淡入淡出（burst）。
//   白天镲片是 27 号通道、鼓组 24–26；战斗里僵尸多于 10 只时镲片 4 秒淡入，
//   鼓组在下一个 Order 边界整拍进；少于 4 只时镲片 8 秒淡出、鼓组 0.5 秒淡出。
const fs = require("fs");
const path = require("path");

const BASS_SAMPLE_LOOP = 4;
const BASS_MUSIC_POSRESET = 0x8000;
const BASS_UNICODE = 0x80000000;
const BASS_STREAM_AUTOFREE = 0x40000;
const BASS_ATTRIB_VOL = 2;
const BASS_ATTRIB_MUSIC_VOL_CHAN = 0x200; // + 通道号
const BASS_POS_MUSIC_ORDER = 1;

const MASTER = 0.5; // 音乐总音量
const TRACKS = 30;

// 曲名 → Order 段与通道映射。mainEnd 之前的通道是旋律；drums/hihats 是打击乐。
const TUNES = {
  title: { order: 0x98 },
  choose: { order: 0x7a },
  day: { order: 0x00, mainEnd: 23, drums: [24, 26], hihats: [[27, 27]] },
  night: { order: 0x30, drumsOrder: 0x5c, scheme: 2 },
  pool: { order: 0x5e, mainEnd: 17, drums: [18, 28], hihats: [[18, 24], [29, 29]] },
  fog: { order: 0x7d, mainEnd: 15, drums: [16, 22], hihats: [[23, 23]] },
  roof: { order: 0xb8, mainEnd: 17, drums: [18, 20], hihats: [[21, 21]] },
  loonboon: { order: 0xa6 },
  cerebrawl: { order: 0xb1 },
  boss: { order: 0x9e },
  conveyer: { order: 0xd4 },
  zen: { order: 0xdd },
};

// burst 状态机，时间单位是 100Hz 的 tick，跟原版数值一致。
const BURST = {
  OFF: 0,
  STARTING: 1,
  ON: 2,
  FINISHING: 3,
};

let bass = null;
let ready = false;
let failed = false;
const streams = { main: 0, drums: 0 };
let tuneName = "";
let tune = null;
let burstState = BURST.OFF;
let burstCounter = 0;
let drumsState = "off"; // off | queued-on | on | queued-off | fading
let drumsCounter = 0;
let lastOrder = -1;
let applied = null; // 已写入 BASS 的通道音量，避免每 tick 重复设置
let jingleHandle = 0;
let sfxHandles = [];

const fn = {};

function soundFile(name, ext) {
  return path.join(__dirname, "..", "assets", "sounds", name + ext);
}

function ensure() {
  if (ready || failed) return ready;
  try {
    const koffi = require("koffi");
    bass = koffi.load(path.join(__dirname, "bass.dll"));
    fn.init = bass.func("int __stdcall BASS_Init(int, uint32, uint32, void*, void*)");
    fn.free = bass.func("int __stdcall BASS_Free()");
    fn.error = bass.func("int __stdcall BASS_ErrorGetCode()");
    fn.musicLoad = bass.func("uint32 __stdcall BASS_MusicLoad(int, str16, uint64, uint64, uint32, uint32)");
    fn.musicFree = bass.func("int __stdcall BASS_MusicFree(uint32)");
    fn.stream = bass.func("uint32 __stdcall BASS_StreamCreateFile(int, str16, uint64, uint64, uint32)");
    fn.play = bass.func("int __stdcall BASS_ChannelPlay(uint32, int)");
    fn.stop = bass.func("int __stdcall BASS_ChannelStop(uint32)");
    fn.pause = bass.func("int __stdcall BASS_ChannelPause(uint32)");
    // 这份 bass.dll 是 2.4.1，没有 BASS_ChannelResume，恢复播放用 ChannelPlay(handle, 0)。
    fn.isActive = bass.func("uint32 __stdcall BASS_ChannelIsActive(uint32)");
    fn.attr = bass.func("int __stdcall BASS_ChannelSetAttribute(uint32, uint32, float)");
    fn.position = bass.func("uint32 __stdcall BASS_ChannelGetPosition(uint32, uint32)");
    fn.setPosition = bass.func("int __stdcall BASS_ChannelSetPosition(uint32, uint64, uint32)");
    if (!fn.init(-1, 44100, 0, null, null)) {
      console.error("BASS_Init failed", fn.error());
      failed = true;
      return false;
    }
    ready = true;
    return true;
  } catch (err) {
    failed = true;
    console.error("BASS unavailable", err && err.message ? err.message : err);
    return false;
  }
}

function chanVolume(handle, channel, volume) {
  fn.attr(handle, BASS_ATTRIB_MUSIC_VOL_CHAN + channel, volume);
}

// 按曲子的通道映射写一遍音量。drumsVol / hihatsVol 是 0..1。
function applyVolumes(tuneDef, drumsVol, hihatsVol) {
  const wanted = new Array(TRACKS).fill(0);
  if (tuneDef.mainEnd == null) {
    // 没有打击乐分离的曲子（主菜单、选卡等）：全部通道常开。
    for (let i = 0; i < TRACKS; i++) wanted[i] = 1;
  } else {
    for (let i = 0; i <= tuneDef.mainEnd; i++) wanted[i] = 1;
    for (let i = tuneDef.drums[0]; i <= tuneDef.drums[1]; i++) wanted[i] = drumsVol;
    for (const span of tuneDef.hihats) {
      for (let i = span[0]; i <= span[1]; i++) {
        if (wanted[i] < hihatsVol) wanted[i] = hihatsVol;
      }
    }
  }
  const handle = streams.main;
  if (!handle) return;
  for (let i = 0; i < TRACKS; i++) {
    if (applied && Math.abs(applied[i] - wanted[i]) < 0.01) continue;
    chanVolume(handle, i, wanted[i]);
    if (!applied) applied = new Array(TRACKS).fill(-1);
    applied[i] = wanted[i];
  }
}

function loadStreams() {
  if (streams.main || failed) return;
  const flags = BASS_SAMPLE_LOOP | BASS_MUSIC_POSRESET | BASS_UNICODE;
  const file = soundFile("mainmusic", ".mo3");
  if (!fs.existsSync(file)) {
    console.error("missing music", file);
    failed = true;
    return;
  }
  streams.main = fn.musicLoad(0, file, 0, 0, flags, 0);
  streams.drums = fn.musicLoad(0, file, 0, 0, flags, 0);
  if (!streams.main || !streams.drums) {
    console.error("BASS_MusicLoad failed", fn.error(), file);
    failed = true;
  }
}

function stopStreams() {
  for (const key of ["main", "drums"]) {
    if (streams[key] && fn.stop) fn.stop(streams[key]);
  }
}

function playStream(handle, order, volume) {
  if (!handle) return;
  fn.stop(handle);
  fn.setPosition(handle, order, BASS_POS_MUSIC_ORDER);
  fn.attr(handle, BASS_ATTRIB_VOL, volume);
  fn.play(handle, 0);
}

function playTune(name) {
  const tuneDef = TUNES[name];
  if (!tuneDef || !ensure()) return false;
  loadStreams();
  if (failed) return false;
  stopStreams();
  tuneName = name;
  tune = tuneDef;
  burstState = BURST.OFF;
  burstCounter = 0;
  drumsState = "off";
  drumsCounter = 0;
  lastOrder = -1;
  applied = null;
  hihatsVolume = 0;
  drumsVolume = 0;
  mainVolume = 1;
  if (tuneDef.scheme === 2) {
    // 黑夜：旋律和鼓组在不同 Order 段，需要两个流同时播。
    playStream(streams.main, tuneDef.order, MASTER);
    playStream(streams.drums, tuneDef.drumsOrder, 0);
  } else {
    playStream(streams.main, tuneDef.order, MASTER);
  }
  applyVolumes(tuneDef, 0, 0);
  return true;
}

function orderNow() {
  if (!streams.main) return -1;
  const packed = fn.position(streams.main, BASS_POS_MUSIC_ORDER);
  return packed & 0xffff;
}

// 僵尸数量驱动的动态配乐。count 是场上活僵尸数，force 表示大波来袭直接起爆。
function burst(count, force) {
  if (!tune) return;
  if (tune.scheme !== 2 && tune.mainEnd == null) return;
  if (burstState === BURST.OFF) {
    if (count >= 10 || force) {
      burstState = BURST.STARTING;
      burstCounter = 400;
    }
    return;
  }
  if (burstState === BURST.ON && (count < 4 && !force)) {
    burstState = BURST.FINISHING;
    burstCounter = 800;
    if (tune.scheme !== 2) drumsState = "queued-off";
    else drumsCounter = 800;
  }
}

// 100Hz 的状态机。白天等方案一：镲片淡入 400 tick（4 秒）、淡出 800 tick（8 秒），
// 鼓组在 Order 边界整拍进出，退出再淡 50 tick。
// 黑夜是方案二：旋律整体淡出、鼓组流淡入，退场时再换回来。
function tick() {
  if (!tune || !ready || failed) return;
  const order = orderNow();
  const boundary = lastOrder >= 0 && order !== lastOrder;
  lastOrder = order;

  if (tune.scheme === 2) {
    if (burstState === BURST.STARTING) {
      burstCounter--;
      mainVolume = Math.max(0, burstCounter / 400);
      drumsVolume = Math.min(1, (400 - burstCounter) / 400);
      if (burstCounter <= 0) {
        burstState = BURST.ON;
        burstCounter = 800;
      }
    } else if (burstState === BURST.ON) {
      mainVolume = 0;
      drumsVolume = 1;
    } else if (burstState === BURST.FINISHING) {
      burstCounter--;
      drumsCounter = Math.max(0, drumsCounter - 1);
      mainVolume = Math.min(1, (800 - burstCounter) / 400);
      drumsVolume = Math.max(0, drumsCounter / 800);
      if (burstCounter <= 0) {
        burstState = BURST.OFF;
        mainVolume = 1;
        drumsVolume = 0;
      }
    }
    if (streams.main) fn.attr(streams.main, BASS_ATTRIB_VOL, MASTER * mainVolume);
    if (streams.drums) fn.attr(streams.drums, BASS_ATTRIB_VOL, MASTER * drumsVolume);
    return;
  }

  if (burstState === BURST.STARTING) {
    burstCounter--;
    const hihats = 1 - burstCounter / 400;
    if (burstCounter === 100) drumsState = "queued-on";
    if (burstCounter <= 0) {
      burstState = BURST.ON;
      burstCounter = 800;
      hihatsVolume = 1;
    }
    hihatsVolume = Math.max(0, Math.min(1, hihats));
  } else if (burstState === BURST.ON) {
    hihatsVolume = 1;
  } else if (burstState === BURST.FINISHING) {
    burstCounter--;
    hihatsVolume = Math.max(0, burstCounter / 800);
    if (burstCounter <= 0 && drumsState === "off") {
      burstState = BURST.OFF;
      hihatsVolume = 0;
    }
  }

  if (drumsState === "queued-on") {
    if (boundary) {
      drumsVolume = 1;
      drumsState = "on";
    }
  } else if (drumsState === "queued-off") {
    if (boundary) {
      drumsState = "fading";
      drumsCounter = 50;
    }
  } else if (drumsState === "fading") {
    drumsCounter--;
    drumsVolume = Math.max(0, drumsCounter / 50);
    if (drumsCounter <= 0) {
      drumsState = "off";
      drumsVolume = 0;
    }
  }

  applyVolumes(tune, drumsVolume, hihatsVolume);
}

let hihatsVolume = 0;
let drumsVolume = 0;
let mainVolume = 1;
let ticker = null;

function ensureTicker() {
  if (ticker) return;
  ticker = setInterval(tick, 10);
}

function playMusic(name) {
  if (!name) return false;
  if (name === tuneName) return true;
  const ok = playTune(name);
  if (ok) ensureTicker();
  return ok;
}

function stopMusic() {
  if (!ensure()) return;
  stopStreams();
  stopJingle();
  tuneName = "";
  tune = null;
  burstState = BURST.OFF;
  drumsState = "off";
  hihatsVolume = 0;
  drumsVolume = 0;
  mainVolume = 1;
}

function pauseMusic(paused) {
  if (!ensure()) return;
  for (const key of ["main", "drums"]) {
    const handle = streams[key];
    if (!handle) continue;
    if (paused) fn.pause(handle);
    else fn.play(handle, 0);
  }
}

// 胜利/失败曲是 ogg 流，单独占一个可随时停掉的通道，避免重试时残留。
function playJingle(name, volume) {
  if (!name || !ensure()) return false;
  stopJingle();
  const file = soundFile(name, ".ogg");
  if (!fs.existsSync(file)) {
    console.error("missing jingle", file);
    return false;
  }
  const handle = fn.stream(0, file, 0, 0, BASS_UNICODE);
  if (!handle) {
    console.error("BASS_StreamCreateFile failed", fn.error(), file);
    return false;
  }
  const vol = typeof volume === "number" ? Math.max(0, Math.min(1, volume)) : 0.8;
  fn.attr(handle, BASS_ATTRIB_VOL, vol);
  fn.play(handle, 1);
  jingleHandle = handle;
  return true;
}

function stopJingle() {
  if (jingleHandle && fn.stop) fn.stop(jingleHandle);
  jingleHandle = 0;
}

function playSfx(name, volume) {
  if (!name || !ensure()) return false;
  const file = soundFile(name, ".ogg");
  if (!fs.existsSync(file)) {
    console.error("missing sfx", file);
    return false;
  }
  const handle = fn.stream(0, file, 0, 0, BASS_UNICODE | BASS_STREAM_AUTOFREE);
  if (!handle) {
    console.error("BASS_StreamCreateFile failed", fn.error(), file);
    return false;
  }
  const vol = typeof volume === "number" ? Math.max(0, Math.min(1, volume)) : 0.7;
  fn.attr(handle, BASS_ATTRIB_VOL, vol);
  fn.play(handle, 1);
  sfxHandles.push(handle);
  if (sfxHandles.length > 24) sfxHandles = sfxHandles.filter((h) => fn.isActive(h) === 1);
  return true;
}

function shutdown() {
  stopMusic();
  if (ticker) {
    clearInterval(ticker);
    ticker = null;
  }
  if (ready && fn.free) fn.free();
  ready = false;
}

module.exports = { playMusic, stopMusic, pauseMusic, playSfx, playJingle, shutdown, ensure, burst };
