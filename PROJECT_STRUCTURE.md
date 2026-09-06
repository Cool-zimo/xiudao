# 📁 项目结构与MVP规划

## 一、完整项目结构

```
xiudao/
├── index.html              # 主页面入口
├── README.md               # 项目说明文档
├── PROJECT_STRUCTURE.md    # 项目结构文档（本文件）
├── UNDERSTANDING.md        # 需求理解文档
├── anser.txt               # 问题回答记录
│
├── css/                    # 样式文件
│   ├── style.css           # 主样式文件
│   ├── theme.css           # 主题样式（正道/邪修切换）
│   └── responsive.css      # 响应式适配
│
├── js/                     # JavaScript核心逻辑
│   ├── main.js             # 主入口，初始化游戏
│   ├── game.js             # 游戏核心状态管理
│   │
│   ├── character.js        # 角色系统（创建、属性）
│   ├── cultivation.js      # 修炼系统（境界、突破）
│   ├── combat.js           # 战斗系统（回合制）
│   │
│   ├── profession.js       # 职业系统（锻造/召唤/暗器）
│   ├── pet.js              # 灵兽系统
│   ├── inventory.js        # 背包系统
│   ├── cloud_control.js    # 控云法术系统
│   │
│   ├── evil_cultivation.js # 邪修系统（魂魄、夺舍、第二人格）
│   ├── forge.js            # 锻造台（炼器、炼丹、控云管理）
│   │
│   ├── save_load.js        # 存档系统（localStorage + Base64 + Hash）
│   ├── utils.js            # 工具函数（加密、随机数等）
│   └── ui.js               # UI渲染和交互
│
├── data/                   # 游戏配置数据
│   ├── realms.json         # 境界配置
│   ├── professions.json    # 职业配置
│   ├── talents.json        # 天赋配置
│   ├── monsters.json       # 怪物配置
│   ├── items.json          # 物品配置（丹药、装备）
│   ├── pets.json           # 灵兽配置
│   └── cloud_spells.json   # 控云法术配置
│
└── assets/                 # 资源文件（可选）
    └── icons/              # 图标（如果需要）
```

---

## 二、最小MVP（Minimum Viable Product）

### 🎯 MVP核心目标
**一个可玩的基础版本**：能创建角色、修炼、战斗、存档，具备核心玩法循环。

### ✅ MVP包含功能

#### 1. 基础框架（必须）
- [x] HTML主页面结构
- [x] CSS基础样式（古风主题）
- [x] JavaScript项目架构
- [x] 屏幕切换系统

#### 2. 角色系统（必须）
- [x] 角色创建界面
  - 姓名输入
  - 阵营选择（正道/邪修）
  - 职业选择（锻造师/召唤师/暗器师）
  - 天赋选择（运气/肉盾/远攻/控云）
- [x] 角色属性系统
  - HP/MP
  - 攻击力/防御力
  - 经验值/等级

#### 3. 修炼系统（必须）
- [x] 6大境界体系
  - 练气期 → 筑基期 → 结丹期 → 金丹期 → 元婴期 → 筠仙期
  - 每境10级
- [x] 经验获取机制
  - 击杀怪物获得经验
  - 服用丹药获得经验
- [x] 境界突破
  - 积累足够经验可突破
  - 筑基→结丹需要渡劫（简化版）

#### 4. 战斗系统（必须）
- [x] 回合制战斗
  - 玩家攻击
  - 怪物反击
  - 胜利/失败判定
- [x] 简单怪物系统
  - 5-10种基础怪物
  - 属性随境界提升
- [x] 战斗奖励
  - 经验值
  - 掉落物（简化）

#### 5. 职业基础功能（简化版）

**锻造师**：
- [x] 基础炼丹功能（3-5种丹药）
- [x] 成功率计算

**召唤师**：
- [x] 契约1只灵兽
- [x] 灵兽协助战斗

**暗器师**：
- [x] 使用暗器攻击（额外伤害）

#### 6. 背包系统（简化版）
- [x] 物品列表显示
- [x] 服用丹药功能
- [x] 装备查看

#### 7. 存档系统（必须）
- [x] localStorage本地存储
- [x] 自动保存（关键操作后）
- [x] 手动保存按钮
- [x] Base64导出功能
- [x] Base64导入功能
- [x] Hash校验（SHA256）
- [x] 密码保护（可选）
- [x] 预览模式（无密码仅看基本信息）

#### 8. UI界面（基础版）
- [x] 首页（开始游戏/继续游戏/导入存档/帮助）
- [x] 角色创建页
- [x] 主游戏界面
  - 角色信息面板
  - 修炼按钮
  - 战斗按钮
  - 背包按钮
  - 日志区域
- [x] 战斗界面
- [x] 背包界面

---

### ❌ MVP不包含功能（后期扩展）

#### 邪修高级功能
- [ ] 魂魄系统
- [ ] 第二人格
- [ ] 夺舍流程（完整版）
- [ ] 傀儡炼制

#### 职业高级功能
- [ ] 锻造师：炼器系统
- [ ] 锻造师：控云法术管理（10等级）
- [ ] 召唤师：多只灵兽
- [ ] 召唤师：灵兽挂机系统
- [ ] 暗器师：暗器打造

#### 复杂系统
- [ ] 控云法术6元素特效
- [ ] Boss战
- [ ] 副本系统
- [ ] 任务系统
- [ ] NPC对话
- [ ] PVP功能

#### 优化功能
- [ ] 音效系统
- [ ] 动画特效
- [ ] 成就系统
- [ ] 数据统计
- [ ] 移动端完美适配（仅保证可用）

---

## 三、MVP开发优先级

### Phase 1: 核心框架（第1周）
**目标**：能运行，有基本UI

1. ✅ 创建HTML结构
2. ✅ 创建CSS样式
3. ✅ 创建JS项目骨架
4. ✅ 实现屏幕切换
5. ✅ 实现角色创建界面

**交付物**：能看到首页和角色创建页

---

### Phase 2: 角色与修炼（第2周）
**目标**：能创建角色，显示属性

1. ✅ 角色数据结构设计
2. ✅ 角色属性计算
3. ✅ 境界系统实现
4. ✅ 经验值系统
5. ✅ 简单的修炼按钮（点击获得经验）

**交付物**：能创建角色，看到属性，点击修炼增加经验

---

### Phase 3: 战斗系统（第3周）
**目标**：能战斗，能升级

1. ✅ 怪物数据配置
2. ✅ 回合制战斗逻辑
3. ✅ 战斗UI界面
4. ✅ 战斗奖励发放
5. ✅ 境界突破逻辑

**交付物**：能与怪物战斗，获胜获得经验，可以突破境界

---

### Phase 4: 职业基础功能（第4周）
**目标**：三种职业有区别

1. ✅ 锻造师：炼丹功能
2. ✅ 召唤师：契约灵兽
3. ✅ 暗器师：暗器攻击
4. ✅ 职业被动技能

**交付物**：不同职业有不同能力

---

### Phase 5: 背包与物品（第5周）
**目标**：能管理物品

1. ✅ 背包数据结构
2. ✅ 物品配置（丹药、装备）
3. ✅ 服用丹药功能
4. ✅ 装备查看

**交付物**：能获得物品，使用丹药

---

### Phase 6: 存档系统（第6周）
**目标**：能保存和分享

1. ✅ localStorage存取
2. ✅ Base64编码/解码
3. ✅ SHA256 Hash校验
4. ✅ 密码保护
5. ✅ 导出/导入界面

**交付物**：能保存进度，能导出存档分享给朋友

---

### Phase 7: 优化与测试（第7周）
**目标**：可发布版本

1. ✅ Bug修复
2. ✅ 数值平衡调整
3. ✅ UI美化
4. ✅ 响应式适配
5. ✅ 部署到GitHub Pages

**交付物**：MVP版本上线

---

## 四、MVP数据结构设计

### 4.1 玩家数据
```javascript
{
  version: "1.0.0",
  player: {
    name: "张三",
    faction: "正道", // "正道" | "邪修"
    profession: "锻造师", // "锻造师" | "召唤师" | "暗器师"
    talent: "运气", // "运气" | "肉盾" | "远攻" | "控云"
    
    cultivation: {
      realm: "练气期", // 当前境界
      level: 1, // 当前境界等级 (1-10)
      experience: 0, // 当前经验
      expToNext: 100, // 升级所需经验
    },
    
    attributes: {
      hp: 100,
      maxHp: 100,
      mp: 50,
      maxMp: 50,
      attack: 10,
      defense: 5,
      speed: 10,
      luck: 10,
    },
  },
  
  pet: null, // 召唤师的灵兽
  
  inventory: [], // 背包物品
  
  metadata: {
    createTime: "2024-01-01 12:00:00",
    lastSaveTime: "2024-01-01 12:00:00",
    playTime: 0,
  }
}
```

### 4.2 怪物数据（示例）
```javascript
{
  id: "monster_001",
  name: "铁背熊",
  realm: "练气期",
  level: 1,
  attributes: {
    hp: 50,
    attack: 8,
    defense: 3,
  },
  expReward: 20,
  drops: [
    { itemId: "item_001", chance: 0.3 }, // 聚气丹 30%概率
  ]
}
```

### 4.3 物品数据（示例）
```javascript
{
  id: "item_001",
  name: "聚气丹",
  type: "丹药",
  quality: "凡品",
  effect: {
    type: "exp",
    value: 50,
  },
  description: "服用后获得50点修为",
}
```

---

## 五、技术要点

### 5.1 存档加密流程
```javascript
// 导出
function exportSave(gameData, password = "") {
  const jsonStr = JSON.stringify(gameData);
  const hash = CryptoJS.SHA256(jsonStr + password).toString();
  const base64 = btoa(unescape(encodeURIComponent(jsonStr)));
  return `XIUDAO|v1.0|${base64}|${hash}`;
}

// 导入
function importSave(token, password = "") {
  const parts = token.split("|");
  const base64 = parts[2];
  const hash = parts[3];
  
  const jsonStr = decodeURIComponent(escape(atob(base64)));
  const expectedHash = CryptoJS.SHA256(jsonStr + password).toString();
  
  if (hash !== expectedHash) {
    throw new Error("存档损坏或密码错误");
  }
  
  return JSON.parse(jsonStr);
}
```

### 5.2 战斗流程
```javascript
class Battle {
  constructor(player, monster) {
    this.player = player;
    this.monster = monster;
  }
  
  playerTurn() {
    const damage = Math.max(1, this.player.attack - this.monster.defense);
    this.monster.hp -= damage;
    return damage;
  }
  
  monsterTurn() {
    const damage = Math.max(1, this.monster.attack - this.player.defense);
    this.player.hp -= damage;
    return damage;
  }
  
  checkEnd() {
    if (this.monster.hp <= 0) return "victory";
    if (this.player.hp <= 0) return "defeat";
    return "continue";
  }
}
```

---

## 六、命名风格规范（特别屌！）

### 6.1 境界名称
```
练气期 → 筑基期 → 结丹期 → 金丹期 → 元婴期 → 筠仙期
```

### 6.2 控云法术等级（侠客风）
```
Lv1: 初窥门径
Lv2: 小有所成
Lv3: 登堂入室
Lv4: 融会贯通
Lv5: 炉火纯青
Lv6: 出神入化
Lv7: 登峰造极
Lv8: 超凡入圣
Lv9: 返璞归真
Lv10: 大道至简 ⚡
```

### 6.3 装备品质
```
凡品 → 下品 → 中品 → 上品 → 极品 → 
法器 → 宝器 → 灵器 → 仙器 → 神器 → 道器
```

### 6.4 丹药命名
```
聚气丹、凝元丹、筑基丹、结金丹、元婴丹、
九转还魂丹、元神出窍丹、涅槃塑体丹、
太清仙丹、混沌神丹
```

### 6.5 怪物/Boss命名
```
普通：铁背熊、赤焰蛇、寒冰狼
精英：啸月天狼、烈焰魔猿、雷霆巨鹰
Boss：九幽魔龙、太古神凰、混沌魔神
```

### 6.6 技能/法术命名
```
控云六系：
- 风：狂风斩、风神之怒、天地同悲
- 雨：暴雨梨花、水幕天华、沧海桑田
- 雷：紫霄神雷、九天雷劫、雷动九州
- 电：闪电链、电光火石、雷霆万钧
- 火：烈焰焚天、火莲绽放、红莲业火
- 冰：冰封万里、寒霜领域、绝对零度
```

---

## 七、下一步行动

现在开始创建 **Phase 1: 核心框架** 的文件：

1. ✅ 创建 `index.html`
2. ✅ 创建 `css/style.css`
3. ✅ 创建 `js/main.js`
4. ✅ 创建 `js/game.js`
5. ✅ 创建 `js/ui.js`

**准备开始吗？** 🚀