// 前院白天 1-10。传送带。卡从右边滚进来，不用阳光，天上不掉阳光。

defineLevel({
  id: "1-10",
  name: "关卡 1-10",
  waveCount: 20,
  kind: "conveyor",
  belt: [
    { id: "peashooter", weight: 20 },
    { id: "cherry", weight: 20 },
    { id: "wallnut", weight: 15 },
    { id: "repeater", weight: 20 },
    { id: "snowpea", weight: 10 },
    { id: "chomper", weight: 5 },
    { id: "potatomine", weight: 10 },
  ],
});
