/*
 * view-shop.js — 戴夫对话和杂货店。
 *
 * screen === "dave"  进关前的过场、卡槽推销、杂货店开张。
 * screen === "store" 主菜单商店。货架内容来自 Shop.stock(当前档案)。
 *
 * 商店画面照 StoreScreen.cpp：
 *   戴夫站在左边，anim_idle 以 12 帧/秒左右摇摆；
 *   鼠标停在商品上，用对话框念出这条商品的介绍；
 *   上一页 / 下一页是车尾灯，点下去后备箱合上再打开，货架换成新的一页。
 */
(function () {
  var Kit = window.ViewKit;
  var label = Kit.label;
  var font = Kit.font;
  var drawPacket = Kit.drawPacket;
  var drawStoneDialog = Kit.drawStoneDialog;
  var wrapText = Kit.wrapText;
  var screens = Kit.screens;

  var PAGE = 8;
  // 原版 GetStorePosition：上排 x=422 起、下排 x=372 起，间距 74。
  var SPOTS = [
    { x: 422, y: 206 }, { x: 496, y: 206 }, { x: 570, y: 206 }, { x: 644, y: 206 },
    { x: 372, y: 310 }, { x: 446, y: 310 }, { x: 520, y: 310 }, { x: 594, y: 310 },
  ];

  var masked = {};

  function goodsOf(state) {
    var profile = state.profile;
    if (!profile) return [];
    return Shop.stock(profile);
  }

  function pageCount(state) {
    return Math.max(1, Math.ceil(goodsOf(state).length / PAGE));
  }

  function pageItems(state) {
    var store = state.store || { page: 0 };
    var pages = pageCount(state);
    var page = Math.max(0, Math.min(pages - 1, store.page || 0));
    var all = goodsOf(state);
    return all.slice(page * PAGE, page * PAGE + PAGE);
  }

  function shakeOf(state) {
    return (state.store && state.store.shake) || 0;
  }

  function itemRect(index) {
    var spot = SPOTS[index] || SPOTS[0];
    return { x: spot.x, y: spot.y, w: 50, h: 87 };
  }

  function prevRect(state) {
    return { x: 252, y: 402 + shakeOf(state), w: 96, h: 75 };
  }

  function nextRect(state) {
    return { x: 596, y: 402 + shakeOf(state), w: 136, h: 83 };
  }

  function backRect(state) {
    return { x: 366, y: 512 + shakeOf(state), w: 138, h: 80 };
  }

  function confirmBox() { return { x: 150, y: 168, w: 500, h: 230 }; }
  function confirmYes() { return { x: 210, y: 330, w: 150, h: 44 }; }
  function confirmNo() { return { x: 430, y: 330, w: 150, h: 44 }; }
  function daveYes() { return { x: 70, y: 470, w: 150, h: 46 }; }
  function daveNo() { return { x: 250, y: 470, w: 150, h: 46 }; }

  function canClick(state) {
    var store = state.store || {};
    return (store.age || 0) >= 1.2 && !(store.hatch > 0) && !store.confirm;
  }

  // 车身 jpg 的遮罩是黑白亮度，不是透明通道。白的留下，黑的抠掉。
  function blit(ctx, id, x, y) {
    var image = Assets.image(id);
    if (!image) return null;
    var mask = Assets.imageMask(id);
    if (!mask) {
      ctx.drawImage(image, x, y);
      return image;
    }
    if (!masked[id]) {
      var canvas = document.createElement("canvas");
      canvas.width = image.width;
      canvas.height = image.height;
      var g = canvas.getContext("2d");
      g.drawImage(image, 0, 0);
      var hold = document.createElement("canvas");
      hold.width = image.width;
      hold.height = image.height;
      var hg = hold.getContext("2d");
      hg.drawImage(mask, 0, 0, image.width, image.height);
      var src = g.getImageData(0, 0, image.width, image.height);
      var cut = hg.getImageData(0, 0, image.width, image.height);
      var s = src.data;
      var d = cut.data;
      for (var i = 0; i < s.length; i += 4) s[i + 3] = (s[i + 3] * d[i]) / 255;
      g.putImageData(src, 0, 0);
      masked[id] = canvas;
    }
    ctx.drawImage(masked[id], x, y);
    return image;
  }

  function money(n) {
    var text = String(Math.max(0, n | 0));
    var out = "";
    for (var i = 0; i < text.length; i++) {
      if (i && (text.length - i) % 3 === 0) out += ",";
      out += text.charAt(i);
    }
    return "$" + out;
  }

  function drawIcon(ctx, item, rect) {
    if (item.plant) {
      drawPacket(ctx, item.plant, { x: rect.x, y: rect.y, w: 50, h: 70 }, {});
      return;
    }
    var dx = 0;
    var dy = 7;
    if (item.id === "slot") { dx = -7; dy = 7; }
    else if (item.id === "pool") { dx = 1; dy = 7; }
    else if (item.id === "rake") { dx = -5; dy = 10; }
    else if (item.id === "roof") { dx = 0; dy = 28; }
    var image = Assets.image(item.icon);
    if (image) ctx.drawImage(image, rect.x + dx, rect.y + dy);
    if (item.id === "slot") {
      label(ctx, String((item.name || "").replace(/\D/g, "") || "7"), rect.x + 25, rect.y + 28, {
        font: font(18), align: "center", fill: "#fff", line: 2,
      });
      label(ctx, "卡片槽", rect.x + 25, rect.y + 48, {
        font: font(12), align: "center", fill: "#fff", line: 2,
      });
    }
  }

  function drawBubble(ctx, text) {
    var bubble = Assets.image("Store_SpeechBubble");
    if (bubble) ctx.drawImage(bubble, 105, -58);
    // 原版 DrawCrazyDave：字在气泡里 (25, 6, 233×144)，字体 FONT_BRIANNETOD16，黑色，没有描边。
    BitmapFont.drawBox(ctx, "BrianneTod16", text, { x: 130, y: -52, w: 233, h: 144 }, "#000000", false);
  }

  function signY(age) {
    if (age <= 0.5) return -150;
    if (age >= 1.1) return 0;
    var u = (age - 0.5) / 0.6;
    var s = u * u * (3 - 2 * u);
    return -150 + 150 * s;
  }

  function drawStore(ctx, state) {
    var bg = Assets.image("Store_Background");
    if (bg) ctx.drawImage(bg, 0, 0, 800, 600);
    else {
      ctx.fillStyle = "#6ea2c8";
      ctx.fillRect(0, 0, 800, 600);
    }

    var store = state.store || { page: 0 };
    var shake = store.shake || 0;
    var open = !(store.hatch > 0);
    if (open) {
      blit(ctx, "Store_Car", 196 + 0, 138 + shake);
      blit(ctx, "Store_HatchbackOpen", 299, shake);
    } else {
      blit(ctx, "Store_CarClosed", 196, 138 + shake);
    }
    blit(ctx, "Store_Sign", 285, signY(store.age || 0));

    ctx.save();
    ctx.translate(-42, 68 + shake);
    if (store.bubble) drawBubble(ctx, store.bubble);
    var pose = store.talkAnim
      ? { anim: store.talkAnim, time: store.talkT || 0, once: true, rate: 12 }
      : { anim: "anim_idle", time: state.time || 0, rate: 12 };
    drawDave(ctx, state.time || 0, 0, 0, 1, pose);
    ctx.restore();

    var profile = state.profile;
    var coins = profile && profile.wallet ? profile.wallet.coins : 0;
    if (open) {
      var items = pageItems(state);
      items.forEach(function (item, index) {
        var rect = itemRect(index);
        rect = { x: rect.x, y: rect.y + shake, w: rect.w, h: rect.h };
        drawIcon(ctx, item, rect);
        blit(ctx, "Store_PriceTag", rect.x - 3, rect.y + 70);
        label(ctx, money(item.cost), rect.x + 23, rect.y + 78, {
          font: font(12, false), align: "center", fill: "#000", line: 0,
        });
        if (item.owned) {
          // 原版在 50×70 的卡片里居中画 FONT_HOUSEOFTERROR16，纯红，细描边来自字模本身。
          BitmapFont.drawBox(ctx, "HouseofTerror16", "已售出", rect, "#ff0000", true);
        }
      });
    }

    blit(ctx, "coinbank", 650, 559);
    label(ctx, money(coins), 766, 578, {
      font: font(14), align: "right", base: "alphabetic", fill: "#b4ff5a", line: 0,
    });

    var pages = pageCount(state);
    var page = Math.max(0, Math.min(pages - 1, store.page || 0));
    if (pages > 1) {
      label(ctx, pages + "的第" + (page + 1) + "页", 470, 500 + shake, {
        font: font(12, false), align: "center", fill: "#505050", line: 0,
      });
    }

    var prevId = pages > 1 ? (state.hover === "store-prev" ? "Store_PrevButtonHighlight" : "Store_PrevButton") : "Store_PrevButtonDisabled";
    var nextId = pages > 1 ? (state.hover === "store-next" ? "Store_NextButtonHighlight" : "Store_NextButton") : "Store_NextButtonDisabled";
    blit(ctx, prevId, prevRect(state).x, prevRect(state).y);
    blit(ctx, nextId, nextRect(state).x, nextRect(state).y);
    var backId = state.hover === "back" ? "Store_MainMenuButtonHighlight" : "Store_MainMenuButton";
    var back = backRect(state);
    blit(ctx, backId, back.x, back.y);
    label(ctx, "主菜单", back.x + back.w / 2 - 7, back.y + back.h / 2 + 1, {
      font: font(20), align: "center", fill: state.hover === "back" ? "#a7c0eb" : "#6299eb", line: 0,
    });

    if (store.confirm && profile) {
      var item = Shop.find(profile, store.confirm);
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      ctx.fillRect(0, 0, 800, 600);
      var box = confirmBox();
      drawStoneDialog(ctx, box, box.y + box.h - 90);
      var ask = item ? ("花费 " + item.cost + " 金币购买「" + item.name + "」？") : "这件商品已经下架了。";
      wrapText(ctx, ask, box.x + 48, box.y + 78, box.w - 90, box.y + 200, { font: font(20), fill: "#fff4c8", line: 3, lineH: 28 });
      Kit.stoneButton(ctx, confirmYes(), "买下", state.hover === "store-yes");
      Kit.stoneButton(ctx, confirmNo(), "再想想", state.hover === "store-no");
    }
  }

  // 戴夫的待机是 anim_idle，原版按 12 帧/秒循环，身子跟着左右晃。
  // 说话时改播对应的 talk 段，播完由游戏逻辑切回待机。
  function drawDave(ctx, time, x, y, scale, pose) {
    var reanim = Assets.reanim("CrazyDave");
    if (!reanim) return;
    pose = pose || { anim: "anim_idle", time: time, rate: 12 };
    var anim = reanim.anims[pose.anim] || reanim.anims.anim_idle;
    if (!anim) return;
    var length = Math.max(1, anim.end - anim.start + 1);
    var index = (pose.time != null ? pose.time : time) * (pose.rate || 12);
    if (pose.once) index = Math.min(length - 1, Math.max(0, index));
    else index = ((index % length) + length) % length;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale || 1, scale || 1);
    Reanim.draw(ctx, reanim, anim.start + index, 0, 0, pose.center ? { center: true } : null);
    ctx.restore();
  }

  function drawDaveScreen(ctx, state) {
    var level = state.level;
    var backdrop = level && level.terrain && Assets.image(level.terrain.background);
    if (backdrop) ctx.drawImage(backdrop, 0, 0, 800, 600);
    else {
      var shopBg = Assets.image("Store_Background");
      if (shopBg) ctx.drawImage(shopBg, 0, 0, 800, 600);
      else {
        ctx.fillStyle = "#87b84a";
        ctx.fillRect(0, 0, 800, 600);
      }
    }
    ctx.fillStyle = "rgba(0,0,0,0.28)";
    ctx.fillRect(0, 0, 800, 600);
    drawDave(ctx, state.time || 0, 690, 20, 0.52);
    var dave = state.dave;
    var box = { x: 36, y: 70, w: 470, h: 360 };
    drawStoneDialog(ctx, box, box.y + box.h - 110);
    var line = dave && dave.lines && dave.lines[dave.index || 0];
    var text = line ? line.text : "";
    wrapText(ctx, text, box.x + 46, box.y + 78, box.w - 86, box.y + 250, { font: font(22), fill: "#fff6c8", line: 4, lineH: 32 });
    if (dave && dave.asking) {
      Kit.stoneButton(ctx, daveYes(), "好啊", state.hover === "dave-yes");
      Kit.stoneButton(ctx, daveNo(), "算了", state.hover === "dave-no");
    } else {
      label(ctx, "点击继续", 250, 390, { font: font(16), align: "center", fill: "#ffe7b0", line: 3 });
    }
  }

  function storeHover(state, x, y) {
    var store = state.store || { page: 0 };
    if (store.confirm) {
      if (Kit.inside(x, y, confirmYes())) return "store-yes";
      if (Kit.inside(x, y, confirmNo())) return "store-no";
      return null;
    }
    if (!canClick(state)) return null;
    var items = pageItems(state);
    var shake = shakeOf(state);
    for (var i = 0; i < items.length; i++) {
      var rect = itemRect(i);
      if (Kit.inside(x, y, { x: rect.x, y: rect.y + shake, w: rect.w, h: rect.h })) return "goods:" + items[i].id;
    }
    var pages = pageCount(state);
    if (pages > 1 && Kit.inside(x, y, prevRect(state))) return "store-prev";
    if (pages > 1 && Kit.inside(x, y, nextRect(state))) return "store-next";
    if (Kit.inside(x, y, backRect(state))) return "back";
    return null;
  }

  function daveHover(state, x, y) {
    var dave = state.dave;
    if (dave && dave.asking) {
      if (Kit.inside(x, y, daveYes())) return "dave-yes";
      if (Kit.inside(x, y, daveNo())) return "dave-no";
      return null;
    }
    return "dave-next";
  }

  screens.store = drawStore;
  screens.dave = drawDaveScreen;
  Kit.shop = { hover: storeHover };
  Kit.dave = { hover: daveHover };
})();
