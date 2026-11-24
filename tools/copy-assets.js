const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const resource = path.join(root, "resource");
const out = path.join(root, "assets");

function norm(name) {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function indexDir(dir) {
  const map = new Map();
  if (!fs.existsSync(dir)) return map;
  for (const file of fs.readdirSync(dir)) {
    const ext = path.extname(file).toLowerCase();
    if (![".png", ".jpg", ".jpeg"].includes(ext)) continue;
    const base = file.slice(0, -ext.length);
    // 文件名以 _ 结尾的是亮度遮罩，不能跟正图抢同一个键，否则 jpg 身体会被遮罩 png 顶掉。
    const key = norm(base) + (base.endsWith("_") ? "mask" : "");
    const full = path.join(dir, file);
    const prev = map.get(key);
    if (!prev || ext === ".png") map.set(key, full);
  }
  return map;
}

const reanimIndex = indexDir(path.join(resource, "reanim"));
const imageIndex = indexDir(path.join(resource, "images"));

function findImage(id) {
  const key = norm(id.replace(/^IMAGE_REANIM_/, "").replace(/^IMAGE_/, ""));
  return reanimIndex.get(key) || imageIndex.get(key) || null;
}

function findMask(id) {
  const key = norm(id.replace(/^IMAGE_REANIM_/, "").replace(/^IMAGE_/, "")) + "mask";
  return reanimIndex.get(key) || imageIndex.get(key) || null;
}

const reanims = [
  "SelectorScreen.reanim",
  "PeaShooterSingle.reanim",
  "PeaShooter.reanim",
  "SunFlower.reanim",
  "CherryBomb.reanim",
  "Wallnut.reanim",
  "PotatoMine.reanim",
  "SnowPea.reanim",
  "Chomper.reanim",
  "PuffShroom.reanim",
  "SunShroom.reanim",
  "FumeShroom.reanim",
  "Gravebuster.reanim",
  "HypnoShroom.reanim",
  "ScaredyShroom.reanim",
  "IceShroom.reanim",
  "DoomShroom.reanim",
  "LilyPad.reanim",
  "Squash.reanim",
  "ThreePeater.reanim",
  "Tanglekelp.reanim",
  "Jalapeno.reanim",
  "Caltrop.reanim",
  "Torchwood.reanim",
  "Tallnut.reanim",
  "SeaShroom.reanim",
  "Plantern.reanim",
  "Cactus.reanim",
  "Blover.reanim",
  "SplitPea.reanim",
  "Starfruit.reanim",
  "Pumpkin.reanim",
  "Magnetshroom.reanim",
  "Cabbagepult.reanim",
  "Pot.reanim",
  "Cornpult.reanim",
  "Coffeebean.reanim",
  "Garlic.reanim",
  "Umbrellaleaf.reanim",
  "Marigold.reanim",
  "Melonpult.reanim",
  "GatlingPea.reanim",
  "TwinSunflower.reanim",
  "GloomShroom.reanim",
  "Cattail.reanim",
  "WinterMelon.reanim",
  "GoldMagnet.reanim",
  "SpikeRock.reanim",
  "CobCannon.reanim",
  "Imitater.reanim",
  "Zombie.reanim",
  "Zombie_flagpole.reanim",
  "Zombie_polevaulter.reanim",
  "Zombie_paper.reanim",
  "Zombie_football.reanim",
  "Zombie_dancer.reanim",
  "Zombie_disco.reanim",
  "Zombie_backup.reanim",
  "Zombie_snorkle.reanim",
  "Zombie_zamboni.reanim",
  "Zombie_bobsled.reanim",
  "Zombie_dolphinrider.reanim",
  "Zombie_jackbox.reanim",
  "Zombie_balloon.reanim",
  "Zombie_digger.reanim",
  "Zombie_pogo.reanim",
  "Zombie_yeti.reanim",
  "Zombie_bungi.reanim",
  "Zombie_ladder.reanim",
  "Zombie_catapult.reanim",
  "Zombie_gargantuar.reanim",
  "Zombie_imp.reanim",
  "Zombie_boss.reanim",
  "SodRoll.reanim",
  "LoadBar_sprout.reanim",
  "LoadBar_Zombiehead.reanim",
  "LawnMower.reanim",
  "PoolCleaner.reanim",
  "RoofCleaner.reanim",
  "Sun.reanim",
  "CrazyDave.reanim",
  "Rake.reanim",
];

const ids = new Set();
for (const file of reanims) {
  const xml = fs.readFileSync(path.join(resource, "reanim", file), "utf8");
  for (const match of xml.matchAll(/<i>([^<]+)<\/i>/g)) ids.add(match[1]);
}
["IMAGE_REANIM_WALLNUT_CRACKED1", "IMAGE_REANIM_WALLNUT_CRACKED2", "IMAGE_REANIM_TALLNUT_CRACKED1", "IMAGE_REANIM_TALLNUT_CRACKED2", "IMAGE_REANIM_PUMPKIN_DAMAGE1", "IMAGE_REANIM_PUMPKIN_DAMAGE2", "IMAGE_REANIM_PUMPKIN_DAMAGE3", "IMAGE_REANIM_SUN1", "IMAGE_REANIM_SUN2", "IMAGE_REANIM_SUN3", "IMAGE_REANIM_ZOMBIE_CONE2", "IMAGE_REANIM_ZOMBIE_CONE3", "IMAGE_REANIM_ZOMBIE_BUCKET2", "IMAGE_REANIM_ZOMBIE_BUCKET3", "IMAGE_REANIM_ZOMBIE_SCREENDOOR2", "IMAGE_REANIM_ZOMBIE_SCREENDOOR3", "IMAGE_REANIM_ZOMBIE_FLAG3"].forEach((id) => ids.add(id));

const ui = [
  "images/background1.jpg",
  "images/background1unsodded.jpg",
  "images/background2.jpg",
  "images/background3.jpg",
  "images/background4.jpg",
  "images/background5.jpg",
  "images/background6boss.jpg",
  "images/pool.jpg",
  "images/pool_night.jpg",
  "images/fog_software.png",
  "images/seeds.png",
  "images/packet_plants.png",
  "images/SeedPacketSilhouette.png",
  "images/Night_grave_graphic.png",
  "images/Scary_Pot.png",
  "images/Tombstones.jpg",
  "images/Tombstones_.png",
  "images/Tombstone_mounds.png",
  "images/sod1row.png",
  "images/SeedBank.png",
  "images/SeedChooser_Background.png",
  "images/SeedChooser_Button.png",
  "images/SeedChooser_Button_Glow.png",
  "images/SeedChooser_Button_Disabled.png",
  "images/SeedChooser_ImitaterAddOn.png",
  "images/ImitaterSeed.png",
  "images/ImitaterSeedDisabled.png",
  "images/dialog_header.png",
  "images/dialog_topleft.png",
  "images/dialog_topmiddle.png",
  "images/dialog_topright.png",
  "images/dialog_centerleft.png",
  "images/dialog_centermiddle.png",
  "images/dialog_centerright.png",
  "images/dialog_bigbottomleft.png",
  "images/dialog_bigbottommiddle.png",
  "images/dialog_bigbottomright.png",
  "images/SeedPacket_Larger.png",
  "images/Shovel.png",
  "images/ShovelBank.png",
  "images/ProjectilePea.png",
  "images/ProjectileSnowPea.png",
  "images/Projectile_star.png",
  "images/ProjectileCactus.png",
  "reanim/FirePea.png",
  "reanim/puff_1.png",
  "reanim/Cabbagepult_cabbage.png",
  "reanim/Melonpult_melon.png",
  "reanim/WinterMelon_projectile.png",
  "reanim/Cornpult_kernal.png",
  "reanim/Cornpult_butter.png",
  "reanim/CobCannon_cob.png",
  "images/plantshadow.png",
  "images/pea_shadows.png",
  "images/AwardScreen_Back.jpg",
  "images/titlescreen.jpg",
  "images/titlescreen_new.jpg",
  "images/ad/Logo.png",
  "images/ad/Loading_frame.png",
  "images/LoadBar_dirt.png",
  "images/LoadBar_grass.png",
  "images/SelectorScreen_Almanac.png",
  "images/SelectorScreen_AlmanacHighlight.png",
  "images/SelectorScreen_Store.png",
  "images/SelectorScreen_StoreHighlight.png",
  "images/Store_Background.jpg",
  "images/Store_Car.jpg",
  "images/Store_Car_.png",
  "images/Store_CarClosed.jpg",
  "images/Store_CarClosed_.png",
  "images/Store_HatchbackOpen.png",
  "images/Store_Sign.png",
  "images/Store_PrevButton.png",
  "images/Store_PrevButtonHighlight.png",
  "images/Store_PrevButtonDisabled.png",
  "images/Store_NextButton.png",
  "images/Store_NextButtonHighlight.png",
  "images/Store_NextButtonDisabled.png",
  "images/Store_MainMenuButton.png",
  "images/Store_MainMenuButtonHighlight.png",
  "images/Store_MainMenuButtonDown.png",
  "images/Store_PriceTag.png",
  "images/Store_PacketUpgrade.png",
  "images/Store_SpeechBubble.png",
  "images/coinbank.png",
  "data/_BrianneTod16.png",
  "data/BrianneTod16.txt",
  "data/_HouseofTerror16.png",
  "data/HouseofTerror16.txt",
  "data/HouseofTerror16Outline.png",
  "images/icon_rake.png",
  "images/icon_poolcleaner.png",
  "images/icon_roofcleaner.png",
  "images/SelectorScreen_Help1.png",
  "images/SelectorScreen_Help2.png",
  "images/SelectorScreen_Options1.png",
  "images/SelectorScreen_Quit1.png",
  "images/SelectorScreen_ZenGarden.png",
  "images/SelectorScreen_LevelNumbers.png",
  "images/Achievements_pedestal.png",
  "images/Almanac_IndexBack.jpg",
  "images/Almanac_PlantBack.jpg",
  "images/Almanac_ZombieBack.jpg",
  "images/Almanac_PlantCard.png",
  "images/Almanac_ZombieCard.png",
  "images/Almanac_ZombieWindow.png",
  "images/Almanac_ZombieWindow2.png",
  "images/Almanac_GroundDay.jpg",
  "images/Almanac_GroundNight.jpg",
  "images/Almanac_GroundPool.jpg",
  "images/Almanac_GroundNightPool.jpg",
  "images/Almanac_GroundRoof.jpg",
  "images/Almanac_GroundIce.jpg",
  "images/button_left.png",
  "images/button_middle.png",
  "images/button_right.png",
  "images/button_down_left.png",
  "images/button_down_middle.png",
  "images/button_down_right.png",
  "images/Almanac_CloseButton.png",
  "images/Almanac_CloseButtonHighlight.png",
  "images/Almanac_IndexButton.png",
  "images/Almanac_IndexButtonHighlight.png",
  "images/BungeeCord.png",
  "particles/pea_splats.png",
  "particles/Pea_particles.png",
  "particles/SnowPea_splats.png",
  "particles/SnowPea_particles.png",
  "particles/Star_splats.png",
  "particles/Star_particles.png",
  "images/ZombieNote.jpg",
  "images/ZombieNoteHelp.png",
  "reanim/SelectorScreen_WoodSign2_press.png",
  "images/FinalWave.png",
  "images/PopCap_Logo.jpg",
  "images/PopCap_Logo.jpg",
  "images/APPROACHING.png",
  "images/FlagMeter.png",
  "images/FlagMeterLevelProgress.png",
  "images/FlagMeterParts.png",
  "images/ExplosionPowie.png",
  "images/ConveyorBelt.png",
  "images/ConveyorBelt_backdrop.png",
  "images/Wallnut_bowlingstripe.png",
  "reanim/SelectorScreen_BG_Left.jpg",
  "reanim/SelectorScreen_BG_Center.jpg",
  "reanim/SelectorScreen_BG_Right.jpg",
  "reanim/SelectorScreen_BG.jpg",
  "reanim/SelectorScreen_Adventure_button.png",
  "reanim/SelectorScreen_Adventure_highlight.png",
  "reanim/SelectorScreen_Survival_highlight.png",
  "reanim/SelectorScreen_Challenges_highlight.png",
  "reanim/SelectorScreen_vasebreaker_highlight.png",
  "reanim/SelectorScreen_StartAdventure_Highlight.png",
];

// 原版引擎只用 mainmusic.mo3（内含全部曲子的 Order 段）和 mainmusic_hihats.mo3（镲片层），
// 所以音乐只复制这两个文件；音效把 resource/sounds 里所有 ogg 全量复制，避免接新音效时漏资源。
const music = ["mainmusic.mo3", "mainmusic_hihats.mo3"];

const sounds = fs
  .readdirSync(path.join(resource, "sounds"))
  .filter((name) => name.toLowerCase().endsWith(".ogg"))
  .map((name) => name.slice(0, -4));

function copy(from, to) {
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
}

let copied = 0;
const missing = [];
for (const id of ids) {
  const src = findImage(id);
  if (!src) {
    missing.push(id);
    continue;
  }
  const rel = path.relative(resource, src);
  copy(src, path.join(out, rel));
  copied++;
  const mask = findMask(id);
  if (mask) {
    copy(mask, path.join(out, path.relative(resource, mask)));
    copied++;
  }
}
for (const rel of ui) {
  const src = path.join(resource, rel);
  if (!fs.existsSync(src)) {
    missing.push(rel);
    continue;
  }
  copy(src, path.join(out, rel));
  copied++;
}
for (const file of reanims) {
  copy(path.join(resource, "reanim", file), path.join(out, "reanim", file));
  copied++;
}
copy(path.join(resource, "properties", "LawnStrings.txt"), path.join(out, "properties", "LawnStrings.txt"));
copied++;

for (const name of music) {
  const src = path.join(resource, "sounds", name);
  if (!fs.existsSync(src)) {
    missing.push(name);
    continue;
  }
  copy(src, path.join(out, "sounds", name));
  copied++;
}
for (const name of sounds) {
  const src = path.join(resource, "sounds", name + ".ogg");
  if (!fs.existsSync(src)) {
    missing.push(name + ".ogg");
    continue;
  }
  copy(src, path.join(out, "sounds", name + ".ogg"));
  copied++;
}

function walk(dir, list) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) walk(full, list);
    else list.push(path.relative(out, full).replace(/\\/g, "/"));
  }
}
const files = [];
walk(out, files);
fs.writeFileSync(path.join(out, "manifest.json"), JSON.stringify(files, null, 2));
console.log("copied", copied, "manifest", files.length);
if (missing.length) console.log("missing", missing.join(", "));
