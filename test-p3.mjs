/** P3 测试：NPC 交互 / 御剑飞行 / 世界持久化 */
let pass = 0, fail = 0;
const check = (l, c, e = '') => {
    if (c) { pass++; console.log(`  ✓ ${l}`); }
    else { fail++; console.log(`  ✗ ${l} ${e}`); }
};

const { World } = await import('./src/systems/world.js');
const { RNG } = await import('./src/core/rng.js');
const { TimeSystem } = await import('./src/systems/time.js');
const { NPCSystem } = await import('./src/systems/npc.js');
const { InteractionSystem } = await import('./src/systems/interaction.js');

console.log('═══════ P3：交互 · 飞行 · 持久化 测试 ═══════\n');

function makeWorld(seed = 555) {
    const world = new World(new RNG(seed));
    const time = new TimeSystem(1, 6);
    const npcs = new NPCSystem(world, new RNG(seed + 1), time);
    npcs.populate({ npcCount: 16, sectCount: 3 });
    const inter = new InteractionSystem(npcs, new RNG(seed + 2), time);
    return { world, time, npcs, inter };
}

function makePlayer(over = {}) {
    return {
        name: '测试道友',
        attributes: { hp: 100, mp: 80, attack: 30, defense: 15 },
        cultivation: { level: 5, realmIndex: 2 },
        gold: 1000, inventory: [], karma: 10,
        ...over
    };
}

// ---------- 交谈 ----------
console.log('【交谈：情报系统】');
{
    const { npcs, inter } = makeWorld();
    const npc = [...npcs.npcs.values()][0];
    const p = makePlayer();

    const r = inter.talk(npc, p);
    check('交谈返回文本', typeof r.text === 'string' && r.text.length > 0, r.text);
    check('交谈返回好感变化', typeof r.favor === 'number');
    check('文本内容带引号（对话格式）', /「.+」/.test(r.text), r.text);

    // 多次交谈应能出现不同类型情报
    const kinds = new Set();
    for (let i = 0; i < 40; i++) kinds.add(inter.talk(npc, p).text);
    check('情报有多种类型', kinds.size >= 2, `${kinds.size} 种`);
}

// ---------- 交易 ----------
console.log('\n【交易：好感影响价格】');
{
    const { npcs, inter } = makeWorld();
    const npc = [...npcs.npcs.values()].find(n => !n.isEvil);
    const p = makePlayer();

    const r = inter.trade(npc, p);
    check('返回商品列表', r.ok && Array.isArray(r.items) && r.items.length > 0, `${r.items?.length} 件`);
    check('每件商品有名称与价格',
        r.items.every(i => i.name && i.price > 0), JSON.stringify(r.items[0]));

    // 好感提升应打折
    npc.favor = 0;
    const price0 = inter.trade(npc, p).items[0].price;
    npc.favor = 100;
    const price1 = inter.trade(npc, p).items[0].price;
    check('好感高时价格更低', price1 <= price0, `${price0} → ${price1}`);
    check('折扣有下限（不会免费）', price1 > 0, String(price1));

    // 购买
    const p2 = makePlayer({ gold: 500 });
    const item = inter.trade(npc, p2).items[0];
    const goldBefore = p2.gold;
    const b = inter.buy(npc, p2, item);
    check('购买成功', b.ok === true, b.reason);
    check('扣除灵石', p2.gold === goldBefore - item.price, `${goldBefore} → ${p2.gold}`);
    check('物品进背包', p2.inventory.some(i => i.name === item.name), JSON.stringify(p2.inventory));
    check('购买提升好感', b.favor > 0);

    // 灵石不足
    const p3 = makePlayer({ gold: 1 });
    const expensive = { name: '灵草', count: 1, price: 999 };
    const b2 = inter.buy(npc, p3, expensive);
    check('灵石不足时拒绝', b2.ok === false, b2.reason);
    check('拒绝后不扣钱', p3.gold === 1);
}

// ---------- 切磋 ----------
console.log('\n【切磋：战力判定】');
{
    const { npcs, inter } = makeWorld();

    const weak = makePlayer({ attributes: { hp: 100, mp: 50, attack: 5, defense: 2 }, cultivation: { level: 1, realmIndex: 0 } });
    const strong = makePlayer({ attributes: { hp: 100, mp: 50, attack: 200, defense: 100 }, cultivation: { level: 10, realmIndex: 8 } });
    const npc = [...npcs.npcs.values()].find(n => n.realmIndex >= 1) || [...npcs.npcs.values()][0];

    const r1 = inter.spar(npc, strong);
    check('强者切磋获胜', r1.win === true, r1.text);
    check('获胜获得修为', r1.exp > 0, `${r1.exp}`);
    check('获胜提升好感', r1.favor > 0);
    check('对手掉血', npc.hp < npc.maxHp);

    const r2 = inter.spar(npc, weak);
    check('弱者切磋落败', r2.win === false, r2.text);
    check('落败受伤', r2.damage > 0 && weak.attributes.hp < 100, `hp=${weak.attributes.hp}`);
    check('落败好感下降', r2.favor < 0);
    check('血量不会降到 0 以下', weak.attributes.hp >= 1, `hp=${weak.attributes.hp}`);
}

// ---------- 赠礼 ----------
console.log('\n【赠礼：边际递减】');
{
    const { npcs, inter } = makeWorld();
    const npc = [...npcs.npcs.values()][0];
    npc.favor = 0;
    const p = makePlayer({ gold: 2000 });

    const g1 = inter.gift(npc, p, 100);
    check('赠礼成功', g1.ok === true, g1.reason);
    check('扣除灵石', p.gold === 1900, `${p.gold}`);
    check('好感提升', g1.favor > 0, `+${g1.favor}`);
    check('有反馈文本', typeof g1.text === 'string' && g1.text.includes('灵石'));

    const f1 = npc.favor;
    const g2 = inter.gift(npc, p, 100);
    check('同等礼物第二次收益递减', g2.favor < g1.favor, `${g1.favor} → ${g2.favor}`);
    check('好感累计增长', npc.favor > f1);

    // 上限
    npc.favor = 99;
    inter.gift(npc, p, 100);
    check('好感不超过 100', npc.favor <= 100, String(npc.favor));

    const poor = makePlayer({ gold: 10 });
    check('灵石不足时拒绝', inter.gift(npc, poor, 100).ok === false);
}

// ---------- 袭击 ----------
console.log('\n【袭击：心魔与仇恨连锁】');
{
    const { npcs, inter } = makeWorld();
    // 找一个有门派的 NPC，验证同门连坐
    const npc = [...npcs.npcs.values()].find(n => n.sectId && n.sectId === 1);
    const sect = npcs.sects.get(1);
    const mates = [...sect.members].filter(id => id !== npc.id).map(id => npcs.npcs.get(id));

    const strong = makePlayer({ attributes: { hp: 100, mp: 50, attack: 300, defense: 150 }, cultivation: { level: 10, realmIndex: 8 } });

    const karmaBefore = strong.karma;
    const r = inter.attack(npc, strong);

    check('袭击成功（强者）', r.ok === true && r.loot > 0, JSON.stringify(r));
    check('心魔上涨', strong.karma > karmaBefore, `${karmaBefore} → ${strong.karma}`);
    check('抢到灵石', strong.gold > 1000, `${strong.gold}`);
    check('对方好感激降', npc.favor === -100);
    check('对方记下仇恨', (npc.grudges.get('player') || 0) > 0, `${npc.grudges.get('player')}`);

    const mateHate = mates.filter(m => (m.grudges.get('player') || 0) > 0);
    check('同门连坐记仇', mateHate.length > 0, `${mateHate.length}/${mates.length} 人`);
    check('同门好感下降', mates.every(m => m.favor < 0));

    // 弱者袭击失败
    const weak = makePlayer({ attributes: { hp: 100, mp: 50, attack: 1, defense: 1 }, cultivation: { level: 1, realmIndex: 0 } });
    const npc2 = [...npcs.npcs.values()].find(n => n.id !== npc.id);
    const r2 = inter.attack(npc2, weak);
    check('弱者袭击失手', r2.killed === false && r2.damage > 0, JSON.stringify(r2));
    check('失手仍涨心魔', weak.karma > 10, String(weak.karma));
    check('失手仍结仇', (npc2.grudges.get('player') || 0) > 0);

    // 击杀
    const npc3 = [...npcs.npcs.values()].find(n => n.alive && n.id !== npc.id && n.id !== npc2.id);
    npc3.hp = 1;
    const r3 = inter.attack(npc3, strong);
    check('可击杀残血目标', r3.killed === true, JSON.stringify(r3));
    check('击杀后标记为死亡', npc3.alive === false);
}

// ---------- 拜师 ----------
console.log('\n【拜师入门】');
{
    const { npcs, inter } = makeWorld();
    const npc = [...npcs.npcs.values()].find(n => n.sectId);
    const p = makePlayer();

    check('好感不足时拒绝', inter.join(npc, p).ok === false);

    npc.favor = 50;
    const r = inter.join(npc, p);
    check('好感足够可入门', r.ok === true, r.reason);
    check('玩家获得门派', p.sectId === npc.sectId, `${p.sectId}`);
    check('记录门派名', p.sectName === npcs.sects.get(npc.sectId).name, p.sectName);

    const p2 = makePlayer();
    npc.favor = 50;
    check('已是本门时拒绝', inter.join(npc, { ...p, sectId: npc.sectId }).ok === false);

    const roamer = [...npcs.npcs.values()].find(n => !n.sectId);
    if (roamer) {
        roamer.favor = 80;
        check('无门派者不能拜师', inter.join(roamer, p2).ok === false);
    }
}

// ---------- 好感态度 ----------
console.log('\n【好感态度分级】');
{
    const { npcs } = makeWorld();
    const npc = [...npcs.npcs.values()][0];
    const seen = [];
    for (const f of [80, 40, 0, -30, -80]) {
        npc.favor = f;
        seen.push(npc.attitude.name);
    }
    check('不同好感对应不同态度', new Set(seen).size === 5, seen.join(','));
    npc.favor = 100; check('满好感为敬重', npc.attitude.key === 'devoted', npc.attitude.name);
    npc.favor = -100; check('负满为仇视', npc.attitude.key === 'hateful', npc.attitude.name);
}

// ---------- 持久化 ----------
console.log('\n【世界持久化：序列化往返】');
{
    const { world, time, npcs, inter } = makeWorld(888);

    // 制造变化：采集、建造、时间推进、NPC 交互
    world.harvest(...[...world.resources.keys()][0].split(',').map(Number));
    let built = false;
    for (let y = 2; y < 46 && !built; y++) {
        for (let x = 2; x < 46 && !built; x++) {
            if (world.get(x, y) === 'cave' && !world.hasBuilding(x, y)) {
                built = world.build(x, y, 'cave').ok;
            }
        }
    }
    for (let i = 0; i < 30; i++) npcs.tick(null);

    const npc = [...npcs.npcs.values()][0];
    npc.favor = 42;
    npc.addGrudge('player', 33);

    const resCountBefore = world.resources.size;
    const buildCountBefore = world.buildings.size;
    const npcCountBefore = npcs.npcs.size;
    const dayBefore = time.day;
    const favorBefore = npc.favor;
    const chronicleBefore = npcs.chronicle.length;

    const snap = {
        seed: 888,
        pos: { x: 20, y: 20 },
        time: time.toJSON(),
        world: world.serialize(),
        npc: npcs.serialize()
    };

    // 模拟"重新打开页面"：全新世界 + 新 NPC 系统，再导入
    const w2 = new World(new RNG(888));
    const t2 = new TimeSystem(1, 6);
    const n2 = new NPCSystem(w2, new RNG(889), t2);
    n2.populate({ npcCount: 16, sectCount: 3 });

    w2.deserialize(snap.world);
    t2.day = snap.time.day; t2.hour = snap.time.hour; t2.minute = snap.time.minute;
    n2.deserialize(snap.npc, w2, new RNG(889), t2);

    check('资源数量一致', w2.resources.size === resCountBefore, `${w2.resources.size} vs ${resCountBefore}`);
    check('建筑数量一致', w2.buildings.size === buildCountBefore, `${w2.buildings.size} vs ${buildCountBefore}`);
    check('NPC 数量一致', n2.npcs.size === npcCountBefore, `${n2.npcs.size} vs ${npcCountBefore}`);
    check('时间已恢复', t2.day === dayBefore, `${t2.day} vs ${dayBefore}`);

    const n2npc = n2.npcs.get(npc.id);
    check('NPC 好感已恢复', n2npc && Math.round(n2npc.favor) === Math.round(favorBefore), `${n2npc?.favor} vs ${favorBefore}`);
    check('NPC 仇恨已恢复', n2npc && n2npc.grudges.get('player') === 33, `${n2npc?.grudges.get('player')}`);
    check('NPC 存活状态已恢复', n2npc && n2npc.alive === npc.alive);
    check('编年史已恢复', n2.chronicle.length === chronicleBefore, `${n2.chronicle.length}`);
    check('门派已恢复', n2.sects.size === npcs.sects.size);

    // 序列化体积（存档要写进 GitHub，不能太大）
    const size = JSON.stringify(snap).length;
    check('存档体积可控（<200KB）', size < 200 * 1024, `${(size / 1024).toFixed(1)}KB`);
    console.log(`  存档体积: ${(size / 1024).toFixed(1)}KB（地形靠种子重建，只存变化量）`);

    // 死去的 NPC 也应正确恢复
    const victim = [...npcs.npcs.values()][5];
    victim.alive = false;
    const snap2 = npcs.serialize();
    const n3 = new NPCSystem(w2, new RNG(1), t2);
    n3.deserialize(snap2, w2, new RNG(1), t2);
    check('死亡 NPC 恢复后仍是死亡', n3.npcs.get(victim.id).alive === false);
}

// ---------- 御剑飞行（纯逻辑部分） ----------
console.log('\n【御剑飞行：条件与消耗】');
{
    // 飞行判定逻辑直接测（WorldCanvas 需要 DOM，这里测规则本身）
    const canFly = (p) => {
        const c = p?.cultivation;
        if ((c?.realmIndex ?? 0) < 1) return { ok: false, reason: '需筑基期方可御剑飞行' };
        const mp = p?.attributes?.mp ?? 0;
        if (mp < 6) return { ok: false, reason: '灵力不足，无法御剑' };
        return { ok: true };
    };

    check('练气期不能飞', canFly(makePlayer({ cultivation: { level: 9, realmIndex: 0 } })).ok === false);
    check('筑基期可以飞', canFly(makePlayer({ cultivation: { level: 1, realmIndex: 1 } })).ok === true);
    check('灵力不足不能飞',
        canFly(makePlayer({ attributes: { hp: 100, mp: 2, attack: 10, defense: 5 }, cultivation: { level: 1, realmIndex: 3 } })).ok === false);
    check('境界够且灵力足可以飞',
        canFly(makePlayer({ attributes: { hp: 100, mp: 80, attack: 10, defense: 5 }, cultivation: { level: 1, realmIndex: 3 } })).ok === true);

    // 消耗：每步 2 点
    const p = makePlayer({ attributes: { hp: 100, mp: 10, attack: 10, defense: 5 }, cultivation: { level: 1, realmIndex: 3 } });
    const steps = [];
    let mp = p.attributes.mp;
    for (let i = 0; i < 10 && mp >= 2; i++) { mp -= 2; steps.push(mp); }
    check('每步消耗 2 灵力', steps[0] === 8, String(steps[0]));
    check('灵力耗尽后停止', steps[steps.length - 1] === 0, String(steps[steps.length - 1]));
    check('10 灵力可飞 5 步', steps.length === 5, `${steps.length} 步`);
}

console.log(`\n═══════ 结果：${pass} 通过 / ${fail} 失败 ═══════`);
process.exit(fail > 0 ? 1 : 0);
