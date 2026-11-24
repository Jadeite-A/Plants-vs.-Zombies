// PopCap reanim。关键帧是稀疏的，没写的字段沿用上一帧。f = -1 表示这一帧隐藏。
// 名字以 anim_ 开头、并且有可见帧的轨道会被当成一段动画的起止。
// 注意：anim_innerarm1/2/3 既是手臂零件，也会被收进 anims，绘制时不能只当标记。
var Reanim = (function () {
  function num(raw, fallback) {
    if (raw == null || raw === "") return fallback;
    var n = +raw;
    return n === n ? n : fallback;
  }

  function parse(xml) {
    var fpsMatch = xml.match(/<fps>([^<]*)<\/fps>/);
    var fps = fpsMatch ? +fpsMatch[1] : 12;
    var tracks = [];
    var re = /<track>([\s\S]*?)<\/track>/g;
    var match;
    while ((match = re.exec(xml))) {
      var body = match[1];
      var name = (body.match(/<name>([^<]*)<\/name>/) || [])[1] || "";
      var rawFrames = [];
      var frameRe = /<t>([\s\S]*?)<\/t>/g;
      var frameMatch;
      while ((frameMatch = frameRe.exec(body))) rawFrames.push(frameMatch[1]);
      var cur = { x: 0, y: 0, kx: 0, ky: 0, sx: 1, sy: 1, f: 0, i: "", a: 1 };
      var frames = rawFrames.map(function (raw) {
        var grab = function (tag) {
          var found = raw.match(new RegExp("<" + tag + ">(-?[\\d.]*)</" + tag + ">"));
          return found ? found[1] : null;
        };
        var image = raw.match(/<i>([^<]*)<\/i>/);
        if (grab("x") != null) cur.x = num(grab("x"), cur.x);
        if (grab("y") != null) cur.y = num(grab("y"), cur.y);
        if (grab("kx") != null) cur.kx = num(grab("kx"), cur.kx);
        if (grab("ky") != null) cur.ky = num(grab("ky"), cur.ky);
        if (grab("sx") != null) cur.sx = num(grab("sx"), cur.sx);
        if (grab("sy") != null) cur.sy = num(grab("sy"), cur.sy);
        if (grab("f") != null) cur.f = num(grab("f"), cur.f);
        if (grab("a") != null) cur.a = num(grab("a"), cur.a);
        if (image) cur.i = image[1];
        return {
          x: cur.x,
          y: cur.y,
          kx: cur.kx,
          ky: cur.ky,
          sx: cur.sx,
          sy: cur.sy,
          f: cur.f,
          i: cur.i,
          a: cur.a,
        };
      });
      var visible = [];
      frames.forEach(function (frame, index) {
        if (frame.f !== -1) visible.push(index);
      });
      tracks.push({ name: name, frames: frames, visible: visible });
    }
    var anims = {};
    tracks.forEach(function (track) {
      if (track.name.indexOf("anim_") !== 0 || !track.frames.length) return;
      // 有可见帧的轨道按可见范围取段；纯时间轴轨道（帧全是 -1，只标节奏）
      // 也算一段动画，长度就是轨道帧数，供整只模型共用。
      var start = track.visible.length ? track.visible[0] : 0;
      var end = track.visible.length ? track.visible[track.visible.length - 1] : track.frames.length - 1;
      anims[track.name] = { start: start, end: end };
    });
    return { fps: fps, tracks: tracks, anims: anims };
  }

  function trackByName(reanim, name) {
    for (var i = 0; i < reanim.tracks.length; i++) {
      if (reanim.tracks[i].name === name) return reanim.tracks[i];
    }
    return null;
  }

  function frameIn(reanim, animName, time) {
    var anim = reanim.anims[animName];
    if (!anim) return 0;
    var length = anim.end - anim.start + 1;
    var index = (time * reanim.fps) % length;
    if (index < 0) index += length;
    return anim.start + index;
  }

  // 旋转走短弧，避免 179° 到 -179° 时整圈甩过去。
  function lerpAngle(a, b, t) {
    var d = b - a;
    while (d > 180) d -= 360;
    while (d < -180) d += 360;
    return a + d * t;
  }

  // 原版在相邻两帧之间插位移、缩放、旋转和透明度；贴图在整数帧上切换。
  // 当前帧或下一帧被标成隐藏时不插，避免零件飞向一个不画的位置。
  function sampleFrame(track, frameFloat) {
    if (!track.frames.length) return null;
    var i0 = Math.floor(frameFloat);
    if (i0 < 0) i0 = 0;
    if (i0 >= track.frames.length) i0 = track.frames.length - 1;
    var a = track.frames[i0];
    if (!a || a.f === -1) return null;
    var t = frameFloat - Math.floor(frameFloat);
    if (t < 0.001 || i0 + 1 >= track.frames.length) return a;
    var b = track.frames[i0 + 1];
    if (!b || b.f === -1) return a;
    return {
      x: a.x + (b.x - a.x) * t,
      y: a.y + (b.y - a.y) * t,
      kx: lerpAngle(a.kx, b.kx, t),
      ky: lerpAngle(a.ky, b.ky, t),
      sx: a.sx + (b.sx - a.sx) * t,
      sy: a.sy + (b.sy - a.sy) * t,
      f: a.f,
      i: a.i,
      a: a.a + (b.a - a.a) * t,
    };
  }

  function paintFrame(ctx, frame, options) {
    if (!frame || frame.f === -1 || !frame.i || frame.a <= 0.01) return;
    var imageId = options.replaceImage ? options.replaceImage(frame.i) || frame.i : frame.i;
    var image = Assets.image(imageId);
    if (!image) return;
    ctx.save();
    var kx = (frame.kx * Math.PI) / 180;
    var ky = (frame.ky * Math.PI) / 180;
    ctx.transform(
      frame.sx * Math.cos(kx),
      frame.sx * Math.sin(kx),
      -frame.sy * Math.sin(ky),
      frame.sy * Math.cos(ky),
      frame.x,
      frame.y
    );
    ctx.globalAlpha *= Math.max(0, Math.min(1, frame.a));
    // 原版 Reanimator 把贴图中心放在关键帧坐标上。加载条的小花和僵尸头按这个画，
    // 花心才落在草皮中间；别的角色仍按左上角，避免把已经对好的植物整体挪走。
    if (options.center) ctx.drawImage(image, -image.width / 2, -image.height / 2);
    else ctx.drawImage(image, 0, 0);
    ctx.restore();
  }

  // 加载条的花瓣关键帧离茎有几像素，这里按调用方给的位移补上，不改原帧。
  function shiftedFrame(track, frame, options) {
    if (!frame || !options.nudge) return frame;
    var extra = options.nudge(track, frame);
    if (!extra) return frame;
    return {
      x: frame.x + extra.x,
      y: frame.y + extra.y,
      kx: frame.kx,
      ky: frame.ky,
      sx: frame.sx,
      sy: frame.sy,
      f: frame.f,
      i: frame.i,
      a: frame.a,
    };
  }

  function draw(ctx, reanim, frameIndex, dx, dy, options) {
    options = options || {};
    ctx.save();
    ctx.translate(dx, dy);
    for (var i = 0; i < reanim.tracks.length; i++) {
      var track = reanim.tracks[i];
      if (options.skip && options.skip(track)) continue;
      if (options.only && !options.only(track)) continue;
      paintFrame(ctx, shiftedFrame(track, sampleFrame(track, frameIndex), options), options);
    }
    ctx.restore();
  }

  // 三重射手、双向射手、机枪射手的身体和头写在不同帧段里，待机要按同一拍各取一帧再叠上。
  function drawLayers(ctx, reanim, names, time, dx, dy, options) {
    options = options || {};
    var primary = reanim.anims[names[0]];
    if (!primary) return;
    var length = primary.end - primary.start + 1;
    if (length < 1) return;
    var index = (time * reanim.fps) % length;
    if (index < 0) index += length;
    var frames = [];
    names.forEach(function (name) {
      var anim = reanim.anims[name];
      if (!anim) return;
      var span = anim.end - anim.start + 1;
      frames.push(anim.start + (index % span));
    });
    ctx.save();
    ctx.translate(dx, dy);
    for (var i = 0; i < reanim.tracks.length; i++) {
      var track = reanim.tracks[i];
      if (options.skip && options.skip(track)) continue;
      var frame = null;
      for (var f = 0; f < frames.length; f++) {
        var candidate = sampleFrame(track, frames[f]);
        if (candidate && candidate.i && candidate.a > 0.01) {
          frame = candidate;
          break;
        }
      }
      if (!frame) continue;
      paintFrame(ctx, frame, options);
    }
    ctx.restore();
  }

  // 把这一帧每个零件的四个角变到画布上，得到能包住整只的盒子。
  function bounds(reanim, frameIndex, skip) {
    var minX = 1e9;
    var minY = 1e9;
    var maxX = -1e9;
    var maxY = -1e9;
    var count = 0;
    for (var i = 0; i < reanim.tracks.length; i++) {
      var track = reanim.tracks[i];
      if (skip && skip(track)) continue;
      var frame = track.frames[frameIndex];
      if (!frame || frame.f === -1 || !frame.i || frame.a <= 0.01) continue;
      var image = Assets.image(frame.i);
      if (!image) continue;
      var w = image.width;
      var h = image.height;
      var kx = (frame.kx * Math.PI) / 180;
      var ky = (frame.ky * Math.PI) / 180;
      var a = frame.sx * Math.cos(kx);
      var b = frame.sx * Math.sin(kx);
      var c = -frame.sy * Math.sin(ky);
      var d = frame.sy * Math.cos(ky);
      var xs = [frame.x, a * w + frame.x, c * h + frame.x, a * w + c * h + frame.x];
      var ys = [frame.y, b * w + frame.y, d * h + frame.y, b * w + d * h + frame.y];
      for (var k = 0; k < 4; k++) {
        if (xs[k] < minX) minX = xs[k];
        if (ys[k] < minY) minY = ys[k];
        if (xs[k] > maxX) maxX = xs[k];
        if (ys[k] > maxY) maxY = ys[k];
      }
      count++;
    }
    if (!count) return null;
    return { minX: minX, minY: minY, maxX: maxX, maxY: maxY };
  }

  function drawTrack(ctx, reanim, track, frameIndex, dx, dy) {
    var frame = sampleFrame(track, frameIndex);
    if (!frame || !frame.i || frame.a <= 0.01) return;
    var image = Assets.image(frame.i);
    if (!image) return;
    ctx.save();
    ctx.translate(dx, dy);
    var kx = (frame.kx * Math.PI) / 180;
    var ky = (frame.ky * Math.PI) / 180;
    ctx.transform(
      frame.sx * Math.cos(kx),
      frame.sx * Math.sin(kx),
      -frame.sy * Math.sin(ky),
      frame.sy * Math.cos(ky),
      frame.x,
      frame.y
    );
    ctx.globalAlpha *= Math.max(0, Math.min(1, frame.a));
    ctx.drawImage(image, 0, 0);
    ctx.restore();
  }

  return {
    parse: parse,
    trackByName: trackByName,
    frameIn: frameIn,
    sampleFrame: sampleFrame,
    draw: draw,
    drawLayers: drawLayers,
    drawTrack: drawTrack,
    bounds: bounds,
  };
})();
