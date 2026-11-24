// 量出 pvz_goty_02.jpg 中间黑色内框的边界（放进度条用）。
// 只用 png 库不方便，这里手写一个最小的 JPEG 解码不可行——改用 Electron 无头截图太重。
// 简化方案：把 jpg 转成 png 再用纯 JS 解码没有现成依赖。
// 直接用项目里已装的 electron？太重。用 Canvas 需要浏览器。
// 所以这里用最笨但可靠的办法：调用 powershell 的 System.Drawing。
