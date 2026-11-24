// 验证 BASS_ATTRIB_MUSIC_VOL_CHAN 在这份 bass.dll (2.4.1) 上可读可写。
const koffi = require("koffi");
const bass = koffi.load("D:/PVZ/electron/bass.dll");
const init = bass.func("int __stdcall BASS_Init(int, uint32, uint32, void*, void*)");
const load = bass.func("uint32 __stdcall BASS_MusicLoad(int, str16, uint64, uint64, uint32, uint32)");
const freeAll = bass.func("int __stdcall BASS_Free()");
const musicFree = bass.func("int __stdcall BASS_MusicFree(uint32)");
const setAttr = bass.func("int __stdcall BASS_ChannelSetAttribute(uint32, uint32, float)");
const getAttr = bass.func("int __stdcall BASS_ChannelGetAttribute(uint32, uint32, float*)");
const pos = bass.func("uint32 __stdcall BASS_ChannelGetPosition(uint32, uint32)");
const setPosition = bass.func("int __stdcall BASS_ChannelSetPosition(uint32, uint64, uint32)");
const play = bass.func("int __stdcall BASS_ChannelPlay(uint32, int)");

if (!init(-1, 44100, 0, null, null)) {
  console.error("init failed");
  process.exit(1);
}
const handle = load(0, "D:/PVZ/assets/sounds/mainmusic.mo3", 0, 0, 4 | 0x8000 | 0x80000000, 0);
console.log("handle", handle);
if (!handle) process.exit(1);

const buf = new Float32Array(1);
function chanVol(chan) {
  buf[0] = -1;
  const ok = getAttr(handle, 0x200 + chan, buf);
  return ok ? buf[0] : "err";
}

console.log("ch0 default:", chanVol(0));
setAttr(handle, 0x200 + 27, 0.5);
console.log("ch27 after set 0.5:", chanVol(27));
setAttr(handle, 0x200 + 27, 0);
console.log("ch27 after set 0:", chanVol(27));

// Order 跳转 + 位置读取
console.log("setPosition 0x98:", setPosition(handle, 0x98, 1), "play:", play(handle, 1));
setTimeout(() => {
  const packed = pos(handle, 1);
  console.log("order now:", packed & 0xffff, "row:", (packed >> 16) & 0xffff);
  musicFree(handle);
  freeAll();
  process.exit(0);
}, 600);
