// 僵尸注册器：species/ 目录里每个文件调用 defineZombie() 报名。
// 僵尸登记。每个种类文件调用 defineZombie。能不能出现在某一关，由关卡和地形决定，不写在这里。
var ZombieSpecies = [];

var ZOMBIE_SOUNDS = {
  groan: ["groan", "groan2", "groan3", "groan4", "groan5", "groan6"],
  bite: ["chomp", "chomp2"],
  biteKill: "gulp",
  armorBreak: "limbs_pop",
  armDrop: "limbs_pop",
  hurt: ["splat", "splat2", "splat3"],
};

function defineZombie(def) {
  // 基础僵尸没有独立的 idle 段，站桩用 anim_idle2（原版预览僵尸就是小幅摇晃）。
  def.anims = def.anims || { idle: "anim_idle2", walk: "anim_walk", eat: "anim_eat", die: "anim_death" };
  def.attack = def.attack || { anim: "anim_eat", windup: 0.4, recover: 0.6, interval: 1, damage: 70 };
  if (def.hp == null) def.hp = 160;
  if (def.speed == null) def.speed = 18;
  if (def.armAt == null) def.armAt = 70;
  def.reanim = def.reanim || "Zombie";
  // 种类自带的声音和默认组合并，覆盖同名项。
  var merged = {};
  Object.keys(ZOMBIE_SOUNDS).forEach(function (key) { merged[key] = ZOMBIE_SOUNDS[key]; });
  if (def.sounds) Object.keys(def.sounds).forEach(function (key) { merged[key] = def.sounds[key]; });
  def.sounds = merged;
  def.locomotion = def.locomotion || "walk";
  ZombieSpecies.push(def);
  return def;
}
