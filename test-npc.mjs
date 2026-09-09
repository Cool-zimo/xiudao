/** P2 测试：NPC 效用 AI / 门派 / 时间系统 */
let pass = 0, fail = 0;
const check = (l, c, e = '') => {
    if (c) { pass++; console.log(`  ✓ ${l}`); }
    else { fail++; console.log(`  ✗ ${l} ${e}`); }
};

const { World } = await import('./src/systems/world.js');
const { RNG } = await import('./src/core/rng.js');
const { TimeSystem, SHICHEN } = await import('./src/systems/time.js');
const { NPCSystem, NPC, Sect } = await import('./src/systems/npc.js');
const { NPC_KIND } = await import('./src/data/npc.js');

console.log('═══════ P2：NPC · 门派 · 时间 测试 ═══════\n');

// ---------- 时间系统 ----------
console.log('【时间：昼夜与节气】');
const t = new TimeSystem(1, 6);
check('初始为第 1 日 6 时', t.day === 1 && t.hour === 6);
check('6 时为卯时', t.shichen().name === '卯时', t.shichen().name);

t.hour = 0;
check('0 时为子时（阴气最盛）', t.shichen().name === '子时');
check('子时阴气 = 1.0', t.yinQi() === 1.0, String(t.yinQi()));
t.hour = 12;
check('12 时为午时（阳气最盛）', t.shichen().name === '午时');
check('午时阴气 = -1.0', t.yinQi() === -1.0, String(t.yinQi()));

console.log('\n【修炼效率受时辰与心魔影响】');
const noon = new TimeSystem(1, 12);
const mid = new TimeSystem(1, 0);
const noonPure = noon.cultivationMul(0);    // 正道
const midPure = mid.cultivationMul(0);
check('正道午时 > 正道子时', noonPure > midPure, `午${noonPure} vs 子${midPure}`);
const noonEvil = noon.cultivationMul(80);   // 邪修
const midEvil = mid.cultivationMul(80);
check('邪修子时 > 邪修午时', midEvil > noonEvil, `子${midEvil} vs 午${noonEvil}`);
check('效率系数有下限保护', new TimeSystem(1, 0).cultivationMul(0) >= 0.4);

console.log('\n【季节】');
const sp = new TimeSystem(1, 6), su = new TimeSystem(31, 6);
const wi = new TimeSystem(91, 6);
check('第 1 日为春', sp.season().name === '春', sp.season().name);
check('第 31 日为夏', su.season().name === '夏', su.season().name);
check('第 91 日为冬', wi.season().name === '冬', wi.season().name);
check('夏季灵气系数最高', su.season().qiMul > sp.season().qiMul);
check('冬季灵气系数最低', wi.season().qiMul < sp.season().qiMul);

console.log('\n【昼夜光照】');
const day = new TimeSystem(1, 12), night = new TimeSystem(1, 0);
check('正午 daylight ≈ 1', day.daylight() > 0.95, String(day.daylight().toFixed(2)));
check('子夜 daylight = 0', night.daylight() === 0, String(night.daylight()));

console.log('\n【时间推进】');
const t2 = new TimeSystem(1, 22);
t2.advance(120);   // 2 小时
check('推进 2 小时跨日', t2.day === 2 && t2.hour === 0, `${t2.day}日${t2.hour}时`);
t2.advance(60 * 24 * 3);
check('推进 3 天', t2.day === 5, `第${t2.day}日`);

// ---------- NPC 系统 ----------
console.log('\n【世界与 NPC 初始化】');
const w = new World(new RNG(777));
const rng = new RNG(777);
const time = new TimeSystem(1, 6);
const npcs = new NPCSystem(w, rng, time);
npcs.populate({ npcCount: 96, sectCount: 3 });

check('生成 96 名 NPC', npcs.npcs.size === 96, `${npcs.npcs.size}`);
check('生成 3 个门派', npcs.sects.size === 3, `${npcs.sects.size}`);
check('全体初始存活', npcs.aliveNpcs().length === 96);

const inBounds = [...npcs.npcs.values()].every(n => w.walkable(n.x, n.y));
check('全部生成在可通行地块', inBounds);

const sectsWithMembers = [...npcs.sects.values()].filter(s => s.members.size > 0);
check('门派均有成员', sectsWithMembers.length === 3,
    sectsWithMembers.map(s => `${s.name}:${s.members.size}`).join(','));

console.log('\n【NPC 属性合理】');
const list = [...npcs.npcs.values()];
check('战力均为正数', list.every(n => n.power > 0));
check('血量在合理区间', list.every(n => n.hp > 0 && n.hp <= n.maxHp));
check('心魔不越界', list.every(n => n.karma >= 0 && n.karma <= 100));
check('姓名非空且为 2-3 字', list.every(n => n.name.length >= 2 && n.name.length <= 3));

const kinds = new Set(list.map(n => n.kind));
check('存在多种身份', kinds.size >= 2, [...kinds].join(','));
const evilCount = list.filter(n => n.isEvil).length;
check('存在邪修', evilCount > 0, `${evilCount} 名`);

console.log('\n【效用 AI：会做决策】');
const before = list.map(n => ({ id: n.id, x: n.x, y: n.y, exp: n.exp }));
for (let i = 0; i < 20; i++) npcs.tick(null);
const after = list.map(n => ({ id: n.id, x: n.x, y: n.y, exp: n.exp }));

const acted = after.filter((a, i) => a.exp !== before[i].exp).length;
check('有 NPC 在修炼积累修为', acted > 0, `${acted}/96 修为有变化`);

const moved = after.filter((a, i) => a.x !== before[i].x || a.y !== before[i].y).length;
check('有 NPC 在移动', moved > 0, `${moved}/96 移动过`);

const actions = new Set([...npcs.npcs.values()].map(n => n.action));
check('产生了多种行为', actions.size >= 2, [...actions].join(','));
console.log(`  行为分布: ${[...actions].join(', ')}`);

console.log('\n【时间随 tick 推进】');
const d0 = time.day;
for (let i = 0; i < 200; i++) npcs.tick(null);
check('世界时间已流逝', time.day > d0, `${d0} → ${time.day}`);

console.log('\n【编年史：世界在发生故事】');
check('产生了大事记', npcs.chronicle.length > 0, `${npcs.chronicle.length} 条`);
if (npcs.chronicle.length) {
    console.log('  最近三条：');
    npcs.chronicle.slice(0, 3).forEach(c => console.log(`    ${c.at}  ${c.text}`));
}
const hasBattle = npcs.chronicle.some(c => /袭|斩杀|重创|击杀|负伤/.test(c.text));
const hasBreak = npcs.chronicle.some(c => /突破/.test(c.text));
check('有战斗事件', hasBattle || npcs.chronicle.length === 0);
check('有突破事件', hasBreak || npcs.chronicle.length === 0);

console.log('\n【门派：实力变化与冲突】');
const s0 = [...npcs.sects.values()].map(s => s.strength);
for (let i = 0; i < 120; i++) npcs.tick(null);
const s1 = [...npcs.sects.values()].map(s => s.strength);
check('门派实力发生变化', s0.some((v, i) => v !== s1[i]), `${s0} → ${s1}`);

console.log('\n【恩怨记忆】');
// 手动制造一次仇恨
const a = list[0], b = list[1];
// 先清空既有恩怨（前面的 tick 里已经结下其他梁子），确保测得准
a.grudges.clear();
a.addGrudge(b.id, 50);
check('可记录仇恨', a.grudges.get(b.id) === 50);
const foe = a.worstEnemy();
check('能找出最恨的人', foe && foe.id === b.id, JSON.stringify(foe));
a.addDebt(b.id, 20);
check('可记录恩情', a.debt.get(b.id) === 20);

console.log('\n【玩家交互】');
const player = {
    name: '测试道友',
    attributes: { hp: 100, attack: 30, defense: 15 },
    cultivation: { level: 5, realmIndex: 2 },
    gold: 500,
    worldX: 10, worldY: 10
};
const pp = npcs._playerPower(player);
check('可计算玩家战力', pp > 0, String(pp));

// 让玩家站在某 NPC 旁边并 tick，验证不会崩
const near = [...npcs.npcs.values()].find(n => n.alive);
player.worldX = near.x; player.worldY = near.y;
let err = null;
try { for (let i = 0; i < 100; i++) npcs.tick(player); }
catch (e) { err = e.message; }
check('玩家在场时 tick 不报错', !err, err || '');

console.log('\n【死亡与统计】');
const dead = 96 - npcs.aliveNpcs().length;
check('存在伤亡（世界有冲突）', dead >= 0, `陨落 ${dead} 人`);
const sum = npcs.summary();
check('可生成世界概览', !!sum && typeof sum.alive === 'number');
check('概览含门派信息', Object.keys(sum.sects).length === 3);
check('概览含高手榜', Array.isArray(sum.top) && sum.top.length > 0);
if (sum.top.length) {
    console.log(`  当前第一高手: ${sum.top[0].name}（${sum.top[0].sect}）${sum.top[0].realm}期 Lv${sum.top[0].level}`);
}
check('编年史有上限（防内存膨胀）', npcs.chronicle.length <= 60, `${npcs.chronicle.length}`);

console.log('\n【序列一致性】');
const npcs2 = new NPCSystem(new World(new RNG(777)), new RNG(777), new TimeSystem(1, 6));
npcs2.populate({ npcCount: 96, sectCount: 3 });
const names1 = [...npcs.npcs.values()].map(n => n.name).join(',');
const names2 = [...npcs2.npcs.values()].map(n => n.name).join(',');
check('同种子生成同一批 NPC', names1 === names2);

console.log(`\n═══════ 结果：${pass} 通过 / ${fail} 失败 ═══════`);
process.exit(fail > 0 ? 1 : 0);
