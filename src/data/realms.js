export default {
  "version": 1,
  "note": "九大境界：每层 maxLevel 级，达圆满后需渡天劫。tribulation 为天劫小游戏难度参数",
  "realms": [
    {
      "id": "lianqi",
      "name": "练气期",
      "maxLevel": 10,
      "baseExp": 100,
      "lifespan": 100,
      "tribulation": { "lightning": 3, "speed": 1.0, "duration": 12, "baseChance": 0.75 }
    },
    {
      "id": "zhuji",
      "name": "筑基期",
      "maxLevel": 10,
      "baseExp": 2000,
      "lifespan": 200,
      "tribulation": { "lightning": 5, "speed": 1.15, "duration": 14, "baseChance": 0.68 }
    },
    {
      "id": "jiedan",
      "name": "结丹期",
      "maxLevel": 10,
      "baseExp": 20000,
      "lifespan": 400,
      "tribulation": { "lightning": 7, "speed": 1.3, "duration": 16, "baseChance": 0.6 }
    },
    {
      "id": "jindan",
      "name": "金丹期",
      "maxLevel": 10,
      "baseExp": 200000,
      "lifespan": 800,
      "tribulation": { "lightning": 9, "speed": 1.45, "duration": 18, "baseChance": 0.52 }
    },
    {
      "id": "yuanying",
      "name": "元婴期",
      "maxLevel": 10,
      "baseExp": 1000000,
      "lifespan": 1500,
      "tribulation": { "lightning": 12, "speed": 1.6, "duration": 20, "baseChance": 0.45 }
    },
    {
      "id": "huashen",
      "name": "化神期",
      "maxLevel": 10,
      "baseExp": 5000000,
      "lifespan": 3000,
      "tribulation": { "lightning": 15, "speed": 1.8, "duration": 22, "baseChance": 0.38 }
    },
    {
      "id": "lianxu",
      "name": "炼虚期",
      "maxLevel": 10,
      "baseExp": 25000000,
      "lifespan": 6000,
      "tribulation": { "lightning": 18, "speed": 2.0, "duration": 24, "baseChance": 0.32 }
    },
    {
      "id": "heti",
      "name": "合体期",
      "maxLevel": 10,
      "baseExp": 120000000,
      "lifespan": 12000,
      "tribulation": { "lightning": 22, "speed": 2.2, "duration": 26, "baseChance": 0.26 }
    },
    {
      "id": "dacheng",
      "name": "大乘期",
      "maxLevel": 10,
      "baseExp": 600000000,
      "lifespan": 30000,
      "tribulation": { "lightning": 28, "speed": 2.5, "duration": 30, "baseChance": 0.18 }
    }
  ]
}
