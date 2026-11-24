// 草坪几何：格子尺寸、镜头、锚点换算（引擎核心，纯数据+纯函数）。
// 草坪格子和镜头。背景图比窗口宽，VIEW_X 是开战时裁掉的左边房子部分。
// 植物锚点对齐格子中心后再右移 12、上移 20，和僵尸的落脚线分开调过，不要一起改。
var Lawn = {
  W: 800,
  H: 600,
  VIEW_X: 200,
  COLS: 9,
  ROWS: 5,
  COL_W: 80,
  ROW_H: 96,
  LAWN_X: 51,
  LAWN_Y: 82,

  plantAt: function (col, row, id) {
    var anchor = PlantCatalog.anchor(id);
    return {
      x: this.LAWN_X + col * this.COL_W + this.COL_W / 2 - anchor.x + 12,
      y: this.LAWN_Y + row * this.ROW_H + this.ROW_H / 2 - anchor.y - 20,
    };
  },

  groundY: function (row) {
    return this.LAWN_Y + row * this.ROW_H + 70;
  },

  cellLeft: function (col) {
    return this.LAWN_X + col * this.COL_W;
  },
};
