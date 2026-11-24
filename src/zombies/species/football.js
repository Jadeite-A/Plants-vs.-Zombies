// 橄榄球僵尸。跑得快，头盔很厚，头盔是金属。
defineZombie({
  "id": "football",
  "name": "橄榄球僵尸",
  "hp": 160,
  "speed": 28,
  "armAt": 70,
  "reanim": "Zombie_football",
  "armor": {
    "id": "metal",
    "hp": 880,
    "metal": true,
    "bit": "helmet"
  },
  "attack": {
    "anim": "anim_eat",
    "windup": 0.3,
    "recover": 0.4,
    "interval": 0.7,
    "damage": 70
  },
  update: function (zombie, board, dt) {
    ZombieFight.march(zombie, board, dt);
  }
});
