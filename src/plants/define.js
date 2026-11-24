// 植物注册器：species/ 目录里每个文件调用 definePlant() 报名。
// 植物登记。每个种类文件调用 definePlant，关卡解锁与否都不影响这里。
var PlantSpecies = [];

function definePlant(def) {
  PlantSpecies.push(def);
  return def;
}
