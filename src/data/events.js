export default {
  "version": 1,
  "note": "随机事件：choices 的 outcome 支持 exp/hp/karma/item/method/relic 等效果",
  "events": [
    {
      "id": "evt_wounded_cultivator",
      "name": "受伤的修士",
      "desc": "山道旁躺着一名气息奄奄的修士，他的储物袋散落一旁。",
      "weight": 10,
      "choices": [
        {
          "text": "出手相救",
          "outcome": { "karma": -5, "exp": 200, "possibleReward": "method" },
          "resultText": "你渡入一丝灵气。他醒来后感激涕零，留下一卷功法残篇。道心 +5"
        },
        {
          "text": "夺宝杀人",
          "outcome": { "karma": 15, "gold": 300, "possibleReward": "item" },
          "resultText": "你取走储物袋，也取走了他的性命。心魔 +15"
        },
        {
          "text": "视而不见",
          "outcome": { "karma": 2 },
          "resultText": "你绕道而行。此事如尘埃落定，却在道心上留下一丝阴影。心魔 +2"
        }
      ]
    },
    {
      "id": "evt_ancient_cave",
      "name": "古修洞府",
      "desc": "崖壁上发现一处封闭千年的洞府，禁制已松动。",
      "weight": 8,
      "choices": [
        {
          "text": "强行破禁",
          "outcome": { "hp": -30, "exp": 500, "possibleReward": "relic" },
          "resultText": "禁制反噬，你受了些伤，但洞府中的遗物归你所有。"
        },
        {
          "text": "小心破解",
          "outcome": { "exp": 150, "possibleReward": "item" },
          "resultText": "你花了些时日，安全取出部分藏品。"
        },
        {
          "text": "记下位置，日后再来",
          "outcome": { "exp": 50 },
          "resultText": "你将坐标记入玉简。机缘需待时机成熟。"
        }
      ]
    },
    {
      "id": "evt_merchant_trap",
      "name": "黑市交易",
      "desc": "一名蒙面修士向你兜售来路不明的丹药。",
      "weight": 8,
      "choices": [
        {
          "text": "买下丹药",
          "outcome": { "gold": -200, "hp": -20, "possibleReward": "item" },
          "resultText": "丹药入腹，一股燥热乱窜。似乎……不太对劲。"
        },
        {
          "text": "拒绝并离开",
          "outcome": {},
          "resultText": "你摇头离去。蒙面人的目光让你脊背发凉。"
        },
        {
          "text": "擒下盘问",
          "outcome": { "karma": 8, "gold": 400, "hp": -40 },
          "resultText": "你制住他，夺其财物。手段虽狠，收获颇丰。心魔 +8"
        }
      ]
    },
    {
      "id": "evt_demon_whisper",
      "name": "心魔低语",
      "desc": "闭关时，识海中响起不属于你的声音，承诺赐予力量。",
      "weight": 6,
      "requireKarma": 20,
      "choices": [
        {
          "text": "接纳低语",
          "outcome": { "karma": 25, "attackBonus": 40, "maxHpBonus": 200 },
          "resultText": "力量涌入四肢百骸。你听见自己发出非人的低笑。心魔 +25"
        },
        {
          "text": "诵清心咒压制",
          "outcome": { "karma": -10, "exp": 300 },
          "resultText": "清心咒响起，低语消散。你的道心更加坚定。心魔 -10"
        },
        {
          "text": "与之辩道",
          "outcome": { "karma": -5, "exp": 600, "hp": -25 },
          "resultText": "你与心魔辩道三日，形销骨立却悟道颇深。心魔 -5"
        }
      ]
    },
    {
      "id": "evt_sect_recruit",
      "name": "宗门招揽",
      "desc": "一位长老观察你许久，递来一枚令牌。",
      "weight": 6,
      "choices": [
        {
          "text": "接受邀请",
          "outcome": { "sectJoin": true, "exp": 200 },
          "resultText": "你接过令牌，从此有了师门依托。"
        },
        {
          "text": "婉拒，独行修道",
          "outcome": { "karma": -3, "gold": 100 },
          "resultText": "你拱手谢绝。逍遥自在，亦是一种道。"
        }
      ]
    },
    {
      "id": "evt_thunder_field",
      "name": "雷泽",
      "desc": "一片紫色雷池，雷霆在池中翻涌，淬炼肉身之圣地。",
      "weight": 7,
      "choices": [
        {
          "text": "入池淬体",
          "outcome": { "hp": -50, "maxHpBonus": 150, "defenseBonus": 10 },
          "resultText": "雷霆入体，痛入骨髓。你的肉身却更为坚韧。"
        },
        {
          "text": "在边缘吸纳雷气",
          "outcome": { "exp": 300 },
          "resultText": "你谨慎地吸纳逸散雷气，修为稳步增长。"
        }
      ]
    }
  ]
}
