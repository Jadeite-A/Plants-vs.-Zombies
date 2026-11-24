/*
 * auto-accounts.js — "更改用户"流程的自动化脚本（配合 PVZ_AUTO=1 使用）。
 *
 * 在渲染端页面上下文里执行：用真实的 mousedown / keydown 事件把界面走一遍，
 * 关键节点 console.log("AUTO_SHOT:标签") 交给主进程截图（见 electron/main.js）。
 * 所有坐标都从 ViewKit.menu 暴露的几何函数现场算，不写死，界面挪了也不用改。
 *
 * 剧情对账户数据是"自愈"的：建一个新用户、改名、最后删掉它，
 * 跑完之后账户列表和跑之前一样；重名校验用当前用户自己的名字来撞。
 */
module.exports = async function () {
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const canvas = document.getElementById("game");
  const menu = window.ViewKit.menu;
  const click = (x, y) =>
    canvas.dispatchEvent(new MouseEvent("mousedown", { clientX: x, clientY: y, button: 0, bubbles: true }));
  const press = (key) => window.dispatchEvent(new KeyboardEvent("keydown", { key: key }));
  const shot = (label) => console.log("AUTO_SHOT:" + label);
  const center = (rect) => [rect.x + rect.w / 2, rect.y + rect.h / 2];

  // 等资源就绪、可进主菜单。
  for (let i = 0; i < 200 && !window.Game.state.ready; i++) await sleep(200);
  await sleep(300);
  click(400, 300); // 加载画面任意点进主菜单
  await sleep(1200);
  shot("1-menu");

  // 点"更改用户"木牌 → 你是谁
  let sign = menu.trackAt("woodsign2");
  click(sign.x + 150, sign.y + 30);
  await sleep(700);
  shot("2-list");

  // 点"（创建一个新的玩家）"，先敲一个必然重名的名字（当前用户名）→ 提示框
  const before = window.Accounts.list();
  click(...center(menu.acctNewRect()));
  await sleep(700);
  shot("3-new");
  before[0].name.split("").forEach(press);
  press("Enter");
  await sleep(700);
  shot("4-duplicate");
  press("Enter"); // 提示框确定 → 回到输入框，名字还留着
  await sleep(400);
  for (let i = 0; i < 20; i++) press("Backspace"); // 清空，换成不重名的
  const unique = "T" + String(Date.now()).slice(-6);
  unique.split("").forEach(press);
  press("Enter");
  await sleep(700);
  shot("5-created");

  // 新用户建好即选中：点重命名，名字后面补个"2"
  click(...center(menu.acctButtonRect("rename")));
  await sleep(700);
  press("2");
  press("Enter");
  await sleep(700);
  shot("6-renamed");

  // 删掉这个新用户，激活用户应自动落回之前的那个
  click(...center(menu.acctButtonRect("del")));
  await sleep(700);
  shot("7-deleted");
  click(...center(menu.acctButtonRect("cancel")));
  await sleep(500);
  const after = window.Accounts.list();
  console.log(
    "AUTO_CHECK users " + before.length + "->" + after.length +
    " active=" + window.Game.state.accountName
  );
  console.log("AUTO_DONE");
};
