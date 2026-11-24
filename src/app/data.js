// 只读门面：把 Lawn / PlantCatalog / Adventure 的数据整理成界面要的形状。
// 给界面和输入用的只读门面。数值的主人是 Lawn、PlantCatalog、Adventure，这里只转发。
var Data = {
  W: Lawn.W,
  H: Lawn.H,
  VIEW_X: Lawn.VIEW_X,
  COLS: Lawn.COLS,
  ROWS: Lawn.ROWS,
  COL_W: Lawn.COL_W,
  ROW_H: Lawn.ROW_H,
  LAWN_X: Lawn.LAWN_X,
  LAWN_Y: Lawn.LAWN_Y,
  plants: PlantCatalog.defs,
  anchors: PlantCatalog.anchors,
  aim: PlantCatalog.aim,
  levels: Adventure.levels,
  plantAt: function (col, row, id) {
    return Lawn.plantAt(col, row, id);
  },
  groundY: function (row) {
    return Lawn.groundY(row);
  },
};
