// 资源装载：贴图与 reanim，从 assets/manifest.json 读清单（引擎核心）。
// 贴图和 reanim。文件名去掉 IMAGE_REANIM_ / IMAGE_ 后压成小写字母数字。
// 以下划线结尾的文件是遮罩，键名再加 "mask"，主菜单剪影用它。
var Assets = (function () {
  var images = new Map();
  var reanims = {};

  function norm(id) {
    return String(id)
      .replace(/^IMAGE_REANIM_/i, "")
      .replace(/^IMAGE_/i, "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
  }

  function image(id) {
    return images.get(norm(id)) || null;
  }

  function imageMask(id) {
    return images.get(norm(id) + "mask") || null;
  }

  function loadImage(url) {
    return new Promise(function (resolve) {
      var img = new Image();
      img.onload = function () {
        var file = decodeURIComponent(url.split("/").pop());
        var base = file.replace(/\.[^.]+$/, "");
        var key = norm(base);
        // 以下划线结尾的文件是遮罩（受击变色、主菜单剪影用），只登记 "mask" 键。
        if (/_$/.test(base)) key += "mask";
        images.set(key, img);
        resolve(img);
      };
      img.onerror = function () {
        resolve(null);
      };
      img.src = url;
    });
  }

  function loadText(url) {
    return fetch(url).then(function (res) {
      if (!res.ok) throw new Error(url);
      return res.text();
    });
  }

  function load(onProgress) {
    return fetch("assets/manifest.json")
      .then(function (res) {
        return res.json();
      })
      .then(function (files) {
        var jobs = [];
        files.forEach(function (file) {
          if (/\.(png|jpg|jpeg)$/i.test(file)) jobs.push({ kind: "image", file: file });
          else if (/\.reanim$/i.test(file)) jobs.push({ kind: "reanim", file: file });
        });
        // 启动画面自己的画（PopCap 闪屏、背景、进度条、草卷、苗、僵尸头）排最前，
        // 否则 0% 时进度条的素材还没到，画面会先秃一截。
        var PRIORITY = [
          "images/PopCap_Logo.jpg",
          "images/titlescreen.jpg",
          "images/ad/Logo.png",
          "images/LoadBar_dirt.png",
          "images/LoadBar_grass.png",
          "reanim/SodRollCap.png",
          "reanim/LoadBar_sprout.reanim",
          "reanim/sprout_body.png",
          "reanim/sprout_petal.png",
          "reanim/anim_sprout.png",
          "reanim/PotatoMine_rock1.png",
          "reanim/PotatoMine_rock3.png",
          "reanim/LoadBar_Zombiehead.reanim",
          "reanim/Zombie_head.png",
          "reanim/Zombie_hair.png",
          "reanim/Zombie_jaw.png",
        ];
        var rank = {};
        PRIORITY.forEach(function (file, index) {
          rank[file] = index;
        });
        jobs.sort(function (a, b) {
          return (rank[a.file] != null ? rank[a.file] : 99) - (rank[b.file] != null ? rank[b.file] : 99);
        });
        var done = 0;
        return Promise.all(
          jobs.map(function (job) {
            var url = "assets/" + job.file;
            var task =
              job.kind === "image"
                ? loadImage(url)
                : loadText(url).then(function (xml) {
                    var name = job.file.split("/").pop().replace(/\.reanim$/, "");
                    reanims[name] = Reanim.parse(xml);
                  });
            return task.then(function () {
              done++;
              if (onProgress) onProgress(done / jobs.length);
            });
          })
        ).then(function () {
          // 戴夫的上衣是黑底 jpg，配一张黑白亮度遮罩。抠掉之后身子才接得上头和手。
          bakeLuminanceMask("CrazyDave_body1");
          if (window.BitmapFont) return BitmapFont.prepare();
        });
      });
  }

  function bakeLuminanceMask(id) {
    var image = images.get(norm(id));
    var mask = imageMask(id);
    if (!image || !mask) return;
    var canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;
    var g = canvas.getContext("2d");
    g.drawImage(image, 0, 0);
    var hold = document.createElement("canvas");
    hold.width = image.width;
    hold.height = image.height;
    hold.getContext("2d").drawImage(mask, 0, 0, image.width, image.height);
    var src = g.getImageData(0, 0, canvas.width, canvas.height);
    var cut = hold.getContext("2d").getImageData(0, 0, canvas.width, canvas.height);
    var s = src.data;
    var d = cut.data;
    for (var i = 0; i < s.length; i += 4) s[i + 3] = (s[i + 3] * d[i]) / 255;
    g.putImageData(src, 0, 0);
    images.set(norm(id), canvas);
  }

  return {
    load: load,
    image: image,
    imageMask: imageMask,
    reanim: function (name) {
      return reanims[name];
    },
  };
})();
