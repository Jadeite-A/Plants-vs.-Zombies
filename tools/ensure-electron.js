// electron 的 postinstall 只挂了一个没有 await 的 Promise。
// Node 26 在解压还没结束时就会把事件循环放空、进程以 0 退出，
// dist 只剩半个 Electron.app，path.txt 也不会写出来，于是 `electron .` 直接报
// “Electron failed to install correctly”。
// 这里在依赖脚本之后把官方 zip 解完整。镜像地址读项目根目录的 .npmrc。
const { execFileSync } = require("child_process");
const fs = require("fs");
const Module = require("module");
const path = require("path");

const root = path.join(__dirname, "..");

function applyNpmrc() {
  const file = path.join(root, ".npmrc");
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const match = line.match(/^\s*([^#=\s]+)\s*=\s*(.*?)\s*$/);
    if (!match) continue;
    const name = match[1].toLowerCase();
    const value = match[2];
    const configKey = "npm_config_" + name.replace(/-/g, "_");
    if (!process.env[configKey]) process.env[configKey] = value;
    if (name.startsWith("electron_")) {
      const envKey = "ELECTRON_" + name.slice("electron_".length).toUpperCase();
      if (!process.env[envKey]) process.env[envKey] = value;
    }
  }
}

function platformPath() {
  if (process.platform === "darwin") return "Electron.app/Contents/MacOS/Electron";
  if (process.platform === "win32") return "electron.exe";
  return "electron";
}

function isReady(electronDir, relativePath) {
  const version = require(path.join(electronDir, "package.json")).version;
  try {
    const installed = fs.readFileSync(path.join(electronDir, "dist", "version"), "utf8").replace(/^v/, "").trim();
    const pointer = fs.readFileSync(path.join(electronDir, "path.txt"), "utf8");
    return installed === version
      && pointer === relativePath
      && fs.existsSync(path.join(electronDir, "dist", relativePath));
  } catch {
    return false;
  }
}

function extractZip(zipPath, dest) {
  fs.rmSync(dest, { recursive: true, force: true });
  fs.mkdirSync(dest, { recursive: true });
  if (process.platform === "darwin") {
    execFileSync("ditto", ["-x", "-k", zipPath, dest], { stdio: "inherit" });
    try {
      execFileSync("xattr", ["-dr", "com.apple.quarantine", path.join(dest, "Electron.app")], { stdio: "ignore" });
    } catch {
      // 没有隔离属性时 xattr 会失败，忽略即可。
    }
    return;
  }
  execFileSync("unzip", ["-q", "-o", zipPath, "-d", dest], { stdio: "inherit" });
}

async function main() {
  applyNpmrc();
  const electronDir = path.dirname(require.resolve("electron/package.json"));
  const relativePath = platformPath();
  if (isReady(electronDir, relativePath)) return;

  const req = Module.createRequire(path.join(electronDir, "package.json"));
  const { downloadArtifact } = req("@electron/get");
  const version = require(path.join(electronDir, "package.json")).version;
  const zipPath = await downloadArtifact({
    version,
    artifactName: "electron",
    platform: process.platform,
    arch: process.arch,
  });
  extractZip(zipPath, path.join(electronDir, "dist"));
  if (!fs.existsSync(path.join(electronDir, "dist", relativePath))) {
    throw new Error("解压后仍找不到 Electron 可执行文件: " + relativePath);
  }
  fs.writeFileSync(path.join(electronDir, "path.txt"), relativePath);
  console.log("Electron " + version + " ready");
}

const keepAlive = setInterval(() => {}, 1000);
main().then(() => {
  clearInterval(keepAlive);
}).catch((err) => {
  clearInterval(keepAlive);
  console.error(err && err.stack ? err.stack : err);
  process.exit(1);
});
