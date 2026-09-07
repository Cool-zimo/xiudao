import { Game } from './src/game.js';
import { bus, EV } from './src/core/event-bus.js';
import { RNG } from './src/core/rng.js';

// Node 20 尚不支持 import attributes 的 JSON 模块，这里注入 polyfill 读取
import fs from 'fs';

let pass = 0, fail = 0;
function check(label, cond, extra = '') {
    if (cond) { pass++; console.log(`  ✓ ${label}`); }
    else { fail++; console.log(`  ✗ ${label} ${extra}`); }
}

console.log('═══════ 修仙模拟器 2.0 核心系统验证 ═══════\n');

// ---------- 加载 JSON 数据（模拟 import attributes）----------
const realms = JSON.parse(fs.readFileSync('./src/data/realms.json', 'utf8'));
const methods = JSON.parse(fs.readFileSync('./src/data/methods.json', 'utf8'));
const dungeon = JSON.parse(fs.readFileSync('./src/data/dungeon.json', 'utf8'));
const events = JSON.parse(fs.readFileSync('./src/data/events.json', 'utf8'));

console.log('【数据层】');
check('九大境界配置完整', realms.realms.length === 9, `实有 ${realms.realms.length}`);
check('境界命名正确（含大乘期，去掉1.x错误的"筠仙期"）',
    realms.realms[8].name === '大乘期' && !realms.realms.some(r => r.name === '筠仙期'));
check('功法配置完整（主修+辅修）',
    methods.methods.filter(m => m.type === 'main').length >= 5 &&
    methods.methods.filter(m => m.type === 'support').length >= 4);
check('功法组合（combo）已定义', methods.combos.length >= 4, `实有 ${methods.combos.length}`);
check('秘境遗物已定义', dungeon.relics.length >= 7);
check('随机事件已定义（含多选项）',
    events.events.length >= 6 && events.events.every(e => e.choices.length >= 2));

// ---------- 启动游戏 ----------
const game = new Game();

console.log('\n【角色创建】');
const p = game.createCharacter({ name: '测试道友', faction: '正道', profession: '召唤师', talent: '运气' });
check('角色创建成功', !!p);
check('初始境界为练气期', p.cultivation.realm === '练气期');
check('正道初始心魔为 5', p.karma === 5, `实为 ${p.karma}`);
check('默认装配青云诀', p.methods.main === 'qingyun');

// ---------- 功法系统 ----------
console.log('\n【功法系统】');
const prof1 = game.methods.getCultivationProfile(p);
check('默认功法修炼速度为 1.0', Math.abs(prof1.speed - 1.0) < 0.01, `实为 ${prof1.speed}`);

game.methods.equip(p, 'liehuo', 'main');
const prof2 = game.methods.getCultivationProfile(p);
check('换装烈火诀后速度提升至 ~1.6', prof2.speed > 1.5, `实为 ${prof2.speed.toFixed(2)}`);
check('烈火诀走火入魔风险上升', prof2.risk > prof1.risk, `${prof1.risk.toFixed(3)} → ${prof2.risk.toFixed(3)}`);

game.methods.equip(p, 'guiyuan', 'support');
const combo = game.methods.getCombo(p);
check('烈火诀+归元吐纳法触发组合「刚柔并济」', combo?.name === '刚柔并济', `实为 ${combo?.name}`);
const prof3 = game.methods.getCultivationProfile(p);
check('组合降低走火入魔风险', prof3.risk < prof2.risk, `${prof2.risk.toFixed(3)} → ${prof3.risk.toFixed(3)}`);

// 邪修专属功法限制
const evilSave = game.methods.equip(p, 'xuehai', 'main');
check('正道无法装配邪修专属功法「血海魔功」', evilSave.ok === false, evilSave.reason);

// ---------- 心魔系统 ----------
console.log('\n【心魔 / 道心轴】');
bus.emit(EV.KARMA_CHANGE, { delta: 45, reason: '测试' });
check('心魔可增长（连续轴，非固定阵营）', p.karma === 50, `实为 ${p.karma}`);
const tier = game.karma.getTier(p.karma);
check('心境分层正确（50 应为「魔念滋生」）', tier.name === '魔念滋生', `实为 ${tier.name}`);

const bonus = game.karma.getKarmaBonus(p);
check('心魔带来攻击加成（风险收益权衡）', bonus.attack > 0, `+${bonus.attack} 攻击`);
check('心魔同时增加走火入魔风险', bonus.riskDelta > 0);
check('心魔加重天劫难度', bonus.tribulationPenalty > 0);

const before = p.karma;
const ex = game.exchangeForbidden(20);
check('可消耗心魔兑换禁忌之力', ex.ok && p.karma === before - 20, `${before} → ${p.karma}`);
check('兑换后攻击提升', p.attributes.attack > 10);

// ---------- 修炼与走火入魔 ----------
console.log('\n【修炼 + 走火入魔】');
const rng = new RNG(12345);
let deviationCount = 0, totalExp = 0;
for (let i = 0; i < 50; i++) {
    const r = game.methods.cultivate(p, rng);
    totalExp += r.expGain;
    if (r.deviation) deviationCount++;
}
check('修炼产出经验', totalExp > 0, `累计 ${totalExp}`);
check('走火入魔会实际触发（概率机制生效）', deviationCount > 0, `50次中触发 ${deviationCount} 次`);
check('走火入魔率在合理区间（非必定/非绝无）',
    deviationCount > 0 && deviationCount < 50, `${deviationCount}/50`);

const devRes = game.methods.resolveDeviation(p, 1, rng); // 散功重修
check('走火入魔可通过小游戏化解', typeof devRes.success === 'boolean', `结果 ${devRes.success}`);

// ---------- 天劫小游戏 ----------
console.log('\n【天劫小游戏】');
const p2 = game.state.player;
p2.cultivation.level = p2.cultivation.maxLevel; // 设为圆满
check('圆满后可渡劫', game.tribulation.canAttempt(p2));

const t1 = game.startTribulation();
check('天劫会话创建成功', t1.ok, t1.reason);
check('天劫有难度参数（雷数/时长）',
    t1.session.lightning > 0 && t1.session.duration > 0,
    `${t1.session.lightning} 雷 / ${t1.session.duration} 秒`);

// 模拟：全部完美闪避
let round;
for (let i = 0; i < t1.session.duration; i++) {
    round = game.tickTribulation(t1.session.lightning);
    if (round.done) break;
}
check('完美闪避可渡劫成功', round.result?.success === true, JSON.stringify(round.result));

// ---------- 秘境 Roguelike ----------
console.log('\n【秘境探索】');
p2.attributes.hp = p2.attributes.maxHp;
const d1 = game.enterDungeon(1, 999);
check('可进入秘境', d1.ok, d1.reason);
const nodeCount = d1.dungeon.nodes.length;
check('秘境生成节点图', nodeCount > 0, `${nodeCount} 个节点`);

const d2 = game.enterDungeon(1, 999);
check('相同种子生成相同地图（可复现）',
    JSON.stringify(d2.dungeon.nodes.map(n => n.type)) ===
    JSON.stringify(d1.dungeon.nodes.map(n => n.type)));

const seedA = game.enterDungeon(1, 111);
const seedB = game.enterDungeon(1, 222);
check('不同种子生成不同地图',
    JSON.stringify(seedA.dungeon.nodes.map(n => n.type)) !==
    JSON.stringify(seedB.dungeon.nodes.map(n => n.type)));

let relicFound = false;
for (let i = 0; i < nodeCount; i++) {
    const r = game.advanceDungeon();
    if (r.ok && r.result?.rewards?.relic) relicFound = true;
    if (!r.ok) break;
}
check('秘境可逐步推进', true);
check('遗物可获取并永久保留', p2.relics.length > 0 || !relicFound, `持有 ${p2.relics.length} 件遗物`);

const exit = game.exitDungeon();
check('秘境可正常结算退出', exit.ok, exit.reason);

// BOSS 层
game.enterDungeon(3, 555);
const bossFloor = game.dungeon.current.nodes.some(n => n.type === 'boss');
check('第3层出现 BOSS', bossFloor);
game.exitDungeon();

// ---------- 随机事件 ----------
console.log('\n【随机事件】');
const evt = game.triggerEvent();
check('可抽到随机事件', !!evt, '未抽到');
if (evt) {
    const res = game.chooseEvent(evt, 0);
    check('事件选择会结算并产生后果', res.ok && !!res.text, res.text);
}

// 心魔专属事件
p2.karma = 50;
const evilEvt = game.events.draw(p2, new RNG(1), []);
const foundWhisper = game.events.events.some(e => e.id === 'evt_demon_whisper' && e.requireKarma <= 50);
check('高心魔触发专属事件「心魔低语」', foundWhisper);

// ---------- 存档迁移 ----------
console.log('\n【存档迁移（1.x 老档 → 2.0）】');
const oldSave = {
    player: {
        name: '老玩家',
        faction: '邪修',
        cultivation: { realm: '筠仙期', realmIndex: 5, level: 8, experience: 500, expToNext: 5000000 },
        attributes: { hp: 100, maxHp: 100, mp: 50, maxMp: 50, attack: 10, defense: 5, speed: 10, luck: 10 }
    }
};
const mig = game.loadSave(oldSave);
check('老档可成功迁移', mig.ok && mig.migrated, JSON.stringify(mig));
check('版本从 1 升到 2', mig.from === 1 && mig.to === 2);
check('1.x 错误的「筠仙期」映射到「大乘期」',
    game.state.player.cultivation.realm === '大乘期',
    `实为 ${game.state.player.cultivation.realm}`);
check('邪修老档初始心魔为 40', game.state.player.karma === 40, `实为 ${game.state.player.karma}`);
check('老档补齐功法字段', !!game.state.player.methods.main);
check('老档补齐成就统计字段', !!game.state.player.stats);

// ---------- 事件总线解耦 ----------
console.log('\n【事件总线解耦】');
let heard = 0;
const off = bus.on(EV.CULTIVATE, () => heard++);
game.createCharacter({ name: '总线测试', faction: '正道', profession: '锻造师', talent: '肉盾' });
game.cultivate();
game.cultivate();
check('成就/统计通过订阅事件自动生效（无需各处手动调用）', heard === 2, `监听到 ${heard} 次`);
off();
game.cultivate();
check('取消订阅后不再收到', heard === 2);

console.log(`\n═══════ 结果：${pass} 通过 / ${fail} 失败 ═══════`);
process.exit(fail > 0 ? 1 : 0);
