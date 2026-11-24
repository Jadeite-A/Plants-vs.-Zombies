// 规则注册表：护甲/行进/召唤/玩法钩子等跨物种共享行为都挂这里。
// 共用规则。植物和僵尸的攻击不登记在这里，而在各自的种类文件里。
// 这里留下护甲、召唤，以及还没被种类文件接管的行进样例。
//
// "mode" 组：按关卡 kind 注册玩法钩子（保龄球、传送带等）。物种文件用
// "mode-zombie" 组按 "关卡种类:僵尸id" 登记该玩法下的专用行为，
// 由 Zombie.update 统一分发。关卡和物种互相都不直接引用对方。
var Rules = {
  locomotion: {},
  attack: {},
  armor: {},
  plant: {},
  special: {},
  mode: {},
  "mode-zombie": {},

  add: function (group, id, handler) {
    this[group][id] = handler;
    return handler;
  },

  use: function (group, id) {
    return this[group][id] || null;
  },
};
