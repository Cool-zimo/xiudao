export default {
  "version": 1,
  "note": "秘境 Roguelike：每层随机生成节点图，遗物永久保留。node 类型决定遭遇",
  "nodeTypes": [
    { "id": "monster", "name": "妖兽", "weight": 40, "icon": "👹" },
    { "id": "elite", "name": "妖王", "weight": 15, "icon": "💀" },
    { "id": "treasure", "name": "宝箱", "weight": 15, "icon": "📦" },
    { "id": "event", "name": "机缘", "weight": 15, "icon": "❓" },
    { "id": "cultivate", "name": "洞天", "weight": 10, "icon": "🧘" },
    { "id": "merchant", "name": "坊市", "weight": 5, "icon": "🏪" }
  ],
  "relics": [
    {
      "id": "relic_qixing",
      "name": "七星罗盘",
      "rarity": "rare",
      "desc": "每层开始额外看到 2 个节点的类型",
      "effect": { "revealNodes": 2 }
    },
    {
      "id": "relic_huti",
      "name": "虎符",
      "rarity": "common",
      "desc": "攻击 +20",
      "effect": { "attack": 20 }
    },
    {
      "id": "relic_xuangui",
      "name": "玄龟甲",
      "rarity": "common",
      "desc": "防御 +15，最大生命 +100",
      "effect": { "defense": 15, "maxHp": 100 }
    },
    {
      "id": "relic_juling",
      "name": "聚灵瓶",
      "rarity": "rare",
      "desc": "每回合恢复 5 点法力",
      "effect": { "mpRegen": 5 }
    },
    {
      "id": "relic_zhuyou",
      "name": "祝由铃",
      "rarity": "epic",
      "desc": "走火入魔概率降低 10%",
      "effect": { "riskDelta": -0.1 }
    },
    {
      "id": "relic_shixin",
      "name": "噬心玉",
      "rarity": "epic",
      "desc": "攻击 +40，但每次战斗增加 1 点心魔",
      "effect": { "attack": 40, "karmaPerBattle": 1 }
    },
    {
      "id": "relic_zhenyuan",
      "name": "镇元塔",
      "rarity": "legendary",
      "desc": "全属性 +50，修炼速度 +50%",
      "effect": { "attack": 50, "defense": 50, "maxHp": 500, "speedDelta": 0.5 }
    }
  ],
  "floorConfig": {
    "baseNodeCount": 6,
    "nodesPerFloor": 1,
    "bossEveryFloors": 3,
    "hpCostPerFloor": 30,
    "expMultiplierPerFloor": 1.35
  }
}
