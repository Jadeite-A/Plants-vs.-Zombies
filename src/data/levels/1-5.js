// 前院白天 1-5。坚果保龄球。用滚动的坚果撞僵尸；第二周目也是八波。场上先摆好三株豌豆射手，戴夫让你铲掉它们。

defineLevel({
  id: "1-5",
  name: "关卡 1-5",
  waveCount: 8,
  kind: "bowling",
  belt: [
    { id: "wallnut", weight: 85 },
    { id: "explodenut", card: "wallnut", bowl: "explode", weight: 15 },
  ],
  prePlants: [
    { col: 5, row: 1 },
    { col: 7, row: 2 },
    { col: 6, row: 3 },
  ],
});
