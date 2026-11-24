const fs = require("fs");
const vm = require("vm");
const context = {
  console,
  Adventure: {
    levels: [{ id: "1-1" }, { id: "2-4" }],
    indexOf(id) { return this.levels.findIndex((level) => level.id === id); },
  },
  PlantCatalog: {
    get(id) { return id ? { id, name: id, place: id === "imitater" ? "corner" : "ground" } : null; },
    order: [],
  },
  Almanac: { plantOrder: ["peashooter", "sunflower", "gatlingpea"], line() { return ""; } },
  Waves: { roster: { "5-1": ["bungee", "catapult"] } },
};
vm.createContext(context);
vm.runInContext(
  fs.readFileSync("src/app/profile.js", "utf8") + "\n" +
  fs.readFileSync("src/app/shop.js", "utf8") + "\n" +
  `
  var a = new Profile({
    id: "a",
    name: "甲",
    wallet: { coins: 10000 },
    adventure: {
      unlocked: ["peashooter", "sunflower", "repeater"],
      cleared: ["2-4", "2-10", "4-5", "4-10"],
    },
  });
  var b = new Profile({
    id: "b",
    name: "乙",
    wallet: { coins: 100 },
    adventure: { unlocked: ["peashooter"], cleared: [] },
  });
  if (!a.shop.open || !a.shop.taco || a.shop.slots !== 6) throw new Error("old save should open shop after 2-4");
  if (b.shop.open || b.shop.slots !== 6) throw new Error("fresh account shop must stay closed");
  if (!Shop.buy(a, "slot")) throw new Error("slot buy");
  if (a.shop.slots !== 7 || a.wallet.coins !== 9250) throw new Error("slot cost " + a.shop.slots + " " + a.wallet.coins);
  if (b.shop.slots !== 6 || b.wallet.coins !== 100) throw new Error("other account changed");
  if (!Shop.buy(a, "gatlingpea") || !a.hasPlant("gatlingpea")) throw new Error("plant buy");
  if (Shop.buy(a, "gatlingpea")) throw new Error("sold out must refuse");
  if (Shop.buy(b, "slot")) throw new Error("closed shop must refuse");
  var saved = JSON.parse(JSON.stringify(a.toJSON()));
  var loaded = Profile.fromJSON(saved);
  if (loaded.shop.slots !== 7 || !loaded.hasPlant("gatlingpea") || loaded.wallet.coins !== a.wallet.coins) {
    throw new Error("roundtrip lost shop");
  }
  var picks = Shop.pickSeeds({
    id: "5-1", number: 41, terrain: { ground: "roof" }, kind: "",
  }, ["peashooter", "sunflower", "torchwood", "umbrellaleaf", "blover", "imitater", "wallnut"]);
  if (picks.length !== 3) throw new Error("dave picks " + picks.join(","));
  if (picks.indexOf("torchwood") >= 0 || picks.indexOf("imitater") >= 0 || picks.indexOf("blover") >= 0) {
    throw new Error("dave picked a banned plant " + picks.join(","));
  }
  var quiet = Shop.pickSeeds({ id: "1-1", number: 1, terrain: { ground: "lawn" } }, ["umbrellaleaf", "peashooter", "sunflower"]);
  if (quiet.indexOf("umbrellaleaf") >= 0) throw new Error("umbrella without bungee");
  var blitz = Shop.pickSeeds({ id: "5-1", number: 41, terrain: { ground: "roof" } }, ["umbrellaleaf", "peashooter"]);
  if (blitz.indexOf("umbrellaleaf") < 0) throw new Error("umbrella should be offered against bungee");
  var again = Shop.pickSeeds({
    id: "5-1", number: 41, terrain: { ground: "roof" }, kind: "",
  }, ["peashooter", "sunflower", "torchwood", "umbrellaleaf", "blover", "imitater", "wallnut"]);
  if (again.join() !== picks.join()) throw new Error("picks must be stable");
  console.log("shop self-check OK", picks.join(","));
`, context);
