// 模式注册：主菜单四个入口 + 关卡玩法（kind）的通用钩子分发。
// 主菜单四个模式。只有冒险模式 open。其余先占着入口，打开时改 open 即可。
// 同时登记关卡玩法（kind）的通用钩子：物种在 "mode-zombie" 组按
// "关卡种类:僵尸id" 提供专用行为，这里只做分发，不含任何物种细节。
var GameModes = {
  list: [
    { id: "adventure", name: "冒险模式", open: true },
    { id: "minigame", name: "迷你游戏", open: false },
    { id: "puzzle", name: "益智模式", open: false },
    { id: "survival", name: "生存模式", open: false },
  ],

  get: function (id) {
    for (var i = 0; i < this.list.length; i++) {
      if (this.list[i].id === id) return this.list[i];
    }
    return null;
  },
};

Rules.add("mode", "bowling", {
  zombieUpdate: function (zombie, board, dt) {
    var special = Rules.use("mode-zombie", "bowling:" + zombie.kindId);
    if (!special) return false;
    return !!special(zombie, board, dt);
  },
});
