// 音效和背景音乐。Electron 里走 64 位 BASS；浏览器里退回 HTML Audio（音乐没有备用方案，静默）。
// play/cue 播音效：cue 接受一个名字或一组名字，数组时随机挑一个。植物和僵尸只报名字，不自己播。
// music(name) 切原版曲段：mainmusic.mo3 里的 Order 段，曲名见 electron/audio.js 的 TUNES。
// burst(count) 把场上僵尸数量交给主进程驱动镲片/鼓组淡入淡出。
var AudioBus = (function () {
  var last = {};
  var track = "";
  var burstAt = 0;
  var burstSent = -1;
  var jingleAudio = null;

  function play(name, volume) {
    var now = performance.now();
    if (last[name] && now - last[name] < 40) return;
    last[name] = now;
    var vol = volume == null ? 0.7 : volume;
    if (window.pvzAudio) {
      window.pvzAudio.playSfx(name, vol);
      return;
    }
    var audio = new Audio("assets/sounds/" + name + ".ogg");
    audio.volume = vol;
    audio.play().catch(function () {});
  }

  function music(name) {
    if (!name || track === name) return;
    track = name;
    if (window.pvzAudio) window.pvzAudio.tune(name);
  }

  // 战况强度。count 为 -1 或 force 时表示大波来袭，直接起爆。
  function burst(count, force) {
    if (!window.pvzAudio) return;
    var now = performance.now();
    if (!force && now - burstAt < 100) return;
    if (!force && count === burstSent) return;
    burstAt = now;
    burstSent = count;
    window.pvzAudio.burst(count, !!force);
  }

  // 胜利/失败曲。独立通道，stop() 时一并停掉。
  function jingle(name, volume) {
    if (window.pvzAudio) {
      window.pvzAudio.jingle(name, volume == null ? 0.8 : volume);
      return;
    }
    var audio = new Audio("assets/sounds/" + name + ".ogg");
    audio.volume = volume == null ? 0.8 : volume;
    jingleAudio = audio;
    audio.play().catch(function () {});
  }

  function musicPause(paused) {
    if (window.pvzAudio) window.pvzAudio.musicPause(!!paused);
  }

  function stop() {
    track = "";
    burstSent = -1;
    if (jingleAudio) {
      jingleAudio.pause();
      jingleAudio = null;
    }
    if (window.pvzAudio && window.pvzAudio.stopMusic) window.pvzAudio.stopMusic();
  }

  function cue(sound, volume) {
    if (!sound) return;
    var name = sound;
    if (Object.prototype.toString.call(sound) === "[object Array]") {
      name = sound[Math.floor(Math.random() * sound.length)];
    }
    play(name, volume);
  }

  return { play: play, music: music, musicPause: musicPause, burst: burst, jingle: jingle, stop: stop, cue: cue };
})();
