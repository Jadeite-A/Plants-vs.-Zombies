/*
 * bitmap-font.js — 原版点阵字。
 *
 * 对话框用 BrianneTod16（方正卡通，黑字），售出章用 HouseofTerror16（方正艺黑，红字加细描边）。
 * 贴图是黑底白字，画的时候按亮度当透明度，再染成指定颜色，字重就是原版那一套。
 */
var BitmapFont = (function () {
  var fonts = {};

  function parseList(text, name) {
    var mark = "Define " + name;
    var at = text.indexOf(mark);
    if (at < 0) return "";
    var open = text.indexOf("(", at);
    var close = text.indexOf(");", open);
    return text.slice(open + 1, close);
  }

  function parseChars(body) {
    var chars = [];
    var i = 0;
    while (i < body.length) {
      if (body.charAt(i) !== "'") {
        i++;
        continue;
      }
      i++;
      var ch;
      if (body.charAt(i) === "\\") {
        i++;
        var esc = body.charAt(i++);
        ch = esc === "n" ? "\n" : esc;
      } else {
        ch = body.charAt(i++);
      }
      if (body.charAt(i) === "'") i++;
      chars.push(ch);
    }
    return chars;
  }

  function parseTuples(body, size) {
    var out = [];
    var re = /\(([^)]*)\)/g;
    var match;
    while ((match = re.exec(body))) {
      var nums = match[1].split(",").map(function (part) { return +part; });
      if (nums.length >= size) out.push(nums);
    }
    return out;
  }

  function parseInts(body) {
    var out = [];
    var re = /-?\d+/g;
    var match;
    while ((match = re.exec(body))) out.push(+match[0]);
    return out;
  }

  function field(text, key) {
    var match = text.match(new RegExp("LayerSet" + key + "\\s+Main\\s+(-?\\d+)"));
    return match ? +match[1] : 0;
  }

  function inkSheet(image) {
    var canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;
    var g = canvas.getContext("2d");
    g.drawImage(image, 0, 0);
    var data = g.getImageData(0, 0, canvas.width, canvas.height);
    var px = data.data;
    for (var i = 0; i < px.length; i += 4) {
      var lum = px[i];
      px[i] = 255;
      px[i + 1] = 255;
      px[i + 2] = 255;
      px[i + 3] = lum;
    }
    g.putImageData(data, 0, 0);
    return canvas;
  }

  function build(name, text, image, outline) {
    var chars = parseChars(parseList(text, "CharList0"));
    var widths = parseInts(parseList(text, "WidthList0"));
    var rects = parseTuples(parseList(text, "RectList0"), 4);
    var offsets = parseTuples(parseList(text, "OffsetList0"), 2);
    var map = {};
    for (var i = 0; i < chars.length; i++) {
      map[chars[i]] = {
        w: widths[i] || 0,
        rect: rects[i] || [0, 0, 0, 0],
        ox: offsets[i] ? offsets[i][0] : 0,
        oy: offsets[i] ? offsets[i][1] : 0,
      };
    }
    var layer = text.match(/LayerSetOffset\s+Main\s+\(\s*(-?\d+)\s*,\s*(-?\d+)\s*\)/);
    fonts[name] = {
      map: map,
      image: inkSheet(image),
      outline: outline || null,
      ascent: field(text, "Ascent") || 15,
      height: field(text, "Height") || 19,
      layerX: layer ? +layer[1] : 0,
      layerY: layer ? +layer[2] : 0,
    };
  }

  function prepare() {
    function grab(url) {
      return fetch(url).then(function (res) { return res.text(); });
    }
    var brianne = Assets.image("BrianneTod16");
    var brianne12 = Assets.image("BrianneTod12");
    var terror = Assets.image("HouseofTerror16");
    var outline = Assets.image("HouseofTerror16Outline");
    return Promise.all([
      grab("assets/data/BrianneTod16.txt"),
      grab("assets/data/BrianneTod12.txt"),
      grab("assets/data/HouseofTerror16.txt"),
    ]).then(function (texts) {
      if (brianne) build("BrianneTod16", texts[0], brianne, null);
      if (brianne12) build("BrianneTod12", texts[1], brianne12, null);
      if (terror) build("HouseofTerror16", texts[2], terror, outline);
    }).catch(function (err) {
      console.error(err);
    });
  }

  function glyphOf(font, ch) {
    return font.map[ch] || null;
  }

  function measure(font, text) {
    var width = 0;
    for (var i = 0; i < text.length; i++) {
      var glyph = glyphOf(font, text.charAt(i));
      width += glyph ? glyph.w : 0;
    }
    return width;
  }

  function wrap(font, text, maxW) {
    var lines = [];
    var buf = "";
    var width = 0;
    for (var i = 0; i < text.length; i++) {
      var ch = text.charAt(i);
      if (ch === "\n") {
        lines.push(buf);
        buf = "";
        width = 0;
        continue;
      }
      var glyph = glyphOf(font, ch);
      var advance = glyph ? glyph.w : 0;
      if (buf && width + advance > maxW) {
        lines.push(buf);
        buf = ch;
        width = advance;
      } else {
        buf += ch;
        width += advance;
      }
    }
    if (buf) lines.push(buf);
    return lines;
  }

  var scratch = null;
  function blit(ctx, sheet, glyph, x, y, color) {
    var rect = glyph.rect;
    if (!rect || rect[2] <= 0 || rect[3] <= 0) return;
    if (!scratch) scratch = document.createElement("canvas");
    if (scratch.width < rect[2] || scratch.height < rect[3]) {
      scratch.width = Math.max(scratch.width, rect[2]);
      scratch.height = Math.max(scratch.height, rect[3]);
    }
    var g = scratch.getContext("2d");
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = "source-over";
    g.clearRect(0, 0, rect[2], rect[3]);
    g.drawImage(sheet, rect[0], rect[1], rect[2], rect[3], 0, 0, rect[2], rect[3]);
    if (color) {
      g.globalCompositeOperation = "source-in";
      g.fillStyle = color;
      g.fillRect(0, 0, rect[2], rect[3]);
    }
    ctx.drawImage(scratch, 0, 0, rect[2], rect[3], x, y, rect[2], rect[3]);
  }

  function drawLine(ctx, font, text, x, baseline, color, outline) {
    var pen = x;
    for (var i = 0; i < text.length; i++) {
      var glyph = glyphOf(font, text.charAt(i));
      if (!glyph) continue;
      var left = pen + glyph.ox + font.layerX;
      var top = baseline - font.ascent + glyph.oy + font.layerY;
      if (outline && font.outline) blit(ctx, font.outline, glyph, left, top, null);
      blit(ctx, font.image, glyph, left, top, color);
      pen += glyph.w;
    }
  }

  // 在矩形里水平、垂直居中画一段话。y 用字体的基线，不再加粗描边。
  function drawBox(ctx, name, text, rect, color, outline) {
    var font = fonts[name];
    if (!font) return false;
    var lines = wrap(font, String(text || ""), rect.w);
    var block = lines.length * font.height;
    var top = rect.y + Math.max(0, (rect.h - block) / 2);
    lines.forEach(function (line, index) {
      var width = measure(font, line);
      var x = rect.x + (rect.w - width) / 2;
      var baseline = top + index * font.height + font.ascent;
      drawLine(ctx, font, line, x, baseline, color, outline);
    });
    return true;
  }

  // 图鉴正文和戴夫对话框是同一套点阵字，只是字号和颜色不同。
  // {KEYWORD}/{FLAVOR} 棕，{STAT} 红，其余沿用调用方给的底色。{SHORTLINE} 换段。
  var RICH = {
    KEYWORD: "#9a4820",
    FLAVOR: "#9a4820",
    NOCTURNAL: "#9a4820",
    AQUATIC: "#2c3a66",
    METAL: "#6a5a48",
    STAT: "#d03020",
  };

  function drawTagged(ctx, name, text, rect, color, align) {
    var font = fonts[name];
    if (!font || text == null) return false;
    var runs = [];
    var cur = color || "#000000";
    var src = String(text).replace(/\r/g, "");
    var i = 0;
    while (i < src.length) {
      if (src.charAt(i) === "{") {
        var end = src.indexOf("}", i);
        if (end > i) {
          var tag = src.slice(i + 1, end);
          if (RICH[tag]) cur = RICH[tag];
          else if (tag === "SHORTLINE") runs.push({ ch: "\n", color: cur });
          i = end + 1;
          continue;
        }
      }
      runs.push({ ch: src.charAt(i), color: cur });
      i++;
    }
    var lines = [];
    var line = [];
    var width = 0;
    function pushLine() {
      lines.push({ runs: line, width: width });
      line = [];
      width = 0;
    }
    runs.forEach(function (run) {
      if (run.ch === "\n") {
        pushLine();
        return;
      }
      var glyph = glyphOf(font, run.ch);
      var adv = glyph ? glyph.w : 0;
      if (line.length && width + adv > rect.w) pushLine();
      line.push(run);
      width += adv;
    });
    if (line.length) pushLine();
    var top = rect.y;
    var maxY = rect.y + (rect.h == null ? 1000 : rect.h);
    lines.forEach(function (row) {
      if (top + font.ascent > maxY) return;
      var x = rect.x;
      if (align === "right") x = rect.x + rect.w - row.width;
      else if (align === "center") x = rect.x + (rect.w - row.width) / 2;
      var pen = x;
      var buf = "";
      var bufColor = null;
      function flush() {
        if (!buf) return;
        drawLine(ctx, font, buf, pen, top + font.ascent, bufColor, false);
        pen += measure(font, buf);
        buf = "";
      }
      row.runs.forEach(function (run) {
        if (run.color !== bufColor) {
          flush();
          bufColor = run.color;
        }
        buf += run.ch;
      });
      flush();
      top += font.height;
    });
    return true;
  }

  return { prepare: prepare, drawBox: drawBox, drawTagged: drawTagged };
})();
