// 后院浓雾 4-10。冒险模式第 40 关的传送带（不是小游戏暴风雨夜那张表）：
// 荷叶、海蘑菇、磁力菇、三叶草、仙人掌、杨桃、双向射手、南瓜头。

defineLevel({
  id: "4-10",
  name: "关卡 4-10",
  waveCount: 20,
  kind: "conveyor",
  dark: true,
  belt: [
    { id: "lilypad", weight: 25 },
    { id: "seashroom", weight: 10 },
    { id: "magnetshroom", weight: 5 },
    { id: "blover", weight: 5 },
    { id: "cactus", weight: 15 },
    { id: "starfruit", weight: 25 },
    { id: "splitpea", weight: 5 },
    { id: "pumpkin", weight: 10 },
  ],
});
