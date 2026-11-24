// 大蒜。被啃时把僵尸赶到相邻一行，自己血量较低。
definePlant({
  "id": "garlic",
  "name": "大蒜",
  "tip": "把僵尸赶到其它前进路线上",
  "cost": 50,
  "cd": 7.5,
  "hp": 400,
  "reanim": "Garlic",
  onBite: function (plant, zombie, board) {
    var rows = (board.level.rows || []).filter(function (row) { return Math.abs(row - zombie.row) === 1; });
    if (!rows.length) return;
    zombie.row = rows[Math.floor(Math.random() * rows.length)];
    zombie.x += 18;
  }
});
